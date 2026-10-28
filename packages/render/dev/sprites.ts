// Sprite sheet harness: each row of defs is drawn by the real renderer at 1x and at 3x on the game's own background.
// Query: ?only=racks|cooling|power|solar|heat (one row), ?minute=780, ?rm=1 (reduced motion).
// `window.__freeze(true)` stops the animation (used by tools/sprites/preview.ts); the page title becomes "sprites-ready" once drawn.
import "@fontsource/vt323";
import { loadContent } from "@aitower/content";
import { TILE } from "../src/constants";
import { SPRITE_PAD, createSpriteScene } from "../src/dev/spriteScene";
import { createRenderer } from "../src/index";

const params = new URLSearchParams(location.search);
const content = loadContent();

interface Row {
	key: string;
	title: string;
	ids: string[];
}

/** AC-1 and LC-2 are the scale and style references; every row starts with a base rack. */
const ROWS: Row[] = [
	{ key: "racks", title: "RACKS   AC-1 | LC-2 (base)   NM-1 | NM-2 | PH-1 | PH-2 (new, Green)", ids: ["rack_air_gpu", "rack_dlc_gpu", "rack_neuromorphic", "rack_neuromorphic2", "rack_photonic", "rack_photonic2"] },
	{ key: "cooling", title: "COOLING   AC-1 | AH-150 (base)  OA-400 economizer  AD-1500 adiabatic | CH-600 (base)  CH-5000 adiabatic chiller", ids: ["rack_air_gpu", "crah_unit", "crah_econ", "crah_adiabatic", "chiller", "chiller_free"] },
	{ key: "power", title: "POWER   AC-1 | Genset 800 (base)  FC-1000 fuel cell  GW-2000 geothermal | Battery Bank (base)  IA-20 iron-air", ids: ["rack_air_gpu", "genset", "fuel_cell", "geothermal", "ups_battery", "ups_iron_air"] },
	{ key: "solar", title: "SOLAR   AC-1 | PV Wall (existing)  Leaf-Bolt Microgrid (new)  PV Roof Canopy (existing)", ids: ["rack_air_gpu", "solar_skin", "microgrid_bea", "solar_canopy"] },
	{ key: "heat", title: "WIND + HEAT   AC-1 | Wind Mast  Heat Recovery  District Heat Link (existing kind art)", ids: ["rack_air_gpu", "wind_mast", "heat_exchanger", "heat_pipeline"] },
];

const only = params.get("only");
const rows = ROWS.filter((r) => !only || r.key === only);
await document.fonts.load('16px "VT323"').catch(() => []);
const sheet = document.getElementById("sheet") as HTMLElement;
const minute = Number(params.get("minute") ?? 780);

const ticks: (() => void)[] = [];
let frozen = false;
for (const row of rows) {
	const scene = createSpriteScene(content, row.ids, minute);
	const block = document.createElement("div");
	block.className = "row";
	const h = document.createElement("h2");
	h.textContent = row.title;
	block.appendChild(h);
	sheet.appendChild(block);
	for (const zoom of [1, 3] as const) {
		const cap = document.createElement("div");
		cap.className = "cap";
		cap.textContent = `${zoom}x`;
		const host = document.createElement("div");
		host.className = "host";
		// The lot plus a little sky and street: tall enough for the 48 px floor, the roof parapet and the ground.
		const w = (scene.widthPx - (SPRITE_PAD - 1) * TILE) * zoom;
		const hh = 96 * zoom;
		host.style.width = `${w}px`;
		host.style.height = `${hh}px`;
		block.appendChild(cap);
		block.appendChild(host);
		const renderer = await createRenderer(host, content);
		renderer.setOptions({ reducedMotion: params.get("rm") === "1", crtEffects: false, colorBlind: false, horrorIntensity: "full" });
		renderer.resize(w, hh);
		renderer.draw(scene.view, 1);
		renderer.focus({ x: Math.floor(scene.view.width / 2), floor: 0 });
		const canvas = host.querySelector("canvas") as HTMLCanvasElement;
		// The camera starts at zoom 2: one wheel step out gives 1x, one step in gives 3x.
		canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: zoom === 3 ? -100 : 100, clientX: w / 2, clientY: hh / 2, cancelable: true, bubbles: true }));
		renderer.focus({ x: Math.floor(scene.view.width / 2), floor: 0 });
		renderer.draw(scene.view, 1);
		ticks.push(() => {
			scene.step();
			renderer.draw(scene.view, 1);
		});
	}
}
document.title = "sprites-ready";
let last = performance.now();
const loop = (now: number): void => {
	if (!frozen && now - last > 100) {
		last = now;
		for (const t of ticks) t();
	}
	requestAnimationFrame(loop);
};
requestAnimationFrame(loop);
(window as unknown as { __freeze: (f: boolean) => void }).__freeze = (f) => {
	frozen = f;
};
