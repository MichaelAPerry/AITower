import { loadContent } from "@aitower/content";
import { createSim, TICKS_PER_DAY } from "@aitower/sim";
import { AUTO_ACCEPT_MARGIN, bestMemoChoice, managePolicy, shouldAccept } from "./run";
const [scn = "starter", days = "20", seed = "1", mode = "auto"] = process.argv.slice(2);
const content = loadContent();
const auto = mode === "auto";
const sim = createSim(content, scn, Number(seed));
const seen = new Set<string>();
const tally: Record<string, { n: number; sum: number }> = {};
const dayRows: string[] = [];
for (let d = 0; d < Number(days); d++) {
	for (let t = 0; t < TICKS_PER_DAY; t++) {
		const events = sim.step();
		for (const e of events) {
			if (e.type === "contractOffered") {
				const v = sim.view();
				const o = v.offers.find((x) => x.id === e.contractId);
				if (o && shouldAccept(o, v, content, auto ? AUTO_ACCEPT_MARGIN : 0.75)) sim.submit({ type: "acceptContract", contractId: e.contractId });
			} else if (e.type === "memoIssued") {
				const c = bestMemoChoice(content, e.eventId);
				if (c) sim.submit({ type: "resolveMemo", memoId: e.memoId, choiceId: c });
			}
		}
		if (t % 60 === 30) managePolicy(sim, content, auto);
		for (const l of sim.view().standingLog) {
			const k = `${l.tick}|${l.cause}|${l.detail}`;
			if (seen.has(k)) continue;
			seen.add(k);
			(tally[l.cause] ??= { n: 0, sum: 0 }).n++;
			tally[l.cause].sum += l.delta;
		}
	}
	const v = sim.view();
	dayRows.push(`d${d} tier${v.tier} up=${(v.uptime * 100).toFixed(1)}% tgt=${v.uptimeTarget} stand=${v.standing} pf=${v.pflops.toFixed(0)} racks=${v.facilities.filter((f) => f.defId.startsWith("rack")).length} cash=${Math.round(v.cash / 1e6)}M`);
}
console.log(dayRows.join("\n"));
console.log(JSON.stringify(tally));
const failed = sim.view().jobs.filter((j) => j.status === "failed").length;
console.log("failed jobs shown:", failed, "gameOver", JSON.stringify(sim.view().gameOver));
