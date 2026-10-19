/**
 * Maintenance automatons: the 12×12 filing-cabinet rover (riveted dome head with one camera eye, treads, a
 * stamped crate on the back when carrying, a welding torch while repairing), the 12×12 rotor drone
 * (`BotDef.flying`, hovers and may sit at a fractional floor while in state "flying") and the 14×12 lifter
 * (`BotDef.carry > 1`, a crate stack on the back when carrying). Interpolated per frame.
 */
import type { ContentDB } from "@aitower/content";
import type { RenderOptions } from "@aitower/shared";
import type { BotView, SimView } from "@aitower/sim";
import { Graphics } from "pixi.js";
import { botDims, botKind, crateCount, hoverOffset, rotorSpeed } from "../botArt";
import { floorTop } from "../camera";
import { hex, satisfactionColor } from "../color";
import { FAC_BOTTOM, TILE } from "../constants";
import type { Sample } from "../interp";
import { BRASS, CRATE, type Mat, STEEL, T, dk, lt, mat } from "../palette";
import { px } from "./draw";

export const BOT_W = 12;
export const BOT_H = 12;

/** World-space bounding box (left, top) of a bot at fractional tile x / floor; `w` is its body width (lifters are wider). */
export const botBox = (view: Pick<SimView, "floorMax">, x: number, floor: number, w = BOT_W): { x: number; y: number } => ({
	x: Math.round((x + 0.5) * TILE - w / 2),
	y: Math.round(floorTop(view, floor) + FAC_BOTTOM - BOT_H),
});

export interface Torch {
	x: number;
	y: number;
}

/** Drawing helpers for one bot: `R` takes local x measured from the bot's back, so mirroring is automatic. */
interface Ctx {
	g: Graphics;
	x: number;
	y: number;
	w: number;
	face: 1 | -1;
	t: number;
	b: BotView;
	m: Mat;
	moving: boolean;
	calm: boolean;
	torches: Torch[];
	X(lx: number, w?: number): number;
	R(lx: number, ly: number, w: number, h: number, c: number, a?: number): void;
}

function crate(c: Ctx, lx: number, ly: number): void {
	c.R(lx, ly, 5, 5, CRATE.lo);
	c.R(lx, ly, 5, 1, CRATE.hi);
	c.R(lx, ly + 1, 4, 3, CRATE.mid);
	c.R(lx + 1, ly + 2, 2, 1, CRATE.stamp);
}

function batteryGauge(c: Ctx, y: number): void {
	const bw = Math.max(1, Math.round(6 * Math.max(0, Math.min(1, c.b.battery))));
	px(c.g, c.x + 3, y, 6, 1, T.ink, 0.8);
	px(c.g, c.x + 3, y, bw, 1, satisfactionColor(c.b.battery));
	if (c.b.state === "charging") px(c.g, c.x + 10, y - 1, 1, 3, Math.floor(c.t * 3) % 2 ? T.amber : T.amberDim);
}

const eyeColor = (b: BotView): number => (b.state === "repairing" ? lt(T.amber, 0.6) : b.state === "charging" ? T.green : T.amber);

function drawRover(c: Ctx, crates: number): void {
	const { R, m, b, t } = c;
	const repairing = b.state === "repairing";
	const bob = c.moving && Math.floor(t * 8) % 2 === 0 ? 1 : 0;
	// Carried crate strapped to the back.
	if (crates > 0) {
		R(0, 1 + bob, 5, 5, CRATE.lo);
		R(0, 1 + bob, 5, 1, CRATE.hi);
		R(0, 2 + bob, 4, 3, CRATE.mid);
		R(1, 3 + bob, 2, 1, CRATE.stamp);
	}
	// Dome head with brass collar.
	R(4, 0 + bob, 4, 1, m.line);
	R(3, 1 + bob, 6, 1, m.hi);
	R(2, 2 + bob, 8, 2, m.mid);
	R(2, 2 + bob, 1, 2, m.line);
	R(9, 2 + bob, 1, 2, m.line);
	R(3, 2 + bob, 2, 1, m.hi);
	R(5, -1 + bob, 1, 1, BRASS.hi); // knob
	R(1, 4 + bob, 10, 1, BRASS.mid);
	R(1, 4 + bob, 1, 1, BRASS.hi);
	// The eye: dark socket, glowing lens.
	const eye = eyeColor(b);
	R(7, 2 + bob, 3, 2, T.ink);
	R(8, 2 + bob, 1, 1, eye);
	if (Math.floor(t * 1.3 + b.id) % 7 !== 0) R(8, 3 + bob, 1, 1, dk(eye, 0.4));
	// Filing-cabinet body with two drawers.
	R(1, 5, 10, 4, m.line);
	R(2, 5, 8, 3, m.mid);
	R(2, 5, 8, 1, m.hi);
	R(2, 7, 8, 1, m.lo);
	R(5, 6, 2, 1, BRASS.mid);
	R(5, 8, 2, 1, BRASS.lo);
	// Arm + welding torch.
	if (repairing) torch(c, 10, 6, 5);
	else R(10, 6, 1, 2, STEEL.lo);
	// Treads with rolling links.
	R(0, 9, 12, 3, T.ink);
	R(1, 9, 10, 1, dk(T.steel, 0.35));
	const ph = c.moving ? Math.floor(t * 14) % 3 : 0;
	for (let k = 1 + ph; k < 11; k += 3) R(k, 11, 1, 1, STEEL.lo);
	for (const wx of [1, 5, 9]) R(wx, 10, 2, 1, STEEL.mid);
	batteryGauge(c, c.y - 4);
}

/** Arm at local (lx, ly) ending in a welding torch whose tip sits at row `tipY`; registers the tip for sparks. */
function torch(c: Ctx, lx: number, ly: number, tipY: number): void {
	c.R(lx, ly, 2, 1, STEEL.mid);
	c.R(lx + 2, ly - 1, 1, 2, STEEL.hi);
	const tip = { x: c.X(lx + 3), y: c.y + tipY };
	c.torches.push(tip);
	if (Math.floor(c.t * 20) % 3 !== 0) {
		px(c.g, tip.x - 1, tip.y - 1, 3, 3, T.amber, 0.35);
		px(c.g, tip.x, tip.y, 1, 1, lt(T.amber, 0.8));
	}
}

/** Bulky lifter (BotDef.carry > 1): 14 px wide, hazard-striped chassis, brass bumper and a crate stack on the back. */
function drawLifter(c: Ctx, crates: number): void {
	const { R, m, b, t } = c;
	const bob = c.moving && Math.floor(t * 8) % 2 === 0 ? 1 : 0;
	// Rear deck and the crate stack (grows upward past the 12-px box).
	R(0, 5, 5, 1, BRASS.lo);
	for (let k = 0; k < crates; k++) crate(c, 0, 0 - 5 * k + bob);
	if (crates > 0) R(2, 0 - 5 * (crates - 1) - 1 + bob, 1, 5 * crates + 1, STEEL.lo, 0.8); // binding strap
	// Dome head.
	R(7, 0 + bob, 4, 1, m.line);
	R(6, 1 + bob, 6, 1, m.hi);
	R(5, 2 + bob, 8, 2, m.mid);
	R(5, 2 + bob, 1, 2, m.line);
	R(12, 2 + bob, 1, 2, m.line);
	R(6, 2 + bob, 2, 1, m.hi);
	R(8, -1 + bob, 1, 1, BRASS.hi);
	R(4, 4 + bob, 10, 1, BRASS.mid);
	R(4, 4 + bob, 1, 1, BRASS.hi);
	const eye = eyeColor(b);
	R(10, 2 + bob, 3, 2, T.ink);
	R(11, 2 + bob, 1, 1, eye);
	if (Math.floor(t * 1.3 + b.id) % 7 !== 0) R(11, 3 + bob, 1, 1, dk(eye, 0.4));
	// Heavy chassis with a hazard stripe.
	R(1, 5, 13, 4, m.line);
	R(2, 5, 11, 3, m.mid);
	R(2, 5, 11, 1, m.hi);
	R(2, 7, 11, 1, m.lo);
	for (let k = 0; k < 11; k += 2) R(2 + k, 8, 1, 1, T.amber);
	R(7, 6, 2, 1, BRASS.mid);
	// Brass bumper / mast on the front.
	R(13, 2, 1, 8, BRASS.mid);
	R(13, 2, 1, 1, BRASS.hi);
	if (b.state === "repairing") torch(c, 13, 6, 5);
	// Heavier treads.
	R(0, 9, 14, 3, T.ink);
	R(1, 9, 12, 1, dk(T.steel, 0.35));
	const ph = c.moving ? Math.floor(t * 12) % 3 : 0;
	for (let k = 1 + ph; k < 13; k += 3) R(k, 11, 1, 1, STEEL.lo);
	for (const wx of [1, 4, 8, 11]) R(wx, 10, 2, 1, STEEL.mid);
	batteryGauge(c, c.y - 4);
}

/**
 * Rotor drone (BotDef.flying): pod body on skids under two rotor masts. Hovers above the floor line; blades blur
 * while spinning (steady blur under reduced motion), droop when landed. A parcel hangs underneath when carrying.
 */
function drawDrone(c: Ctx, crates: number, speed: number, hover: number, nearFloor: boolean): void {
	const { g, R, m, b, t } = c;
	const y0 = c.y - hover; // shift everything up by the hover height
	const r = (lx: number, ly: number, w: number, h: number, col: number, a = 1): void => R(lx, ly - hover, w, h, col, a);
	// Ground shadow when close to a floor.
	if (hover > 0 && nearFloor) px(g, c.X(3, 6), c.y + BOT_H - 1, 6, 1, T.ink, 0.35);
	const bob = speed > 0 && !c.calm && Math.floor(t * 6 + b.id) % 2 === 0 ? 1 : 0;
	const by = bob;
	// Rotor masts and hubs.
	for (const lx of [2, 9]) {
		r(lx, 2 + by, 1, 3, STEEL.lo);
		r(lx, 1 + by, 1, 1, BRASS.mid);
	}
	// Blades (light on a dark under-line so they read against the slab behind).
	const blade = lt(STEEL.hi, 0.4);
	for (const lx of [0, 7]) {
		if (speed === 0) {
			r(lx, 2 + by, 2, 1, STEEL.mid); // landed: drooping
			r(lx + 3, 2 + by, 2, 1, STEEL.mid);
			continue;
		}
		r(lx, 1 + by, 5, 1, T.ink, 0.35);
		if (c.calm) {
			r(lx, 0 + by, 5, 1, blade, 0.6); // steady blur
			r(lx + 1, 0 + by, 3, 1, blade);
		} else {
			const wdt = Math.floor(t * 30 * speed + lx) % 3 === 0 ? 5 : 3;
			r(lx, 0 + by, 5, 1, STEEL.mid, 0.4);
			r(lx + (5 - wdt) / 2, 0 + by, wdt, 1, blade);
		}
	}
	// Pod body.
	r(2, 4 + by, 8, 1, BRASS.mid);
	r(2, 4 + by, 1, 1, BRASS.hi);
	r(1, 5 + by, 10, 4, m.line);
	r(2, 5 + by, 8, 3, m.mid);
	r(2, 5 + by, 8, 1, m.hi);
	r(2, 7 + by, 8, 1, m.lo);
	// Camera eye.
	const eye = eyeColor(b);
	r(7, 5 + by, 3, 2, T.ink);
	r(8, 5 + by, 1, 1, eye);
	r(5, 6 + by, 2, 1, BRASS.lo);
	// Skids.
	r(2, 9 + by, 1, 2, STEEL.lo);
	r(9, 9 + by, 1, 2, STEEL.lo);
	r(1, 10 + by, 4, 1, STEEL.mid);
	r(7, 10 + by, 4, 1, STEEL.mid);
	// Parcel on a strap under the pod.
	if (crates > 0) {
		r(5, 9 + by, 1, 1, STEEL.lo);
		r(4, 10 + by, 4, 2, CRATE.mid);
		r(4, 10 + by, 4, 1, CRATE.hi);
		r(5, 11 + by, 2, 1, CRATE.stamp);
	}
	if (b.state === "repairing") {
		const tip = { x: c.X(11), y: y0 + 7 + by };
		r(10, 7 + by, 1, 1, STEEL.mid);
		c.torches.push(tip);
		if (Math.floor(t * 20) % 3 !== 0) {
			px(g, tip.x - 1, tip.y - 1, 3, 3, T.amber, 0.35);
			px(g, tip.x, tip.y, 1, 1, lt(T.amber, 0.8));
		}
	}
	batteryGauge(c, y0 - 3);
}

export class Bots {
	readonly g = new Graphics();
	/** Welding-torch tips of repairing bots this frame (world px), for the sparks effect. */
	readonly torches: Torch[] = [];
	private facing = new Map<number, 1 | -1>();

	constructor(private readonly content: ContentDB) {}

	draw(view: SimView, pos: (b: BotView) => Sample, vel: (b: BotView) => Sample, t: number, opt?: Pick<RenderOptions, "reducedMotion">): void {
		const g = this.g;
		g.clear();
		this.torches.length = 0;
		for (const b of view.bots) {
			const p = pos(b);
			const v = vel(b);
			const def = this.content.bots[b.defId];
			const kind = botKind(def);
			const dims = botDims(kind);
			const { x, y } = botBox(view, p.x, p.y, dims.w);
			const m = mat(def ? hex(def.color) : T.steel);
			const moving = Math.abs(v.x) > 1e-4 || Math.abs(v.y) > 1e-4;
			if (v.x > 1e-4) this.facing.set(b.id, 1);
			else if (v.x < -1e-4) this.facing.set(b.id, -1);
			const face = this.facing.get(b.id) ?? 1;
			const w = dims.w;
			// Mirror helper: local x (from the back) → world x.
			const X = (lx: number, wd = 1): number => (face > 0 ? x + lx : x + w - lx - wd);
			const R = (lx: number, ly: number, wd: number, h: number, c: number, a = 1): void => px(g, X(lx, wd), y + ly, wd, h, c, a);
			const ctx: Ctx = { g, x, y, w, face, t, b, m, moving, calm: opt?.reducedMotion === true, torches: this.torches, X, R };
			const crates = crateCount(def, b.carrying);
			if (kind === "drone") {
				const near = Math.abs(p.y - Math.round(p.y)) < 0.05;
				drawDrone(ctx, crates, rotorSpeed(b.state), hoverOffset(b.state), near);
			} else if (kind === "lifter") drawLifter(ctx, crates);
			else drawRover(ctx, crates);
		}
	}
}
