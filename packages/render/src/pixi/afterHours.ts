/**
 * The four after-hours items (docs/AFTER_HOURS.md): Bea's fern and Cass's coffee machine in the lobby (G), Mel's fish tank and the
 * book on Luci's desk in the basement (B). Each has a plain look and an upgraded one. The art is the owner's sprite sheet, cut into
 * eight small PNGs (`ahArt/`), drawn at furniture scale (images, not code). They are not facilities: the sim keeps the cells
 * free, and a click on them is counted by the UI.
 */
import type { SimView } from "@aitower/sim";
import { Assets, Container, Sprite, type Texture } from "pixi.js";
import { floorTop } from "../camera";
import { FAC_BOTTOM, TILE } from "../constants";
import book from "./ahArt/book.png";
import bookUp from "./ahArt/book-up.png";
import coffee from "./ahArt/coffee.png";
import coffeeUp from "./ahArt/coffee-up.png";
import fern from "./ahArt/fern.png";
import fernUp from "./ahArt/fern-up.png";
import tank from "./ahArt/tank.png";
import tankUp from "./ahArt/tank-up.png";

type Item = SimView["afterHours"]["items"][number];

/** [plain, upgraded] image of each item. */
export const ITEM_ART: Record<Item["id"], readonly [string, string]> = {
	fern: [fern, fernUp],
	tank: [tank, tankUp],
	coffee: [coffee, coffeeUp],
	book: [book, bookUp],
};

/** Cache key: which items stand where, and in which look. */
export const afterHoursKey = (view: SimView): string => view.afterHours.items.map((i) => `${i.id}:${i.visible ? 1 : 0}:${i.bought ? 1 : 0}:${i.floor}:${i.x}`).join("|");

/** The layer: rebuilt only when `afterHoursKey` changes (or when a texture finishes loading). */
/** Owner (Nov 2): items drawn at 1/3 of the PNG size. */
const ITEM_SCALE = 1 / 3;

export class AfterHoursLayer {
	readonly g = new Container();
	private key = "";
	private tex = new Map<string, Texture>();
	private loading = new Set<string>();
	private last: SimView | null = null;

	private texture(url: string): Texture | undefined {
		const t = this.tex.get(url);
		if (t) return t;
		if (!this.loading.has(url)) {
			this.loading.add(url);
			void Assets.load<Texture>(url)
				.then((loaded) => {
					loaded.source.scaleMode = "nearest";
					this.tex.set(url, loaded);
					this.key = "";
					if (this.last) this.update(this.last);
				})
				.catch(() => {});
		}
		return undefined;
	}

	update(view: SimView): void {
		this.last = view;
		const k = `${afterHoursKey(view)}#${view.floorMax}#${this.tex.size}`;
		if (k === this.key) return;
		this.key = k;
		for (const c of this.g.removeChildren()) c.destroy();
		for (const item of view.afterHours.items) {
			if (!item.visible) continue;
			const t = this.texture(ITEM_ART[item.id][item.bought ? 1 : 0]);
			if (!t) continue;
			const s = new Sprite(t);
			// Centred in its spot, standing on the floor.
			s.anchor.set(0.5, 1);
			s.scale.set(ITEM_SCALE);
			s.x = Math.round(item.x * TILE + (item.width * TILE) / 2);
			s.y = floorTop(view, item.floor) + FAC_BOTTOM;
			this.g.addChild(s);
		}
	}
}
