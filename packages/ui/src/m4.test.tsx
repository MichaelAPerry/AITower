import type { TechNode } from "@aitower/content";
import type { AutomationPolicy, SimEvent } from "@aitower/sim";
import { renderToString as render } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { activeOrders, anyAutomation, clonePolicy, foremanLockedText, sendAutomation, toCount, toggleBranch, toggleOrder, withOrder } from "./automation/automation";
import { AutomationDrawer } from "./automation/AutomationDrawer";
import { showGrowthGauge } from "./bio/bio";
import { DRAWER_TABS, drawerForKey, feedLines } from "./calm/calm";
import { TopStrip } from "./calm/TopStrip";
import { createFakeContent, createFakeStore } from "./dev/fakeStore";
import { click, findAll, findButton, panelProps, textOf } from "./dev/walk";
import { describeEvent } from "./events";
import { keyAction, runKey } from "./keyboard";
import { onNotice } from "./notices";
import { currentObjective } from "./objective/objective";
import { SoulGauge } from "./soul/SoulGauge";
import { treeBars } from "./soul/soul";
import { droughtChip, pathGauge } from "./paths/paths";
import { CRAWL_LINES, crawlSeconds, isSkipKey, lineDelay, reducedMotion } from "./title/crawl";
import { OpeningCrawl } from "./title/OpeningCrawl";
import { scenarioCards, showPicker, validScenario } from "./title/scenarios";
import { startGame } from "./title/titleState";
import { Hud } from "./Hud";

const FOREMAN: TechNode = { id: "works_foreman", name: "Works Foreman", branch: "administration", minTier: 1, cost: 10, requires: [], description: "x", effects: [{ type: "feature", feature: "foreman" }] };
const setup = () => {
	const content = createFakeContent();
	content.tech.push(FOREMAN);
	const store = createFakeStore(content);
	return { content, store };
};
const policy = (store: ReturnType<typeof setup>["store"]): AutomationPolicy => store.get().view.automation.policy;

describe("automation policy helpers", () => {
	it("withOrder and toggleOrder copy; they never touch the input", () => {
		const { store } = setup();
		const p = policy(store);
		const before = JSON.stringify(p);
		const a = withOrder(p, "parts", { keep: 9 });
		const b = toggleOrder(p, "bots");
		expect(a.parts).toEqual({ enabled: false, keep: 9 });
		expect(b.bots.enabled).toBe(true);
		expect(a.research).not.toBe(p.research);
		expect(a.research.branches).not.toBe(p.research.branches);
		expect(JSON.stringify(p)).toBe(before);
		expect(clonePolicy(p)).toEqual(p);
	});
	it("toggleBranch keeps the canonical order and empty means any", () => {
		expect(toggleBranch([], "power")).toEqual(["power"]);
		expect(toggleBranch(["power"], "compute")).toEqual(["compute", "power"]);
		expect(toggleBranch(["compute", "power"], "compute")).toEqual(["power"]);
		expect(toggleBranch(["power"], "power")).toEqual([]);
	});
	it("toCount accepts whole numbers in range and refuses the rest", () => {
		expect(toCount(4)).toBe(4);
		expect(toCount(2.6)).toBe(3);
		expect(toCount(0, 1)).toBeNull();
		expect(toCount(Number.NaN)).toBeNull();
		expect(toCount(Number.POSITIVE_INFINITY)).toBeNull();
		expect(toCount(1e12)).toBe(1_000_000);
		expect(toCount(1e12, 0, 1e13)).toBe(1e12);
	});
	it("lists the orders that are on, and the AUTO lamp follows", () => {
		const { store } = setup();
		expect(anyAutomation(store.get().view)).toBe(false);
		store.dispatch({ type: "setAutomation", policy: withOrder(policy(store), "parts", { enabled: true }) });
		expect(activeOrders(store.get().view)).toEqual(["Spare parts"]);
		expect(anyAutomation(store.get().view)).toBe(true);
	});
	it("a Foreman switch left on while it is locked does not count; the hired Clerk does", () => {
		const { store } = setup();
		const v = store.get().view;
		const locked = { ...v, automation: { ...v.automation, policy: withOrder(v.automation.policy, "foreman", { enabled: true }) } };
		expect(anyAutomation(locked)).toBe(false);
		store.unlockClerk();
		store.dispatch({ type: "setClerk", policy: { ...store.get().view.clerk.policy, enabled: true } });
		expect(activeOrders(store.get().view)).toEqual(["Contract Automation"]);
	});
	it("sendAutomation builds on the policy as it is now and shows a refusal as a notice", () => {
		const { store } = setup();
		const seen: string[] = [];
		const off = onNotice((n) => seen.push(n.text));
		expect(sendAutomation(store, (c) => withOrder(c, "parts", { keep: 7 })).ok).toBe(true);
		expect(sendAutomation(store, (c) => withOrder(c, "bots", { maxBots: 3 })).ok).toBe(true);
		expect(policy(store).parts.keep).toBe(7); // the second edit kept the first
		expect(policy(store).bots.maxBots).toBe(3);
		expect(sendAutomation(store, (c) => withOrder(c, "foreman", { enabled: true })).ok).toBe(false); // not hired
		off();
		expect(seen).toEqual(["The Works Foreman has not been hired"]);
		expect(policy(store).foreman.enabled).toBe(false);
	});
});

describe("Automation drawer", () => {
	it("has an edge tab on key T (A would pan the camera: the renderer owns WASD)", () => {
		expect(drawerForKey("t")).toBe("automation");
		expect(drawerForKey("a")).toBeNull();
		expect(DRAWER_TABS.some((t) => t.id === "automation" && t.key === "T")).toBe(true);
		expect(keyAction("t")).toEqual({ type: "drawer", id: "automation" });
		expect(keyAction("a")).toBeNull();
		const { store } = setup();
		const toggleDrawer = vi.fn();
		runKey(store, "t", { menu: { isOpen: () => false, open() {}, close() {} } as never, toggleDrawer, togglePalette() {}, lastSpeed: { current: 1 } });
		expect(toggleDrawer).toHaveBeenCalledWith("automation");
	});
	it("has one row per order and the Clerk, each with a switch that dispatches setAutomation", () => {
		const { store, content } = setup();
		const spy = vi.spyOn(store, "dispatch");
		let tree = AutomationDrawer(panelProps(store, content));
		const html = render(<AutomationDrawer {...panelProps(store, content)} />);
		for (const name of ["Research", "Spare parts", "Maintenance bots", "Works Foreman", "Contract Automation"]) expect(html).toContain(name);
		click(findButton(tree, /Research: off/));
		expect(spy).toHaveBeenLastCalledWith({ type: "setAutomation", policy: expect.objectContaining({ research: { enabled: true, branches: [] } }) });
		tree = AutomationDrawer(panelProps(store, content));
		click(findButton(tree, /Spare parts: off/));
		click(findButton(AutomationDrawer(panelProps(store, content)), /Maintenance bots: off/));
		expect(policy(store)).toMatchObject({ research: { enabled: true }, parts: { enabled: true, keep: 4 }, bots: { enabled: true } });
		click(findButton(AutomationDrawer(panelProps(store, content)), /Research: on/));
		expect(policy(store).research.enabled).toBe(false);
	});
	it("picks research branches", () => {
		const { store, content } = setup();
		click(findButton(AutomationDrawer(panelProps(store, content)), /^Power$/));
		click(findButton(AutomationDrawer(panelProps(store, content)), /^Compute$/));
		expect(policy(store).research.branches).toEqual(["compute", "power"]);
		click(findButton(AutomationDrawer(panelProps(store, content)), /^Power$/));
		expect(policy(store).research.branches).toEqual(["compute"]);
	});
	it("shows 'Research: Works Foreman' until it is unlocked, then a switch and its settings", () => {
		const { store, content } = setup();
		expect(foremanLockedText(content)).toBe("Research: Works Foreman");
		const open = vi.fn();
		const props = { ...panelProps(store, content), openResearch: open };
		let tree = AutomationDrawer(props);
		click(findButton(tree, /Research: Works Foreman/));
		expect(open).toHaveBeenCalledTimes(1);
		expect(() => findButton(tree, /Works Foreman: (on|off)/)).toThrow();
		expect(render(<AutomationDrawer {...props} />)).not.toContain("Keep in reserve");
		store.unlockForeman();
		tree = AutomationDrawer(panelProps(store, content));
		click(findButton(tree, /Works Foreman: off/));
		expect(policy(store).foreman.enabled).toBe(true);
		expect(render(<AutomationDrawer {...panelProps(store, content)} />)).toContain("Keep in reserve");
	});
	it("researching the Foreman node unlocks it in the fake store like the sim", () => {
		const { store } = setup();
		store.addResearchPoints(100);
		expect(store.dispatch({ type: "research", techId: "works_foreman" }).ok).toBe(true);
		expect(store.get().view.automation.foremanUnlocked).toBe(true);
	});
	it("lists the Clerk as a locked line, then as a one-line toggle that dispatches setClerk", () => {
		const { store, content } = setup();
		expect(textOf(AutomationDrawer(panelProps(store, content)))).toContain("Hire a Contract Automation");
		store.unlockClerk();
		const spy = vi.spyOn(store, "dispatch");
		click(findButton(AutomationDrawer(panelProps(store, content)), /Clerk is off/));
		expect(spy).toHaveBeenLastCalledWith({ type: "setClerk", policy: expect.objectContaining({ enabled: true }) });
		expect(store.get().view.clerk.policy.enabled).toBe(true);
		click(findButton(AutomationDrawer(panelProps(store, content)), /Clerk is on/));
		expect(store.get().view.clerk.policy.enabled).toBe(false);
	});
});

describe("top strip", () => {
	it("has no AUTO lamp, badge or chips on a plain game", () => {
		const { store, content } = setup();
		const t = textOf(TopStrip(panelProps(store, content)));
		expect(t).not.toMatch(/AUTO|SANDBOX|WEATHER/);
	});
	it("shows the AUTO lamp when any order is on, and it opens the drawer", () => {
		const { store, content } = setup();
		store.dispatch({ type: "setAutomation", policy: toggleOrder(policy(store), "parts") });
		const setUi = vi.fn();
		const tree = TopStrip({ ...panelProps(store, content), setUi });
		click(findButton(tree, /Standing orders on: Spare parts/));
		expect(setUi).toHaveBeenCalledWith({ drawer: "automation" });
	});
	it("shows SANDBOX and the drought chip", () => {
		const { store, content } = setup();
		store.patchView({ sandbox: true, drought: true });
		const t = textOf(TopStrip(panelProps(store, content)));
		expect(t).toContain("SANDBOX");
		expect(t).toContain("DARK CALM");
		expect(droughtChip({ drought: false }, content)).toBeNull();
		expect(droughtChip({ drought: true }, content)?.title).toMatch(/Dunkelflaute/);
	});
	it("shows the three Singularity bars, the committed tree active and a sealed one marked", () => {
		const { store, content } = setup();
		const v = store.get().view;
		const gauges = () => findAll(TopStrip(panelProps(store, content)), (el) => el.type === SoulGauge);
		expect(gauges()).toHaveLength(1);
		const bars = treeBars({ ...v.soul, sp: { synthetic: 500, biotech: 0, greentech: 100 }, sealedOut: ["biotech"] }, "greentech");
		expect(bars.map((b) => [b.tree, b.state, b.frac])).toEqual([["synthetic", "active", 0.5], ["biotech", "sealed", 0], ["greentech", "active", 0.1]]);
		expect(bars[0].title).toContain("1000 Singularity points");
		expect(treeBars(v.soul, null)[2].state).toBe("dormant");
		expect(textOf(SoulGauge({ view: { ...v, soul: { ...v.soul, sealedOut: ["biotech"] } }, onOpen: () => {} }))).toContain("SEALED");
	});
	it("the green score gauge names the Garden's target from the content", () => {
		const { content } = setup();
		const g = pathGauge({ path: "greentech", greenScore: 0.5, refinement: 0 }, content);
		expect(g?.title).toContain("1000 Singularity points");
	});
	it("growth index gives way to the path gauge on Greentech and Synthetic unless corruption exists", () => {
		expect(showGrowthGauge({ corruption: 0, tier: 4 })).toBe(true);
		expect(showGrowthGauge({ corruption: 0, tier: 4, path: "biotech" })).toBe(true);
		expect(showGrowthGauge({ corruption: 0, tier: 4, path: "greentech" })).toBe(false);
		expect(showGrowthGauge({ corruption: 0, tier: 5, path: "synthetic" })).toBe(false);
		expect(showGrowthGauge({ corruption: 0.2, tier: 5, path: "synthetic" })).toBe(true);
		expect(showGrowthGauge({ corruption: 0, tier: 2 })).toBe(false);
	});
});

describe("sandbox", () => {
	it("gives no bankruptcy warning when the cash is negative", () => {
		const { store, content } = setup();
		store.patchView({ cash: -5000 });
		const warn = currentObjective(store.get().view, content, (c) => store.canBuild(c));
		expect(warn.title).toBe("The Treasury is in the red");
		store.patchView({ sandbox: true });
		const calm = currentObjective(store.get().view, content, (c) => store.canBuild(c));
		expect(calm.title).not.toBe("The Treasury is in the red");
		expect(calm.detail).not.toMatch(/bankrupt/i);
	});
	it("a new sandbox game sets the flag, the cash and the Clearance", () => {
		const { store } = setup();
		store.newGame(1, "sandbox");
		expect(store.get().view).toMatchObject({ sandbox: true, cash: 500_000_000, tier: 5 });
		store.newGame(1, "brownfield");
		expect(store.get().view).toMatchObject({ sandbox: false, cash: 350_000, tier: 2 });
	});
});

const L = (tick: number, event: SimEvent) => ({ tick, event });
describe("feed lines (ticker and alert log)", () => {
	const { store, content } = setup();
	const view = store.get().view;
	const feed = (log: { tick: number; event: SimEvent }[]) => feedLines(log, view, content, "full");
	it("folds payouts into one line per game-hour", () => {
		const lines = feed([L(60, { type: "earned", jobId: 1, amount: 1000 }), L(75, { type: "earned", jobId: 2, amount: 2500 }), L(90, { type: "earned", jobId: 1, amount: 500 }), L(130, { type: "earned", jobId: 1, amount: 700 })]);
		expect(lines).toHaveLength(2);
		expect(lines[0].text).toBe("Contracts paid $4k this hour (3 payouts, 2 jobs)");
		expect(lines[0].tick).toBe(90);
		expect(lines[1].text).toMatch(/paid \$700/); // a single payout keeps its own wording
	});
	it("folds the Foreman's builds and the stores' purchases per hour (parts and bots apart)", () => {
		const lines = feed([L(10, { type: "autoBuilt", facilityId: 1 }), L(20, { type: "autoBuilt", facilityId: 2 }), L(25, { type: "autoBought", what: "parts", count: 5 }), L(30, { type: "autoBought", what: "parts", count: 5 }), L(35, { type: "autoBought", what: "bot", count: 1 })]);
		expect(lines.map((l) => l.text)).toEqual(["The Works Foreman placed 2 facilities this hour", "Stores bought 10 spare parts", "Stores bought 1 bot"]);
		expect(lines[0].cell).toBeUndefined();
	});
	it("keeps a lone Foreman build clickable and keeps other events one by one, in order", () => {
		const lines = feed([L(5, { type: "autoBuilt", facilityId: 1 }), L(6, { type: "droughtStarted" }), L(7, { type: "earned", jobId: 1, amount: 10 }), L(8, { type: "droughtEnded" })]);
		expect(lines).toHaveLength(4);
		expect(lines[1].text).toMatch(/^Dunkelflaute/);
		expect(lines[0].text).toMatch(/^The Works Foreman placed /);
	});
	it("an update moves a folded line to the end, and the keep filter drops events first", () => {
		const log = [L(1, { type: "earned", jobId: 1, amount: 5 }), L(2, { type: "droughtStarted" }), L(3, { type: "earned", jobId: 1, amount: 5 })];
		expect(feed(log).map((l) => l.tick)).toEqual([2, 3]);
		expect(feedLines(log, view, content, "full", (e) => e.type !== "droughtStarted").map((l) => l.tick)).toEqual([3]);
		expect(feed([L(1, { type: "liftArrived", liftId: 1, floor: 2 })])).toEqual([]);
	});
});

describe("event wording", () => {
	const { store, content } = setup();
	const view = store.get().view;
	const d = (e: SimEvent) => describeEvent(e, view, content, "full");
	it("never toasts the streams, toasts the drought start", () => {
		expect(d({ type: "earned", jobId: 1, amount: 100 }).toast).toBe(false);
		expect(d({ type: "autoBuilt", facilityId: 1 }).toast).toBe(false);
		expect(d({ type: "autoBought", what: "parts", count: 1 }).text).toBe("Stores bought 1 spare part");
		expect(d({ type: "droughtStarted" })).toMatchObject({ toast: true, severity: "warn" });
		expect(d({ type: "droughtEnded" })).toMatchObject({ toast: false, severity: "good" });
	});
});

describe("scenario picker", () => {
	it("lists the content's scenarios, the standard start first, each with a description", () => {
		const { content } = setup();
		const cards = scenarioCards(content);
		expect(cards.map((c) => c.id)).toEqual(["starter", "brownfield", "sandbox"]);
		expect(cards.every((c) => c.description.length > 20)).toBe(true);
		expect(cards[1].description).toBe(content.scenarios.brownfield.description);
		expect(cards[1].facts).toBe("$350k · Level 2");
		expect(cards[2].sandbox).toBe(true);
		expect(showPicker(cards)).toBe(true);
		expect(showPicker(cards.slice(0, 1))).toBe(false);
	});
	it("falls back to the standard start for an unknown id", () => {
		const { content } = setup();
		expect(validScenario(content, "brownfield")).toBe("brownfield");
		expect(validScenario(content, "nope")).toBe("starter");
		expect(validScenario(content, null)).toBe("starter");
	});
	it("New game starts the chosen scenario; Continue and the default start are unchanged", () => {
		const { store } = setup();
		const newGame = vi.spyOn(store, "newGame");
		startGame(store, { kind: "new", scenarioId: "brownfield" });
		expect(newGame).toHaveBeenLastCalledWith(undefined, "brownfield");
		expect(store.get().view.cash).toBe(350_000);
		expect(store.get().speed).toBe(1);
		startGame(store, { kind: "new" });
		expect(newGame).toHaveBeenLastCalledWith();
	});
	it("with the crawl the clock stays stopped until the crawl ends", () => {
		const { store } = setup();
		store.setSpeed(3);
		startGame(store, { kind: "new", crawl: true });
		expect(store.get().speed).toBe(0);
	});

});

describe("opening crawl", () => {
	it("is about six lines, each later than the last", () => {
		expect(CRAWL_LINES).toHaveLength(6);
		expect(new Set(CRAWL_LINES).size).toBe(6);
		expect(lineDelay(0)).toBe(0);
		expect(lineDelay(5)).toBeGreaterThan(lineDelay(4));
		expect(crawlSeconds()).toBeGreaterThan(lineDelay(5));
	});
	it("is skipped by Esc, Enter and Space only", () => {
		expect(["Escape", "Enter", " "].every(isSkipKey)).toBe(true);
		expect(["a", "Tab", "1"].some(isSkipKey)).toBe(false);
	});
	it("respects reduced motion from the setting or the system", () => {
		expect(reducedMotion(true, undefined)).toBe(true);
		expect(reducedMotion(false, undefined)).toBe(false);
		expect(reducedMotion(false, { matchMedia: () => ({ matches: true }) })).toBe(true);
		expect(reducedMotion(false, { matchMedia: () => ({ matches: false }) })).toBe(false);
		expect(
			reducedMotion(false, {
				matchMedia: () => {
					throw new Error("no");
				},
			}),
		).toBe(false);
	});
	it("renders every line, animated by delay unless motion is reduced, with a skip button", () => {
		const html = render(<OpeningCrawl reduced={false} onDone={() => {}} />);
		for (const line of CRAWL_LINES) expect(html).toContain(line.replace(/'/g, "&#x27;"));
		expect(html).toContain("animation-delay");
		expect(html).toContain("Skip");
		const still = render(<OpeningCrawl reduced onDone={() => {}} />);
		expect(still).not.toContain("animation-delay");
		expect(still).toContain("is-still");
		expect(still).toContain("Begin");
	});
});

describe("Hud", () => {
	it("renders the drawer tab and, in a sandbox, the badge without a bankruptcy warning", () => {
		const { store, content } = setup();
		store.patchView({ sandbox: true, cash: -100 });
		const html = render(<Hud store={store} content={content} title={false} />);
		expect(html).toContain("Automation");
		expect(html).toContain("SANDBOX");
		expect(html).not.toContain("in the red");
	});
	it("shows the scenario picker on the title screen", () => {
		const { store, content } = setup();
		const html = render(<Hud store={store} content={content} title />);
		// The title waits for the saves list before drawing its menu, but the picker needs only the content.
		expect(html).toContain("FREE BUILD SITE");
		expect(html).toContain("Auction Lot");
	});
});
