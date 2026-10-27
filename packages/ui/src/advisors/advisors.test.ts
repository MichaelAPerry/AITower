import { loadContent } from "@aitower/content";
import type { DecisionView, SimView } from "@aitower/sim";
import { describe, expect, it } from "vitest";
import { fmtMoney } from "../format";
import { ADVISORS, ADVISOR_ORDER, advisorOfLane, cashCost, choiceChipList, parseMarkup, plainText, priceLine, tally } from "./advisors";
import { TIP_GAP_MS, TIP_SHOW_MS, answerFor, nextTip, pitches, tipCandidates } from "./talk";

const content = loadContent();
const rack = (id: number, status = "ok", extra: Record<string, unknown> = {}) => ({ id, defId: "rack_air_gpu", floor: 1, x: id * 3, status, enabled: true, tempC: 40, ...extra });
function view(p: Partial<Record<keyof SimView, unknown>> = {}): SimView {
	return {
		tick: 3000,
		cash: 5_000_000,
		tier: 1,
		sandbox: false,
		spareParts: 3,
		jobs: [],
		offers: [],
		bots: [],
		lifts: [],
		powerNets: [],
		techResearched: [],
		researchPoints: 0,
		standingLog: [],
		standing: 50,
		uptime: 1,
		uptimeTarget: 0.95,
		totalKw: 100,
		pflops: 40,
		loan: { principal: 0, max: 0, dailyRate: 0 },
		facilities: [rack(1), rack(2)],
		...p,
	} as unknown as SimView;
}

/** A view where the node is available and affordable: every prerequisite done, enough points, tier high enough. */
function ready(techId: string): SimView {
	const done = new Set<string>();
	const walk = (id: string): void => {
		for (const r of content.tech.find((t) => t.id === id)?.requires ?? []) {
			done.add(r);
			walk(r);
		}
	};
	walk(techId);
	const node = content.tech.find((t) => t.id === techId);
	return view({ tier: node?.minTier ?? 1, techResearched: [...done], researchPoints: (node?.cost ?? 0) + 50 });
}

describe("advisor text", () => {
	it("splits {{term|label}} markers and reduces to plain text", () => {
		expect(parseMarkup("a {{ups|UPS}} b {{kw}}")).toEqual([{ text: "a " }, { term: "ups", text: "UPS" }, { text: " b " }, { term: "kw", text: "kw" }]);
		expect(plainText("a {{ups|UPS}} b")).toBe("a UPS b");
	});
	it("names four distinct advisors with distinct colours, and lanes.json agrees with the names", () => {
		expect(new Set(ADVISOR_ORDER.map((a) => ADVISORS[a].color)).size).toBe(4);
		expect(ADVISORS.cass.name).toBe("Cass Parr");
		for (const l of content.lanes ?? []) if (l.advisor) expect(advisorOfLane(l.advisor), l.id).toBeDefined();
	});
	it("every tip and answer text number-first terms are real glossary ids", async () => {
		const { termById } = await import("../glossary/terms");
		const v = ready("cold_plate_gen3");
		const all = [...tipCandidates(v, content), ...ADVISOR_ORDER.flatMap((a) => answerFor(a, v, content).lines)];
		for (const l of all) for (const g of parseMarkup(l.text)) if ("term" in g) expect(termById(g.term), `${l.id}: ${g.term}`).toBeDefined();
	});
});

describe("tips fire once per concept", () => {
	it("a hot rack makes Cass speak, number first, with a Handbook link; once it has fired it is not offered again", () => {
		const v = view({ facilities: [rack(1, "throttled", { tempC: 86 })] });
		const c = tipCandidates(v, content, new Set([1]));
		expect(c[0]).toMatchObject({ id: "hot", advisor: "cass" });
		expect(c[0].text).toMatch(/^86 °C/);
		expect(c[0].links[0].entry).toBe("ch:heat");
		expect(nextTip(c, new Set(), null)?.id).toBe("hot");
		expect(nextTip(c, new Set(["hot"]), null)).toBeNull();
		expect(nextTip(c, new Set(), "hot")).toBeNull(); // never the one already on screen
	});
	it("one tip at a time: nextTip returns a single line, in ranking order", () => {
		const v = view({ facilities: [rack(1, "throttled", { tempC: 86 }), rack(2, "idle")], offers: [{ id: 1 }], uptime: 0.5, powerNets: [{ satisfaction: 0.6 }] });
		const c = tipCandidates(v, content, new Set([1]));
		const fired = new Set<string>();
		const order: string[] = [];
		for (let i = 0; i < 6; i++) {
			const t = nextTip(c, fired, null);
			if (!t) break;
			order.push(t.id);
			fired.add(t.id);
		}
		expect(order[0]).toBe("hot");
		expect(new Set(order).size).toBe(order.length);
	});
	it("pacing: a tip shows about 20 real seconds, then waits a gap", () => {
		expect(TIP_SHOW_MS).toBe(20_000);
		expect(TIP_GAP_MS).toBeGreaterThanOrEqual(5_000);
	});
});

describe("advisors argue with live numbers", () => {
	it("when a better rack is available and affordable, its advisor compares the slot", () => {
		const v = ready("cold_plate_gen3");
		const p = pitches(v, content).find((x) => x.id === "pitch:cold_plate_gen3");
		expect(p?.advisor).toBe("mel"); // the Compute lane's advisor, as the research tree says: "Same floor, more output."
		expect(p?.text).toContain("Retrofit a rack to LC-3 and it gives 230 PF in the slot LC-2 gives 130"); // the best rack this floor can have in that slot
		expect(plainText(p?.text ?? "")).toMatch(/RP; you hold/);
		expect(p?.action).toMatchObject({ kind: "research", techId: "cold_plate_gen3" });
	});
	it("the pitching advisor is the one data/lanes.json gives the node's lane", () => {
		for (const node of content.tech) {
			const lane = content.lanes?.find((l) => l.id === node.lane);
			const p = pitches(ready(node.id), content).find((x) => x.id === `pitch:${node.id}`);
			if (p && lane?.advisor) expect(ADVISORS[p.advisor].name, node.id).toBe(lane.advisor);
		}
	});
	it("not available or not affordable means no pitch", () => {
		expect(pitches(view(), content)).toEqual([]);
		const poor = { ...ready("cold_plate_gen3"), researchPoints: 1 } as SimView;
		expect(pitches(poor, content).find((x) => x.id === "pitch:cold_plate_gen3")).toBeUndefined();
	});
	it("wetware racks are pitched by Mel with power per kW", () => {
		const v = ready("wetware_annex"); // Rung 1 of the Flesh: the OC-1 Organoid Cabinet
		const p = pitches(v, content).find((x) => x.id === "pitch:wetware_annex");
		expect(p?.advisor).toBe("mel");
		expect(p?.text).toMatch(/PF per/);
	});
});

describe("Ask: a ranked answer from one advisor", () => {
	it("Cass lists her open problem first, then live status and the cooling comparison", () => {
		const v = view({ facilities: [rack(1, "throttled", { tempC: 86 })] });
		const a = answerFor("cass", v, content, new Set([1]));
		expect(a.lines[0].id).toBe("hot");
		expect(a.lines.some((l) => l.id === "ask:cass")).toBe(true);
		expect(a.lines.some((l) => l.id === "compare:cooling")).toBe(true);
		expect(a.lines.length).toBeLessThanOrEqual(4);
		for (const l of a.lines) expect(l.advisor).toBe("cass");
	});
	it("Mel answers why wetware over racks with PF per kW from the content, and every advisor always has something to say", () => {
		const a = answerFor("mel", view({ tier: 3 }), content);
		expect(a.lines.find((l) => l.id === "compare:wetware")?.text).toMatch(/OC-\d tissue gives .* PF per/);
		for (const id of ADVISOR_ORDER) expect(answerFor(id, view(), content).lines.length).toBeGreaterThan(0);
	});
});

describe("decision helpers: effects, price and MAGI vote", () => {
	const ev = content.events.find((e) => e.id === "heatwave");
	const decision = (): DecisionView => {
		if (!ev) throw new Error("heatwave missing");
		return { id: 1, eventId: ev.id, advisor: ev.advisor, category: ev.category, title: ev.title, body: ev.body, choices: ev.choices.map((c) => ({ id: c.id, label: c.label, hint: c.hint })), recommended: ev.recommended, votes: ev.votes, issuedAt: 0, canDefer: true };
	};
	it("the price line names what the recommended option costs and sets it against the alternative", () => {
		const line = priceLine(content, decision(), fmtMoney);
		expect(line).toContain("costs $90k");
		expect(line).toContain("costs nothing now");
	});
	it("the tally counts approvals of the recommended option", () => {
		expect(tally([{ approve: true }, { approve: true }, { approve: false }]).text).toBe("2 to 1 for");
		expect(tally([{ approve: false }, { approve: false }, { approve: true }]).text).toBe("1 to 2 against");
	});
	it("a multi-area decision carries Cass, Bea and Mel votes in that order; single-area ones carry none", () => {
		expect(decision().votes?.map((v) => v.advisor)).toEqual(["cass", "bea", "mel"]);
		expect(content.events.find((e) => e.id === "energy_levy")?.votes).toBeUndefined();
	});
	it("effect chips show money, durations and affinity pills", () => {
		const e = content.events.find((x) => x.id === "brownout");
		const chips = choiceChipList(e?.choices[0].effects ?? []);
		expect(chips.map((c) => c.text)).toEqual(expect.arrayContaining(["−$100k", "grid ×0.8 · 8h", "Garden +3"]));
		expect(chips.find((c) => c.path)?.path).toBe("greentech");
		expect(cashCost(e?.choices[0].effects ?? [])).toBe(100000);
	});
});
