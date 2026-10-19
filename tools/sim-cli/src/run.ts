/**
 * Headless runner. Player policy: accept an offer only when idle capacity can serve it (see
 * `shouldAccept`); when work orders are waiting and no spare parts are left, buy 2; resolve each Ministry memo
 * with the choice of best cash outcome (`bestMemoChoice`).
 * Collects per-day metrics. Pure (no I/O).
 */
import type { ContentDB } from "@aitower/content";
import { type ClerkPolicy, type ContractView, createSim, type Sim, type SimView, TICKS_PER_DAY } from "@aitower/sim";

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


/** Auto-player memo policy: the choice with the best direct cash outcome (ties: better standing, then first listed). */
export function bestMemoChoice(content: ContentDB, eventId: string): string | null {
	const def = content.events.find((e) => e.id === eventId);
	if (!def) return null;
	let best: { id: string; cash: number; standing: number } | null = null;
	for (const c of def.choices) {
		let cash = 0;
		let standing = 0;
		for (const e of c.effects) {
			if (e.type === "cash") cash += e.amount;
			else if (e.type === "standing") standing += e.amount;
		}
		if (!best || cash > best.cash || (cash === best.cash && standing > best.standing)) best = { id: c.id, cash, standing };
	}
	return best?.id ?? null;
}

/** Permissive clerk standing order: any kind, any pay, any penalty, liquid included. */
export const PERMISSIVE_CLERK: ClerkPolicy = { enabled: true, kinds: ["training", "finetune", "inference"], minPayPerPflopHour: 0, maxPenalty: 0, allowLiquid: true };

/** The next tech to research: the clerk node first, then the cheapest researchable node (prerequisites met, clearance reached). */
export function nextTech(content: ContentDB, v: SimView): string | null {
	const done = new Set(v.techResearched);
	const open = content.tech.filter((t) => !done.has(t.id) && t.minTier <= v.tier && t.requires.every((r) => done.has(r)));
	const clerk = open.find((t) => t.effects.some((e) => e.type === "feature" && e.feature === "contractsClerk"));
	if (clerk) return clerk.id;
	if (!v.clerk.unlocked && content.tech.some((t) => t.effects.some((e) => e.type === "feature" && e.feature === "contractsClerk"))) {
		// Work toward the clerk: a missing prerequisite chain comes first (cheapest open node on the way is enough).
		const need = open.filter((t) => content.tech.some((c) => c.effects.some((e) => e.type === "feature") && c.requires.includes(t.id)));
		if (need.length > 0) return need.sort((a, b) => a.cost - b.cost)[0].id;
	}
	return open.sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id))[0]?.id ?? null;
}

/** Spend RP when the next node is affordable; switch the clerk on once it exists. */
export function managePolicy(sim: Sim, content: ContentDB): void {
	const v = sim.view();
	const id = nextTech(content, v);
	const node = id ? content.tech.find((t) => t.id === id) : undefined;
	if (node && v.researchPoints >= node.cost) sim.submit({ type: "research", techId: node.id });
	if (v.clerk.unlocked && !v.clerk.policy.enabled) sim.submit({ type: "setClerk", policy: PERMISSIVE_CLERK });
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
	standing: number;
	/** Unspent research points at the end of the day. */
	rp: number;
	/** Techs researched so far. */
	techs: number;
	/** Ministry levy charged on the day. */
	taxes: number;
	/** Memos issued so far. */
	memos: number;
	gameOver: string | null;
}

export interface RunResult {
	rows: DayRow[];
	hash: string;
}

export function runHeadless(content: ContentDB, scenarioId: string, days: number, seed: number): RunResult {
	const sim = createSim(content, scenarioId, seed);
	const rackIds = new Set(Object.values(content.facilities).filter((d) => d.kind === "rack").map((d) => d.id));
	const rows: DayRow[] = [];
	let memos = 0;
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
				else if (e.type === "memoIssued") {
					memos++;
					const choice = bestMemoChoice(content, e.eventId);
					if (choice) sim.submit({ type: "resolveMemo", memoId: e.memoId, choiceId: choice });
				}
			}
			const v = sim.view();
			if (v.spareParts === 0 && v.workOrders.length > 0 && t % 60 === 0) sim.submit({ type: "buyParts", count: 2 });
			if (t % 60 === 30) managePolicy(sim, content);
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
			standing: v.standing,
			rp: v.researchPoints,
			techs: v.techResearched.length,
			taxes: closed.taxes,
			memos,
			gameOver: v.gameOver?.kind ?? null,
		});
	}
	return { rows, hash: sim.hash() };
}

const money = (n: number): string => `${n < 0 ? "-" : ""}$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;

export function formatTable(rows: DayRow[]): string {
	const head = ["day", "cash", "revenue", "energy", "penalties", "PUE", "uptime", "PFLOPS", "maxRackC", "fails", "tier", "standing", "RP", "techs", "taxes", "memos", "over"];
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
		r.standing.toFixed(0),
		r.rp.toFixed(1),
		String(r.techs),
		money(r.taxes),
		String(r.memos),
		r.gameOver ?? "-",
	]);
	const widths = head.map((h, i) => Math.max(h.length, ...body.map((row) => row[i].length)));
	const line = (cells: string[]): string => cells.map((c, i) => c.padStart(widths[i])).join("  ");
	return [line(head), line(widths.map((w) => "-".repeat(w))), ...body.map(line)].join("\n");
}
