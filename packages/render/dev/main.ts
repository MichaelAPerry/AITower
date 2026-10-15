// Dev harness: renders the hand-built fixture and animates it.
// Query params: ?overlay=heat|power|coolant  ?minute=1200  ?zoom=1..4  ?select=facility:4  ?ghost=1  ?mpt=4 (minutes per tick)
import type { OverlayMode, Selection } from "@aitower/shared";
import { createRenderer } from "../src/index";
import { createFixture, fixtureContent } from "../src/dev/fixtureView";

const params = new URLSearchParams(location.search);
const host = document.getElementById("world") as HTMLElement;
const hud = document.getElementById("hud") as HTMLElement;
const fx = createFixture(Number(params.get("minute") ?? 600), Number(params.get("mpt") ?? 2));
const renderer = await createRenderer(host, fixtureContent);
renderer.resize(window.innerWidth, window.innerHeight);
window.addEventListener("resize", () => renderer.resize(window.innerWidth, window.innerHeight));

const modes: OverlayMode[] = ["normal", "heat", "power", "coolant"];
let overlay = (params.get("overlay") as OverlayMode | null) ?? "normal";
renderer.setOverlay(overlay);
window.addEventListener("keydown", (e) => {
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
	hud.textContent = `tick ${fx.view.tick}  ${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}  overlay ${overlay} [1-4]  cell ${lastCell}`;
	requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
