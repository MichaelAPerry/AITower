// Dev harness: renders the hand-built fixture and animates it.
// Query params: ?overlay=heat|power|coolant|nutrient|contamination  ?minute=1200  ?zoom=1..4  ?focus=x,floor  ?select=facility:4  ?ghost=1|bad
//               ?mpt=4 (minutes per tick)  ?real=1 (real content colours)
//               ?scene=variety (every kind x tier x width, failure rows, new bots; focus=x,floor to jump)
//               ?stage=0..4 (biotech skin stage in the variety scene; keys Q W E R T set it live)  ?horror=full|mild|off
//               ?cb=1 (colour-blind)  ?rm=1 (reduced motion)  ?crt=0 (CRT effects off)
import "@fontsource/vt323";
import { loadContent } from "@aitower/content";
import type { OverlayMode, Selection } from "@aitower/shared";
import { createRenderer } from "../src/index";
import { createFixture, fixtureContent } from "../src/dev/fixtureView";
import { STAGE_SCORE, createVarietyScene, varietyContent } from "../src/dev/varietyScene";

const params = new URLSearchParams(location.search);
const host = document.getElementById("world") as HTMLElement;
const hud = document.getElementById("hud") as HTMLElement;
const variety = params.get("scene") === "variety";
const fx = variety ? createVarietyScene({ stage: Math.max(0, Math.min(4, Number(params.get("stage") ?? 0))) as 0 | 1 | 2 | 3 | 4 }) : createFixture(Number(params.get("minute") ?? 600), Number(params.get("mpt") ?? 2));
// ?real=1 draws the fixture with the real content colours (falls back to the local stub).
let content = fixtureContent;
if (params.has("real")) {
	try {
		content = loadContent();
	} catch (err) {
		console.warn("loadContent failed, using fixture content", err);
	}
}
if (variety) content = varietyContent(content);
// The app loads the fonts before creating the renderer; do the same here.
await document.fonts.load('16px "VT323"').catch(() => []);
const renderer = await createRenderer(host, content);
renderer.resize(window.innerWidth, window.innerHeight);
renderer.setOptions({
	reducedMotion: params.get("rm") === "1",
	crtEffects: params.get("crt") !== "0",
	colorBlind: params.get("cb") === "1",
	horrorIntensity: (["full", "mild", "off"] as const).find((h) => h === params.get("horror")) ?? "full",
});
const focus = params.get("focus");
if (focus) {
	const [fx0, ff0] = focus.split(",").map(Number);
	renderer.focus({ x: fx0, floor: ff0 });
}
const zoomTo = Number(params.get("zoom") ?? 2);
if (zoomTo !== 2) {
	// Zoom via synthetic wheel steps at the viewport centre (the camera zoom is internal to the renderer).
	renderer.draw(fx.view, 1);
	const canvas = host.querySelector("canvas") as HTMLCanvasElement;
	for (let i = 0; i < Math.abs(zoomTo - 2); i++) {
		canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: zoomTo > 2 ? -100 : 100, clientX: window.innerWidth / 2, clientY: window.innerHeight / 2, cancelable: true }));
	}
}
window.addEventListener("resize", () => renderer.resize(window.innerWidth, window.innerHeight));

const modes: OverlayMode[] = ["normal", "heat", "power", "coolant", "nutrient", "contamination"];
let overlay = (params.get("overlay") as OverlayMode | null) ?? "normal";
renderer.setOverlay(overlay);
window.addEventListener("keydown", (e) => {
	const stageKey = "qwert".indexOf(e.key.toLowerCase());
	if (stageKey >= 0) fx.view.corruption = STAGE_SCORE[stageKey];
	const i = Number(e.key) - 1;
	if (i >= 0 && i < modes.length) {
		overlay = modes[i];
		renderer.setOverlay(overlay);
	}
});

const sel = params.get("select");
if (sel) {
	const [kind, id] = sel.split(":");
	renderer.setSelection({ kind, id: Number(id) } as Selection);
}
if (params.has("ghost")) {
	renderer.setGhost({ cells: [{ x: 36, floor: 1 }, { x: 37, floor: 1 }], valid: true, defId: "rack_air_gpu", label: "$400k" });
	if (params.get("ghost") === "bad") renderer.setGhost({ cells: [{ x: 21, floor: 2 }, { x: 22, floor: 2 }], valid: false, defId: "rack_dlc_gpu", label: "$1.2M" });
}
let lastCell = "";
renderer.onPointer((e) => {
	if (e.kind === "down" && e.cell) renderer.setSelection(null);
	lastCell = e.cell ? `${e.cell.x},${e.cell.floor}` : "-";
	if (e.kind === "move" && e.cell && !params.has("ghost")) {
		renderer.setGhost({ cells: [e.cell], valid: fx.view.slab[(e.cell.floor - fx.view.floorMin) * fx.view.width + e.cell.x] === 1 });
	}
	if (e.kind === "leave") renderer.setGhost(null);
});

const TICK_MS = 100;
let acc = 0;
let last = performance.now();
const frame = (now: number) => {
	acc += Math.min(now - last, 250);
	last = now;
	while (acc >= TICK_MS) {
		fx.step();
		acc -= TICK_MS;
	}
	renderer.draw(fx.view, acc / TICK_MS);
	const m = fx.view.minuteOfDay;
	hud.textContent = `tick ${fx.view.tick}  ${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}  overlay ${overlay} [1-6]  stage ${fx.view.corruption} [q-t]  cell ${lastCell}`;
	requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
