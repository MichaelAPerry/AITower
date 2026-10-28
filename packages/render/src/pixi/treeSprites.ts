/**
 * One entry point for the tree sprites (docs/ART_DIRECTION.md): racks and support items of the Green, Bio and Synthetic trees.
 * `facilityArt.ts` calls these; they dispatch to `greenRacks.ts` / `greenSprites.ts`, `bioSprites.ts` and `synthSprites.ts`.
 */
import type { Graphics } from "pixi.js";
import { type GreenSprite, type RackSprite, spriteTree } from "../art";
import type { LiveFx } from "../horror";
import { type Mat } from "../palette";
import { bioDoorLive, bioDoorStatic, bioShell, bioSpansLive, bioSpansStatic, bioSupportBody, bioSupportLive, bioTrim } from "./bioSprites";
import { greenDoorLive, greenDoorStatic, greenShell, greenSpansLive, greenSpansStatic } from "./greenRacks";
import { type SupportLive, greenSupportBody, greenSupportLive, greenTrim } from "./greenSprites";
import { synthDoorLive, synthDoorStatic, synthShell, synthSpansLive, synthSpansStatic, synthSupportBody, synthSupportLive, synthTrim } from "./synthSprites";

export type { SupportLive } from "./greenSprites";

type G = "nm1" | "nm2" | "ph1" | "ph2";
type B = "oc1" | "oc2" | "oc3" | "oc4";
type S = "lc2" | "lc3" | "lc4" | "ml1";
const isG = (s: RackSprite): s is G => spriteTree(s) === "greentech";
const isB = (s: RackSprite): s is B => spriteTree(s) === "biotech";

/** Cabinet shell (the rack enamel colour) of a tree rack. */
export const rackShell = (s: RackSprite): number => (isG(s) ? greenShell(s) : isB(s) ? bioShell(s) : synthShell(s as S));

/** Trim material of a tree rack's cornice, pilasters and sensor bar. */
export const rackTrim = (s: RackSprite): Mat => (isG(s) ? greenTrim() : isB(s) ? bioTrim(s) : synthTrim());

/** Static door interior of cabinet `i` (cabinet left edge `cx`, body top `y`). */
export function rackDoorStatic(g: Graphics, s: RackSprite, cx: number, y: number, i: number, n: number): void {
	if (isG(s)) greenDoorStatic(g, s, cx, y, i);
	else if (isB(s)) bioDoorStatic(g, s, cx, y, i, n);
	else synthDoorStatic(g, s as S, cx, y, i, n);
}

/** Live pass of one cabinet: `p` activity 0..1, `on` powered, `calm` reduced motion. `fx` carries the cursor for eyes. */
export function rackDoorLive(g: Graphics, s: RackSprite, cx: number, y: number, i: number, n: number, seed: number, t: number, calm: boolean, on: boolean, p: number, fx: LiveFx): void {
	if (isG(s)) greenDoorLive(g, s, cx, y, seed, t, calm, on, p);
	else if (isB(s)) bioDoorLive(g, s, cx, y, i, n, seed, t, calm, on, p, fx);
	else synthDoorLive(g, s as S, cx, y, i, n, seed, t, calm, on, p);
}

/** Static art over the whole rack (growth crossing the gaps, the tree, the flesh wall, the monolith). */
export function rackSpansStatic(g: Graphics, s: RackSprite, x: number, y: number, n: number): void {
	if (isG(s)) greenSpansStatic(g, s, x, y, n);
	else if (isB(s)) bioSpansStatic(g, s, x, y, n);
	else synthSpansStatic(g, s as S, x, y, n);
}

/** Live pass over the whole rack. */
export function rackSpansLive(g: Graphics, s: RackSprite, x: number, y: number, n: number, seed: number, t: number, calm: boolean, on: boolean, p: number, fx: LiveFx): void {
	if (isG(s)) greenSpansLive(g, s, x, y, n, seed, t, calm, on, p);
	else if (isB(s)) bioSpansLive(g, s, x, y, n, seed, t, calm, on, p, fx);
	else synthSpansLive(g, s as S, x, y, n, seed, t, calm, on, p);
}

/** Static body of a support sprite (not a rack). `x` = left edge, `y` = top of the body, `W` = width in px. */
export function supportBody(g: Graphics, s: GreenSprite, x: number, y: number, W: number): void {
	const tree = spriteTree(s);
	if (tree === "greentech") greenSupportBody(g, s, x, y, W);
	else if (tree === "biotech") bioSupportBody(g, s, x, y, W);
	else synthSupportBody(g, s, x, y, W);
}

/** Live pass of a support sprite. */
export function supportLive(g: Graphics, s: GreenSprite, x: number, y: number, W: number, l: SupportLive, fx: LiveFx): void {
	const tree = spriteTree(s);
	if (tree === "greentech") greenSupportLive(g, s, x, y, W, l);
	else if (tree === "biotech") bioSupportLive(g, s, x, y, W, l, fx);
	else synthSupportLive(g, s, x, y, W, l);
}
