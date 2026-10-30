// Sprite sheet harness: each row of defs is drawn by the real renderer at 1x and at 3x on the game's own background, every sprite labelled.
// Query: ?tree=green|bio|synthetic|transfer (which sheet), ?only=<row key>, ?minute=780, ?rm=1 (reduced motion).
// `window.__freeze(true)` stops the animation (used by tools/sprites/preview.ts); the page title becomes "sprites-ready" once drawn.
import "@fontsource/vt323";
import { loadContent } from "@aitower/content";
import { TILE } from "../src/constants";
import { SPRITE_GAP, SPRITE_PAD, createSpriteScene } from "../src/dev/spriteScene";
import { createRenderer } from "../src/index";
import type { Renderer } from "@aitower/shared";
import { forceTransfer, walkSeconds } from "../src/transferAnim";

const params = new URLSearchParams(location.search);
const content = loadContent();
const tree = params.get("tree") ?? "green";

interface Row {
	key: string;
	title: string;
	ids: string[];
}

/** AC-1 (the plain air rack) is the scale and style reference at the start of every rack row. */
const SHEETS: Record<string, { title: string; rows: Row[] }> = {
	green: {
		title: "GREEN: alive and natural. Moss, fungus, a tree. (solarpunk)",
		rows: [
			{ key: "racks", title: "RACKS  the machine is overtaken, rung by rung", ids: ["rack_air_gpu", "rack_neuromorphic", "rack_neuromorphic2", "rack_photonic", "rack_photonic2"] },
			{ key: "cooling", title: "COOLING", ids: ["crah_econ", "crah_adiabatic", "chiller_free"] },
			{ key: "power", title: "POWER AND SOLAR", ids: ["fuel_cell", "geothermal", "ups_iron_air", "microgrid_bea"] },
		],
	},
	bio: {
		title: "BIO: fleshy. A living wall.",
		rows: [
			{ key: "racks", title: "RACKS  membrane, eyes, mouths, the wall", ids: ["rack_air_gpu", "organoid_incubator", "rack_organoid_2", "rack_organoid_3", "neural_pit"] },
			{ key: "support", title: "SUPPORT  perfusion and the vascular plant", ids: ["perfusion_bath", "perfusion_manifold", "vascular_plant"] },
		],
	},
	synthetic: {
		title: "SYNTHETIC: chrome.",
		rows: [
			{ key: "racks", title: "RACKS  polished steel, cold seams, a monolith", ids: ["rack_air_gpu", "rack_dlc_gpu", "rack_dlc_gpu2", "rack_dlc_gpu3", "rack_mind_lattice"] },
			{ key: "cooling", title: "COOLING", ids: ["cdu", "cdu_big", "cdu_hall"] },
			{ key: "chillers", title: "CHILLERS", ids: ["chiller_tower", "cryo_core", "cryo_plant"] },
			{ key: "transfer", title: "SPECIAL", ids: ["consciousness_transfer"] },
		],
	},
};

const only = params.get("only");
const sheet = document.getElementById("sheet") as HTMLElement;
await document.fonts.load('16px "VT323"').catch(() => []);
const minute = Number(params.get("minute") ?? 780);
const rm = params.get("rm") === "1";

const ticks: (() => void)[] = [];
let frozen = false;

const heading = (text: string, cls = "sheet-title"): void => {
	const h = document.createElement("h1");
	h.className = cls;
	h.textContent = text;
	sheet.appendChild(h);
};

/** "LC-2 Liquid-Cooled Rack" -> code "LC-2", rest "Liquid-Cooled Rack". Names without a code keep it all as the rest. */
function splitName(name: string): { code: string; rest: string } {
	const m = /^([A-Z]{1,3}-\d+\w*)\s+(.*)$/.exec(name) ?? /^(.*?)\s+([A-Z]{1,3}-\d+\w*)$/.exec(name);
	if (!m) return { code: "", rest: name };
	return /^[A-Z]{1,3}-\d/.test(m[1]) ? { code: m[1], rest: m[2] } : { code: m[2], rest: m[1] };
}

/** One host element holding a renderer at `zoom`, with a label under (3x) or over (1x) each sprite. */
async function drawHost(block: HTMLElement, scene: ReturnType<typeof createSpriteScene>, ids: readonly string[], zoom: 1 | 3, bounds?: { w: number; h: number }): Promise<Renderer> {
	const w = bounds?.w ?? (scene.widthPx - (SPRITE_PAD - 1) * TILE) * zoom;
	const hh = bounds?.h ?? 96 * zoom;
	const cap = document.createElement("div");
	cap.className = "cap";
	cap.textContent = zoom === 1 ? "game scale (1x)" : "zoom 3x";
	const host = document.createElement("div");
	host.className = "host";
	host.style.width = `${w}px`;
	host.style.height = `${hh}px`;
	block.appendChild(cap);
	block.appendChild(host);
	const renderer = await createRenderer(host, content);
	renderer.setOptions({ reducedMotion: rm, crtEffects: false, colorBlind: false, horrorIntensity: "full" });
	renderer.resize(w, hh);
	renderer.draw(scene.view, 1);
	const focusX = Math.floor(scene.view.width / 2);
	renderer.focus({ x: focusX, floor: 0 });
	const canvas = host.querySelector("canvas") as HTMLCanvasElement;
	// The camera starts at zoom 2: one wheel step out gives 1x, one step in gives 3x.
	canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: zoom === 3 ? -100 : 100, clientX: w / 2, clientY: hh / 2, cancelable: true, bubbles: true }));
	renderer.focus({ x: focusX, floor: 0 });
	renderer.draw(scene.view, 1);
	ticks.push(() => {
		scene.step();
		renderer.draw(scene.view, 1);
	});
	// Labels: world x of a tile maps to the screen at w/2 + (x - (focus + 0.5) tiles) * TILE * zoom.
	for (let k = 0; k < ids.length; k++) {
		const d = content.facilities[ids[k]];
		const tx = scene.view.facilities[k].x;
		const left = w / 2 + (tx - (focusX + 0.5)) * TILE * zoom;
		const width = d.width * TILE * zoom;
		const { code, rest } = splitName(d.name);
		const label = document.createElement("div");
		label.className = zoom === 1 ? "lab lab1" : "lab lab3";
		label.style.left = `${left}px`;
		label.style.width = `${width + (zoom === 1 ? SPRITE_GAP * TILE : 0)}px`;
		if (zoom === 1) label.textContent = code || rest.split(" ")[0];
		else label.innerHTML = `<b></b><span></span>`;
		if (zoom === 3) {
			(label.querySelector("b") as HTMLElement).textContent = code || rest;
			(label.querySelector("span") as HTMLElement).textContent = code ? rest : "";
		}
		host.appendChild(label);
	}
	return renderer;
}

async function standardSheet(): Promise<void> {
	const def = SHEETS[tree];
	heading(def.title);
	for (const row of def.rows.filter((r) => !only || r.key === only)) {
		const block = document.createElement("div");
		block.className = "row";
		const h = document.createElement("h2");
		h.textContent = row.title;
		block.appendChild(h);
		sheet.appendChild(block);
		const scene = createSpriteScene(content, row.ids, minute);
		for (const zoom of [1, 3] as const) await drawHost(block, scene, row.ids, zoom);
	}
}

/** The Consciousness Transfer Unit sheet: a lift beside the unit, shown in five moments of one transfer, and a 1x strip of the same. */
async function transferSheet(): Promise<void> {
	heading("SYNTHETIC SPECIAL: CT-1 Consciousness Transfer Unit. A person walks out of the lift into the pod and is uploaded (+36 Synthetic SP).");
	const ids = ["consciousness_transfer"];
	// Lift tile 2, a free tile, then the unit from tile 4: the walk is about 70 px.
	const dist = 4 * TILE + 31 - (2 * TILE + 8);
	const walk = walkSeconds(dist);
	const frames: { s: number; title: string }[] = [
		{ s: -1, title: "1  idle: the pod is shut, a cold light on top" },
		{ s: walk * 0.35, title: "2  the lift opens; a person walks out" },
		{ s: walk - 0.25, title: "3  the pod door slides up as they arrive" },
		{ s: walk + 0.7, title: "4  they step in; the door shuts" },
		{ s: walk + 1.2 + 0.9, title: "5  upload: cold light floods the pod, they rise as data" },
		{ s: walk + 0.9 + 1.7, title: "6  done; the Lattice has a new resident" },
	];
	const wrap = document.createElement("div");
	wrap.className = "frames";
	sheet.appendChild(wrap);
	for (let i = 0; i < frames.length; i++) {
		const f = frames[i];
		const block = document.createElement("div");
		block.className = "row frame";
		const h = document.createElement("h2");
		h.textContent = f.title;
		block.appendChild(h);
		wrap.appendChild(block);
		const scene = createSpriteScene(content, ids, minute, { lift: true, idBase: 100 + i * 10, gapBeforeFirst: 1 });
		const fid = scene.view.facilities[0].id;
		if (f.s >= 0) forceTransfer(fid, f.s, walk);
		else forceTransfer(fid, null);
		const rr = await drawHost(block, scene, ids, 3);
		// The walker is a renderer layer fed by the event the sim sends; the pod and the walker both read the held phase.
		rr.pushEvents([{ type: "consciousnessTransferred", facilityId: fid, sp: 35.7 }]);
		rr.draw(scene.view, 1);
	}
}

if (tree === "transfer") await transferSheet();
else await standardSheet();
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
