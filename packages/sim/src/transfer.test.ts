/** Consciousness Transfer Unit (CT-1, Synthetic special): unlock, Singularity points, the sim event the renderer plays, determinism. */
import { type ContentDB, loadContent, treeRack } from "@aitower/content";
import { describe, expect, it } from "vitest";
import type { SimEvent } from "./api";
import { TICKS_PER_HOUR } from "./core/constants";
import { spRates, transferStep } from "./progression/soul";
import { type SimImpl, createSim } from "./sim";
import { addFacility } from "./world/entities";

const quiet = (): ContentDB => {
	const c = loadContent();
	c.events = c.events.filter((e) => e.category !== "story");
	c.balance.events.graceTicks = 1e9;
	return c;
};
const start = (): SimImpl => {
	const s = createSim(quiet(), "starter", 1) as SimImpl;
	s.state.cash = 1e9;
	return s;
};
const ID = "consciousness_transfer";
/** A unit on the floor, wired to power by hand (the tests are about the transfer, not the piping). */
const unit = (s: SimImpl, powered = true) => {
	const f = addFacility(s.state, s.content, ID, 1, 30);
	f.powerNet = powered ? 0 : -1;
	f.sat = powered ? 1 : 0;
	return f;
};
/** The transfer step at game hour `h` of the current day. */
const atHour = (s: SimImpl, h: number): SimEvent[] => {
	const events: SimEvent[] = [];
	s.state.tick = h * TICKS_PER_HOUR;
	transferStep({ state: s.state, content: s.content, events, scratch: undefined as never });
	return events;
};

describe("Consciousness Transfer Unit: unlock", () => {
	it("sits after the ML-1 node in the Synthetic research, is a Level 5 Synthetic item 3 tiles wide with high Bio and Green seal", () => {
		const c = loadContent();
		const d = c.facilities[ID];
		const node = c.tech.find((t) => t.id === "transfer_protocol");
		expect(d.tech).toBe("transfer_protocol");
		expect(node?.requires).toEqual(["mind_lattice_dossier"]);
		expect(node?.path).toBe("synthetic");
		expect(d.width).toBe(3);
		expect(d.line).toBe("synthetic");
		expect(d.seal).toEqual({ biotech: 20, greentech: 20 });
		// About an ML-1: same price, same Level.
		const ml1 = treeRack(c, "synthetic", 4);
		expect(d.cost).toBe(ml1?.cost);
		expect(d.unlockTier).toBe(ml1?.unlockTier);
		// It is a building, not a rack: it never scores compute SP or retrofits.
		expect(d.rung).toBeUndefined();
	});

	it("cannot be placed before the research, can be placed after it", () => {
		const s = start();
		s.state.tier = 5;
		s.invalidateProjection();
		const cmd = { type: "place", defId: ID, floor: 1, x: 30 } as const;
		const before = s.canBuild(cmd);
		expect(before.ok).toBe(false);
		for (const id of ["mind_lattice_dossier", "transfer_protocol"]) s.state.techResearched.push(id);
		s.invalidateProjection();
		const after = s.canBuild(cmd);
		if (!after.ok) expect(after.reason).not.toMatch(/research|tier/i);
	});
});

describe("Consciousness Transfer Unit: Singularity points", () => {
	it("a powered unit adds the Synthetic SP on every sixth hour and on no other", () => {
		const s = start();
		unit(s);
		const sp = s.content.facilities[ID].transfer?.sp ?? 0;
		const hours = [0, 6, 12, 18];
		for (let h = 0; h < 24; h++) {
			const before = s.state.sp.synthetic;
			const ev = atHour(s, h);
			if (hours.includes(h)) {
				expect(s.state.sp.synthetic - before).toBeCloseTo(sp, 6);
				expect(ev).toHaveLength(1);
			} else {
				expect(s.state.sp.synthetic).toBe(before);
				expect(ev).toHaveLength(0);
			}
		}
		expect(s.state.sp.biotech).toBe(0);
		expect(s.state.sp.greentech).toBe(0);
	});

	it("is worth one ML-1 running flat out: a day of transfers is within 1% of the ML-1's daily SP", () => {
		const s = start();
		const ml1 = treeRack(s.content, "synthetic", 4);
		const solo = start();
		const f = addFacility(solo.state, solo.content, ml1?.id ?? "", 1, 30);
		f.pflops = ml1?.rack?.pflops ?? 0;
		const ml1Day = spRates(solo.state, solo.content).synthetic;
		const t = s.content.facilities[ID].transfer;
		const perDay = ((t?.sp ?? 0) * 24) / (t?.everyHours ?? 1);
		expect(ml1Day).toBeGreaterThan(100);
		expect(Math.abs(perDay - ml1Day) / ml1Day).toBeLessThan(0.01);
	});

	it("does nothing when unpowered, switched off or failed", () => {
		const s = start();
		const f = unit(s, false);
		expect(atHour(s, 6)).toEqual([]);
		f.powerNet = 0;
		f.sat = 0.2;
		expect(atHour(s, 6)).toEqual([]);
		f.sat = 1;
		f.enabled = false;
		expect(atHour(s, 6)).toEqual([]);
		f.enabled = true;
		f.failed = true;
		expect(atHour(s, 6)).toEqual([]);
		expect(s.state.sp.synthetic).toBe(0);
		f.failed = false;
		expect(atHour(s, 6)).toHaveLength(1);
	});

	it("two units transfer two people", () => {
		const s = start();
		unit(s);
		const g = addFacility(s.state, s.content, ID, 1, 36);
		g.powerNet = 0;
		g.sat = 1;
		expect(atHour(s, 12)).toHaveLength(2);
		expect(s.state.sp.synthetic).toBeCloseTo(2 * (s.content.facilities[ID].transfer?.sp ?? 0), 6);
	});
});

describe("Consciousness Transfer Unit: the sim event", () => {
	it("carries the unit id and the SP, which the renderer plays as a person walking in", () => {
		const s = start();
		const f = unit(s);
		const ev = atHour(s, 0);
		expect(ev).toEqual([{ type: "consciousnessTransferred", facilityId: f.id, sp: s.content.facilities[ID].transfer?.sp }]);
	});

	it("is deterministic: the same seed and the same day give the same events and the same SP", () => {
		const run = (): { events: SimEvent[]; sp: number } => {
			const s = start();
			unit(s);
			const events: SimEvent[] = [];
			for (let i = 0; i < 24 * TICKS_PER_HOUR; i++) {
				s.step().forEach((e) => {
					if (e.type === "consciousnessTransferred") events.push(e);
				});
			}
			return { events, sp: s.state.sp.synthetic };
		};
		const a = run();
		const b = run();
		expect(a.events.length).toBeGreaterThan(0);
		expect(a.events).toEqual(b.events);
		expect(a.sp).toBe(b.sp);
	});
});
