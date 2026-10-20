/**
 * In-world feedback for sim events (M4): "+$" floaters (money green) rising from the job's racks, red "−$" floaters for failed
 * jobs, and small build puffs for auto-built devices. Pools are fixed (see `floaters.ts`): no per-frame allocation, hard caps.
 * Reduced motion: floaters and puffs do not move, they only fade.
 */
import type { ContentDB } from "@aitower/content";
import type { SimEvent, SimView } from "@aitower/sim";
import { Container, Graphics } from "pixi.js";
import { FloaterField, PUFF_LIFE, PuffField, applyEvents, floatAlpha, floatOffset } from "../floaters";
import { MONEY, T, lt } from "../palette";
import { px } from "./draw";
import { TextPool } from "./labels";

const PUFF = lt(T.steel, 0.45);

export class Juice {
	readonly root = new Container();
	private readonly puffsG = new Graphics();
	private readonly texts = new TextPool(10);
	readonly floaters = new FloaterField();
	readonly puffs = new PuffField();

	constructor(private readonly content: ContentDB) {
		this.root.addChild(this.puffsG, this.texts.root);
	}

	private isRack = (defId: string): boolean => this.content.facilities[defId]?.kind === "rack";

	/** Turn events into floaters and puffs against the latest view. */
	push(events: readonly SimEvent[], view: SimView | null): void {
		if (view) applyEvents(events, view, this.floaters, this.puffs, this.isRack);
	}

	update(dt: number, reduced: boolean): void {
		this.floaters.update(dt);
		this.puffs.update(dt);
		const g = this.puffsG;
		g.clear();
		for (const p of this.puffs.items) {
			if (!p.active) continue;
			const u = p.age / PUFF_LIFE;
			const a = (1 - u) * 0.8;
			const cx = Math.round(p.x);
			const cy = Math.round(p.y);
			if (reduced) {
				// Static fade: a still plus.
				px(g, cx - 3, cy, 7, 1, PUFF, a);
				px(g, cx, cy - 3, 1, 7, PUFF, a);
				continue;
			}
			// Eight motes flying out from the build spot.
			const r = 2 + Math.round(u * 7);
			for (let k = 0; k < 8; k++) {
				const ang = (k * Math.PI) / 4;
				px(g, cx + Math.round(Math.cos(ang) * r), cy + Math.round(Math.sin(ang) * r * 0.7) - Math.round(u * 3), 1 + (u < 0.5 ? 1 : 0), 1 + (u < 0.5 ? 1 : 0), PUFF, a);
			}
		}
		this.texts.begin();
		for (const f of this.floaters.items) {
			if (!f.active) continue;
			const t = this.texts.put(f.text, Math.round(f.x), Math.round(f.y + floatOffset(f.age, reduced)), f.kind === "earned" ? MONEY : T.red);
			t.alpha = floatAlpha(f.age);
		}
		this.texts.end();
	}
}
