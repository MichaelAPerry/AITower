import { jsx as _jsx } from "react/jsx-runtime";
import "@fontsource/vt323";
import "@fontsource/special-elite";
import "@fontsource/silkscreen";
import { createAudio } from "@aitower/audio";
import { loadContent } from "@aitower/content";
import { createRenderer } from "@aitower/render";
import { Hud, createToolController } from "@aitower/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "./ErrorBoundary";
import { configureCrashOverlay, installGlobalErrorLogging } from "./crash";
import { startLoop } from "./loop";
import { createGameStore } from "./store";
const SPEEDS = [0, 1, 3, 10, 30];
const OVERLAYS = ["normal", "heat", "power", "coolant"];
installGlobalErrorLogging();
async function boot() {
    const content = loadContent();
    // Pixi rasterises text once, so the retro fonts must be ready before the renderer starts.
    await Promise.all(['16px "VT323"', '16px "Special Elite"', '8px "Silkscreen"'].map((f) => document.fonts.load(f).catch(() => [])));
    const worldEl = document.getElementById("world");
    const hudEl = document.getElementById("hud");
    const renderer = await createRenderer(worldEl, content);
    let audio = null;
    try {
        audio = createAudio();
    }
    catch (err) {
        console.warn("audio disabled:", err);
    }
    const store = createGameStore(content, renderer, audio);
    const params = new URLSearchParams(location.search);
    const seedParam = params.get("seed");
    const seed = seedParam !== null && seedParam.trim() !== "" && Number.isFinite(Number(seedParam)) ? Math.trunc(Number(seedParam)) : undefined;
    await store.boot({ fresh: params.has("new"), seed });
    const speed = Number(params.get("speed"));
    if (params.has("speed") && SPEEDS.includes(speed))
        store.setSpeed(speed);
    const overlay = params.get("overlay");
    if (overlay && OVERLAYS.includes(overlay))
        store.setOverlay(overlay);
    configureCrashOverlay({
        autosaveDay: async () => {
            const env = (await store.listSaves()).find((s) => s.id === "auto");
            return env ? env.day : null;
        },
        exportText: async () => {
            try {
                return { text: store.save(), from: "current" };
            }
            catch (err) {
                console.warn("current game cannot be exported:", err);
            }
            const text = await store.readSlotRaw("auto");
            return text === null ? null : { text, from: "autosave" };
        },
    });
    const tools = createToolController(store, content);
    renderer.onPointer((e) => tools.handle(e));
    renderer.resize(window.innerWidth, window.innerHeight);
    // Open on the starter rack row, nudged right so the build palette doesn't cover it.
    renderer.focus({ x: 19, floor: 0 });
    window.addEventListener("resize", () => renderer.resize(window.innerWidth, window.innerHeight));
    // Browsers only allow audio after a user gesture.
    const unlockAudio = () => {
        audio?.resume().catch(() => { });
        window.removeEventListener("pointerdown", unlockAudio);
        window.removeEventListener("keydown", unlockAudio);
    };
    window.addEventListener("pointerdown", unlockAudio);
    window.addEventListener("keydown", unlockAudio);
    createRoot(hudEl).render(_jsx(StrictMode, { children: _jsx(ErrorBoundary, { children: _jsx(Hud, { store: store, content: content }) }) }));
    startLoop(store, renderer, audio);
    store.publish(performance.now(), true);
    document.getElementById("boot")?.remove();
    // Debug handle for the console and automated checks.
    window.aitower = { store, content };
}
boot().catch((err) => {
    console.error(err);
    const el = document.getElementById("boot");
    if (el)
        el.textContent = `AItower failed to start: ${err instanceof Error ? err.message : String(err)}`;
});
