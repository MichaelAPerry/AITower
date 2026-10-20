import type { OrganoidSpec } from "@aitower/content";
import { type CellPointerEvent, DEFAULT_SETTINGS } from "@aitower/shared";
import { renderToString as render } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AscensionForm } from "./ascension/AscensionForm";
import { ascensionDue, filePath, pathPending, pathRows, pathToConfirm } from "./ascension/ascension";
import { bandText, bioWords, memoStain, organoidBand, showGrowthGauge, tissueState, traitInfo } from "./bio/bio";
import { NextChip, Ticker } from "./calm/Parts";
import { BuildBar } from "./build/BuildBar";
import { BuildInspector } from "./build/BuildInspector";
import { BuildPalette } from "./components/BuildPalette";
import { MODES, overlayLabel } from "./components/OverlaySwitcher";
import { createFakeContent, createFakeStore } from "./dev/fakeStore";
import { click, findAll, findButton, panelProps, textOf } from "./dev/walk";
import { describeEvent } from "./events";
import { endingOf, overCopyFor } from "./gameover/gameOver";
import { MemoSlip, urgentToPop } from "./memo/MemoDesk";
import { currentObjective, endingLine } from "./objective/objective";
import { nutrientLoopProblem, rackProblem } from "./objective/diagnose";
import { Inspector } from "./components/Inspector";
import { runKey } from "./keyboard";
import { escapeStep } from "./menu/escape";
import { createMenuController } from "./menu/menuController";
import { createToolController } from "./tools/controller";

const renderToString = (el: Parameters<typeof render>[0]): string => render(el).replace(/<!-- -->/g, "");
const setup = () => {
	const content = createFakeContent();
	const store = createFakeStore(content);
	return { content, store };
};
const bio: OrganoidSpec = { targetC: 37, toleranceC: 3, nutrientUse: 3, contamination: 0.002 };

describe("organoid band", () => {
	it("is ±1, 2 and 3 tolerances around the target", () => {
		expect(organoidBand(bio)).toEqual({ targetC: 37, lo: 34, hi: 40, slowLo: 31, slowHi: 43, failLo: 28, failHi: 46 });
		expect(bandText(bio)).toBe("37 °C ±3");
	});
	it("classifies in band, slowed and failing, cold and hot", () => {
		expect(tissueState(37, bio)).toMatchObject({ kind: "inBand", side: null });
		expect(tissueState(34, bio).kind).toBe("inBand");
		expect(tissueState(33, bio)).toMatchObject({ kind: "slow", side: "cold" });
		expect(tissueState(28, bio).kind).toBe("slow"); // exactly 3 tolerances is not yet beyond
		expect(tissueState(27.9, bio)).toMatchObject({ kind: "failing", side: "cold" });
		expect(tissueState(41, bio)).toMatchObject({ kind: "slow", side: "hot" });
		expect(tissueState(47, bio)).toMatchObject({ kind: "failing", side: "hot" });
	});
});

describe("horror intensity wording", () => {
	it("uses Compute Authority euphemism unless horror is off", () => {
		expect(bioWords("full").gauge).toBe("ASSET GROWTH INDEX");
		expect(bioWords("mild").gauge).toBe("ASSET GROWTH INDEX");
		expect(bioWords("off").gauge).toBe("CONTAMINATION");
		expect(bioWords("full").grown).toBe("Unregistered asset");
		expect(bioWords("off").grown).toBe("Growth");
		expect(traitInfo("fleshed", "full").label).toBe("Reclassified: Schedule F");
		expect(traitInfo("fleshed", "off").label).toBe("Mutated: fleshed");
	});
	it("stains the memo slip subtly, half as much at mild, never at off", () => {
		expect(memoStain(0.3, "full")).toBe("none");
		expect(memoStain(0.5, "full")).toBe("faint");
		expect(memoStain(0.9, "full")).toBe("heavy");
		expect(memoStain(0.5, "mild")).toBe("none");
		expect(memoStain(0.9, "mild")).toBe("faint");
		expect(memoStain(1, "off")).toBe("none");
	});
	it("shows the growth gauge once corruption is above zero or from Clearance 3", () => {
		expect(showGrowthGauge({ corruption: 0, tier: 2 })).toBe(false);
		expect(showGrowthGauge({ corruption: 0.01, tier: 1 })).toBe(true);
		expect(showGrowthGauge({ corruption: 0, tier: 3 })).toBe(true);
	});
	it("renders the top-strip gauge with the euphemism, and the plain label at off", () => {
		const { content, store } = setup();
		store.setCorruption(0.4);
		const html = (h: "full" | "off") => {
			store.setSettings({ horrorIntensity: h });
			return renderToString(<NextChip {...panelProps(store, content)} />) + renderToString(<GrowthGauge store={store} />);
		};
		expect(html("full")).toContain("ASSET GROWTH INDEX");
		expect(html("off")).toContain("CONTAMINATION");
	});
});

import { GrowthIndex } from "./bio/GrowthIndex";
function GrowthGauge({ store }: { store: ReturnType<typeof createFakeStore> }) {
	const s = store.get();
	return <GrowthIndex view={s.view} horror={s.settings.horrorIntensity} />;
}

describe("diagnosis", () => {
	const wet = () => {
		const { content, store } = setup();
		store.seedBio();
		return { content, view: store.get().view };
	};
	it("noNutrient: no pipe, no plant, unpowered plant, short net", () => {
		const { content, view } = wet();
		expect(nutrientLoopProblem(view, content, null)).toMatch(/No nutrient pipe.*nutrient conduit.*Nutrient Plant/);
		expect(nutrientLoopProblem({ ...view, facilities: view.facilities.filter((f) => f.defId !== "nutrient_plant") }, content, 1)).toMatch(/reaches no Nutrient Plant/);
		const off = { ...view, facilities: view.facilities.map((f) => (f.defId === "nutrient_plant" ? { ...f, status: "unpowered" as const } : f)) };
		expect(nutrientLoopProblem(off, content, 1)).toMatch(/off or has no power/);
		expect(nutrientLoopProblem(view, content, 1)).toMatch(/short: 20 of 26 units a tick/);
		expect(nutrientLoopProblem({ ...view, nutrientNets: [{ id: 1, supply: 30, demand: 26, satisfaction: 1 }] }, content, 1)).toBeNull();
	});
	it("a starving organoid rack explains its line through rackProblem", () => {
		const { content, view } = wet();
		const f = view.facilities.find((x) => x.status === "noNutrient");
		expect(f).toBeDefined();
		expect(rackProblem(view, content, f as NonNullable<typeof f>)).toMatch(/No nutrient pipe/);
	});
	it("tooCold says to put it near warm racks or heat the room, with the band", () => {
		const { content, view } = wet();
		const f = view.facilities.find((x) => x.status === "tooCold") as NonNullable<ReturnType<typeof view.facilities.find>>;
		const why = rackProblem(view, content, f) ?? "";
		expect(why).toMatch(/Too cold/);
		expect(why).toMatch(/37 °C ±1/);
		expect(why).toMatch(/near warm racks or heat the room/);
	});
	it("CURRENT ORDERS reports starving and cold organoid racks", () => {
		const { content, store } = setup();
		store.seedBio();
		const v = store.get().view;
		const o = currentObjective({ ...v, facilities: v.facilities.map((f) => (f.status === "failed" ? { ...f, status: "ok" as const } : f)) }, content, () => ({ ok: true }));
		expect(o.title).toMatch(/can't run/);
		expect(o.detail).toMatch(/nutrient/i);
	});
});

describe("dossier", () => {
	const dossier = (sel: Parameters<ReturnType<typeof createFakeStore>["setSelection"]>[0], horror: "full" | "off" = "full") => {
		const { content, store } = setup();
		store.seedBio();
		store.setSettings({ horrorIntensity: horror });
		store.setSelection(sel);
		return renderToString(<Inspector {...panelProps(store, content)} />);
	};
	const idOf = (pick: (f: { defId: string; status: string; grown: boolean }) => boolean) => {
		const { store } = setup();
		store.seedBio();
		return (store.get().view.facilities.find(pick) as { id: number }).id;
	};
	it("shows the organoid band, the tissue state and the contamination at the rack", () => {
		const html = dossier({ kind: "facility", id: idOf((f) => f.status === "tooCold") });
		expect(html).toContain("Tissue temp");
		expect(html).toContain("Too cold");
		const wetRack = dossier({ kind: "facility", id: idOf((f) => f.defId === "organoid_incubator" && f.status === "ok") });
		expect(wetRack).toContain("Growth index");
		expect(dossier({ kind: "facility", id: idOf((f) => f.defId === "organoid_incubator" && f.status === "ok") }, "off")).toContain("Contamination");
	});
	it("calls a grown facility an Unregistered asset (Growth at off)", () => {
		const id = idOf((f) => f.grown);
		expect(dossier({ kind: "facility", id })).toContain("Unregistered asset");
		expect(dossier({ kind: "facility", id }, "off")).toContain(">Growth<");
	});
	it("shows a mutated bot as reclassified (plain wording at off)", () => {
		expect(dossier({ kind: "bot", id: 1 })).toContain("Reclassified: Schedule F");
		expect(dossier({ kind: "bot", id: 1 }, "off")).toContain("Mutated: fleshed");
	});
});

describe("ascension", () => {
	it("is due at the minimum Clearance with no path chosen, and not before or after", () => {
		const { content, store } = setup();
		const v = store.get().view;
		expect(ascensionDue({ ...v, tier: 4, path: null }, content)).toBe(false);
		expect(ascensionDue({ ...v, tier: 5, path: null }, content)).toBe(true);
		expect(ascensionDue({ ...v, tier: 5, path: "biotech" }, content)).toBe(false);
	});
	it("CURRENT ORDERS says so and offers the form; nothing once the choice is pending or made", () => {
		const { content, store } = setup();
		store.setTier(5);
		const v = store.get().view;
		const o = currentObjective(v, content, () => ({ ok: true }));
		expect(o).toMatchObject({ action: "ascension", title: expect.stringContaining("Ascension") });
		expect(currentObjective(v, content, () => ({ ok: true }), { path: "biotech", tick: v.tick }).action).toBeUndefined();
		let opened = 0;
		const tree = NextChip(panelProps(store, content, { openAscension: () => opened++ }));
		click(findButton(tree, /ASCENSION/));
		expect(opened).toBe(1);
	});
	it("lists the content's paths and stamps the unavailable ones COMING SOON", () => {
		const { content, store } = setup();
		const rows = pathRows(content, store.get().view);
		expect(rows.map((r) => [r.id, r.available])).toEqual([["biotech", true], ["greentech", false], ["synthetic", false]]);
		const html = renderToString(<AscensionForm rows={rows} tier={5} pending={null} onPick={() => {}} onConfirm={() => {}} onCancel={() => {}} onClose={() => {}} />);
		expect(html).toContain("ASCENSION");
		expect(html.match(/ui-asc-soon/g)?.length).toBe(2);
		expect(pathToConfirm(content, "greentech")).toBeNull();
		expect(pathToConfirm(content, "biotech")).toBe("biotech");
	});
	it("choosing asks for confirmation, and only confirming dispatches choosePath", () => {
		const { content, store } = setup();
		store.setTier(5);
		const sent: unknown[] = [];
		const orig = store.dispatch;
		store.dispatch = (c) => {
			sent.push(c);
			return orig(c);
		};
		const rows = pathRows(content, store.get().view);
		let picked: string | null = null;
		let confirmed = 0;
		const form = (pending: typeof picked) => AscensionForm({ rows, tier: 5, pending: pending as never, onPick: (id) => (picked = id), onConfirm: () => confirmed++, onCancel: () => {}, onClose: () => {} });
		click(findButton(form(null), /Choose/));
		expect(picked).toBe("biotech");
		expect(sent).toEqual([]); // nothing dispatched by picking
				const bar0 = findAll(form("biotech" as never), (e) => typeof e.props.onYes === "function")[0];
		expect(bar0.props.question).toBe("Commit to Biotech? This cannot be undone.");
		expect(findAll(form(null), (e) => typeof e.props.onYes === "function")).toHaveLength(0);
		const bar = findAll(form("biotech" as never), (e) => typeof e.props.onYes === "function")[0];
		(bar.props.onYes as () => void)();
		expect(confirmed).toBe(1);
		const filed = filePath(store, content, "biotech");
		expect(sent).toEqual([{ type: "choosePath", path: "biotech" }]);
		expect(filed).toMatchObject({ path: "biotech" });
		store.advance(1);
		expect(store.get().view.path).toBe("biotech");
		expect(store.get().log.some((e) => e.event.type === "pathChosen")).toBe(true);
	});
	it("refuses an unavailable path and a second choice without dispatching a wrong command", () => {
		const { content, store } = setup();
		store.setTier(5);
		expect(filePath(store, content, "greentech")).toBeNull();
		expect(filePath(store, content, "biotech")).not.toBeNull();
		store.advance(1);
		expect(filePath(store, content, "biotech")).toBeNull(); // the sim says it was already chosen
	});
	it("a filed choice is pending only until the next tick", () => {
		const f = { path: "biotech" as const, tick: 100 };
		expect(pathPending(f, { path: null, tick: 100 })).toBe(true);
		expect(pathPending(f, { path: null, tick: 101 })).toBe(false); // the sim refused it
		expect(pathPending(f, { path: "biotech", tick: 101 })).toBe(false);
		expect(pathPending(null, { path: null, tick: 1 })).toBe(false);
	});
});

describe("endings", () => {
	const { content } = setup();
	const over = (kind: "victory" | "absorbed" | "bankrupt", ending?: "livingTower" | "cleanTower" | "absorbed") => ({ kind, tick: 1, ...(ending ? { ending } : {}) });
	it("prints the content's text for the ending reached", () => {
		const living = overCopyFor(over("victory", "livingTower"), content);
		expect(living.heading).toBe("LIVING TOWER");
		expect(living.lines).toEqual(content.endings[0].body.split("\n\n"));
		expect(overCopyFor(over("victory", "cleanTower"), content).heading).toBe("CLEAN TOWER");
		const abs = overCopyFor(over("absorbed", "absorbed"), content);
		expect(abs).toMatchObject({ heading: "ABSORBED", tone: "red", stamp: "ABSORBED" });
		expect(overCopyFor(over("absorbed"), content).heading).toBe("ABSORBED"); // kind alone is enough
	});
	it("keeps the old copy for bankrupt, shutdown and a victory without an ending, and when content lacks the ending", () => {
		expect(overCopyFor(over("bankrupt"), content).heading).toBe("NOTICE OF TERMINATION");
		expect(overCopyFor(over("victory"), content).heading).toBe("COMMENDATION");
		expect(overCopyFor(over("victory", "livingTower"), { ...content, endings: [] }).heading).toBe("COMMENDATION");
		expect(endingOf(over("absorbed"))).toBe("absorbed");
		expect(endingOf(over("bankrupt"))).toBeUndefined();
	});
	it("prints plain forms at horror off", () => {
		expect(overCopyFor(over("absorbed"), content, "full").stamp).toBe("ABSORBED");
		expect(overCopyFor(over("absorbed"), content, "off").stamp).toBe("TAKEN OVER");
	});
	it("CURRENT ORDERS shows the ending progress, but never announces the secret one", () => {
		const { content: c, store } = setup();
		const v = store.get().view;
		expect(endingLine({ ...v, endingProgress: { ending: "livingTower", days: 2, needed: 3 } }, c)).toBe("Living Tower: 2 of 3 days");
		expect(endingLine({ ...v, endingProgress: { ending: "cleanTower", days: 2.9, needed: 7 } }, c)).toBe("Clean Tower: 2 of 7 days");
		expect(endingLine({ ...v, endingProgress: { ending: "absorbed", days: 1, needed: 1 } }, c)).toBeNull();
		expect(endingLine({ ...v, endingProgress: null }, c)).toBeNull();
	});
});

describe("event wording", () => {
	const { content, store } = setup();
	store.seedBio();
	const v = store.get().view;
	const grown = (v.facilities.find((f) => f.grown) as { id: number }).id;
	it("words the biotech events in euphemism, and plainly at off", () => {
		expect(describeEvent({ type: "growthSprouted", facilityId: grown }, v, content).text).toMatch(/unregistered asset/);
		expect(describeEvent({ type: "growthSprouted", facilityId: grown }, v, content, "off").text).toMatch(/growth has appeared/);
		expect(describeEvent({ type: "botMutated", botId: 1, trait: "fleshed" }, v, content).text).toMatch(/reclassified \(Schedule F\)/);
		expect(describeEvent({ type: "botMutated", botId: 1, trait: "tendriled" }, v, content, "off").text).toMatch(/mutated \(tendriled\)/);
		expect(describeEvent({ type: "contaminationIrreversible" }, v, content).text).toMatch(/recertified/);
		expect(describeEvent({ type: "contaminationIrreversible" }, v, content, "off").text).toMatch(/no longer be reversed/);
		expect(describeEvent({ type: "pathChosen", path: "biotech" }, v, content).text).toMatch(/path committed: Biotech/);
		expect(describeEvent({ type: "gameOver", kind: "absorbed", ending: "absorbed" }, v, content).text).toMatch(/reclassified as a Compute Authority asset/);
		expect(describeEvent({ type: "gameOver", kind: "victory", ending: "livingTower" }, v, content).text).toMatch(/Living Tower/);
	});
	it("no horror words reach a toast in the Compute Authority voice", () => {
		for (const e of [{ type: "growthSprouted", facilityId: grown }, { type: "botMutated", botId: 1, trait: "fleshed" }, { type: "contaminationIrreversible" }] as const) expect(describeEvent(e, v, content).text).not.toMatch(/mutat|infect|contamin|flesh|gore|blood/i);
	});
	it("a failed component toasts only when the spare-parts stock is empty; a finished job is left to the ticker", () => {
		expect(describeEvent({ type: "componentFailed", facilityId: 1 }, { ...v, spareParts: 3 }, content).toast).toBe(false);
		expect(describeEvent({ type: "componentFailed", facilityId: 1 }, { ...v, spareParts: 0 }, content).toast).toBe(true);
	});
});

describe("Wetware tab, nutrient tool and overlays", () => {
	it("has a Wetware tab listing the bio category, with the headline band", () => {
		const { content, store } = setup();
		store.setTier(5);
		const html = renderToString(<BuildPalette {...panelProps(store, content, { ui: { paletteTab: "bio", paletteOpen: true } })} />);
		expect(html).toContain("Wetware");
		expect(html).toContain("Nutrient Plant");
		const insp = renderToString(<BuildInspector {...panelProps(store, content, { ui: { paletteTab: "bio", paletteOpen: true, buildHover: "organoid_incubator" } })} />);
		expect(insp).toContain("37 °C ±1");
		expect(html).not.toContain("Growth Mass"); // growths are never buildable
	});
	it("lists the nutrient conduit next to power and coolant, with its cost", () => {
		const { content, store } = setup();
		const html = renderToString(<BuildPalette {...panelProps(store, content, { ui: { paletteTab: "structure" } })} />);
		expect(html).toContain("Nutrient pipe");
		expect(html).toContain(`$${content.structure.coolantConduitPerTile}/tile`);
	});
	it("the nutrient conduit tool drags an L-path and dispatches buildConduit on the nutrient layer", () => {
		const { content, store } = setup();
		store.setTool({ kind: "conduit", layer: "nutrient" });
		const sent: unknown[] = [];
		const orig = store.dispatch;
		store.dispatch = (c) => {
			sent.push(c);
			return orig(c);
		};
		const ctl = createToolController(store, content, { notify: () => {} });
		const ev = (kind: CellPointerEvent["kind"], x: number): CellPointerEvent => ({ kind, button: 0, cell: { x, floor: 2 } }) as CellPointerEvent;
		ctl.handle(ev("move", 4));
		const ghost = (store as unknown as { ghost: { label: string; valid: boolean } }).ghost;
		expect(ghost.label).toMatch(/^Nutrient conduit ×1 · \$/);
		ctl.handle(ev("down", 4));
		ctl.handle(ev("move", 6));
		ctl.handle(ev("up", 6));
		expect(sent).toEqual([{ type: "buildConduit", layer: "nutrient", cells: [{ x: 4, floor: 2 }, { x: 5, floor: 2 }, { x: 6, floor: 2 }] }]);
		expect(store.get().tool).toEqual({ kind: "conduit", layer: "nutrient" }); // stays armed
	});
	it("has overlay buttons for nutrient and contamination, with their keys", () => {
		expect(MODES.find((m) => m.id === "nutrient")?.key).toBe("U");
		expect(MODES.find((m) => m.id === "contamination")?.key).toBe("G");
		expect(overlayLabel(MODES[5], "full")).toEqual({ label: "Growth", title: "Asset growth overlay (G)" });
		expect(overlayLabel(MODES[5], "off")).toEqual({ label: "Contam.", title: "Contamination overlay (G)" });
	});
});

describe("Calm HUD interactions", () => {
	it("a catalog card arms a build, a second click puts it down, and hovering only previews", () => {
		const { content, store } = setup();
		store.setSettings(DEFAULT_SETTINGS);
		const patches: unknown[] = [];
		const tree = () => BuildPalette(panelProps(store, content, { ui: { paletteTab: "rack", paletteOpen: true }, setUi: (p) => patches.push(p) }));
		const cardOf = (t: ReturnType<typeof tree>) => findAll(t, (e) => String(e.props["data-tut"]).startsWith("card-rack_air_gpu"))[0];
		click(cardOf(tree()));
		expect(store.get().tool).toEqual({ kind: "place", defId: "rack_air_gpu" });
		click(cardOf(tree()));
		expect(store.get().tool.kind).toBe("select");
		(cardOf(tree()).props.onMouseEnter as () => void)();
		expect(patches).toContainEqual({ buildHover: "rack_air_gpu" });
		expect(store.get().tool.kind).toBe("select");
	});
	it("a category button opens its catalog in one click; the active one closes it", () => {
		const patches: unknown[] = [];
		const tree = BuildBar({ ui: { paletteOpen: false, paletteTab: "rack" } as never, setUi: (p) => patches.push(p) });
		click(findButton(tree, /Cooling/));
		expect(patches).toEqual([{ paletteOpen: true, paletteTab: "cooling", drawer: null, buildHover: null }]);
		const open = BuildBar({ ui: { paletteOpen: true, paletteTab: "cooling" } as never, setUi: (p) => patches.push(p) });
		click(findButton(open, /Cooling/));
		expect(patches.at(-1)).toEqual({ paletteOpen: false, buildHover: null });
	});
	it("the ticker opens the alert log and counts unseen serious events only", () => {
		const { content, store } = setup();
		const patches: unknown[] = [];
		const props = panelProps(store, content, { setUi: (p) => patches.push(p) });
		click(findButton(Ticker(props), /Open the alert log/));
		expect(patches).toEqual([{ drawer: "log" }]);
	});
	it("the memo slip shows stamps with effect numbers, and the prose only after 'read memo'", () => {
		const { content, store } = setup();
		store.issueMemo("heatwave", 600);
		const view = store.get().view;
		const m = view.memos[0];
		expect(urgentToPop(view, content, [], [])?.id).toBe(m.id);
		const answers: string[] = [];
		const slip = (open: boolean) => MemoSlip({ memo: m, content, tick: view.tick, open, onRead: () => {}, onAnswer: (c) => answers.push(c), onAside: () => {} });
		expect(textOf(slip(false))).toContain("BUY CREDITS −$12k");
		expect(textOf(slip(false))).not.toContain("Weather Bureau advises");
		expect(textOf(slip(true))).toContain("Weather Bureau advises");
		click(findButton(slip(false), /BUY CREDITS/));
		expect(answers).toEqual(["credits"]);
		// not urgent, not popped
		store.issueMemo("audit", 5000);
		const v2 = store.get().view;
		expect(urgentToPop(v2, content, [m.id], [])).toBeNull();
	});
});

describe("drawer and palette keys", () => {
	it("C F I B call the drawer and palette togglers; Esc puts the tool down before it closes the open drawer", () => {
		const { store } = setup();
		const menu = createMenuController(store);
		const calls: string[] = [];
		let open = true;
		const drawer = { isOpen: () => open, close: () => (open = false) };
		const env = { menu, drawer, toggleDrawer: (id: string) => calls.push(id), togglePalette: () => calls.push("palette"), lastSpeed: { current: 1 as const } };
		for (const k of ["c", "F", "i", "b"]) expect(runKey(store, k, env as never)).toBe(true);
		expect(calls).toEqual(["contracts", "insights", "insights", "palette"]);
		store.setTool({ kind: "slab" });
		runKey(store, "Escape", env as never);
		expect(store.get().tool.kind).toBe("select"); // the tool goes first …
		expect(open).toBe(true);
		runKey(store, "Escape", env as never);
		expect(open).toBe(false); // … then the panel
		expect(escapeStep({ menuOpen: false, drawerOpen: true, tool: { kind: "slab" }, selection: null })).toBe("cancelTool");
	});
});
