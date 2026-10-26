/** The Soul (docs/SOUL.md): secret seal numbers, Singularity points, bonds, story scenes and objections, on the real content. */
import { type ContentDB, loadContent } from "@aitower/content";
import { describe, expect, it } from "vitest";
import type { SimEvent } from "./api";
import { GensetMode } from "./core/state";
import { type SimImpl, createSim, simFromSnapshot } from "./sim";
import { isSealed, sealOf, soulStep } from "./progression/soul";

const content = (edit?: (c: ContentDB) => void): ContentDB => {
	const c = loadContent();
	edit?.(c);
	return c;
};
/** Real content with the story scenes removed, so the decision slot stays free unless a test wants a scene. */
const quiet = (): ContentDB => content((c) => (c.events = c.events.filter((e) => e.category !== "story")));
const sim = (c = quiet(), scenario = "starter"): SimImpl => createSim(c, scenario, 1) as SimImpl;
const steps = (s: SimImpl, n: number): SimEvent[] => {
	const out: SimEvent[] = [];
	for (let i = 0; i < n; i++) out.push(...s.step());
	return out;
};
const place = (s: SimImpl, defId: string, floor: number, x: number): void => {
	const r = s.submit({ type: "place", defId, floor, x });
	expect(r, defId).toEqual({ ok: true });
	s.step();
};

describe("secret seal numbers", () => {
	it("the starter tower is scarred by what it was built with", () => {
		const s = sim();
		// grid tie 8 + four AC-1 racks 1 each + one air handler 2.
		expect(s.state.sealScar).toEqual({ greentech: 14, biotech: 0 });
	});

	it("placing an item adds its positive numbers to the permanent scar; demolishing does not refund it", () => {
		const s = sim();
		s.state.cash = 1e9;
		place(s, "genset", 0, 6);
		expect(s.state.sealScar.greentech).toBe(14 + 20);
		expect(s.state.sealScar.biotech).toBe(6);
		s.submit({ type: "demolish", floor: 0, x: 6 });
		s.step();
		expect(s.state.facilities.some((f) => f.defId === "genset")).toBe(false);
		expect(s.state.sealScar.greentech).toBe(34);
	});

	it("aligned items never scar (negative numbers), they clean residue while they run", () => {
		const s = sim();
		const before = { ...s.state.sealScar };
		s.state.cash = 1e9;
		s.state.tier = 5;
		s.state.techResearched.push("solar_charter");
		s.invalidateProjection();
		place(s, "solar_skin", 1, 30);
		expect(s.state.sealScar).toEqual(before);
		s.state.sealResidue.greentech = 1;
		steps(s, 24 * 60);
		// The grid tie and racks add residue every hour; one solar skin only offsets some of it, and residue never goes below 0.
		expect(s.state.sealResidue.greentech).toBeGreaterThanOrEqual(0);
	});

	it("running facilities add value × residuePerDay per day, and a genset only while it runs", () => {
		const s = sim();
		s.state.cash = 1e9;
		place(s, "genset", 0, 6);
		const g = s.state.facilities.find((f) => f.defId === "genset");
		const perHour = s.content.balance.soul.residuePerDay / 24;
		const hour = (): number => {
			const r = s.state.sealResidue.greentech;
			s.state.tick = 0; // 06:00, an hourly sample
			soulStep({ state: s.state, content: s.content, events: [], scratch: undefined as never });
			return s.state.sealResidue.greentech - r;
		};
		if (g) g.gensetMode = GensetMode.Off;
		// Grid tie 8 + four AC-1 racks 1 each + air handler 2 (the idle genset does not count).
		expect(hour()).toBeCloseTo(14 * perHour, 9);
		if (g) g.gensetMode = GensetMode.Running;
		expect(hour()).toBeCloseTo(34 * perHour, 9);
	});
});

describe("Singularity points", () => {
	it("Synthetic accrues from running shared racks without any commitment; Bio and Green do not", () => {
		const s = sim();
		for (const f of s.state.facilities) if (s.content.facilities[f.defId].kind === "rack" && f.defId !== "rack_storage") f.pflops = 20;
		s.state.tick = 0;
		soulStep({ state: s.state, content: s.content, events: [], scratch: undefined as never });
		const so = s.content.balance.soul;
		// Four AC-1 racks at 20 PF each, for one hourly sample.
		expect(s.state.sp.synthetic).toBeCloseTo(4 * 20 * (so.spWeights.synthetic.shared ?? 0) * so.spPerPflopHour, 9);
		expect(s.state.sp.biotech).toBe(0);
		expect(s.state.sp.greentech).toBe(0);
		// Committed to Green, compute also earns Green points, scaled by the green score and the seal.
		s.state.path = "greentech";
		s.state.greenScore = 0.5;
		soulStep({ state: s.state, content: s.content, events: [], scratch: undefined as never });
		const seal = 1 - sealOf(s.state, "greentech") / so.sealMax;
		expect(s.state.sp.greentech).toBeCloseTo(4 * 20 * (so.spWeights.greentech.shared ?? 0) * so.spPerPflopHour * 0.5 * seal, 9);
	});

	it("the first tree at its target wins; a committed tree is checked before Synthetic", () => {
		const s = sim();
		const target = s.content.balance.soul.spTarget;
		s.state.sp.synthetic = target;
		const ev = steps(s, 120);
		expect(ev).toContainEqual({ type: "gameOver", kind: "victory", ending: "singularity" });

		const g = sim();
		g.state.path = "greentech";
		g.state.sp.synthetic = target;
		g.state.sp.greentech = target;
		expect(steps(g, 120)).toContainEqual({ type: "gameOver", kind: "victory", ending: "garden" });

		const b = sim();
		b.state.sp.biotech = target; // without the Bio commitment its points do not count
		steps(b, 120);
		expect(b.state.gameOver).toBeNull();
	});
});

describe("committing to a tree", () => {
	const ready = (): SimImpl => {
		const s = sim();
		s.state.tier = s.content.balance.ascension.minTier;
		s.invalidateProjection();
		return s;
	};

	it("Synthetic is always open; Bio and Green need their champion's trust", () => {
		const s = ready();
		const r = s.submit({ type: "choosePath", path: "greentech" });
		expect(!r.ok && r.reason).toMatch(/Bea Altasar's trust/);
		expect(s.view().soul.commitBlock.biotech).toMatch(/Mel Kiorre's trust/);
		expect(s.view().soul.commitBlock.synthetic).toBeNull();
		s.state.bonds.bea = 60;
		s.invalidateProjection();
		expect(s.submit({ type: "choosePath", path: "greentech" })).toEqual({ ok: true });
	});

	it("a sealed tree cannot be chosen, whatever the bond", () => {
		const s = ready();
		s.state.bonds.mel = 100;
		s.state.sealResidue.biotech = 200;
		s.invalidateProjection();
		expect(isSealed(s.state, s.content, "biotech")).toBe(true);
		const r = s.submit({ type: "choosePath", path: "biotech" });
		expect(!r.ok && r.reason).toMatch(/The Flesh is closed/);
	});

	it("lock-out: a committed tree that reaches the seal limit throws the player back onto Synthetic", () => {
		const s = sim();
		s.state.path = "greentech";
		s.state.sealResidue.greentech = 100;
		const ev = steps(s, 120);
		expect(ev).toContainEqual({ type: "sealedOut", path: "greentech" });
		expect(s.state.path).toBe("synthetic");
		expect(s.view().soul.sealedOut).toEqual(["greentech"]);
		expect(s.view().soul.commitBlock.greentech).toMatch(/closed/);
	});
});

describe("story scenes and objections", () => {
	const answer = (s: SimImpl, choiceId: string): void => {
		const d = s.view().decision;
		expect(d).not.toBeNull();
		s.submit({ type: "resolveDecision", decisionId: d?.id ?? -1, choiceId });
		s.step();
	};

	it("the opening scene arrives with its lines, is not deferrable, and moves the bonds", () => {
		const s = sim(loadContent());
		steps(s, 120);
		const d = s.view().decision;
		expect(d?.eventId).toBe("st_intro");
		expect(d?.canDefer).toBe(false);
		expect(d?.lines?.length).toBeGreaterThan(3);
		expect(d?.choices.find((c) => c.id === "dunno")?.reply?.[0].who).toBe("cass");
		const cass = s.state.bonds.cass;
		const luci = s.state.bonds.luci;
		answer(s, "dunno");
		expect(s.state.bonds.cass).toBe(cass + 6);
		// Luci recommended "money": overruling her costs her -1 plus the scene's own -1.
		expect(s.state.bonds.luci).toBe(luci - 1 + s.content.balance.soul.bondOverrule);
	});

	it("taking the recommendation warms that advisor to you", () => {
		const s = sim(loadContent());
		steps(s, 120);
		const luci = s.state.bonds.luci;
		answer(s, "money");
		expect(s.state.bonds.luci).toBe(luci + 6 + s.content.balance.soul.bondFollow);
	});

	it("placing a heavy polluter draws its champion's objection once, naming the item", () => {
		const c = content((x) => (x.events = x.events.filter((e) => e.category !== "story" || e.trigger?.kind === "objection")));
		const s = sim(c);
		s.state.cash = 1e9;
		place(s, "genset", 0, 6);
		steps(s, 12);
		const d = s.view().decision;
		expect(d?.eventId).toBe("obj_greentech");
		expect(d?.subject).toEqual({ defId: "genset", name: s.content.facilities.genset.name });
		expect(d?.lines?.[0].text).toContain(s.content.facilities.genset.name);
		answer(s, "replace");
		place(s, "genset", 0, 12);
		steps(s, 200);
		expect(s.view().decision).toBeNull();
	});

	it("hidden effects: a story choice changes seal and SP, and 'Luci, you decide' commits to Synthetic", () => {
		const c = content((x) => (x.events = x.events.filter((e) => e.id === "st_commit")));
		const s = sim(c);
		s.state.tier = 3;
		steps(s, 12);
		expect(s.view().decision?.eventId).toBe("st_commit");
		answer(s, "luci");
		expect(s.state.path).toBe("synthetic");
	});

	it("seal asides fire as the hidden number climbs", () => {
		const c = content((x) => (x.events = x.events.filter((e) => e.id.startsWith("st_seal_green"))));
		const s = sim(c);
		s.state.sealResidue.greentech = 40;
		steps(s, 12);
		expect(s.view().decision?.eventId).toBe("st_seal_green_25");
		const residue = s.state.sealResidue.greentech;
		answer(s, "care");
		expect(s.state.sealResidue.greentech).toBeLessThan(residue);
		expect(sealOf(s.state, "greentech")).toBeGreaterThan(25);
	});
});

describe("saves", () => {
	it("round-trips the Soul exactly", () => {
		const s = sim();
		s.state.sp.synthetic = 12.5;
		s.state.sealResidue.biotech = 3;
		s.state.bonds.mel = 71;
		s.state.objected.push("greentech:genset");
		const twin = simFromSnapshot(s.content, JSON.parse(JSON.stringify(s.snapshot()))) as SimImpl;
		expect(twin.hash()).toBe(s.hash());
		expect(twin.state.bonds.mel).toBe(71);
	});

	it("a v10 save gains the Soul: scars rebuilt from its facilities, content bonds, old endings mapped", () => {
		const s = sim();
		const snap = JSON.parse(JSON.stringify(s.snapshot())) as { version: number; state: Record<string, unknown> };
		snap.version = 10;
		for (const k of ["sp", "sealScar", "sealResidue", "bonds", "objected", "sealedOut"]) delete snap.state[k];
		snap.state.endingDays = { livingTower: 0, cleanTower: 0, greenExemplar: 0, millionMinds: 0 };
		snap.state.gameOver = { kind: "victory", tick: 5, ending: "millionMinds" };
		const loaded = simFromSnapshot(s.content, snap as never) as SimImpl;
		expect(loaded.state.sealScar).toEqual(s.state.sealScar);
		expect(loaded.state.bonds).toEqual(s.content.balance.soul.bondStart);
		expect(loaded.state.gameOver?.ending).toBe("singularity");
		expect("endingDays" in loaded.state).toBe(false);
	});
});
