/** Heat / power / coolant overlays. The base is rebuilt once per tick; shimmer is per frame. */
import type { ContentDB } from "@aitower/content";
import type { OverlayMode } from "@aitower/shared";
import type { SimView } from "@aitower/sim";
import { Container, Graphics } from "pixi.js";
import { floorTop } from "../camera";
import { heatAlpha, heatColor, loadColor, netColor, rackTempColor, satisfactionColor, shade } from "../color";
import { FAC_BOTTOM, FAC_TOP, FLOOR_H, MARGIN_BOTTOM, MARGIN_TOP, MARGIN_X, TILE } from "../constants";
import { drawCoolant, drawPower } from "./conduits";
import { box, px } from "./draw";

const NONE = 0x5a5f66;

export class Overlays {
	readonly root = new Container();
	private base = new Graphics();
	private anim = new Graphics();

	constructor(private readonly content: ContentDB) {
		this.root.addChild(this.base, this.anim);
	}

	rebuild(view: SimView, mode: OverlayMode): void {
		const g = this.base;
		g.clear();
		if (mode === "heat") this.heat(view);
		else if (mode === "power") this.power(view);
		else if (mode === "coolant") this.coolant(view);
	}

	private dim(view: SimView, alpha: number): void {
		const h = (view.floorMax - view.floorMin + 1) * FLOOR_H;
		px(this.base, -MARGIN_X - 4000, -MARGIN_TOP - 4000, view.width * TILE + 2 * MARGIN_X + 8000, h + MARGIN_TOP + MARGIN_BOTTOM + 8000, 0x05070c, alpha);
	}

	private heat(view: SimView): void {
		const g = this.base;
		this.dim(view, 0.25);
		const { width, floorMin, floorMax, airTemp, slab } = view;
		for (let f = floorMin; f <= floorMax; f++) {
			const top = floorTop(view, f);
			for (let x = 0; x < width; x++) {
				const i = (f - floorMin) * width + x;
				const t = airTemp[i];
				const a = heatAlpha(t) * (slab[i] ? 1 : 0.45);
				px(g, x * TILE, top, TILE, FLOOR_H, heatColor(t), a);
			}
		}
		for (const fv of view.facilities) {
			const def = this.content.facilities[fv.defId];
			if (!def || def.kind !== "rack") continue;
			const x = fv.x * TILE;
			const y = floorTop(view, fv.floor) + FAC_TOP;
			const c = rackTempColor(fv.tempC);
			px(g, x + 1, y, def.width * TILE - 1, FAC_BOTTOM - FAC_TOP, c, 0.55);
			box(g, x + 1, y, def.width * TILE - 1, FAC_BOTTOM - FAC_TOP, shade(c, 1.3), 0.9);
		}
	}

	private power(view: SimView): void {
		const g = this.base;
		this.dim(view, 0.62);
		const nets = new Map(view.powerNets.map((n) => [n.id, n]));
		drawPower(g, view, (i) => (view.powerNetOf[i] >= 0 ? netColor(view.powerNetOf[i]) : NONE), 3);
		for (const fv of view.facilities) {
			const def = this.content.facilities[fv.defId];
			if (!def) continue;
			const x = fv.x * TILE;
			const y = floorTop(view, fv.floor) + FAC_TOP;
			const w = def.width * TILE - 1;
			const h = FAC_BOTTOM - FAC_TOP;
			const net = fv.powerNet !== null ? nets.get(fv.powerNet) : undefined;
			const c = net ? satisfactionColor(net.satisfaction) : 0xff3030;
			px(g, x + 1, y, w, h, c, net ? 0.45 : 0.3);
			box(g, x + 1, y, w, h, fv.powerNet !== null ? netColor(fv.powerNet) : 0xff3030, 1);
		}
	}

	private coolant(view: SimView): void {
		const g = this.base;
		this.dim(view, 0.62);
		const nets = new Map(view.coolantNets.map((n) => [n.id, n]));
		const col = (i: number) => (view.coolantNetOf[i] >= 0 ? netColor(view.coolantNetOf[i]) : NONE);
		drawCoolant(g, view, col, (i) => shade(col(i), 0.65), 3);
		for (const fv of view.facilities) {
			const def = this.content.facilities[fv.defId];
			if (!def) continue;
			const needs = def.placement?.needsCoolant || def.kind === "chiller" || def.kind === "cdu" || (def.rack?.liquidFraction ?? 0) > 0;
			if (!needs && fv.coolantNet === null) continue;
			const x = fv.x * TILE;
			const y = floorTop(view, fv.floor) + FAC_TOP;
			const w = def.width * TILE - 1;
			const h = FAC_BOTTOM - FAC_TOP;
			const net = fv.coolantNet !== null ? nets.get(fv.coolantNet) : undefined;
			const c = net ? loadColor(net.capacityKw > 0 ? net.loadKw / net.capacityKw : 1) : 0xff3030;
			px(g, x + 1, y, w, h, c, 0.45);
			box(g, x + 1, y, w, h, fv.coolantNet !== null ? netColor(fv.coolantNet) : 0xff3030, 1);
		}
	}

	/** Per-frame animation: rising shimmer over hot cells in heat mode. */
	animate(view: SimView, mode: OverlayMode, t: number): void {
		const g = this.anim;
		g.clear();
		if (mode !== "heat") return;
		const { width, floorMin, floorMax, airTemp } = view;
		for (let f = floorMin; f <= floorMax; f++) {
			const top = floorTop(view, f);
			for (let x = 0; x < width; x++) {
				const temp = airTemp[(f - floorMin) * width + x];
				if (temp < 30) continue;
				const k = Math.min(1, (temp - 30) / 15);
				for (let j = 0; j < 3; j++) {
					const ph = (t * (0.5 + k * 0.8) + j / 3 + x * 0.13) % 1;
					const sx = x * TILE + 3 + j * 5 + Math.round(Math.sin(t * 4 + x + j) * 1.5);
					const sy = top + FLOOR_H - 6 - Math.round(ph * (FLOOR_H - 10));
					px(g, sx, sy, 2, 1, 0xffffff, (1 - ph) * 0.35 * k);
				}
			}
		}
	}
}
