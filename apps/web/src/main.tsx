import { createAudio } from "@aitower/audio";
import { loadContent } from "@aitower/content";
import { createRenderer } from "@aitower/render";
import type { AudioEngine } from "@aitower/shared";
import { Hud, createToolController } from "@aitower/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { startLoop } from "./loop";
import { createGameStore } from "./store";

async function boot() {
	const content = loadContent();
	const worldEl = document.getElementById("world") as HTMLElement;
	const hudEl = document.getElementById("hud") as HTMLElement;

	const renderer = await createRenderer(worldEl, content);
	let audio: AudioEngine | null = null;
	try {
		audio = createAudio();
	} catch (err) {
		console.warn("audio disabled:", err);
	}

	const store = createGameStore(content, renderer, audio);
	const params = new URLSearchParams(location.search);
	if (params.has("new")) store.newGame(Number(params.get("seed")) || undefined);
	else store.loadAutosave();
	if (params.has("speed")) store.setSpeed(Number(params.get("speed")) as 0 | 1 | 3 | 10 | 30);
	if (params.has("overlay")) store.setOverlay(params.get("overlay") as "normal" | "heat" | "power" | "coolant");

	const tools = createToolController(store, content);
	renderer.onPointer((e) => tools.handle(e));
	renderer.resize(window.innerWidth, window.innerHeight);
	// Open on the starter rack row, nudged right so the build palette doesn't cover it.
	renderer.focus({ x: 19, floor: 0 });
	window.addEventListener("resize", () => renderer.resize(window.innerWidth, window.innerHeight));

	// Browsers only allow audio after a user gesture.
	const unlockAudio = () => {
		audio?.resume().catch(() => {});
		window.removeEventListener("pointerdown", unlockAudio);
		window.removeEventListener("keydown", unlockAudio);
	};
	window.addEventListener("pointerdown", unlockAudio);
	window.addEventListener("keydown", unlockAudio);

	createRoot(hudEl).render(
		<StrictMode>
			<Hud store={store} content={content} />
		</StrictMode>,
	);
	startLoop(store, renderer, audio);
	store.publish(performance.now(), true);
	document.getElementById("boot")?.remove();

	// Debug handle for the console and automated checks.
	(window as unknown as { aitower: unknown }).aitower = { store, content };
}

boot().catch((err) => {
	console.error(err);
	const el = document.getElementById("boot");
	if (el) el.textContent = `AItower failed to start: ${err instanceof Error ? err.message : String(err)}`;
});
