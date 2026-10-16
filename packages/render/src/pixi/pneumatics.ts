/**
 * Decorative pneumatic job tubes: when a rack's `jobId` changes to a new job a
 * brass capsule zips along its floor's ceiling tube from the dispatch box to the
 * rack's receiver; when a job is released a capsule returns. Change detection
 * happens here (renderer side), once per sim tick.
 */
import type { ContentDB } from "@aitower/content";
import type { RenderOptions } from "@aitower/shared";
import type { SimView } from "@aitower/sim";
import { Graphics } from "pixi.js";
import { floorTop } from "../camera";
import { TILE, TUBE_Y } from "../constants";
import { BRASS, T, lt } from "../palette";
import { receiverX } from "./facilityArt";
import { px } from "./draw";

interface Capsule {
	y: number;
	from: number;
	to: number;
	start: number;
	dur: number;
	outbound: boolean;
}

const SPEED = 260; // world px / s
const MAX_CAPSULES = 64;

export class Pneumatics {
	readonly g = new Graphics();
	private jobs = new Map<number, number | null>();
	private caps: Capsule[] = [];

	constructor(private readonly content: ContentDB) {}

	/** Call once per new sim tick. `now` is seconds. */
	onTick(view: SimView, now: number): void {
		const seen = new Set<number>();
		for (const f of view.facilities) {
			const def = this.content.facilities[f.defId];
			if (def?.kind !== "rack") continue;
			seen.add(f.id);
			const had = this.jobs.has(f.id);
			const prev = this.jobs.get(f.id) ?? null;
			this.jobs.set(f.id, f.jobId);
			if (!had || prev === f.jobId) continue;
			// Find this floor's tube run (contiguous slab) around the rack.
			const row = (f.floor - view.floorMin) * view.width;
			let l = f.x;
			while (l > 0 && view.slab[row + l - 1] === 1) l--;
			let r = f.x + def.width - 1;
			while (r < view.width - 1 && view.slab[row + r + 1] === 1) r++;
			const dispatchL = l * TILE + 3;
			const dispatchR = (r + 1) * TILE - 3;
			const rx = receiverX(f.x * TILE);
			const outbound = f.jobId === null;
			// Inbound from the nearer dispatch box; outbound back to the other one.
			const nearL = rx - dispatchL <= dispatchR - rx;
			const from = outbound ? rx : nearL ? dispatchL : dispatchR;
			const to = outbound ? (nearL ? dispatchR : dispatchL) : rx;
			if (this.caps.length < MAX_CAPSULES) {
				this.caps.push({
					y: floorTop(view, f.floor) + TUBE_Y,
					from,
					to,
					start: now + (f.id % 5) * 0.06,
					dur: Math.max(0.3, Math.abs(to - from) / SPEED),
					outbound,
				});
			}
		}
		for (const id of this.jobs.keys()) if (!seen.has(id)) this.jobs.delete(id);
	}

	/** Capsules are hidden under reduced motion (they are decorative); they stay queued and resume when it is off. */
	draw(t: number, opt: RenderOptions): void {
		const g = this.g;
		g.clear();
		if (opt.reducedMotion) return;
		let w = 0;
		for (const c of this.caps) {
			const u = (t - c.start) / c.dur;
			if (u > 1.25) continue;
			this.caps[w++] = c;
			if (u < 0) continue;
			if (u >= 1) {
				// Arrival "thunk": a brass flash ring at the receiver / box.
				const a = 1 - (u - 1) / 0.25;
				px(g, Math.round(c.to) - 3, c.y - 2, 7, 1, BRASS.hi, a * 0.8);
				px(g, Math.round(c.to) - 3, c.y + 2, 7, 1, BRASS.hi, a * 0.8);
				px(g, Math.round(c.to) - 1, c.y - 1, 3, 3, lt(T.paper, 0.5), a * 0.6);
				continue;
			}
			// Ease in-out along the tube.
			const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
			const x = Math.round(c.from + (c.to - c.from) * e);
			const dir = Math.sign(c.to - c.from) || 1;
			// Motion streak behind the capsule.
			const sp = Math.min(1, 4 * u * (1 - u) + 0.2);
			px(g, dir > 0 ? x - 11 : x + 5, c.y, 7, 2, lt(T.amber, 0.5), 0.45 * sp);
			// Capsule bulging out of the tube: ink outline, pale brass shell, paper (inbound) / red (outbound) band.
			px(g, x - 3, c.y - 2, 7, 6, T.ink);
			px(g, x - 2, c.y - 1, 5, 4, lt(T.brass, 0.45));
			px(g, x - 2, c.y - 1, 5, 1, lt(T.brass, 0.75));
			px(g, x - 2, c.y + 2, 5, 1, BRASS.lo);
			px(g, x, c.y - 1, 1, 4, c.outbound ? T.red : T.green);
		}
		this.caps.length = w;
	}
}
