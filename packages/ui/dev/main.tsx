import "@fontsource/vt323";
import "@fontsource/special-elite";
import "@fontsource/silkscreen";
import { createRoot } from "react-dom/client";
import { Hud } from "../src/Hud";
import { createFakeContent, createFakeStore, type FakeStoreWithEmit } from "../src/dev/fakeStore";

const content = createFakeContent();
const store = createFakeStore(content) as FakeStoreWithEmit;
const q = new URLSearchParams(location.search);
// Dev harness only: lets screenshot/probe scripts drive the fake store.
(window as unknown as { __store: typeof store }).__store = store;
if (q.get("tool")) store.setTool({ kind: "place", defId: q.get("tool") ?? "" });
if (q.get("overlay")) store.setOverlay(q.get("overlay") as "heat");
if (q.get("tab") || q.get("sel")) {
	const sel = q.get("sel");
	if (sel === "none") store.setSelection(null);
	else if (sel === "bot") store.setSelection({ kind: "bot", id: 1 });
	else if (sel === "lift") store.setSelection({ kind: "lift", id: 1 });
	else if (sel) store.setSelection({ kind: "facility", id: Number(sel) });
}
// Settings and saves for screenshots: ?scale=1.5 &cb=1 &crt=0 &motion=1 &notice=0 &menu=save|load|settings|controls|new
const num = (k: string): number | null => (q.has(k) ? Number(q.get(k)) : null);
store.setSettings({
	...(num("scale") !== null ? { textScale: num("scale") as number } : {}),
	...(q.get("cb") === "1" ? { colorBlind: true } : {}),
	...(q.get("crt") === "0" ? { crtEffects: false } : {}),
	...(q.get("motion") === "1" ? { reducedMotion: true } : {}),
	...(q.get("notice") === "0" ? { showDesktopNotice: false } : {}),
});
store.seedSlot("auto", { name: "Autosave", savedAt: Date.now() - 3 * 3600_000, day: 11, cash: 1_103_200, tier: 2 });
store.seedSlot("slot1", { name: "Before the chiller", savedAt: Date.now() - 26 * 3600_000, day: 9, cash: 640_000, tier: 1 });
createRoot(document.getElementById("hud") as HTMLElement).render(<Hud store={store} content={content} />);

// Keep the HUD alive: advance the fake clock and drop a few events for toasts.
setInterval(() => store.advance(store.get().speed), 250);
setTimeout(() => store.emit([{ type: "rackTripped", facilityId: 9 }]), 400);
setTimeout(() => store.emit([{ type: "jobCompleted", jobId: 7, payout: 520_000 }]), 700);
setTimeout(() => store.emit([{ type: "commandRejected", command: { type: "buyBot", defId: "techbot" }, reason: "All bot docks are full" }]), 900);

// Click a bottom tab via ?tab=jobs (harness convenience for screenshots).
const tab = q.get("tab");
if (tab) setTimeout(() => (document.querySelectorAll<HTMLButtonElement>(".ui-bottom-tabs .ui-tab")).forEach((b) => {
		if (b.textContent?.toLowerCase().startsWith(tab)) b.click();
	}), 50);

// Open the system menu on a section via ?menu=… (Esc twice: clear the selection, then open).
const menuSection = q.get("menu");
if (menuSection) {
	const esc = (): boolean => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
	setTimeout(() => {
		esc();
		esc();
		setTimeout(() => {
			const names: Record<string, string> = { save: "save game", load: "load game", settings: "settings", controls: "controls", new: "new game" };
			document.querySelectorAll<HTMLButtonElement>(".ui-drawer").forEach((b) => {
				if (b.textContent?.toLowerCase() === names[menuSection]) b.click();
			});
		}, 120);
	}, 300);
}
