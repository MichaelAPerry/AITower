import "@fontsource/dotgothic16/latin-400.css";
import "@fontsource/vt323";
import "@fontsource/special-elite";
import "@fontsource/silkscreen";
import { createAudio } from "@aitower/audio";
import { loadContent } from "@aitower/content";
import { createRenderer } from "@aitower/render";
import type { AudioEngine } from "@aitower/shared";
import { Hud, createToolController } from "@aitower/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "./ErrorBoundary";
import { configureCrashOverlay, installGlobalErrorLogging } from "./crash";
import { createInsetTracker } from "./insets";
import { startLoop } from "./loop";
import { createGameStore } from "./store";

const SPEEDS = [0, 1, 3, 10, 30] as const;
const OVERLAYS = ["normal", "heat", "power", "coolant"] as const;

installGlobalErrorLogging();

async function boot() {
	const content = loadContent();
	// Pixi rasterises text once, so the retro fonts must be ready before the renderer starts.
	await Promise.all(
		['16px "VT323"', '16px "Special Elite"', '8px "Silkscreen"'].map((f) => document.fonts.load(f).catch(() => [])),
	);
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
	const seedParam = params.get("seed");
	const seed = seedParam !== null && seedParam.trim() !== "" && Number.isFinite(Number(seedParam)) ? Math.trunc(Number(seedParam)) : undefined;
	await store.boot({ fresh: params.has("new"), seed });
	// Dev builds only: screenshot and probe scripts reach the store (and through it the sim).
	if ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) (window as unknown as { __aitower: typeof store }).__aitower = store;
	const speed = Number(params.get("speed"));
	if (params.has("speed") && (SPEEDS as readonly number[]).includes(speed)) store.setSpeed(speed as (typeof SPEEDS)[number]);
	const overlay = params.get("overlay");
	if (overlay && (OVERLAYS as readonly string[]).includes(overlay)) store.setOverlay(overlay as (typeof OVERLAYS)[number]);

	configureCrashOverlay({
		autosaveDay: async () => {
			const env = (await store.listSaves()).find((s) => s.id === "auto");
			return env ? env.day : null;
		},
		exportText: async () => {
			try {
				return { text: store.save(), from: "current" as const };
			} catch (err) {
				console.warn("current game cannot be exported:", err);
			}
			const text = await store.readSlotRaw("auto");
			return text === null ? null : { text, from: "autosave" as const };
		},
	});

	const tools = createToolController(store, content);
	renderer.onPointer((e) => tools.handle(e));
	renderer.resize(window.innerWidth, window.innerHeight);
	// Open on the starter rack row, nudged right so the build palette doesn't cover it.
	renderer.focus({ x: 19, floor: 0 });
	window.addEventListener("resize", () => renderer.resize(window.innerWidth, window.innerHeight));

	// Let the camera pan the tower ends clear of whatever overlay covers that side.
	const trackInsets = createInsetTracker((l, r) => renderer.setInsets?.(l, r));
	window.setInterval(trackInsets, 200);
	window.addEventListener("resize", trackInsets);

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
			<ErrorBoundary>
				<Hud store={store} content={content} />
			</ErrorBoundary>
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
