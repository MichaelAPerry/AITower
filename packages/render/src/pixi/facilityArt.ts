/**
 * Programmer pixel art for facilities. `drawBody` is static (cached), `drawLive`
 * is redrawn every frame (LEDs, fans, bars, badges). Coordinates: `x` = world
 * left edge of the facility, `top` = world top of its floor cell.
 */
import type { FacilityDef } from "@aitower/content";
import type { FacilityView } from "@aitower/sim";
import type { Graphics } from "pixi.js";
import { hex, shade } from "../color";
import { FAC_BOTTOM, FAC_TOP, PIPE_RETURN_Y, PIPE_SUPPLY_Y, TILE } from "../constants";
import { badgeFor, flicker, isActive, LED, ledCue } from "../status";
import { box, fan, px } from "./draw";

const SUPPLY = 0x3f8cff;
const RETURN = 0xff5a4a;
const H = FAC_BOTTOM - FAC_TOP;

// ─── Static bodies ─────────────────────────────────────────────────────

export function drawBody(g: Graphics, def: FacilityDef, x: number, top: number): void {
	const c = hex(def.color);
	const a = hex(def.accent);
	const W = def.width * TILE;
	const y = top + FAC_TOP;
	switch (def.kind) {
		case "rack":
			return rackBody(g, def, x, y, W, c, a);
		case "crah":
			return crahBody(g, x, y, W, c, a);
		case "chiller":
			return chillerBody(g, x, y, top, W, c, a);
		case "cdu":
			return cduBody(g, x, y, top, W, c, a);
		case "grid_tie":
			return gridTieBody(g, x, y, W, c, a);
		case "genset":
			return gensetBody(g, x, y, W, c, a);
		case "ups":
			return upsBody(g, x, y, W, c, a);
		case "depot":
			return depotBody(g, x, y, W, c, a);
		case "charger":
			return chargerBody(g, x, y, W, c, a);
	}
}

function cabinet(g: Graphics, x: number, y: number, w: number, h: number, c: number, a: number): void {
	px(g, x, y, w, h, shade(c, 0.55));
	px(g, x + 1, y + 1, w - 2, h - 2, c);
	px(g, x + 1, y + 1, w - 2, 1, shade(c, 1.25)); // top highlight
	px(g, x + 1, y + 1, 1, h - 2, shade(c, 1.12)); // left highlight
	px(g, x, y, w, 2, a); // accent cap
}

function rackBody(g: Graphics, def: FacilityDef, x: number, y: number, W: number, c: number, a: number): void {
	const cab = TILE; // one cabinet per tile
	const dlc = def.rack?.cooling === "dlc" || def.rack?.cooling === "immersion";
	const storage = (def.rack?.pflops ?? 0) === 0 && (def.rack?.storageTB ?? 0) > 0;
	for (let i = 0; i < def.width; i++) {
		const cx = x + i * cab;
		cabinet(g, cx + 1, y, cab - 1, H, c, a);
		const face = shade(c, 0.78);
		if (storage) {
			// Drive bays: 2 columns of sleds.
			for (let r = 0; r < 8; r++) {
				const ry = y + 4 + r * 3;
				px(g, cx + 3, ry, 4, 2, face);
				px(g, cx + 8, ry, 4, 2, face);
				px(g, cx + 3, ry, 1, 2, shade(a, 0.6));
				px(g, cx + 8, ry, 1, 2, shade(a, 0.6));
			}
		} else {
			// Server blades.
			for (let r = 0; r < 9; r++) {
				const ry = y + 4 + r * 3;
				px(g, cx + 3, ry, 8, 2, face);
				px(g, cx + 3, ry + 2, 8, 1, shade(c, 0.6));
			}
		}
		px(g, cx + 2, y + H - 2, cab - 3, 1, shade(c, 0.45)); // plinth
		if (dlc) {
			// Pipe stubs up to the ceiling coolant pair + side manifold.
			const top = y - FAC_TOP;
			px(g, cx + 4, top + PIPE_SUPPLY_Y, 2, y - (top + PIPE_SUPPLY_Y), SUPPLY);
			px(g, cx + 9, top + PIPE_RETURN_Y, 2, y - (top + PIPE_RETURN_Y), RETURN);
			px(g, cx + 4, y - 2, 2, 1, shade(SUPPLY, 1.3));
			px(g, cx + 9, y - 2, 2, 1, shade(RETURN, 1.3));
			px(g, cx + 12, y + 4, 1, H - 8, shade(SUPPLY, 0.8));
		}
	}
}

function louvres(g: Graphics, x: number, y: number, w: number, h: number, c: number): void {
	px(g, x, y, w, h, shade(c, 0.5));
	for (let ly = y + 1; ly < y + h - 1; ly += 3) {
		px(g, x + 1, ly, w - 2, 1, shade(c, 1.15));
		px(g, x + 1, ly + 1, w - 2, 1, shade(c, 0.7));
	}
}

function crahBody(g: Graphics, x: number, y: number, W: number, c: number, a: number): void {
	cabinet(g, x + 1, y, W - 2, H, c, a);
	louvres(g, x + 3, y + 4, W / 2 - 4, H - 8, c);
	// Fan housing on the right half (blades drawn live).
	px(g, x + W / 2 + 1, y + 6, W / 2 - 4, W / 2 - 4, shade(c, 0.6));
	// Supply grille at the bottom.
	for (let i = x + 3; i < x + W - 3; i += 2) px(g, i, y + H - 4, 1, 2, shade(c, 0.5));
}

function chillerBody(g: Graphics, x: number, y: number, top: number, W: number, c: number, a: number): void {
	cabinet(g, x + 1, y + 6, W - 2, H - 6, c, a);
	// Coil grille.
	for (let i = x + 4; i < x + W - 4; i += 2) px(g, i, y + 16, 1, H - 20, shade(c, 0.65));
	// Fan deck on top (blades drawn live).
	px(g, x + 3, y + 2, W - 6, 4, shade(c, 0.5));
	// Pipes up to the ceiling pair.
	px(g, x + 4, top + PIPE_SUPPLY_Y, 2, y + 6 - (top + PIPE_SUPPLY_Y), SUPPLY);
	px(g, x + W - 6, top + PIPE_RETURN_Y, 2, y + 6 - (top + PIPE_RETURN_Y), RETURN);
	// Compressor block.
	px(g, x + 4, y + 9, 10, 5, shade(c, 0.7));
	px(g, x + 5, y + 10, 3, 3, a);
}

function cduBody(g: Graphics, x: number, y: number, top: number, W: number, c: number, a: number): void {
	cabinet(g, x + 1, y + 4, W - 2, H - 4, c, a);
	// Pipe loops.
	px(g, x + 4, top + PIPE_SUPPLY_Y, 2, y + 4 - (top + PIPE_SUPPLY_Y), SUPPLY);
	px(g, x + W - 7, top + PIPE_RETURN_Y, 2, y + 4 - (top + PIPE_RETURN_Y), RETURN);
	px(g, x + 3, y + H - 9, W - 6, 2, SUPPLY);
	px(g, x + 3, y + H - 6, W - 6, 2, RETURN);
	// Pump housing (impeller drawn live) and gauge.
	g.circle(x + W / 2, y + 14, 6).fill({ color: shade(c, 0.55) });
	g.circle(x + W / 2, y + 14, 5).fill({ color: shade(c, 0.8) });
	px(g, x + 4, y + 7, 4, 3, 0xd8dde4);
	px(g, x + 5, y + 8, 2, 1, a);
}

function gridTieBody(g: Graphics, x: number, y: number, W: number, c: number, a: number): void {
	// Transformer tank with cooling fins.
	cabinet(g, x + 4, y + 8, W - 8, H - 8, c, a);
	for (let i = x + 6; i < x + W - 6; i += 3) px(g, i, y + 12, 1, H - 16, shade(c, 0.6));
	// Radiator banks on the sides.
	for (let i = 0; i < 3; i++) {
		px(g, x + 1 + i, y + 12, 1, H - 14, shade(c, 0.8 - i * 0.1));
		px(g, x + W - 2 - i, y + 12, 1, H - 14, shade(c, 0.8 - i * 0.1));
	}
	// HV insulators (stacked discs) + bushings.
	for (const ix of [x + 12, x + W / 2, x + W - 12]) {
		for (let d = 0; d < 4; d++) px(g, ix - 2 + (d % 2), y + 7 - d * 2, 4 - (d % 2) * 2 + 1, 1, d % 2 ? 0xc9b48a : 0xe8e0d0);
		px(g, ix, y - 2, 1, 3, 0x9a9a9a);
		px(g, ix - 1, y - 3, 3, 1, 0xd0d0d0);
	}
	// Hazard sign.
	px(g, x + W / 2 - 3, y + 18, 7, 6, 0x1a1a1a);
	px(g, x + W / 2 - 2, y + 19, 5, 4, a);
	px(g, x + W / 2, y + 20, 1, 2, 0x1a1a1a);
}

function gensetBody(g: Graphics, x: number, y: number, W: number, c: number, a: number): void {
	cabinet(g, x + 1, y + 8, W - 2, H - 8, c, a);
	// Radiator grille (left).
	for (let i = y + 12; i < y + H - 3; i += 2) px(g, x + 3, i, 12, 1, shade(c, 0.55));
	// Access doors.
	box(g, x + 18, y + 12, 14, H - 16, shade(c, 0.6));
	box(g, x + 34, y + 12, 14, H - 16, shade(c, 0.6));
	px(g, x + 30, y + 20, 1, 3, shade(c, 1.4));
	px(g, x + 46, y + 20, 1, 3, shade(c, 1.4));
	// Control panel.
	px(g, x + W - 12, y + 12, 8, 6, 0x1c2026);
	// Exhaust stack.
	px(g, x + W - 9, y - 4, 4, 12, 0x5a5e66);
	px(g, x + W - 10, y - 5, 6, 2, 0x3a3e46);
}

function upsBody(g: Graphics, x: number, y: number, W: number, c: number, a: number): void {
	cabinet(g, x + 1, y + 2, W - 2, H - 2, c, a);
	// Battery modules.
	for (let col = 0; col < Math.floor((W - 6) / 7); col++) {
		for (let r = 0; r < 3; r++) {
			const bx = x + 4 + col * 7;
			const by = y + 12 + r * 6;
			px(g, bx, by, 6, 5, shade(c, 0.65));
			px(g, bx + 1, by, 1, 1, 0xcfd4da);
			px(g, bx + 4, by, 1, 1, 0xcfd4da);
		}
	}
	// Charge bar frame (fill drawn live).
	px(g, x + 4, y + 5, W - 8, 4, 0x101317);
}

function depotBody(g: Graphics, x: number, y: number, W: number, c: number, a: number): void {
	// Shelving frame with three shelves; part boxes drawn live.
	px(g, x + 2, y, 2, H, shade(c, 0.7));
	px(g, x + W - 4, y, 2, H, shade(c, 0.7));
	for (let s = 0; s < 3; s++) {
		px(g, x + 2, y + 9 + s * 10, W - 4, 2, c);
		px(g, x + 2, y + 11 + s * 10, W - 4, 1, shade(c, 0.5));
	}
	px(g, x + 2, y, W - 4, 2, a);
}

function chargerBody(g: Graphics, x: number, y: number, W: number, c: number, a: number): void {
	// Dock pad on the floor + pylon with plug.
	px(g, x + 2, y + H - 3, W - 4, 3, shade(c, 0.6));
	px(g, x + 3, y + H - 3, W - 6, 1, c);
	px(g, x + W - 7, y + 6, 5, H - 9, c);
	px(g, x + W - 7, y + 6, 5, 2, a);
	px(g, x + W - 8, y + 18, 2, 3, 0x2a2f36);
	for (let i = x + 5; i < x + W - 10; i += 4) px(g, i, y + H - 2, 2, 1, a, 0.6);
}

// ─── Live details ──────────────────────────────────────────────────────

/** Time-varying details drawn on top of the cached body. `t` is seconds. */
export function drawLive(g: Graphics, def: FacilityDef, f: FacilityView, x: number, top: number, t: number): void {
	const y = top + FAC_TOP;
	const W = def.width * TILE;
	const active = isActive(f.status, f.enabled);
	const a = hex(def.accent);
	const c = hex(def.color);
	switch (def.kind) {
		case "rack":
			rackLeds(g, def, f, x, y, t);
			break;
		case "crah": {
			const s = W / 2 - 4;
			const spin = active && f.heatKw > 0.01 ? t * 14 : 0;
			fan(g, x + W / 2 + 1 + s / 2, y + 6 + s / 2, s / 2 - 1, spin, shade(c, 0.4), shade(c, 1.3));
			break;
		}
		case "chiller": {
			const spin = active && f.heatKw > 0.01 ? t * 16 : 0;
			const n = Math.max(1, Math.floor((W - 6) / 16));
			for (let i = 0; i < n; i++) fan(g, x + 3 + 8 + i * 16, y + 4, 4, spin + i, shade(c, 0.4), shade(c, 1.4));
			break;
		}
		case "cdu": {
			const spin = active ? t * 10 : 0;
			fan(g, x + W / 2, y + 14, 4, spin, shade(c, 0.5), a);
			break;
		}
		case "grid_tie": {
			// Hum light.
			const on = active && f.powerKw > 0;
			px(g, x + W - 9, y + 12, 2, 2, on ? LED.ok : LED.off);
			break;
		}
		case "genset": {
			const run = f.running === true;
			px(g, x + W - 11, y + 13, 2, 2, run ? LED.ok : LED.red);
			px(g, x + W - 8, y + 13, 2, 2, run ? (Math.floor(t * 4) % 2 ? LED.amber : LED.off) : LED.off);
			if (run) {
				// Engine shake on the doors.
				const j = Math.floor(t * 20) % 2;
				px(g, x + 18 + j, y + 10, 30, 1, shade(c, 1.2), 0.5);
			}
			break;
		}
		case "ups": {
			const ch = Math.max(0, Math.min(1, f.charge ?? 0));
			const inner = W - 10;
			const col = ch > 0.5 ? LED.ok : ch > 0.2 ? LED.amber : LED.red;
			px(g, x + 5, y + 6, Math.round(inner * ch), 2, col);
			break;
		}
		case "depot": {
			const n = Math.max(0, Math.floor(f.stored ?? 0));
			const per = Math.max(1, Math.floor((W - 8) / 5));
			for (let i = 0; i < Math.min(n, per * 3); i++) {
				const s = Math.floor(i / per);
				const k = i % per;
				const bx = x + 4 + k * 5;
				const by = y + 5 + s * 10;
				px(g, bx, by, 4, 4, 0xb5793e);
				px(g, bx, by, 4, 1, 0xd89a5a);
				px(g, bx + 1, by + 2, 2, 1, a, 0.7);
			}
			break;
		}
		case "charger": {
			const pulse = active ? 0.5 + 0.5 * Math.sin(t * 4) : 0;
			px(g, x + W - 6, y + 9, 3, 2, active ? a : LED.off, active ? 0.5 + pulse * 0.5 : 1);
			break;
		}
	}
	if (!f.enabled || f.status === "unpowered" || f.status === "disabled") {
		px(g, x + 1, y, W - 2, H, 0x000000, 0.4);
	}
	drawBadge(g, f, x + W / 2, top + 1, t);
}

function rackLeds(g: Graphics, def: FacilityDef, f: FacilityView, x: number, y: number, t: number): void {
	const cue = ledCue(f.status, f.enabled);
	const slot = Math.floor(t * 8);
	const blinkOn = Math.floor(t * 2.5) % 2 === 0;
	for (let i = 0; i < def.width; i++) {
		const lx = x + i * TILE + 12;
		for (let l = 0; l < 9; l++) {
			const ly = y + 4 + l * 3;
			let on = true;
			if (cue.mode === "off") on = false;
			else if (cue.mode === "blink") on = blinkOn;
			else if (cue.mode === "activity") on = flicker(f.id, i * 16 + l, slot + l) < 0.25 + f.clock * 0.6;
			px(g, lx, ly, 2, 1, on ? cue.color : LED.off);
		}
	}
}

/** Status icon (wrench / crossed drop / crossed bolt) on a dark tag above the facility. */
function drawBadge(g: Graphics, f: FacilityView, cx: number, y: number, t: number): void {
	const b = badgeFor(f.status);
	if (!b) return;
	if (Math.floor(t * 2) % 3 === 2) return; // gentle blink
	const x = Math.round(cx) - 5;
	px(g, x - 1, y - 1, 11, 9, 0x000000, 0.75);
	px(g, x, y, 9, 7, b === "wrench" ? 0xffb020 : b === "noCoolant" ? 0x2a6fdb : 0xffd23f);
	const ink = 0x111111;
	if (b === "wrench") {
		px(g, x + 2, y + 1, 2, 2, ink);
		px(g, x + 3, y + 2, 1, 1, 0xffb020);
		px(g, x + 4, y + 3, 1, 1, ink);
		px(g, x + 5, y + 4, 1, 1, ink);
		px(g, x + 6, y + 5, 2, 1, ink);
	} else if (b === "noCoolant") {
		px(g, x + 4, y + 1, 1, 1, 0xffffff);
		px(g, x + 3, y + 2, 3, 2, 0xffffff);
		px(g, x + 3, y + 4, 3, 1, 0xffffff);
		cross(g, x, y);
	} else {
		px(g, x + 4, y + 1, 2, 1, ink);
		px(g, x + 3, y + 2, 2, 1, ink);
		px(g, x + 3, y + 3, 4, 1, ink);
		px(g, x + 5, y + 4, 1, 1, ink);
		px(g, x + 4, y + 5, 1, 1, ink);
		cross(g, x, y);
	}
	void t;
}

function cross(g: Graphics, x: number, y: number): void {
	for (let i = 0; i < 7; i++) px(g, x + 1 + i, y + i, 1, 1, 0xff2020);
}
