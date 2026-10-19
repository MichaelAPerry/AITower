import type { FacilityDef } from "@aitower/content";
import type { FacilityStatus, FacilityView } from "@aitower/sim";
import type { Graphics } from "pixi.js";
import { describe, expect, it } from "vitest";
import { artSpec } from "../art";
import { FAC_BOTTOM, FAC_TOP, TILE, TUBE_Y } from "../constants";
import { hex } from "../color";
import { drawBody, drawLive } from "../pixi/facilityArt";
import { fixtureContent } from "./fixtureView";
import { VARIETY_ROWS, createVarietyScene, varietyContent, varietyId } from "./varietyScene";

interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
	color: number;
}

/** Records every rect a drawing routine paints (the art code only uses `rect().fill()` and `clear()`). */
function recorder(): { g: Graphics; rects: Rect[] } {
	const rects: Rect[] = [];
	let cur: Rect | null = null;
	const g = {
		clear() {},
		rect(x: number, y: number, w: number, h: number) {
			cur = { x, y, w, h, color: -1 };
			rects.push(cur);
			return g;
		},
		fill(o: { color: number }) {
			if (cur) cur.color = o.color;
			return g;
		},
	};
	return { g: g as unknown as Graphics, rects };
}

const content = varietyContent(fixtureContent);
const defs = VARIETY_ROWS.flatMap((row) => [1, 2, 3, 4].flatMap((tier) => row.widths.map((w) => ({ row, tier, w, def: content.facilities[varietyId(row, tier, w)] }))));
const TOP = 100;

const body = (def: FacilityDef): Rect[] => {
	const r = recorder();
	drawBody(r.g, def, 0, TOP);
	return r.rects;
};

describe("variety scene", () => {
	it("covers every facility kind, every rack cooling flavour, tiers 1-4 and several widths", () => {
		const kinds = new Set(defs.map((d) => d.def.kind));
		expect([...kinds].sort()).toEqual(["charger", "cdu", "chiller", "crah", "depot", "genset", "grid_tie", "rack", "ups"].sort());
		const flavours = new Set(defs.filter((d) => d.def.kind === "rack").map((d) => artSpec(d.def).variant));
		expect([...flavours].sort()).toEqual(["air", "dlc", "immersion", "storage"]);
		for (const row of VARIETY_ROWS) {
			expect(row.widths.length).toBeGreaterThanOrEqual(2);
			for (const tier of [1, 2, 3, 4]) for (const w of row.widths) expect(content.facilities[varietyId(row, tier, w)]).toMatchObject({ unlockTier: tier, width: w });
		}
		for (const w of [1, 2, 3, 4]) expect(defs.some((d) => d.def.kind === "rack" && d.def.width === w)).toBe(true);
	});

	it("places every facility on a real def, inside the grid, without overlaps", () => {
		const { view } = createVarietyScene();
		const seen = new Set<string>();
		for (const f of view.facilities) {
			const d = content.facilities[f.defId];
			expect(d, f.defId).toBeDefined();
			expect(f.width).toBe(d.width);
			expect(f.x).toBeGreaterThanOrEqual(0);
			expect(f.x + f.width).toBeLessThanOrEqual(view.width);
			expect(f.floor).toBeGreaterThanOrEqual(view.floorMin);
			expect(f.floor).toBeLessThanOrEqual(view.floorMax);
			for (let k = 0; k < f.width; k++) {
				const key = `${f.floor}:${f.x + k}`;
				expect(seen.has(key), key).toBe(false);
				seen.add(key);
			}
		}
		for (const b of view.bots) expect(content.bots[b.defId], b.defId).toBeDefined();
	});

	it("exercises every failure state, a blackout, a brownout, a coolant overload and the new bots", () => {
		const { view } = createVarietyScene();
		const st = new Set(view.facilities.map((f) => f.status));
		for (const s of ["tripped", "failed", "noCoolant", "unpowered", "brownout", "throttled"] as FacilityStatus[]) expect(st.has(s), s).toBe(true);
		expect(view.powerNets.some((n) => n.satisfaction === 0)).toBe(true);
		expect(view.powerNets.some((n) => n.satisfaction > 0 && n.satisfaction < 1)).toBe(true);
		expect(view.coolantNets.some((n) => n.loadKw > n.capacityKw)).toBe(true);
		expect(view.facilities.some((f) => f.status === "failed" && f.tempC >= 92)).toBe(true);
		expect(view.facilities.some((f) => f.status === "failed" && f.tempC < 80)).toBe(true);
		const kinds = new Set(view.bots.map((b) => (content.bots[b.defId].flying ? "drone" : (content.bots[b.defId].carry ?? 1) > 1 ? "lifter" : "rover")));
		expect([...kinds].sort()).toEqual(["drone", "lifter", "rover"]);
	});

	it("moves the courier drone through fractional floors in state flying", () => {
		const sc = createVarietyScene();
		const drone = sc.view.bots.find((b) => b.state === "flying");
		expect(drone).toBeDefined();
		const floors = new Set<number>();
		for (let i = 0; i < 60; i++) {
			sc.step();
			floors.add(drone?.floor ?? -1);
		}
		expect([...floors].some((f) => f !== Math.round(f))).toBe(true);
		expect(drone?.state).toBe("flying");
	});
});

describe("facility art over kind x tier x width", () => {
	it("draws every def without throwing and with finite, positive rects", () => {
		for (const { def } of defs) {
			const rects = body(def);
			expect(rects.length, def.id).toBeGreaterThan(20);
			for (const r of rects) {
				expect(Number.isFinite(r.x + r.y + r.w + r.h), def.id).toBe(true);
				expect(r.w).toBeGreaterThan(0);
				expect(r.h).toBeGreaterThan(0);
			}
		}
	});

	it("keeps every body inside its own tiles and its floor cell", () => {
		for (const { def } of defs) {
			for (const r of body(def)) {
				// Allow brass hoppers / crests above the body (tube rows) but nothing may spill sideways or below the slab.
				expect(r.x, `${def.id} left`).toBeGreaterThanOrEqual(0);
				expect(r.x + r.w, `${def.id} right`).toBeLessThanOrEqual(def.width * TILE);
				expect(r.y, `${def.id} top`).toBeGreaterThanOrEqual(TOP + 1);
				expect(r.y + r.h, `${def.id} bottom`).toBeLessThanOrEqual(TOP + FAC_BOTTOM);
			}
		}
	});

	it("gives higher unlock tiers visibly more detail at every width", () => {
		for (const row of VARIETY_ROWS) {
			for (const w of row.widths) {
				const counts = [1, 2, 3, 4].map((t) => body(content.facilities[varietyId(row, t, w)]).length);
				for (let t = 1; t < 4; t++) expect(counts[t], `${row.label} w${w} tier ${t + 1}`).toBeGreaterThan(counts[t - 1]);
			}
		}
	});

	it("uses brass only from tier 2 up on non-rack facilities' trim rows", () => {
		// Compare tier 1 and 2 of the same chiller: tier 2 adds rects, tier 1 does not (plain enamel).
		const row = VARIETY_ROWS.find((r) => r.kind === "chiller");
		expect(row).toBeDefined();
		if (!row) return;
		const w = row.widths[0];
		const a = body(content.facilities[varietyId(row, 1, w)]);
		const b = body(content.facilities[varietyId(row, 2, w)]);
		expect(b.length).toBeGreaterThan(a.length);
		expect(b.slice(0, a.length)).toEqual(a.map((r) => ({ ...r })).map((r, i) => ({ ...r, color: b[i].color }))); // tier 2 only appends
	});

	it("draws immersion racks differently from dlc racks (glass tank, fluid tinted by the accent)", () => {
		const row = (f: string) => VARIETY_ROWS.find((r) => r.flavour === f);
		const imm = content.facilities[varietyId(row("immersion") as never, 1, 2)];
		const dlc = content.facilities[varietyId(row("dlc") as never, 1, 2)];
		const withAccent = { ...imm, accent: "#ff00aa" };
		const a = body(imm);
		const b = body({ ...dlc, color: imm.color, accent: imm.accent });
		expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
		// The tank holds more distinct glass/fluid colours than the louvred dlc cabinet, and accent changes the fluid.
		expect(JSON.stringify(body(withAccent))).not.toBe(JSON.stringify(a));
		// Tank frame: brass line colour box 8 wide (TANK_W) exists in the cabinet.
		expect(a.some((r) => r.w === 8 && r.h === 10)).toBe(true);
		expect(b.some((r) => r.w === 8 && r.h === 10)).toBe(false);
	});

	it("uses the def colour and accent", () => {
		const row = VARIETY_ROWS[0];
		const base = content.facilities[varietyId(row, 2, 2)];
		const a = body(base);
		const b = body({ ...base, color: "#112233", accent: "#445566" });
		expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
		expect(b.some((r) => r.color === hex("#445566") || r.color === hex("#112233") || a.every((q) => q.color !== r.color))).toBe(true);
	});

	it("live details draw in every status and with every presentation option without throwing", () => {
		const statuses: FacilityStatus[] = ["ok", "idle", "disabled", "unpowered", "brownout", "noCoolant", "throttled", "tripped", "failed"];
		for (const { def } of defs) {
			for (const status of statuses) {
				for (const rm of [false, true]) {
					const r = recorder();
					const f = { id: 3, defId: def.id, floor: 0, x: 0, width: def.width, enabled: status !== "disabled", status, tempC: 60, clock: 0.8, health: 1, powerKw: 10, heatKw: 50, jobId: 1, powerNet: 0, coolantNet: null, running: true, charge: 0.5, stored: 4 } as FacilityView;
					drawLive(r.g, def, f, 0, TOP, 1.25, { reducedMotion: rm, crtEffects: !rm, colorBlind: rm, horrorIntensity: "full" });
					for (const q of r.rects) expect(Number.isFinite(q.x + q.y + q.w + q.h)).toBe(true);
				}
			}
		}
	});

	it("immersion bubbles are fixed under reduced motion and move otherwise", () => {
		const row = VARIETY_ROWS.find((r) => r.flavour === "immersion");
		if (!row) throw new Error("no immersion row");
		const def = content.facilities[varietyId(row, 2, 2)];
		const live = (t: number, rm: boolean): string => {
			const r = recorder();
			const f = { id: 9, defId: def.id, floor: 0, x: 0, width: 2, enabled: true, status: "ok", tempC: 60, clock: 1, health: 1, powerKw: 10, heatKw: 50, jobId: null, powerNet: 0, coolantNet: null } as FacilityView;
			drawLive(r.g, def, f, 0, TOP, t, { reducedMotion: rm, crtEffects: false, colorBlind: false, horrorIntensity: "full" });
			// Only the tank region (cabinet-local x 3..9, y within the tank).
			return JSON.stringify(r.rects.filter((q) => q.x >= 3 && q.x <= 10 && q.y >= TOP + FAC_TOP + 17 && q.y <= TOP + FAC_TOP + 25));
		};
		expect(live(1, true)).toBe(live(2.3, true));
		expect(live(1, false)).not.toBe(live(1.4, false));
		expect(live(1, true).length).toBeGreaterThan(2);
	});

	it("hoppers and crests rise at most 4 px above an air rack's body", () => {
		for (const { def, tier } of defs.filter((d) => d.def.kind === "rack" && artSpec(d.def).variant === "air")) {
			const top = Math.min(...body(def).map((r) => r.y));
			expect(top).toBeGreaterThanOrEqual(TOP + FAC_TOP - 4);
			if (tier === 1) expect(top).toBe(TOP + TUBE_Y - 1); // the pneumatic receiver, nothing else
		}
	});
});
