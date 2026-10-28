/**
 * Support items of the Green tree (docs/ART_DIRECTION.md): alive, natural, solarpunk. Redrawn from nothing (the first set, leaf-trimmed
 * machines, was rejected): each item is now a piece of garden that does the machine's job.
 *   OA-400   a wooden box whose louvres are leaves and whose fan is a flower
 *   AD-1500  a living moss wall that drips, a barrel of water, a flower fan
 *   CH-5000  a greenhouse with trees inside, a roof garden and four sunflower fans
 *   FC-1000  a mossy cabinet and a bank of gas cylinders standing like vases
 *   IA-20    a rusted container turned planter: meadow on the roof, a charge bar of leaves, butterflies
 *   GW-2000  a wellhead among rocks, ferns and a pond, a turf-roofed pump house
 *   Leaf-Bolt Microgrid  solar panels on a vine-covered pergola, a battery, sunflowers
 * Same rules as the rest of the world art: axis-aligned rects, tokens and their shades, nothing allocated per frame. Static parts are
 * cached; the `*Live` functions run every frame (fan flowers, drips, steam, butterflies, charge). `x` = left edge, `y` = top of the
 * body, `W` = width in px, inside x..x+W and y..y+31.
 */
import type { Graphics } from "pixi.js";
import type { GreenSprite } from "../art";
import { solarGlow } from "../green";
import { T, TREE_GREEN, dk, lt, mat, mix } from "../palette";
import { bevel, fanBlades, hash, px, ring } from "./draw";
import { BARK, FERN, LEAF, MOSS, SOIL, SPORE, SUN, bracket, clump, frond, mossCap, scatter, sprout, toadstool, vine } from "./organic";

/** The Green tree's leaf-green ramp. */
export const TREE = mat(TREE_GREEN);
/** Trim of the Green racks. */
export const greenTrim = (): ReturnType<typeof mat> => TREE;

const WOOD = mat(mix(T.amberDim, T.amber, 0.22));
const WATER = lt(T.brass, 0.3);
const WATER_DK = mix(T.brassDk, T.ink, 0.25);
const GLASSH = mix(T.brass, T.green, 0.35);
const PETAL = lt(T.sodium, 0.25);
const PINKP = mix(T.accent2, T.paper, 0.3);
const RUST = mat(dk(mix(T.amber, T.red, 0.5), 0.28));
const PALE = mat(mix(T.paper, T.brass, 0.45));
const ROCK = mat(mix(T.amberDim, T.paper, 0.3));
const MOSS_SH = [MOSS.mid, MOSS.mid, MOSS.lo, MOSS.hi, LEAF.mid] as const;
const DEEP_SH = [MOSS.lo, FERN.dk, MOSS.mid, FERN.dk] as const;

/** What the live pass of a support sprite knows. */
export interface SupportLive {
	id: number;
	/** Enabled and not failed, tripped, unpowered or disabled. */
	usable: boolean;
	/** 0..1 load: heat removed over capacity (cooling), output share (power). */
	load: number;
	/** UPS charge 0..1 and whether it is charging. */
	charge: number;
	charging: boolean;
	minute: number;
	drought: boolean;
	calm: boolean;
	t: number;
}

/** A 3 x 3 flower: four petals round a sodium heart. */
function flower(g: Graphics, x: number, y: number, c: number): void {
	px(g, x + 1, y, 1, 1, c);
	px(g, x, y + 1, 3, 1, c);
	px(g, x + 1, y + 2, 1, 1, c);
	px(g, x + 1, y + 1, 1, 1, T.sodium);
}

/** A tuft of grass: `h` tall blades leaning a little. */
function tuft(g: Graphics, x: number, y: number, h: number, seed: number): void {
	for (let k = 0; k < 3; k++) {
		const bh = Math.max(2, h - (k === 1 ? 0 : 1 + Math.floor(hash(seed, k) * 2)));
		px(g, x + k, y - bh, 1, bh, k === 1 ? LEAF.mid : FERN.mid);
		px(g, x + k, y - bh, 1, 1, LEAF.hi);
	}
}

/** A wooden box with a light rim top-left. */
function woodBox(g: Graphics, x: number, y: number, w: number, h: number): void {
	bevel(g, x, y, w, h, WOOD);
	for (let gx = x + 3; gx < x + w - 2; gx += 5) px(g, gx, y + 2, 1, h - 4, WOOD.lo, 0.6);
}

/** A flower-shaped fan bay: a wooden ring round a dark well; blades are drawn live. */
function fanWell(g: Graphics, x: number, y: number, d: number): void {
	ring(g, x, y, d, WOOD.line, WOOD.mid);
	ring(g, x + 1, y + 1, d - 2, WOOD.lo, dk(T.ink, 0.1));
}

function fanFlower(g: Graphics, x: number, y: number, d: number, angle: number): void {
	fanBlades(g, x + 1, y + 1, d - 2, angle, PETAL);
}

// ═══ OA-400 economizer ═════════════════════════════════════════════════

function econBody(g: Graphics, x: number, y: number, W: number): void {
	woodBox(g, x + 1, y + 9, W - 2, 21);
	// Louvres of leaves: each slat is a row of leaves with dark air between.
	px(g, x + 3, y + 11, 24, 17, WOOD.line);
	for (let r = 0; r < 5; r++) {
		const ly = y + 12 + r * 3;
		px(g, x + 4, ly, 22, 1, LEAF.hi);
		px(g, x + 4, ly + 1, 22, 1, r & 1 ? LEAF.mid : FERN.mid);
		for (let c = 0; c < 22; c += 3) px(g, x + 4 + c + (r & 1), ly + 2, 1, 1, FERN.dk);
	}
	fanWell(g, x + 29, y + 12, 15);
	// Plaque with a sprout, a seed drawer under it.
	px(g, x + 32, y + 26, 9, 3, WOOD.line);
	sprout(g, x + 36, y + 28, 2);
	// Roof garden: turf, flowers, a vine down the front corner, a toadstool at the foot.
	mossCap(g, x + 2, y + 9, W - 4, 3, 3);
	for (const [fx, c] of [[6, PINKP], [14, PETAL], [34, PINKP], [41, PETAL]] as const) {
		px(g, x + fx + 1, y + 6, 1, 3, FERN.mid);
		flower(g, x + fx, y + 4, c);
	}
	tuft(g, x + 22, y + 9, 5, 4);
	vine(g, x + 3, y + 12, 15, 5);
	vine(g, x + W - 4, y + 12, 11, 8);
	scatter(g, x + 2, y + 27, W - 4, 3, 9, 0.6, MOSS_SH);
	toadstool(g, x + W - 8, y + 25, false);
}

function econLive(g: Graphics, x: number, y: number, s: SupportLive): void {
	const spin = s.usable && !s.calm;
	fanFlower(g, x + 29, y + 12, 15, spin ? s.t * (5 + 9 * s.load) : 0.5);
	if (!s.usable) return;
	// Seeds and pollen drift in through the leaf louvres.
	for (let k = 0; k < 3; k++) {
		const u = s.calm ? 0.2 + 0.3 * k : (s.t * 0.4 + k * 0.33) % 1;
		px(g, x + 5 + Math.floor(u * 20), y + 13 + k * 5 + Math.floor(Math.sin(u * 9 + k) * 1.2), 1, 1, SUN, Math.min(1, u * 5, (1 - u) * 5));
	}
}

// ═══ AD-1500 adiabatic unit ════════════════════════════════════════════

function adiabaticBody(g: Graphics, x: number, y: number, W: number): void {
	woodBox(g, x + 1, y + 8, W - 2, 22);
	// The living wall: a soil panel packed with moss, ferns and tiny flowers.
	px(g, x + 3, y + 10, 30, 18, SOIL.line);
	px(g, x + 4, y + 11, 28, 16, SOIL.mid);
	scatter(g, x + 4, y + 11, 28, 16, 17, 0.95, MOSS_SH);
	scatter(g, x + 4, y + 11, 28, 16, 29, 0.5, DEEP_SH);
	for (let k = 0; k < 6; k++) flower(g, x + 5 + k * 5 + (k & 1), y + 13 + ((k * 5) % 9), k % 3 === 0 ? PINKP : PETAL);
	frond(g, x + 8, y + 27, 7, 1);
	frond(g, x + 28, y + 27, 7, -1);
	// The water barrel: staves, hoops, a surface with a lily pad.
	bevel(g, x + 36, y + 13, 14, 16, WOOD);
	for (const hy of [y + 15, y + 26]) px(g, x + 36, hy, 14, 1, WOOD.line);
	px(g, x + 38, y + 14, 10, 3, WATER_DK);
	px(g, x + 38, y + 14, 10, 1, WATER);
	px(g, x + 41, y + 15, 3, 1, LEAF.mid);
	px(g, x + 36, y + 17, 14, 1, WOOD.lo, 0.7);
	// Fan well, a planter box on top with ferns and a flower, moss on the rim.
	fanWell(g, x + 51, y + 13, 12);
	px(g, x + 2, y + 5, W - 4, 4, SOIL.line);
	px(g, x + 3, y + 6, W - 6, 3, SOIL.mid);
	scatter(g, x + 3, y + 5, W - 6, 4, 4, 0.9, MOSS_SH);
	frond(g, x + 6, y + 6, 5, 1);
	frond(g, x + 24, y + 6, 4, -1);
	flower(g, x + 44, y + 3, PINKP);
	sprout(g, x + 56, y + 6, 4);
	vine(g, x + 34, y + 9, 12, 3);
	toadstool(g, x + 40, y + 26, false);
}

function adiabaticLive(g: Graphics, x: number, y: number, s: SupportLive): void {
	const spin = s.usable && !s.calm;
	fanFlower(g, x + 51, y + 13, 12, spin ? s.t * (5 + 9 * s.load) : 0.4);
	if (!s.usable) return;
	// Water drips down the wall; a ring spreads on the barrel.
	for (let k = 0; k < 4; k++) {
		const u = s.calm ? 0.3 + 0.1 * k : (s.t * (0.5 + 0.4 * s.load) + k * 0.27) % 1;
		px(g, x + 6 + k * 7 + (k & 1), y + 11 + Math.floor(u * 15), 1, 2, WATER, 1 - u * 0.5);
	}
	const r = s.calm ? 2 : 1 + Math.floor(((s.t * 0.8) % 1) * 4);
	px(g, x + 43 - r, y + 15, r * 2, 1, WATER, 0.5);
	// Mist leaves the wall toward the fan.
	for (let k = 0; k < 3; k++) {
		const u = s.calm ? 0.3 : (s.t * 0.3 + k * 0.33) % 1;
		px(g, x + 32 + Math.floor(u * 5), y + 14 + k * 4, 2, 1, WATER, 0.5 * (1 - u));
	}
}

// ═══ CH-5000 adiabatic chiller: a greenhouse ═══════════════════════════

const FAN_SLOTS = 4;
const fanX = (x: number, W: number, k: number): number => x + 8 + Math.floor((k * (W - 16)) / FAN_SLOTS) + 2;

function chillerBody(g: Graphics, x: number, y: number, W: number): void {
	// Planter base along the whole front, soil and moss.
	woodBox(g, x + 1, y + 24, W - 2, 6);
	scatter(g, x + 2, y + 24, W - 4, 3, 5, 0.9, MOSS_SH);
	// The greenhouse: wooden posts, glass panes tinted green, plants and small trees inside.
	px(g, x + 2, y + 10, W - 4, 14, WOOD.line);
	px(g, x + 3, y + 11, W - 6, 13, GLASSH, 0.28);
	px(g, x + 3, y + 11, W - 6, 13, dk(T.ink, 0.05), 0.55);
	for (let k = 0; k < Math.floor((W - 8) / 16); k++) {
		const cx = x + 6 + k * 16;
		clump(g, cx + 1, y + 11, 9, 11 + k);
		px(g, cx + 5, y + 19, 1, 5, BARK.mid);
		frond(g, cx + 11, y + 23, 4, 1);
		flower(g, cx + 12, y + 18, k & 1 ? PINKP : PETAL);
	}
	for (let px0 = x + 2; px0 < x + W - 2; px0 += 16) px(g, px0, y + 10, 2, 14, WOOD.mid);
	px(g, x + 2, y + 10, W - 4, 1, WOOD.hi);
	// Roof garden: turf, grass, flowers, four wooden fan wells for the sunflower fans.
	px(g, x + 1, y + 7, W - 2, 3, SOIL.mid);
	mossCap(g, x + 1, y + 8, W - 2, 6, 3);
	for (let k = 0; k < FAN_SLOTS; k++) {
		fanWell(g, fanX(x, W, k), y - 1, 11);
		tuft(g, fanX(x, W, k) + 13, y + 8, 4, k);
		flower(g, fanX(x, W, k) + 15, y + 3, k & 1 ? PETAL : PINKP);
	}
	vine(g, x + 3, y + 24, 6, 2);
	toadstool(g, x + W - 9, y + 22, false);
	bracket(g, x + 3, y + 25, 1, 1, 4);
	// Drip line along the front, with a leaf valve.
	px(g, x + 4, y + 28, W - 8, 1, WATER_DK);
	for (let c = 10; c < W - 10; c += 20) px(g, x + c, y + 27, 2, 3, LEAF.mid);
}

function chillerLive(g: Graphics, x: number, y: number, W: number, s: SupportLive): void {
	for (let k = 0; k < FAN_SLOTS; k++) {
		const spin = s.usable && !s.calm;
		fanFlower(g, fanX(x, W, k), y - 1, 11, spin ? s.t * (4 + 9 * s.load) + k : 0.3 + k);
	}
	if (!s.usable) return;
	// Water runs along the drip line; dew shimmers on the panes.
	const u = s.calm ? 0.5 : (s.t * 0.4) % 1;
	px(g, x + 5 + Math.floor(u * (W - 12)), y + 28, 3, 1, WATER);
	for (let k = 0; k < 4; k++) {
		const slot = s.calm ? 0 : Math.floor(s.t * 1.5 + k * 1.7);
		px(g, x + 6 + Math.floor(hash(s.id + k, slot) * (W - 12)), y + 12 + Math.floor(hash(s.id, slot + k) * 8), 1, 1, T.paper, 0.7);
	}
}

// ═══ FC-1000 hydrogen fuel cell ════════════════════════════════════════

const CYL = 5;
const cylX = (x: number, k: number): number => x + 35 + k * 6;

function fuelCellBody(g: Graphics, x: number, y: number): void {
	// The cabinet: pale enamel under a moss roof, a vine up one side, an H2 tag.
	bevel(g, x + 2, y + 8, 29, 22, PALE);
	px(g, x + 5, y + 12, 11, 8, PALE.line);
	px(g, x + 6, y + 13, 9, 6, dk(T.ink, 0.1));
	px(g, x + 7, y + 14, 2, 4, LEAF.lo);
	px(g, x + 10, y + 14, 4, 1, LEAF.mid);
	px(g, x + 10, y + 16, 4, 1, LEAF.mid);
	px(g, x + 19, y + 12, 9, 12, PALE.dk);
	for (let r = 0; r < 4; r++) px(g, x + 20, y + 13 + r * 3, 7, 1, PALE.lo);
	mossCap(g, x + 2, y + 8, 29, 5, 3);
	vine(g, x + 3, y + 12, 17, 6);
	frond(g, x + 6, y + 6, 4, 1);
	flower(g, x + 24, y + 4, PINKP);
	px(g, x + 25, y + 7, 1, 2, FERN.mid);
	scatter(g, x + 3, y + 25, 27, 5, 3, 0.55, MOSS_SH);
	// The bank of cylinders, each standing like a vase with something growing from its neck.
	for (let k = 0; k < 5; k++) {
		const cx = cylX(x, k);
		bevel(g, cx, y + 12, CYL, 18, PALE);
		px(g, cx + 1, y + 10, 3, 2, PALE.lo);
		px(g, cx + 1, y + 20, 1, 8, lt(T.paper, 0.2), 0.6);
		if (k % 2 === 0) {
			px(g, cx + 2, y + 6, 1, 4, FERN.mid);
			flower(g, cx + 1, y + 4, k === 2 ? PINKP : PETAL);
		} else {
			sprout(g, cx + 2, y + 10, 3);
		}
		px(g, cx, y + 24, CYL, 1, LEAF.mid, 0.9);
	}
	px(g, x + 34, y + 29, 30, 1, WOOD.lo);
	toadstool(g, x + 31, y + 25, false);
}

function fuelCellLive(g: Graphics, x: number, y: number, s: SupportLive): void {
	if (!s.usable) return;
	const lit = s.calm || Math.floor(s.t * 1.3) % 2 === 0;
	px(g, x + 8, y + 15, 1, 1, lit ? T.paper : LEAF.hi);
	// The panel bar breathes with the load.
	px(g, x + 10, y + 14, Math.max(1, Math.round(4 * s.load)), 1, LEAF.hi);
	// Spores of green light rise off the cylinders and leaves.
	for (let k = 0; k < 3; k++) {
		const u = s.calm ? 0.25 + 0.2 * k : (s.t * 0.3 + k * 0.33) % 1;
		px(g, cylX(x, k * 2) + 2 + Math.floor(Math.sin(u * 7 + k) * 1.5), y + 14 - Math.floor(u * 12), 1, 1, SPORE, 1 - u);
	}
}

// ═══ IA-20 iron-air store ══════════════════════════════════════════════

function ironAirBody(g: Graphics, x: number, y: number, W: number): void {
	// A rust-orange shipping container, ribbed, turned into a planter.
	bevel(g, x + 1, y + 12, W - 2, 18, RUST);
	for (let c = x + 5; c < x + W - 5; c += 4) px(g, c, y + 14, 1, 14, RUST.lo, 0.8);
	px(g, x + 3, y + 26, W - 6, 1, RUST.line);
	// Battery icon with a window of charge drawn live; the cap is a small flower bud.
	px(g, x + 29, y + 15, 30, 10, RUST.line);
	px(g, x + 30, y + 16, 28, 8, dk(T.ink, 0.1));
	px(g, x + 59, y + 18, 2, 4, RUST.line);
	// Doors, hinge bolts.
	px(g, x + W - 10, y + 14, 7, 14, RUST.dk);
	px(g, x + W - 9, y + 15, 5, 12, RUST.lo);
	px(g, x + W - 5, y + 20, 1, 3, T.sodium);
	// The meadow on the roof: soil, turf, grass, wildflowers, two bushes.
	px(g, x + 1, y + 9, W - 2, 4, SOIL.mid);
	px(g, x + 1, y + 9, W - 2, 1, SOIL.hi);
	mossCap(g, x + 1, y + 9, W - 2, 8, 3);
	for (let c = 5; c < W - 5; c += 7) tuft(g, x + c, y + 10, 4 + Math.floor(hash(3, c) * 4), c);
	for (let k = 0; k < 7; k++) {
		const fx = x + 6 + k * 12 + Math.floor(hash(4, k) * 4);
		const fh = 4 + Math.floor(hash(5, k) * 3);
		px(g, fx + 1, y + 9 - fh, 1, fh, FERN.mid);
		flower(g, fx, y + 7 - fh, [PINKP, PETAL, T.amber][k % 3]);
	}
	clump(g, x + 20, y + 1, 9, 5);
	clump(g, x + 70, y + 2, 8, 9);
	// Vines over the face, moss and a toadstool colony at the foot.
	vine(g, x + 4, y + 13, 16, 2);
	vine(g, x + 26, y + 13, 9, 5);
	vine(g, x + 66, y + 13, 14, 7);
	scatter(g, x + 2, y + 27, W - 4, 3, 7, 0.7, MOSS_SH);
	toadstool(g, x + 12, y + 25, true);
	toadstool(g, x + W - 14, y + 26, false);
}

function ironAirLive(g: Graphics, x: number, y: number, s: SupportLive): void {
	// Charge as a bar of leaves: rows of leaf-green cells filling left to right.
	const cells = 7;
	const lit = Math.round(s.charge * cells);
	for (let k = 0; k < cells; k++) {
		const on = k < lit;
		const pulse = on && k === lit - 1 && s.charging && !s.calm && Math.floor(s.t * 2) % 2 === 0;
		px(g, x + 31 + k * 4, y + 17, 3, 6, pulse ? T.paper : on ? (k < 2 ? T.amber : TREE.mid) : dk(RUST.mid, 0.5));
		if (on) px(g, x + 31 + k * 4, y + 17, 3, 1, TREE.hi);
	}
	if (!s.usable) return;
	// Two butterflies work the meadow.
	for (let k = 0; k < 2; k++) {
		const u = s.calm ? 0.3 + 0.4 * k : (s.t * 0.06 + k * 0.5) % 1;
		const bx = x + 4 + Math.floor(u * 84);
		const by = y + 2 + Math.floor(Math.sin(u * 40 + k * 3) * 2) + k * 3;
		const wing = s.calm || Math.floor(s.t * 6 + k) % 2 === 0;
		px(g, bx, by, 1, 1, T.paper);
		px(g, bx - 1, by - (wing ? 1 : 0), 1, 1, k ? PINKP : T.amber);
		px(g, bx + 1, by - (wing ? 1 : 0), 1, 1, k ? PINKP : T.amber);
	}
}

// ═══ GW-2000 geothermal well ═══════════════════════════════════════════

function geothermalBody(g: Graphics, x: number, y: number): void {
	// A pond at the left foot with lily pads and reeds.
	px(g, x + 2, y + 25, 20, 5, WATER_DK);
	px(g, x + 3, y + 25, 18, 1, WATER, 0.6);
	px(g, x + 6, y + 27, 3, 1, LEAF.mid);
	px(g, x + 14, y + 28, 3, 1, LEAF.mid);
	for (const rx of [3, 6, 20]) {
		px(g, x + rx, y + 18, 1, 8, FERN.mid);
		px(g, x + rx, y + 17, 1, 2, BARK.mid);
	}
	// The rock mound with the wellhead rising from it, wrapped in a vine.
	for (let c = 0; c < 26; c++) {
		const u = (c + 0.5) / 26;
		const hk = 6 + Math.round(10 * Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2)) * (0.85 + 0.2 * hash(3, c >> 1)));
		px(g, x + 20 + c, y + 30 - hk, 1, hk, c % 4 === 0 ? ROCK.lo : ROCK.mid);
		px(g, x + 20 + c, y + 30 - hk, 1, 1, ROCK.hi);
	}
	scatter(g, x + 20, y + 14, 26, 16, 12, 0.5, MOSS_SH, true);
	px(g, x + 28, y + 8, 6, 14, ROCK.line);
	px(g, x + 29, y + 9, 4, 12, WOOD.mid);
	px(g, x + 29, y + 9, 1, 12, WOOD.hi);
	px(g, x + 27, y + 7, 8, 3, ROCK.line);
	px(g, x + 28, y + 7, 6, 1, ROCK.hi);
	vine(g, x + 30, y + 9, 13, 8);
	frond(g, x + 24, y + 24, 6, -1);
	frond(g, x + 44, y + 24, 6, 1);
	// The pump house: a small timber shed with a turf roof and a lit window.
	bevel(g, x + 47, y + 15, 15, 15, WOOD);
	px(g, x + 50, y + 19, 6, 5, WOOD.line);
	px(g, x + 51, y + 20, 4, 3, dk(T.sodium, 0.35));
	px(g, x + 46, y + 12, 17, 4, SOIL.line);
	mossCap(g, x + 46, y + 12, 17, 2, 3);
	flower(g, x + 55, y + 8, PINKP);
	px(g, x + 56, y + 11, 1, 2, FERN.mid);
	px(g, x + 34, y + 12, 13, 2, ROCK.line);
	px(g, x + 35, y + 12, 11, 1, ROCK.mid);
	toadstool(g, x + 44, y + 26, true);
}

function geothermalLive(g: Graphics, x: number, y: number, s: SupportLive): void {
	if (!s.usable) return;
	// Steam rolls up from the wellhead in soft puffs.
	for (let k = 0; k < 3; k++) {
		const u = s.calm ? 0.2 + 0.25 * k : (s.t * 0.3 + k * 0.33) % 1;
		px(g, x + 29 + Math.floor(Math.sin(u * 5 + k) * 2) + k, y + 5 - Math.floor(u * 7), 2, 1, T.paper, 0.7 * (1 - u));
	}
	px(g, x + 51, y + 20, 4, 3, T.sodium, s.calm || Math.floor(s.t * 1.2) % 2 === 0 ? 0.6 : 0.3);
	const r = s.calm ? 2 : 1 + Math.floor(((s.t * 0.6) % 1) * 5);
	px(g, x + 12 - r, y + 27, r * 2, 1, WATER, 0.5);
}

// ═══ Leaf-Bolt Microgrid ═══════════════════════════════════════════════

const PANEL = mix(T.verdigris, T.accent2, 0.3);

function microgridBody(g: Graphics, x: number, y: number, W: number): void {
	// Pergola: two timber posts and a beam; vines climb both.
	px(g, x + 2, y + 6, 3, 24, WOOD.line);
	px(g, x + 3, y + 6, 1, 24, WOOD.mid);
	px(g, x + W - 5, y + 6, 3, 24, WOOD.line);
	px(g, x + W - 4, y + 6, 1, 24, WOOD.mid);
	px(g, x + 1, y + 5, W - 2, 3, WOOD.line);
	px(g, x + 2, y + 5, W - 4, 1, WOOD.hi);
	px(g, x + 2, y + 6, W - 4, 1, WOOD.mid);
	// Tilted panels in two rows, each edged in timber, with cell lines.
	for (let r = 0; r < 2; r++)
		for (let k = 0; k < 3; k++) {
			const px0 = x + 6 + k * 18;
			const py0 = y + 8 + r * 8;
			px(g, px0, py0, 17, 7, WOOD.line);
			px(g, px0 + 1, py0 + 1, 15, 5, dk(PANEL, 0.45));
			for (let c = 1; c < 15; c += 4) px(g, px0 + 1 + c, py0 + 1, 1, 5, dk(PANEL, 0.7));
			px(g, px0 + 1, py0 + 3, 15, 1, dk(PANEL, 0.7));
		}
	// Vines and flowers over the beam; a battery cabinet with the leaf-bolt badge under the panels.
	vine(g, x + 4, y + 7, 22, 3);
	vine(g, x + W - 4, y + 7, 18, 6);
	vine(g, x + 30, y + 6, 6, 9);
	mossCap(g, x + 6, y + 5, 14, 5, 2);
	bevel(g, x + 23, y + 20, 18, 10, mat(mix(T.putty, T.greenDim, 0.5)));
	px(g, x + 26, y + 22, 12, 6, dk(T.ink, 0.1));
	px(g, x + 31, y + 22, 3, 1, TREE.hi);
	px(g, x + 29, y + 23, 4, 1, TREE.mid);
	px(g, x + 30, y + 24, 5, 1, TREE.mid);
	px(g, x + 29, y + 25, 4, 1, TREE.lo);
	px(g, x + 31, y + 26, 3, 1, TREE.hi);
	// Sunflowers in planters either side.
	for (const sx of [x + 10, x + W - 18]) {
		px(g, sx, y + 27, 8, 3, SOIL.mid);
		for (let k = 0; k < 2; k++) {
			px(g, sx + 1 + k * 4, y + 20, 1, 8, FERN.mid);
			flower(g, sx + k * 4, y + 17, k ? T.amber : PETAL);
		}
		scatter(g, sx, y + 27, 8, 1, sx, 0.9, MOSS_SH);
	}
	toadstool(g, x + 44, y + 26, false);
}

function microgridLive(g: Graphics, x: number, y: number, s: SupportLive): void {
	const glow = solarGlow(s.minute, s.drought, s.usable);
	// The panels take the day's light.
	if (glow > 0.05)
		for (let r = 0; r < 2; r++)
			for (let k = 0; k < 3; k++) {
				const px0 = x + 6 + k * 18;
				const py0 = y + 8 + r * 8;
				px(g, px0 + 1, py0 + 1, 15, 5, T.brass, 0.34 * glow);
				const u = s.calm ? 0.4 : (s.t * 0.25 + k * 0.3 + r * 0.17) % 1;
				px(g, px0 + 1 + Math.floor(u * 13), py0 + 1, 2, 5, T.paper, 0.55 * glow);
			}
	if (!s.usable) return;
	const on = s.calm || Math.floor(s.t * 1.6) % 2 === 0;
	px(g, x + 31, y + 22, 3, 1, on ? T.paper : TREE.hi);
	// A bee between the sunflowers.
	const u = s.calm ? 0.3 : (s.t * 0.12) % 1;
	const bx = x + 12 + Math.floor(u * 38);
	px(g, bx, y + 15 + Math.floor(Math.sin(u * 30) * 2), 1, 1, T.amber);
}

// ═══ Entry points ══════════════════════════════════════════════════════

/** Static body of a support sprite (not a rack). */
export function greenSupportBody(g: Graphics, s: GreenSprite, x: number, y: number, W: number): void {
	switch (s) {
		case "econ":
			econBody(g, x, y, W);
			return;
		case "adiabatic":
			adiabaticBody(g, x, y, W);
			return;
		case "adiabatic_chiller":
			chillerBody(g, x, y, W);
			return;
		case "fuel_cell":
			fuelCellBody(g, x, y);
			return;
		case "iron_air":
			ironAirBody(g, x, y, W);
			return;
		case "geothermal":
			geothermalBody(g, x, y);
			return;
		case "microgrid":
			microgridBody(g, x, y, W);
			return;
		default:
			return;
	}
}

/** Live pass of a support sprite (not a rack). */
export function greenSupportLive(g: Graphics, s: GreenSprite, x: number, y: number, W: number, l: SupportLive): void {
	switch (s) {
		case "econ":
			econLive(g, x, y, l);
			return;
		case "adiabatic":
			adiabaticLive(g, x, y, l);
			return;
		case "adiabatic_chiller":
			chillerLive(g, x, y, W, l);
			return;
		case "fuel_cell":
			fuelCellLive(g, x, y, l);
			return;
		case "iron_air":
			ironAirLive(g, x, y, l);
			return;
		case "geothermal":
			geothermalLive(g, x, y, l);
			return;
		case "microgrid":
			microgridLive(g, x, y, l);
			return;
		default:
			return;
	}
}
