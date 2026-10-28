/**
 * The Green racks (docs/ART_DIRECTION.md): the machine is overtaken by living things, rung by rung.
 *   NM-1  a cabinet with moss on it and a few sprouts
 *   NM-2  mycelium threads and fungus covering it
 *   PH-1  a sapling growing through the door, light coming down through its leaves
 *   PH-2  a small tree: trunk, canopy and roots over the floor; the machine barely shows
 * Same rules as the rest of the world art (axis-aligned rects, 1 px outline, tokens and their shades). Rack sprites draw the door
 * interior of a 15 px cabinet (`rackDoorStatic`, door glass 9 x 23 at (cx + 4, y + 3)) and, over the whole rack, `rackSpansStatic`
 * (growth that crosses the gaps between cabinets and spills over the frame). Static parts are cached; the `*Live` functions only
 * flick a few rects with module constants and arithmetic (no allocation per frame) and hold still under reduced motion.
 */
import type { Graphics } from "pixi.js";
import { T, dk, lt, mat, mix } from "../palette";
import { hash, px } from "./draw";
import { BARK, CAP, FERN, HYPHA, LEAF, MOSS, SHROOM, SOIL, SPORE, SUN, bracket, clump, frond, hypha, leafPair, mossCap, scatter, sprout, toadstool, vine } from "./organic";

export type GreenRack = "nm1" | "nm2" | "ph1" | "ph2";

/** Cabinet shell (the rack enamel colour): graphite with a leaf cast, the photonic ones paler. */
export const greenShell = (s: GreenRack): number => (s === "ph1" || s === "ph2" ? mix(T.putty, T.brass, 0.18) : mix(T.putty, T.greenDim, 0.42));

const CHIP = mix(T.steel, T.ink, 0.5);
const GLASS_P = mix(T.housingHi, T.brass, 0.2);
const BEAM = mix(GLASS_P, T.paper, 0.55);
const DARK_LEAF = dk(FERN.dk, 0.2);
const MOSS_SHADES = [MOSS.mid, MOSS.mid, MOSS.lo, MOSS.hi, LEAF.mid] as const;
const DEEP_SHADES = [MOSS.lo, FERN.dk, MOSS.mid, FERN.dk] as const;

// Door glass of a cabinet: 9 x 23 at (cx + 4, y + 3).
const GX = 4;
const GY = 3;
const GW = 9;
const GH = 23;

/** Photonic beam rows of PH-1 (relative to the door glass). */
const PH_BEAMS = [6, 12, 18] as const;
/** Nodes of the mycelium network of NM-2 per cabinet (door-relative x, y): they spike live. */
const NM2_NODES = [
	[1, 6],
	[5, 11],
	[2, 15],
	[6, 19],
	[3, 3],
] as const;

export function greenDoorStatic(g: Graphics, s: GreenRack, cx: number, y: number, i: number): void {
	const gx = cx + GX;
	const gy = y + GY;
	if (s === "nm1") {
		// Dark glass with four rows of dim chips at the top; the lower half is moss.
		for (let r = 0; r < 4; r++) for (let q = 0; q < 3; q++) px(g, gx + 1 + q * 3, gy + 2 + r * 3, 2, 1, CHIP);
		scatter(g, gx, gy + 13, GW, 10, 11 + i * 17, 0.95, MOSS_SHADES, true);
		px(g, gx, gy + GH - 2, GW, 2, MOSS.lo);
		scatter(g, gx, gy + GH - 4, GW, 2, 5 + i, 1, MOSS_SHADES);
		// Moss creeping down the left frame from the top and a few sprouts out of the clump.
		scatter(g, cx + 1, y + 1, 3, 11, 3 + i * 5, 0.7, MOSS_SHADES, true);
		sprout(g, gx + 2 + i * 3, gy + 14, 6);
		if (i === 0) sprout(g, gx + 7, gy + 14, 3);
		else px(g, gx + 6, gy + 13, 1, 1, LEAF.hi);
	} else if (s === "nm2") {
		// Overgrown: moss over most of the glass, mycelium threads climbing from the foot, nodes at the junctions.
		scatter(g, gx, gy + 1, GW, GH - 2, 21 + i * 31, 0.5, DEEP_SHADES);
		scatter(g, gx, gy + 12, GW, 11, 7 + i * 9, 0.85, MOSS_SHADES, true);
		hypha(g, gx + 1, gy + GH - 3, 18, 1, -1, 41 + i * 7);
		hypha(g, gx + 6, gy + GH - 3, 16, -1, -1, 77 + i * 5);
		hypha(g, gx + 3, gy + 12, 9, 1, -1, 13 + i);
		for (const n of NM2_NODES) px(g, gx + n[0], gy + n[1], 1, 1, SPORE, 0.55);
		// Bracket fungus shelves growing off the door frame, a small toadstool at the foot.
		bracket(g, gx + GW - 1, gy + 8 + (i ? 3 : 0), 2, -1, 5);
		bracket(g, gx, gy + 15 - (i ? 3 : 0), 2, 1, 4);
		toadstool(g, gx + 1 + i * 3, gy + GH - 6, true);
		toadstool(g, gx + 6, gy + GH - 5, false);
	} else if (s === "ph1") {
		// The door glass is cracked open and lit from above: pale glass, beams, light shafts.
		px(g, gx, gy, GW, GH, GLASS_P);
		px(g, gx, gy, GW, 1, lt(GLASS_P, 0.3));
		for (const by of PH_BEAMS) {
			px(g, gx + 1, gy + by, GW - 2, 1, BEAM, i === 0 ? 0.4 : 1);
			px(g, gx, gy + by - 1, 1, 3, T.brass, 0.5);
			px(g, gx + GW - 1, gy + by - 1, 1, 3, T.brass, 0.5);
		}
		// Light shafts coming down through the leaves (two diagonals).
		for (let k = 0; k < GH - 2; k++) {
			px(g, gx + 1 + Math.floor(k * 0.35), gy + 1 + k, 1, 1, SUN, 0.28);
			px(g, gx + 5 + Math.floor(k * 0.3), gy + 1 + k, 1, 1, SUN, 0.2);
		}
		if (i === 0) {
			// The sapling: trunk up the middle of the door, three leaf pairs, a crown above the cabinet.
			px(g, gx + 4, gy + 3, 2, GH - 4, BARK.mid);
			px(g, gx + 4, gy + 3, 1, GH - 4, BARK.hi);
			px(g, gx + 5, gy + 8, 1, GH - 9, BARK.lo);
			px(g, gx + 3, gy + GH - 1, 5, 1, SOIL.mid);
			px(g, gx + 2, gy + GH - 3, 7, 3, SOIL.lo);
			px(g, gx + 2, gy + GH - 3, 7, 1, SOIL.hi);
			for (const [ly, side] of [
				[17, -1],
				[12, 1],
				[7, -1],
			] as const) {
				px(g, gx + (side < 0 ? 1 : 6), gy + ly, 3, 1, BARK.lo);
				px(g, gx + (side < 0 ? 0 : 7), gy + ly - 1, 2, 1, LEAF.mid);
				px(g, gx + (side < 0 ? 0 : 8), gy + ly - 2, 1, 1, LEAF.hi);
				px(g, gx + (side < 0 ? 1 : 6), gy + ly + 1, 2, 1, FERN.mid);
			}
			leafPair(g, gx + 4, gy + 1);
			leafPair(g, gx + 5, gy - 3);
			px(g, gx + 3, gy - 4, 2, 1, LEAF.hi);
			px(g, gx + 5, gy - 2, 1, 2, BARK.mid);
		} else {
			// Second cabinet: the photonic door, overgrown from the first, vines hanging over the beams.
			vine(g, gx + 1, gy + 1, 15, 31);
			vine(g, gx + 6, gy + 1, 9, 77);
			vine(g, gx + 8, gy + 1, 12, 19);
			scatter(g, gx, gy + GH - 6, GW, 6, 17, 0.9, MOSS_SHADES, true);
			px(g, gx + 4, gy + GH - 6, 1, 1, LEAF.hi);
		}
	} else {
		// PH-2: only a dark foliage backdrop here; the tree itself is drawn over the whole rack by `greenSpansStatic`.
		scatter(g, gx, gy, GW, GH, 91 + i * 13, 0.75, DEEP_SHADES);
	}
}

/** Growth that spills out across the whole rack: n cabinets from x. */
export function greenSpansStatic(g: Graphics, s: GreenRack, x: number, y: number, n: number): void {
	const W = n * 16;
	if (s === "nm1") {
		// A mossy cap along the whole top of the rack and the odd sprout and toadstool.
		for (let i = 0; i < n; i++) mossCap(g, x + i * 16 + 2, y + 1, 12, 5 + i, 3);
		sprout(g, x + 4, y, 4);
		sprout(g, x + W - 5, y, 3);
		toadstool(g, x + W - 8, y + 26, false);
		for (let i = 0; i < n; i++) scatter(g, x + i * 16 + 1, y + 27, 15, 3, 33 + i, 0.6, MOSS_SHADES, false);
	} else if (s === "nm2") {
		for (let i = 0; i < n; i++) {
			mossCap(g, x + i * 16 + 1, y + 1, 14, 9 + i, 4);
			scatter(g, x + i * 16 + 1, y + 24, 15, 7, 51 + i, 0.85, MOSS_SHADES);
		}
		// Threads bridging the gaps between cabinets, shelf fungus on top and around the foot, a toadstool colony.
		for (let i = 0; i < n - 1; i++) {
			const gxp = x + (i + 1) * 16 - 1;
			hypha(g, gxp - 3, y + 8, 7, 1, 0, 61 + i, 0.95);
			hypha(g, gxp - 4, y + 17, 9, 1, 1, 71 + i, 0.95);
		}
		bracket(g, x + 1, y + 6, 2, 1, 5);
		bracket(g, x + W - 1, y + 20, 2, -1, 5);
		toadstool(g, x + 2, y + 24, true);
		toadstool(g, x + W - 8, y + 25, true);
		toadstool(g, x + W - 3, y + 27, false);
		px(g, x + 4, y - 2, 2, 2, CAP.mid);
		px(g, x + 5, y, 1, 1, SHROOM.mid);
	} else if (s === "ph1") {
		// Crown spreading above the top, moss on the frame, roots over the kick plate.
		clump(g, x + 4, y - 4, 8, 5);
		clump(g, x + 8, y - 5, 7, 12);
		px(g, x + 14, y + 9, 3, 1, BARK.lo);
		scatter(g, x + 1, y + 1, 4, 14, 3, 0.6, MOSS_SHADES, true);
		px(g, x + 6, y + 27, 7, 1, BARK.mid);
		px(g, x + 2, y + 28, 5, 1, BARK.lo);
		px(g, x + 12, y + 28, 6, 1, BARK.lo);
		px(g, x + 5, y + 29, 2, 1, BARK.dk);
		scatter(g, x + 16, y + 24, 14, 5, 29, 0.5, MOSS_SHADES);
	} else {
		ph2Tree(g, x, y, n);
	}
}

/** PH-2 drawn as a small tree standing on the floor: trunk, forked branches, a broad canopy, hanging vines, roots over the floor. */
function ph2Tree(g: Graphics, x: number, y: number, n: number): void {
	const W = n * 16;
	const mid = x + Math.floor(W / 2);
	// Hanging moss and cabinet corners first (they sit under the foliage and trunk).
	for (let i = 0; i < n; i++) scatter(g, x + i * 16 + 1, y + 20, 15, 9, 41 + i, 0.7, MOSS_SHADES);
	// Branches fork from the trunk top to both sides of the canopy.
	for (let k = 0; k < 14; k++) {
		const bx = Math.round(k * 1.4);
		px(g, mid - 3 - bx, y + 12 - Math.floor(k * 0.6), 2, 2, BARK.mid);
		px(g, mid + 2 + bx, y + 12 - Math.floor(k * 0.6), 2, 2, BARK.lo);
	}
	// Trunk: 7 px at the base, narrowing to 5 under the fork, bark grain, a knot.
	for (let r = 0; r < 24; r++) {
		const ty = y + 7 + r;
		const w = r < 14 ? 5 : r < 20 ? 6 : 8;
		const tx = mid - Math.floor(w / 2);
		px(g, tx, ty, w, 1, BARK.mid);
		px(g, tx, ty, 1, 1, BARK.line);
		px(g, tx + w - 1, ty, 1, 1, BARK.line);
		px(g, tx + 1, ty, 1, 1, BARK.hi);
		px(g, tx + w - 2, ty, 1, 1, BARK.lo);
		if (hash(5, r) < 0.4) px(g, tx + 2, ty, 1, 1, BARK.dk);
	}
	px(g, mid, y + 19, 2, 2, BARK.line);
	// Roots flare over the floor and across the kick plates, ending in the slab.
	for (const dir of [-1, 1] as const) {
		for (let k = 0; k < 17; k++) {
			const rx = mid + (dir < 0 ? -4 - k : 3 + k);
			const ry = y + 27 + (k > 2 ? 1 : 0) + (k > 9 ? 1 : 0);
			if (rx < x || rx >= x + W) break;
			px(g, rx, ry, 1, k < 8 ? 3 : 2, BARK.mid);
			px(g, rx, ry, 1, 1, BARK.hi);
			px(g, rx, ry + (k < 8 ? 2 : 1), 1, 1, BARK.dk);
		}
	}
	px(g, mid - 5, y + 26, 2, 2, BARK.mid);
	px(g, mid + 4, y + 26, 2, 2, BARK.lo);
	// Moss on the roots and a toadstool or two.
	scatter(g, mid - 14, y + 27, 8, 2, 7, 0.5, MOSS_SHADES);
	scatter(g, mid + 7, y + 27, 8, 2, 9, 0.5, MOSS_SHADES);
	toadstool(g, mid - 10, y + 24, true);
	toadstool(g, mid + 9, y + 25, false);
	// Canopy: three layers of clumps, 8 to 14 px, wider than the rack, shaded from sunlit top to dim underside.
	const clumps: readonly (readonly [number, number, number])[] = [
		[-3, 13, 9],
		[7, 11, 11],
		[mid - x - 18, 7, 11],
		[mid - x + 6, 7, 11],
		[mid - x - 7, 2, 14],
		[mid - x - 1, 1, 12],
		[3, 5, 12],
		[W - 14, 4, 12],
		[16, -4, 13],
		[W - 29, -5, 13],
		[mid - x - 6, -7, 12],
	];
	for (const [cx, cy, d] of clumps) {
		const px0 = Math.max(0, Math.min(W - d, cx));
		clump(g, x + px0, y + cy - 4, d, cx * 7 + cy);
	}
	// Fill the underside of the canopy with leafy hanging bits and vines over the door glass.
	for (let c = 3; c < W - 3; c += 4) vine(g, x + c, y + 12 + Math.floor(hash(3, c) * 3), 5 + Math.floor(hash(8, c) * 7), c * 3 + 1);
	// Dapples: sun through the leaves.
	for (let k = 0; k < 20; k++) {
		const dx = Math.floor(hash(33, k) * (W - 6)) + 3;
		const dy = Math.floor(hash(34, k) * 14) - 6;
		px(g, x + dx, y + dy + 4, 1, 1, SUN, 0.9);
	}
	frond(g, x + 2, y + 30, 5, 1);
	frond(g, x + W - 3, y + 30, 5, -1);
}

// ═══ Live ═══════════════════════════════════════════════════════════════

/** Live pass of one cabinet: `p` = activity 0..1, `on` = powered, `calm` = reduced motion. */
export function greenDoorLive(g: Graphics, s: GreenRack, cx: number, y: number, seed: number, t: number, calm: boolean, on: boolean, p: number): void {
	const gx = cx + GX;
	const gy = y + GY;
	if (s === "nm1") {
		if (!on) return;
		// The few chips still lit blink steadily; a sprout leaf flicks sideways now and then.
		const lit = 0.15 + 0.35 * p;
		for (let r = 0; r < 4; r++)
			for (let q = 0; q < 3; q++) {
				const slot = calm ? 0 : Math.floor(t * 2.2 + hash(seed, r * 3 + q) * 5);
				if (hash(seed * 31 + r * 3 + q, slot) < lit) px(g, gx + 1 + q * 3, gy + 2 + r * 3, 2, 1, LEAF.hi);
			}
		if (!calm && Math.floor(t * 0.7 + seed) % 3 === 0) px(g, gx + 2 + (seed % 2) * 3 + 1, gy + 7, 1, 1, LEAF.hi);
	} else if (s === "nm2") {
		if (!on) return;
		// Event spikes: a node on the mycelium flashes, brightening the thread beside it.
		const lit = 0.06 + 0.14 * p;
		for (let k = 0; k < NM2_NODES.length; k++) {
			const slot = calm ? 0 : Math.floor(t * 3.4 + hash(seed, k) * 4);
			const hot = hash(seed * 37 + k, slot) < lit;
			const n = NM2_NODES[k];
			if (hot || (calm && hash(seed * 41 + k, 1) < 0.35)) {
				px(g, gx + n[0] - 1, gy + n[1], 3, 1, SPORE, 0.45);
				px(g, gx + n[0], gy + n[1] - 1, 1, 3, SPORE, 0.45);
				px(g, gx + n[0], gy + n[1], 1, 1, T.paper);
			}
		}
	} else if (s === "ph1") {
		if (!on) return;
		if (seed % 2 === 0) {
			// Light moves through the leaves: dapples on the trunk and a warm shaft that breathes.
			for (let k = 0; k < 3; k++) {
				const slot = calm ? 0 : Math.floor(t * 1.6 + k * 1.7);
				const dy = 3 + Math.floor(hash(seed + k, slot) * 15);
				px(g, gx + 3 + (k % 2) * 3, gy + dy, 1, 1, SUN, 0.95);
			}
			px(g, gx + 1, gy + 2, 1, GH - 3, SUN, calm ? 0.12 : 0.07 + 0.08 * (0.5 + 0.5 * Math.sin(t * 1.3)));
		} else {
			for (let b = 0; b < 3; b++) {
				const by = gy + PH_BEAMS[b];
				const u = calm ? 0.5 : (t * (0.5 + 0.4 * p) + b * 0.33 + hash(seed, b) * 0.2) % 1;
				px(g, gx + 1 + Math.floor(u * (GW - 4)), by, 2, 1, T.paper);
			}
		}
	} else {
		if (!on) return;
		// A single photonic pulse still runs in the dark between the roots.
		const u = calm ? 0.3 : (t * 0.5 + hash(seed, 2)) % 1;
		px(g, gx + Math.floor(u * (GW - 2)), gy + GH - 3, 2, 1, BEAM, 0.9);
	}
}

/** Live pass over the whole rack. */
export function greenSpansLive(g: Graphics, s: GreenRack, x: number, y: number, n: number, seed: number, t: number, calm: boolean, on: boolean, p: number): void {
	if (s === "nm2") {
		// A spore mote drifts up from each toadstool; a pulse travels across the threads between cabinets.
		if (!on) return;
		for (let i = 0; i < n - 1; i++) {
			const u = calm ? 0.5 : (t * 0.45 + i * 0.4 + hash(seed, i)) % 1;
			px(g, x + (i + 1) * 16 - 4 + Math.floor(u * 8), y + 8, 1, 1, SPORE);
		}
		const m = calm ? 0.4 : (t * 0.4 + hash(seed, 7)) % 1;
		px(g, x + 3 + Math.floor(hash(seed, 3) * 8), y + 22 - Math.round(m * 8), 1, 1, SPORE, 0.9 * (1 - m));
	} else if (s === "ph2") {
		const W = n * 16;
		// Leaves flicker as the light moves; spore motes rise from under the canopy; one photonic glint remains at the foot.
		const slot = calm ? 0 : Math.floor(t * 2.2);
		for (let k = 0; k < 8; k++) {
			const dx = 3 + Math.floor(hash(seed + 9, k * 5 + (slot % 3)) * (W - 6));
			const dy = -2 + Math.floor(hash(seed + 11, k + slot) * 10);
			px(g, x + dx, y + dy, 1, 1, SUN, calm ? 0.8 : 0.5 + 0.5 * hash(seed, k + slot));
		}
		if (!on) return;
		for (let k = 0; k < 3; k++) {
			const u = calm ? 0.2 + 0.3 * k : (t * 0.22 + k / 3) % 1;
			px(g, x + 6 + k * 15 + Math.floor(Math.sin(u * 6 + k) * 2), y + 24 - Math.round(u * 20), 1, 1, SPORE, 0.9 * (1 - u));
		}
		const u = calm ? 0.5 : (t * (0.15 + 0.2 * p)) % 1;
		px(g, x + 3 + Math.floor(u * (W - 8)), y + 24, 3, 1, BEAM, 0.8);
	} else if (s === "ph1" && !calm && on) {
		const slot = Math.floor(t * 1.8);
		px(g, x + 8 + Math.floor(hash(seed, slot) * 5), y - 2 + Math.floor(hash(seed + 1, slot) * 3), 1, 1, SUN, 0.95);
	}
}

export const GREEN_HYPHA = HYPHA;
export const GREEN_TRUNK = mat(BARK.mid);
export const GREEN_MOSS_SHADES = MOSS_SHADES;
export { DARK_LEAF };
