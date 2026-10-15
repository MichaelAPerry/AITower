/**
 * Headless runner. Player policy: accept an offer only when idle capacity can serve it (see
 * `shouldAccept`); when work orders are waiting and no spare parts are left, buy 2.
 * Collects per-day metrics. Pure (no I/O).
 */
import type { ContentDB } from "@aitower/content";
import { type ContractView, createSim, type SimView, TICKS_PER_DAY } from "@aitower/sim";

/** Accept only work that the currently idle, healthy racks can finish comfortably. */
export function shouldAccept(offer: ContractView, v: SimView, content: ContentDB): boolean {
	if (v.jobs.some((j) => j.status === "queued" || j.status === "stalled")) return false;
	let freePflops = 0;
	let storageTB = 0;
	for (const f of v.facilities) {
		const spec = content.facilities[f.defId]?.rack;
		if (!spec) continue;
		storageTB += spec.storageTB;
		if (f.jobId !== null || f.status === "failed" || f.status === "tripped" || !f.enabled) continue;
		if (offer.needsLiquid && spec.cooling === "air") continue;
		freePflops += spec.pflops;
	}
	if (offer.storageTB > storageTB) return false;
	if (offer.kind === "inference") return (offer.sustainedPflops ?? offer.work) <= freePflops * 0.9;
	if (freePflops <= 0) return false;
	const hoursNeeded = offer.work / freePflops;
	return hoursNeeded * 60 <= offer.durationTicks * 0.75;
}


export interface DayRow {
	day: number;
	cash: number;
	revenue: number;
	energy: number;
	penalties: number;
	pue: number;
	uptime: number;
	/** Mean delivered PFLOPS over the day. */
	pflops: number;
	maxRackC: number;
	failures: number;
	tier: number;
}

export interface RunResult {
	rows: DayRow[];
	hash: string;
}

export function runHeadless(content: ContentDB, scenarioId: string, days: number, seed: number): RunResult {
	const sim = createSim(content, scenarioId, seed);
	const rackIds = new Set(Object.values(content.facilities).filter((d) => d.kind === "rack").map((d) => d.id));
	const rows: DayRow[] = [];
	for (let day = 0; day < days; day++) {
		let failures = 0;
		let pflopsSum = 0;
		let maxRackC = Number.NEGATIVE_INFINITY;
		for (let t = 0; t < TICKS_PER_DAY; t++) {
			const events = sim.step();
			for (const e of events) {
				if (e.type === "contractOffered") {
					const v = sim.view();
					const offer = v.offers.find((o) => o.id === e.contractId);
					if (offer && shouldAccept(offer, v, content)) sim.submit({ type: "acceptContract", contractId: e.contractId });
				}
				else if (e.type === "componentFailed") failures++;
			}
			const v = sim.view();
			if (v.spareParts === 0 && v.workOrders.length > 0 && t % 60 === 0) sim.submit({ type: "buyParts", count: 2 });
			pflopsSum += v.pflops;
			for (const f of v.facilities) if (rackIds.has(f.defId) && f.tempC > maxRackC) maxRackC = f.tempC;
		}
		const v = sim.view();
		// After the day rolls over, the closed day is the second-to-last ledger entry.
		const closed = v.ledger[v.ledger.length - 2] ?? v.ledger[v.ledger.length - 1];
		rows.push({
			day,
			cash: v.cash,
			revenue: closed.revenue,
			energy: closed.energy,
			penalties: closed.penalties,
			pue: v.pue,
			uptime: v.uptime,
			pflops: pflopsSum / TICKS_PER_DAY,
			maxRackC: Number.isFinite(maxRackC) ? maxRackC : Number.NaN,
			failures,
			tier: v.tier,
		});
	}
	return { rows, hash: sim.hash() };
}

const money = (n: number): string => `${n < 0 ? "-" : ""}$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;

export function formatTable(rows: DayRow[]): string {
	const head = ["day", "cash", "revenue", "energy", "penalties", "PUE", "uptime", "PFLOPS", "maxRackC", "fails", "tier"];
	const body = rows.map((r) => [
		String(r.day),
		money(r.cash),
		money(r.revenue),
		money(r.energy),
		money(r.penalties),
		r.pue.toFixed(2),
		`${(r.uptime * 100).toFixed(1)}%`,
		r.pflops.toFixed(1),
		Number.isNaN(r.maxRackC) ? "-" : r.maxRackC.toFixed(1),
		String(r.failures),
		String(r.tier),
	]);
	const widths = head.map((h, i) => Math.max(h.length, ...body.map((row) => row[i].length)));
	const line = (cells: string[]): string => cells.map((c, i) => c.padStart(widths[i])).join("  ");
	return [line(head), line(widths.map((w) => "-".repeat(w))), ...body.map(line)].join("\n");
}
