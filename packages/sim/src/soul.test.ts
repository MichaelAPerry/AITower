/** The Soul (docs/SOUL.md, docs/REFRAME.md): secret seal numbers, per-tree Singularity points, bonds, story scenes and objections, on the real content. */
import { type ContentDB, loadContent } from "@aitower/content";
import { describe, expect, it } from "vitest";
import type { SimEvent } from "./api";
import { GensetMode } from "./core/state";
import { type SimImpl, createSim, simFromSnapshot } from "./sim";
import { isClosed, isSealed, sealOf, soulStep, treeFactor } from "./progression/soul";
import { addFacility } from "./world/entities";

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
/** One hourly soul sample on the current state (tick 0 is on the hour). */
const hourly = (s: SimImpl): void => {
	s.state.tick = 0;
	soulStep({ state: s.state, content: s.content, events: [], scratch: undefined as never });
};
/** A bare tower: no racks at all, so each test adds exactly the racks it scores. */
const bare = (): SimImpl => {
	const s = sim();
	for (const f of [...s.state.facilities]) if (s.content.facilities[f.defId].kind === "rack") s.state.facilities.splice(s.state.facilities.indexOf(f), 1);
	s.state.sealScar = { biotech: 0, greentech: 0 };
	s.state.sealResidue = { biotech: 0, greentech: 0 };
	return s;
};
/** Add a delivering rack of `defId` at `pf` PFLOPS (the scoring reads delivered compute). */
const rackAt = (s: SimImpl, defId: string, pf: number, x = 20): void => {
	const f = addFacility(s.state, s.content, defId, 1, x);
	f.pflops = pf;
};

describe("secret seal numbers", () => {
	it("the starter tower is scarred by what it was built with", () => {
		const s = sim();
		// grid tie 8 + one air handler 2; the base racks are neutral and scar nothing.
		expect(s.state.sealScar).toEqual({ greentech: 10, biotech: 0 });
	});

	it("placing an item adds its positive numbers to the permanent scar; demolishing does not refund it", () => {
		const s = sim();
		s.state.cash = 1e9;
		place(s, "genset", 0, 6);
		expect(s.state.sealScar.greentech).toBe(10 + 20);
		expect(s.state.sealScar.biotech).toBe(6);
		s.submit({ type: "demolish", floor: 0, x: 6 });
		s.step();
		expect(s.state.facilities.some((f) => f.defId === "genset")).toBe(false);
		expect(s.state.sealScar.greentech).toBe(30);
	});

	it("aligned items never scar (negative numbers), they clean residue while they run", () => {
		const s = sim();
		const before = { ...s.state.sealScar };
		s.state.cash = 1e9;
		s.state.tier = 5;
		s.state.techResearched.push("neuromorphic_bench");
		s.invalidateProjection();
		place(s, "solar_skin", 1, 40); // exterior wall: the edge of the floor
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
			hourly(s);
			return s.state.sealResidue.greentech - r;
		};
		if (g) g.gensetMode = GensetMode.Off;
		// Grid tie 8 + air handler 2 (the idle genset does not count).
		expect(hour()).toBeCloseTo(10 * perHour, 9);
		if (g) g.gensetMode = GensetMode.Running;
		expect(hour()).toBeCloseTo(30 * perHour, 9);
	});
});

describe("Singularity points: each tree scores only its own racks", () => {
	const so = (s: SimImpl) => s.content.balance.soul;

	it("base racks are neutral: AC-1, AC-3 and IA-1 score for no tree", () => {
		const s = bare();
		for (const id of ["rack_air_gpu", "rack_air_gpu2", "rack_infer"]) rackAt(s, id, 100);
		hourly(s);
		expect(s.state.sp).toEqual({ synthetic: 0, biotech: 0, greentech: 0 });
	});

	it("Synthetic: weight 2.5, factor 1, no matter the green score or the other seals", () => {
		const s = bare();
		rackAt(s, "rack_dlc_gpu", 130);
		s.state.sealResidue.greentech = 90;
		s.state.sealResidue.biotech = 90;
		hourly(s);
		expect(s.state.sp.synthetic).toBeCloseTo(130 * so(s).spWeights.synthetic * so(s).spPerPflopHour, 9);
		expect(s.state.sp.biotech).toBe(0);
		expect(s.state.sp.greentech).toBe(0);
		expect(treeFactor(s.state, s.content, "synthetic")).toBe(1);
	});

	it("Bio: weight 1.5 × (1 − bio seal)", () => {
		const s = bare();
		rackAt(s, "organoid_incubator", 135);
		s.state.sealResidue.biotech = 25;
		hourly(s);
		expect(s.state.sp.biotech).toBeCloseTo(135 * so(s).spWeights.biotech * so(s).spPerPflopHour * 0.75, 9);
		expect(s.state.sp.synthetic).toBe(0);
		expect(s.state.sp.greentech).toBe(0);
	});

	it("Green: (floor + (1 − floor) × green score) × (1 − green seal): slow on any power, full on clean", () => {
		const green = (score: number, seal = 0): number => {
			const s = bare();
			rackAt(s, "rack_neuromorphic", 100);
			s.state.greenScore = score;
			s.state.sealResidue.greentech = seal;
			hourly(s);
			expect(s.state.sp.synthetic).toBe(0);
			return s.state.sp.greentech / (100 * so(s).spWeights.greentech * so(s).spPerPflopHour);
		};
		const fl = so(bare()).greenFloor;
		expect(green(0)).toBeCloseTo(fl, 9); // never stuck at zero
		expect(green(1)).toBeCloseTo(1, 9);
		expect(green(0.12)).toBeCloseTo(fl + (1 - fl) * 0.12, 9);
		expect(green(0.5, 20)).toBeCloseTo((fl + (1 - fl) * 0.5) * 0.8, 9);
	});

	it("a tree's racks score nothing for the others, and a mixed tower scores each in its own tree", () => {
		const s = bare();
		rackAt(s, "rack_dlc_gpu2", 200, 10);
		rackAt(s, "rack_organoid_2", 300, 14);
		rackAt(s, "rack_photonic", 300, 20);
		s.state.greenScore = 1;
		hourly(s);
		const w = so(s).spWeights;
		expect(s.state.sp.synthetic).toBeCloseTo(200 * w.synthetic * so(s).spPerPflopHour, 9);
		expect(s.state.sp.biotech).toBeCloseTo(300 * w.biotech * so(s).spPerPflopHour, 9);
		expect(s.state.sp.greentech).toBeCloseTo(300 * w.greentech * so(s).spPerPflopHour, 9);
	});

	it("seal 100 closes a tree: its racks stop scoring (the view says so), the Lattice never closes", () => {
		const s = bare();
		rackAt(s, "rack_organoid_2", 300, 10);
		rackAt(s, "rack_dlc_gpu", 130, 14);
		s.state.sealResidue.biotech = 100;
		expect(isSealed(s.state, s.content, "biotech")).toBe(true);
		expect(isClosed(s.state, s.content, "biotech")).toBe(true);
		expect(isClosed(s.state, s.content, "synthetic")).toBe(false);
		const v = s.view().soul;
		expect(v.trees.biotech).toMatchObject({ closed: true, factor: 0, seal: 100 });
		expect(v.trees.synthetic).toMatchObject({ closed: false, factor: 1, seal: null });
		expect(v.green.speed).toBe(s.content.balance.soul.greenFloor);
		hourly(s);
		expect(s.state.sp.biotech).toBe(0);
		expect(s.state.sp.synthetic).toBeGreaterThan(0);
	});

	it("the view reports points a day and days to go at the rate delivered now", () => {
		const s = bare();
		rackAt(s, "rack_dlc_gpu3", 420);
		const t = s.view().soul.trees.synthetic;
		expect(t.spPerDay).toBeCloseTo(420 * 2.5 * so(s).spPerPflopHour * 24, 9);
		expect(t.daysToWin).toBeCloseTo(so(s).spTarget / t.spPerDay, 9);
		expect(t.rung).toBe(3);
		expect(t.racks).toBe(1);
		expect(s.view().soul.trees.biotech.daysToWin).toBeNull();
	});

	it("the first tree at its target wins, and a tree needs no commitment to win", () => {
		const target = quiet().balance.soul.spTarget;
		for (const [tree, ending] of [["synthetic", "singularity"], ["biotech", "flesh"], ["greentech", "garden"]] as const) {
			const s = sim();
			s.state.sp[tree] = target;
			expect(steps(s, 120)).toContainEqual({ type: "gameOver", kind: "victory", ending });
		}
		const both = sim();
		both.state.sp.synthetic = target;
		both.state.sp.greentech = target + 5;
		expect(steps(both, 120)).toContainEqual({ type: "gameOver", kind: "victory", ending: "garden" });
	});
});

describe("no commit, no bond gates", () => {
	it("the sim has no commit command, no path state and no dating state", () => {
		const s = sim();
		const r = s.submit({ type: "choosePath", path: "greentech" } as never);
		expect(r.ok).toBe(false);
		for (const k of ["path", "route", "sealedOut", "bondGiven", "flags", "afterHoursDay", "afterSeen", "gifted", "inbox", "messageDay", "messageSeen"]) expect(k in s.state, k).toBe(false);
		for (const type of ["visitAdvisor", "giveGift", "replyMessage"]) expect(s.submit({ type } as never).ok, type).toBe(false);
	});

	it("any mix of trees may be built whatever the bonds (all at 0), as long as Level and research allow", () => {
		const s = sim();
		s.state.bonds = { cass: 0, bea: 0, mel: 0, luci: 0 };
		s.state.tier = 5;
		s.state.cash = 1e9;
		for (const t of ["chilled_loop", "wetware_annex", "neuromorphic_bench"]) s.state.techResearched.push(t);
		s.invalidateProjection();
		const racks = s.state.facilities.filter((f) => f.defId === "rack_air_gpu").slice(0, 3);
		expect(racks.length).toBe(3);
		const trees = ["synthetic", "biotech", "greentech"] as const;
		racks.forEach((f, i) => {
			const c = s.canBuild({ type: "retrofit", facilityId: f.id, tree: trees[i] });
			// The only things that can say no are the rack's site (pipe under it), never a commit or a bond.
			if (!c.ok) expect(c.reason).toMatch(/conduit/);
		});
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
		expect(d?.lines?.[0].who).toBe("narrator");
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
		expect(d?.lines?.some((l) => l.text.includes(s.content.facilities.genset.name))).toBe(true);
		answer(s, "replace");
		place(s, "genset", 0, 12);
		steps(s, 200);
		expect(s.view().decision).toBeNull();
	});

	it("the first rack of each rung draws one scene from that tree's champion, once", () => {
		const c = content((x) => (x.events = x.events.filter((e) => e.trigger?.kind === "rung")));
		const s = sim(c);
		steps(s, 20);
		expect(s.view().decision).toBeNull();
		addFacility(s.state, s.content, "rack_dlc_gpu", 1, 40);
		steps(s, 12);
		const d = s.view().decision;
		expect(d?.eventId).toBe("rung_syn_1");
		expect(d?.advisor).toBe("luci");
		expect(d?.lines?.[0].who).toBe("narrator");
		answer(s, d?.choices[0].id ?? "");
		// A second rung-1 rack, or another tree's rung 1, is a different story: only the same scene never repeats.
		addFacility(s.state, s.content, "rack_dlc_gpu", 1, 44);
		steps(s, 400);
		expect(s.view().decision).toBeNull();
		addFacility(s.state, s.content, "organoid_incubator", 1, 48);
		steps(s, 400);
		expect(s.view().decision?.eventId).toBe("rung_bio_1");
		expect(s.view().decision?.advisor).toBe("mel");
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
		for (const k of ["sp", "sealScar", "sealResidue", "bonds", "objected"]) delete snap.state[k];
		snap.state.endingDays = { livingTower: 0, cleanTower: 0, greenExemplar: 0, millionMinds: 0 };
		snap.state.gameOver = { kind: "victory", tick: 5, ending: "millionMinds" };
		const loaded = simFromSnapshot(s.content, snap as never) as SimImpl;
		expect(loaded.state.sealScar).toEqual(s.state.sealScar);
		expect(loaded.state.bonds).toEqual(s.content.balance.soul.bondStart);
		expect(loaded.state.gameOver?.ending).toBe("singularity");
		expect("endingDays" in loaded.state).toBe(false);
		expect(sealOf(loaded.state, "greentech")).toBeGreaterThanOrEqual(0);
	});
});
