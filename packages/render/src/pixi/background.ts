/**
 * Screen-space sky and skyline. Smoggy dithered gradient (dirty teal day,
 * sodium dusk, brown-black night), sweeping searchlights at night, two parallax
 * layers of brutalist towers with lit strip windows, blinking aircraft lamps,
 * and a giant "AITOWER" sign. Silhouettes are shared `GraphicsContext`s tinted
 * per time of day; everything is drawn in whole zoom-pixels.
 */
import type { RenderOptions } from "@aitower/shared";
import { Container, Graphics, GraphicsContext, Texture, TilingSprite } from "pixi.js";
import { droughtSky, lerpColor, skyColors } from "../color";
import { T, dk, lt, mix } from "../palette";
import { px } from "./draw";
import { type CityCtx, buildCity } from "./skylineArt";
import { CITY_SPAN, type SkyStyle, rand, styleKey } from "./skyline";
const SKY_REF = 520; // world px over which the gradient runs (above the horizon)
const BAND = 6; // world px per sky band

const CLOUD_SPAN = 2048;

/** Flat smog streaks with dithered, ragged edges (tile-local, y negative = above the horizon). */
function buildClouds(seed: number): GraphicsContext {
	const ctx = new GraphicsContext();
	const r = rand(seed);
	const W = 0xffffff;
	for (let i = 0; i < 16; i++) {
		const w = 90 + Math.floor(r() * 240);
		const h = 3 + Math.floor(r() * 5);
		const x0 = Math.floor(r() * CLOUD_SPAN);
		const y0 = -150 - Math.floor(r() * 420);
		for (const dx of [0, -CLOUD_SPAN]) {
			const x = x0 + dx;
			// Core with tapered ends.
			for (let k = 0; k < h; k++) {
				const inset = Math.floor(Math.abs(k - h / 2) * 6 + r() * 6);
				ctx.rect(x + inset, y0 + k, w - inset * 2, 1).fill({ color: W });
			}
			// Dithered fringe above and below.
			for (let k = 8; k < w - 8; k += 2) {
				if (r() < 0.7) ctx.rect(x + k + (k & 2 ? 1 : 0), y0 - 1, 1, 1).fill({ color: W });
				if (r() < 0.5) ctx.rect(x + k + 1, y0 + h, 1, 1).fill({ color: W });
			}
		}
	}
	return ctx;
}

interface Look {
	deco: number;
	decoAlpha: number;
	accent: number;
	accentAlpha: number;
}

interface Layer {
	ctx: CityCtx;
	parallax: number;
	tiles: { body: Graphics; shade: Graphics; lights: Graphics; deco: Graphics; accent: Graphics; sign: Graphics; alt: Graphics }[];
	minH: number;
	maxH: number;
	seed: number;
	sign: boolean;
	root: Container;
}

function checkerTexture(): Texture {
	const c = document.createElement("canvas");
	c.width = 2;
	c.height = 2;
	const x = c.getContext("2d");
	if (x) {
		x.fillStyle = "#fff";
		x.fillRect(0, 0, 1, 1);
		x.fillRect(1, 1, 1, 1);
	}
	const t = Texture.from(c);
	t.source.scaleMode = "nearest";
	return t;
}

export class Background {
	readonly root = new Container();
	private sky = new Graphics();
	private dithers = new Container();
	private ditherPool: TilingSprite[] = [];
	private checker = checkerTexture();
	private beams = new Graphics();
	private stars = new Graphics();
	private haze = new Graphics();
	private lampsG = new Graphics();
	private cloudCtx = buildClouds(77);
	private clouds = new Container();
	private cloudTiles: Graphics[] = [];
	private far: Layer;
	private near: Layer;
	private style: SkyStyle = { tier: 1, path: null, stage: 0 };
	private styleKey = styleKey(this.style);
	private starList: { x: number; y: number; phase: number }[];

	constructor() {
		this.far = this.makeLayer(97, 40, 120, false, 0.25);
		this.near = this.makeLayer(1337, 30, 150, true, 0.5);
		this.root.addChild(this.sky, this.dithers, this.stars, this.clouds, this.beams, this.far.root, this.haze, this.near.root, this.lampsG);
		const r = rand(42);
		this.starList = Array.from({ length: 40 }, () => ({ x: r(), y: r(), phase: r() * 6.28 }));
	}

	private makeLayer(seed: number, minH: number, maxH: number, sign: boolean, parallax: number): Layer {
		return { ctx: buildCity(seed, minH, maxH, sign, this.style, !sign), parallax, tiles: [], root: new Container(), seed, minH, maxH, sign };
	}

	/** Rebuild the skyline when the Level or the path stage changed (a no-op otherwise). */
	setStyle(tier: number, path: SkyStyle["path"], stage: SkyStyle["stage"]): void {
		const next = { tier, path, stage };
		if (styleKey(next) === this.styleKey) return;
		this.style = next;
		this.styleKey = styleKey(next);
		for (const l of [this.far, this.near]) {
			for (const t of l.tiles) {
				l.root.removeChild(t.body, t.shade, t.lights, t.deco, t.accent, t.sign, t.alt);
				for (const g of Object.values(t)) g.destroy();
			}
			l.tiles = [];
			this.destroyCtx(l.ctx);
			l.ctx = buildCity(l.seed, l.minH, l.maxH, l.sign, next, !l.sign);
		}
	}

	private destroyCtx(c: CityCtx): void {
		for (const g of [c.body, c.shade, c.lights, c.deco, c.accent, c.sign, c.alt]) g.destroy();
	}

	/**
	 * @param horizonY screen y of the ground line
	 * @param originX screen x of world origin (for parallax)
	 */
	/**
	 * `opt.reducedMotion` freezes the drift, twinkle and searchlight sweep (time held at 0) and holds the
	 * sign and aircraft lamps lit instead of blinking.
	 */
	update(vw: number, vh: number, zoom: number, horizonY: number, originX: number, minuteOfDay: number, t: number, opt: RenderOptions, signAlt = false, drought = 0): void {
		const sky = droughtSky(skyColors(minuteOfDay), drought);
		const calm = opt.reducedMotion;
		const tt = calm ? 0 : t;
		const hz = Math.round(horizonY);
		const z = zoom;

		// Stepped bands anchored to the horizon with a checker dither row between them.
		const g = this.sky;
		g.clear();
		px(g, 0, 0, vw, vh, sky.top);
		const band = BAND * z;
		const nb = Math.ceil(SKY_REF / BAND);
		const colAt = (k: number): number => lerpColor(sky.horizon, sky.top, Math.min(1, (k * BAND) / SKY_REF) ** 0.8);
		let d = 0;
		for (let k = 0; k <= nb; k++) {
			const y1 = hz - k * band;
			const y0 = y1 - band;
			if (y1 < 0) break;
			if (y0 > vh) continue;
			px(g, 0, Math.max(0, y0), vw, Math.min(vh, y1) - Math.max(0, y0), colAt(k));
			// Dither the upper edge of this band with the next band's colour.
			if (k < nb && y0 - z >= -z) {
				let sp = this.ditherPool[d];
				if (!sp) {
					sp = new TilingSprite({ texture: this.checker, width: 1, height: 1 });
					this.ditherPool.push(sp);
					this.dithers.addChild(sp);
				}
				sp.visible = true;
				sp.tint = colAt(k + 1);
				sp.tileScale.set(z);
				sp.position.set(0, y0);
				sp.width = vw;
				sp.height = 2 * z;
				d++;
			}
		}
		for (let i = d; i < this.ditherPool.length; i++) this.ditherPool[i].visible = false;
		if (hz < vh) px(g, 0, Math.max(0, hz), vw, vh - Math.max(0, hz), sky.horizon);

		// A few dim stars through the smog.
		const s = this.stars;
		s.clear();
		if (sky.night > 0.3) {
			for (const st of this.starList) {
				const sy = Math.floor(st.y * (hz - 60 * z));
				if (sy < 0) continue;
				const tw = 0.5 + 0.5 * Math.sin(tt * 1.3 + st.phase);
				px(s, Math.floor(st.x * vw), sy, z, z, T.paper, (sky.night - 0.3) * 0.6 * tw);
			}
		}

		// Smog streaks drifting slowly, far behind everything.
		{
			const tw = CLOUD_SPAN * z;
			const need = Math.ceil(vw / tw) + 2;
			while (this.cloudTiles.length < need) {
				const c = new Graphics(this.cloudCtx);
				this.clouds.addChild(c);
				this.cloudTiles.push(c);
			}
			const par = Math.round(originX * 0.12 + tt * 3 * z);
			const st = (((par % tw) + tw) % tw) - tw;
			const tint = sky.night > 0.5 ? mix(sky.haze, T.sodium, 0.15) : lt(sky.haze, 0.25);
			for (let i = 0; i < this.cloudTiles.length; i++) {
				const c = this.cloudTiles[i];
				c.visible = i < need;
				c.position.set(st + i * tw, hz);
				c.scale.set(z);
				c.tint = tint;
				c.alpha = 0.35;
			}
		}

		// Layers.
		const pk = this.style.path;
		const pc = pk === "biotech" ? T.flesh : pk === "greentech" ? T.green : T.brass;
		const ac = pk === "biotech" ? lt(T.blood, 0.35) : pk === "greentech" ? lt(T.green, 0.6) : lt(T.brass, 0.25);
		const dAlpha = pk === "synthetic" ? 0.3 : 0.92;
		const aAlpha = pk === "synthetic" ? 0.4 + 0.6 * sky.night : pk === "biotech" ? 0.6 + 0.4 * sky.night : 0.95;
		const look = (city: number, far: boolean): Look => ({ deco: mix(city, pc, far ? 0.4 : 0.55), decoAlpha: dAlpha * (far ? 0.75 : 1), accent: far ? mix(ac, city, 0.4) : ac, accentAlpha: aAlpha });
		this.placeLayer(this.far, vw, z, hz, originX, sky.cityFar, dk(sky.cityFar, 0.25), sky.night * 0.5, mix(sky.cityFar, sky.horizon, 0.3), sky.night, false, look(sky.cityFar, true));
		const signLit = sky.night > 0.25;
		const signCol = signAlt ? mix(T.flesh, T.paper, 0.2) : signLit ? (!calm && Math.floor(t * 1.7) % 9 === 0 ? dk(T.brass, 0.4) : T.brass) : mix(sky.city, T.paper, 0.35);
		this.placeLayer(this.near, vw, z, hz, originX, sky.city, dk(sky.city, 0.3), sky.night * 0.85, signCol, sky.night, signAlt, look(sky.city, false));

		// Searchlights sweeping from the near skyline.
		const b = this.beams;
		b.clear();
		const lampG = this.lampsG;
		lampG.clear();
		const tileW = CITY_SPAN * z;
		const start = this.layerStart(this.near, originX, z);
		if (sky.night > 0.2) {
			const len = Math.max(vw, vh) * 1.2;
			for (let i = 0; i < this.near.tiles.length; i++) {
				if (!this.near.tiles[i].body.visible) continue;
				for (const bm of this.near.ctx.beams) {
					const ox = start + i * tileW + bm.x * z;
					const oy = hz + bm.y * z;
					if (ox < -len || ox > vw + len) continue;
					const a = -Math.PI / 2 + Math.sin(tt * 0.25 + bm.phase) * 0.55;
					const spread = 0.045;
					b.poly([ox, oy, ox + Math.cos(a - spread) * len, oy + Math.sin(a - spread) * len, ox + Math.cos(a + spread) * len, oy + Math.sin(a + spread) * len]).fill({
						color: lt(T.brass, 0.3),
						alpha: 0.07 * sky.night,
					});
				}
			}
		}
		// Aircraft warning lamps (blink red; brighter at night).
		for (let i = 0; i < this.near.tiles.length; i++) {
			if (!this.near.tiles[i].body.visible) continue;
			for (const lp of this.near.ctx.lamps) {
				if (!calm && Math.sin(t * 2.2 + lp.phase) < 0.1) continue;
				const lx = start + i * tileW + lp.x * z;
				const ly = hz + lp.y * z;
				if (lx < -4 * z || lx > vw + 4 * z) continue;
				px(lampG, lx - z, ly, 3 * z, z, T.red, 0.25 + 0.3 * sky.night);
				px(lampG, lx, ly - z, z, 3 * z, T.red, 0.25 + 0.3 * sky.night);
				px(lampG, lx, ly, z, z, lt(T.red, 0.4), 0.6 + 0.4 * sky.night);
			}
		}

		// Smog haze hanging in front of the far layer and over the base of the near one.
		const hzG = this.haze;
		hzG.clear();
		for (let k = 0; k < 6; k++) {
			const hh = 8 * z;
			px(hzG, 0, hz - (k + 1) * hh, vw, hh, sky.haze, 0.32 - k * 0.05);
		}
	}

	private layerStart(layer: Layer, originX: number, z: number): number {
		const tileW = CITY_SPAN * z;
		const par = Math.round(originX * layer.parallax);
		return (((par % tileW) + tileW) % tileW) - tileW;
	}

	private placeLayer(
		layer: Layer,
		vw: number,
		z: number,
		hz: number,
		originX: number,
		body: number,
		shade: number,
		lightAlpha: number,
		signColor: number,
		night: number,
		signAlt: boolean,
		look: Look,
	): void {
		const tileW = CITY_SPAN * z;
		const need = Math.ceil(vw / tileW) + 2;
		while (layer.tiles.length < need) {
			const t = {
				body: new Graphics(layer.ctx.body),
				shade: new Graphics(layer.ctx.shade),
				lights: new Graphics(layer.ctx.lights),
				deco: new Graphics(layer.ctx.deco),
				accent: new Graphics(layer.ctx.accent),
				sign: new Graphics(layer.ctx.sign),
				alt: new Graphics(layer.ctx.alt),
			};
			layer.root.addChild(t.body, t.shade, t.lights, t.deco, t.accent, t.sign, t.alt);
			layer.tiles.push(t);
		}
		const start = this.layerStart(layer, originX, z);
		for (let i = 0; i < layer.tiles.length; i++) {
			const tl = layer.tiles[i];
			const vis = i < need;
			const x = start + i * tileW;
			for (const gfx of [tl.body, tl.shade, tl.lights, tl.deco, tl.accent, tl.sign, tl.alt]) {
				gfx.visible = vis;
				gfx.position.set(x, hz);
				gfx.scale.set(z);
			}
			tl.body.tint = body;
			tl.shade.tint = shade;
			tl.lights.visible = vis && lightAlpha > 0.08;
			tl.lights.tint = mix(T.brass, T.paper, 0.4);
			tl.lights.alpha = lightAlpha;
			tl.deco.tint = look.deco;
			tl.deco.alpha = look.decoAlpha;
			tl.accent.tint = look.accent;
			tl.accent.alpha = look.accentAlpha;
			tl.sign.tint = signColor;
			tl.sign.alpha = night > 0.25 ? 1 : 0.9;
			tl.alt.tint = signColor;
			tl.alt.alpha = tl.sign.alpha;
			tl.sign.visible = vis && !signAlt;
			tl.alt.visible = vis && signAlt;
		}
	}

	/** Release the shared silhouette contexts (call after the scene graph is destroyed). */
	destroyShared(): void {
		this.cloudCtx.destroy();
		for (const l of [this.far, this.near]) {
			this.destroyCtx(l.ctx);
		}
		this.checker.destroy(true);
	}
}
