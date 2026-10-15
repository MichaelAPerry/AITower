/** Screen-space sky (time-of-day bands + stars) and a parallax city silhouette. */
import { Container, Graphics, GraphicsContext } from "pixi.js";
import { lerpColor, skyColors } from "../color";
import { px } from "./draw";

const CITY_SPAN = 1024; // world px per silhouette tile
const BAND = 6; // screen px per sky band

function rand(seed: number): () => number {
	let s = seed >>> 0;
	return () => {
		s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
		return s / 4294967296;
	};
}

function buildCity(): { body: GraphicsContext; lights: GraphicsContext } {
	const body = new GraphicsContext();
	const lights = new GraphicsContext();
	const r = rand(1337);
	let x = 0;
	while (x < CITY_SPAN) {
		const w = 18 + Math.floor(r() * 40);
		const h = 30 + Math.floor(r() * 110);
		body.rect(x, -h, w, h).fill({ color: 0xffffff });
		if (r() < 0.3) body.rect(x + Math.floor(w / 2) - 1, -h - 10, 2, 10).fill({ color: 0xffffff }); // antenna
		if (r() < 0.25) body.rect(x + 3, -h - 6, w - 6, 6).fill({ color: 0xffffff }); // setback
		for (let wy = -h + 6; wy < -6; wy += 6) {
			for (let wx = x + 3; wx < x + w - 3; wx += 5) {
				if (r() < 0.32) lights.rect(wx, wy, 2, 2).fill({ color: 0xffd98a });
			}
		}
		x += w + Math.floor(r() * 6);
	}
	return { body, lights };
}

interface Star {
	x: number;
	y: number;
	phase: number;
	big: boolean;
}

export class Background {
	readonly root = new Container();
	private sky = new Graphics();
	private stars = new Graphics();
	private city = new Container();
	private cityBodies: Graphics[] = [];
	private cityLights: Graphics[] = [];
	private ctx = buildCity();
	private starList: Star[];

	constructor() {
		this.root.addChild(this.sky, this.stars, this.city);
		const r = rand(42);
		this.starList = Array.from({ length: 90 }, () => ({ x: r(), y: r(), phase: r() * 6.28, big: r() < 0.12 }));
	}

	/**
	 * @param horizonY screen y of the ground line
	 * @param originX screen x of world origin (for parallax)
	 */
	update(vw: number, vh: number, zoom: number, horizonY: number, originX: number, minuteOfDay: number, t: number): void {
		const sky = skyColors(minuteOfDay);
		const g = this.sky;
		g.clear();
		const hz = Math.max(0, Math.min(vh, horizonY));
		const span = Math.max(hz, 1);
		for (let y = 0; y < hz; y += BAND) {
			px(g, 0, y, vw, Math.min(BAND, hz - y), lerpColor(sky.top, sky.horizon, (y / span) ** 1.6));
		}
		if (hz < vh) px(g, 0, hz, vw, vh - hz, sky.horizon);

		const s = this.stars;
		s.clear();
		if (sky.night > 0.05) {
			for (const st of this.starList) {
				const sy = st.y * hz * 0.85;
				if (sy > hz - 20) continue;
				const tw = 0.55 + 0.45 * Math.sin(t * 1.7 + st.phase);
				const sz = st.big ? 2 : 1;
				px(s, Math.floor(st.x * vw), Math.floor(sy), sz, sz, 0xffffff, sky.night * tw);
			}
		}

		// City: tiled silhouette, half-speed horizontal parallax, scaled with zoom.
		const tileW = CITY_SPAN * zoom;
		const need = Math.ceil(vw / tileW) + 2;
		while (this.cityBodies.length < need) {
			const b = new Graphics(this.ctx.body);
			const l = new Graphics(this.ctx.lights);
			this.city.addChild(b, l);
			this.cityBodies.push(b);
			this.cityLights.push(l);
		}
		const par = Math.round(originX * 0.5);
		const start = (((par % tileW) + tileW) % tileW) - tileW;
		for (let i = 0; i < this.cityBodies.length; i++) {
			const b = this.cityBodies[i];
			const l = this.cityLights[i];
			const vis = i < need;
			b.visible = vis;
			l.visible = vis && sky.night > 0.15;
			b.position.set(start + i * tileW, Math.round(horizonY));
			l.position.copyFrom(b.position);
			b.scale.set(zoom);
			l.scale.set(zoom);
			b.tint = sky.city;
			l.alpha = sky.night * 0.85;
		}
	}

	/** Release the shared silhouette contexts (call after the scene graph is destroyed). */
	destroyShared(): void {
		this.ctx.body.destroy();
		this.ctx.lights.destroy();
	}
}
