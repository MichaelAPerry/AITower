import "@fontsource/vt323";
import "@fontsource/special-elite";
import "@fontsource/silkscreen";
import { createRoot } from "react-dom/client";
import { Hud } from "../src/Hud";
import { TUTORIAL_STEPS } from "../src/tutorial/steps";
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
if (q.get("saves") !== "0") {
	store.seedSlot("auto", { name: "Autosave", savedAt: Date.now() - 3 * 3600_000, day: 11, cash: 1_103_200, tier: 2 });
	store.seedSlot("slot1", { name: "Before the chiller", savedAt: Date.now() - 26 * 3600_000, day: 9, cash: 640_000, tier: 1 });
}
// Decision card and game-over states: ?decision=heatwave|audit (open decision) &hist=1 &standing=18 &mod=1 &over=bankrupt|shutdown|victory
if (q.get("decision")) {
	if (q.get("hist") === "1") {
		const id = store.issueDecision("audit");
		store.dispatch({ type: "resolveDecision", decisionId: id, choiceId: "bribe" });
		store.advance(1);
	}
	store.issueDecision(q.get("decision") === "audit" ? "audit" : "heatwave");
}
if (num("standing") !== null) store.setStanding(num("standing") as number);
if (q.get("mod") === "1") {
	const t = store.get().view.tick;
	store.addModifier({ label: "Heatwave", kind: "ambient", value: 8, endsAt: t + 840 });
	store.addModifier({ label: "Brownout", kind: "gridCap", value: 0.5, endsAt: t + 300 });
	store.addModifier({ label: "Subsidy", kind: "payout", value: 1.25, endsAt: t + 2000 });
}
// M2b: ?clerk=1 (clerk hired) | ?clerk=on (and switched on), ?rp=N research points, ?research=1 opens the sheet,
// ?audit=A..E files a quarterly audit after load, ?fin=credit|audits|record opens that Finance section (with ?tab=finance).
if (q.get("clerk")) {
	store.unlockClerk();
	if (q.get("clerk") === "on") store.dispatch({ type: "setClerk", policy: { ...store.get().view.clerk.policy, enabled: true, kinds: ["training", "inference"], allowLiquid: false, minPayPerPflopHour: 100 } });
}
if (num("rp") !== null) store.addResearchPoints((num("rp") as number) - store.get().view.researchPoints);
// M3: ?bio=1 (wetware fixtures) &corr=0..1 corruption &asc=1 (Clearance 5, FORM A-5 due) &over=bankrupt|shutdown|victory|absorbed|living|clean
if (q.get("bio") === "1") store.seedBio();
if (num("corr") !== null) store.setCorruption(num("corr") as number);
if (q.get("asc") === "1") store.setTier(5);
const over = q.get("over");
if (over === "living" || over === "clean") store.triggerGameOver("victory", over === "living" ? "livingTower" : "cleanTower");
else if (over === "absorbed") store.triggerGameOver("absorbed", "absorbed");
else if (over) store.triggerGameOver(over as "bankrupt");
// M4: ?foreman=1 (Works Foreman hired) &auto=1 (parts + research orders on) &path=greentech|synthetic &score=0..1 &drought=1 &sandbox=1
if (q.get("foreman") === "1") store.unlockForeman();
if (q.get("auto") === "1") {
	const p = store.get().view.automation.policy;
	store.dispatch({ type: "setAutomation", policy: { ...p, parts: { ...p.parts, enabled: true }, research: { ...p.research, enabled: true } } });
}
const path = q.get("path");
if (path === "greentech" || path === "synthetic") store.patchView({ path, ...(path === "greentech" ? { greenScore: num("score") ?? 0.62 } : { refinement: num("score") ?? 0.4 }) });
if (q.get("drought") === "1") store.patchView({ drought: true });
if (q.get("sandbox") === "1") store.patchView({ sandbox: true });
// Induction: ?tut=<step id> jumps to that step, ?tut=none closes it (default: step 1, as on a first visit).
try {
	const tut = q.get("tut");
	if (tut === "none") localStorage.setItem("aitower.induction.v1", JSON.stringify({ step: 0, done: true }));
	else if (tut) localStorage.setItem("aitower.induction.v1", JSON.stringify({ step: Math.max(0, TUTORIAL_STEPS.findIndex((t) => t.id === tut)), done: false }));
	else if (!q.has("keeptut")) localStorage.removeItem("aitower.induction.v1");
} catch {
	/* storage blocked */
}
// ?title=1 shows the title screen; ?saves=0 removes the seeded saves (first-visit title).
createRoot(document.getElementById("hud") as HTMLElement).render(<Hud store={store} content={content} title={q.get("title") === "1"} />);

// Keep the HUD alive: advance the fake clock and drop a few events for toasts.
setInterval(() => store.advance(store.get().speed), 250);
if (q.get("toasts") !== "0") {
	setTimeout(() => store.emit([{ type: "rackTripped", facilityId: 9 }]), 400);
	setTimeout(() => store.emit([{ type: "jobCompleted", jobId: 7, payout: 520_000 }]), 700);
	setTimeout(() => store.emit([{ type: "commandRejected", command: { type: "buyBot", defId: "techbot" }, reason: "All bot docks are full" }]), 900);
}

// Click a bottom tab via ?tab=jobs (harness convenience for screenshots).
const tab = q.get("tab");
if (tab) setTimeout(() => (document.querySelectorAll<HTMLButtonElement>(".ui-dtab")).forEach((b) => {
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

const press = (key: string): boolean => window.dispatchEvent(new KeyboardEvent("keydown", { key }));
if (q.get("research") === "1") setTimeout(() => press("r"), 300);
if (q.get("audit")) setTimeout(() => store.fileQuarterReport(q.get("audit") as "A"), 700);
const fin = q.get("fin");
if (fin)
	setTimeout(() => {
		document.querySelectorAll<HTMLButtonElement>(".ui-subtab").forEach((b) => {
			if (b.textContent?.toLowerCase().startsWith(fin)) b.click();
		});
	}, 150);

// M3 harness: ?palette=bio|rack|... opens the full palette popover on that tab; ?drawer=gauges|finance|research|log opens that drawer.
const pal = q.get("palette");
if (pal)
	setTimeout(() => {
		press("b");
		setTimeout(() => document.querySelectorAll<HTMLButtonElement>(".ui-palette .ui-tab").forEach((b) => {
			if (b.textContent?.toLowerCase().startsWith(pal.slice(0, 4))) b.click();
		}), 100);
	}, 300);
const drawerKeys: Record<string, string> = { contracts: "c", research: "r", finance: "f", gauges: "i" };
if (q.get("drawer")) setTimeout(() => press(drawerKeys[q.get("drawer") as string] ?? "c"), 300);
