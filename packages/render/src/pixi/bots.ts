/** Maintenance rovers (10×10 px), interpolated per frame. */
import type { ContentDB } from "@aitower/content";
import type { BotView, SimView } from "@aitower/sim";
import { Graphics } from "pixi.js";
import { floorTop } from "../camera";
import { hex, satisfactionColor, shade } from "../color";
import { FAC_BOTTOM, TILE } from "../constants";
import type { Sample } from "../interp";
import { px } from "./draw";

export const BOT_W = 10;
export const BOT_H = 10;

/** World-space bounding box (left, top) of a bot at fractional tile x / floor. */
export const botBox = (view: Pick<SimView, "floorMax">, x: number, floor: number): { x: number; y: number } => ({
	x: Math.round((x + 0.5) * TILE - BOT_W / 2),
	y: Math.round(floorTop(view, floor) + FAC_BOTTOM - BOT_H),
});

export class Bots {
	readonly g = new Graphics();

	constructor(private readonly content: ContentDB) {}

	draw(view: SimView, pos: (b: BotView) => Sample, vel: (b: BotView) => Sample, t: number): void {
		const g = this.g;
		g.clear();
		for (const b of view.bots) {
			const p = pos(b);
			const v = vel(b);
			const { x, y } = botBox(view, p.x, p.y);
			const def = this.content.bots[b.defId];
			const body = def ? hex(def.color) : 0x2ec4b6;
			const moving = Math.abs(v.x) > 1e-4 || Math.abs(v.y) > 1e-4;
			const facing = v.x < -1e-4 ? -1 : 1;
			// Chassis.
			px(g, x, y + 4, BOT_W, 4, shade(body, 0.6));
			px(g, x + 1, y + 4, BOT_W - 2, 3, body);
			px(g, x + 1, y + 4, BOT_W - 2, 1, shade(body, 1.3));
			// Sensor head with eye on the facing side.
			const hx = facing > 0 ? x + 5 : x + 1;
			px(g, hx, y + 1, 4, 3, shade(body, 0.8));
			px(g, facing > 0 ? hx + 3 : hx, y + 2, 1, 1, b.state === "repairing" ? 0xffe14a : 0x9ff7ff);
			px(g, facing > 0 ? hx : hx + 3, y, 1, 1, 0xdddddd); // antenna
			// Wheels: spoke pixel rotates while moving.
			const phase = moving ? Math.floor(t * 12) % 2 : 0;
			for (const wx of [x + 1, x + 4, x + 7]) {
				px(g, wx, y + 8, 2, 2, 0x15171a);
				px(g, wx + phase, y + 8 + (1 - phase), 1, 1, 0x6a6f78);
			}
			// Carried part.
			if (b.carrying) {
				const cx = facing > 0 ? x + 1 : x + 5;
				px(g, cx, y, 4, 4, 0xb5793e);
				px(g, cx, y, 4, 1, 0xd89a5a);
			}
			// Battery pip.
			const bw = Math.max(1, Math.round(6 * Math.max(0, Math.min(1, b.battery))));
			px(g, x + 2, y - 3, 6, 1, 0x101215, 0.8);
			px(g, x + 2, y - 3, bw, 1, satisfactionColor(b.battery));
			if (b.state === "charging") px(g, x + 9, y - 4, 1, 3, Math.floor(t * 3) % 2 ? 0xffd23f : 0x5a4a10);
		}
	}
}
