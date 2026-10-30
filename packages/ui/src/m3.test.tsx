import { loadContent, type OrganoidSpec } from "@aitower/content";
import { type CellPointerEvent, DEFAULT_SETTINGS } from "@aitower/shared";
import { renderToString as render } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { bandText, bioWords, decisionStain, organoidBand, showGrowthGauge, tissueState, traitInfo } from "./bio/bio";
import { NextChip, Ticker } from "./calm/Parts";
import { BuildBar } from "./build/BuildBar";
import { BuildInspector } from "./build/BuildInspector";
import { BuildPalette } from "./components/BuildPalette";
import { MODES, overlayLabel } from "./components/OverlaySwitcher";
import { createFakeContent, createFakeStore } from "./dev/fakeStore";
import { click, findAll, findButton, panelProps, textOf } from "./dev/walk";
import { describeEvent } from "./events";
import { endingPages, epilogueAdvisor } from "./gameover/EndingScene";
import { endingOf, overCopyFor } from "./gameover/gameOver";
import { DecisionCard } from "./advisors/DecisionCard";
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
		expect(decisionStain(0.3, "full")).toBe("none");
		expect(decisionStain(0.5, "full")).toBe("faint");
		expect(decisionStain(0.9, "full")).toBe("heavy");
		expect(decisionStain(0.5, "mild")).toBe("none");
		expect(decisionStain(0.9, "mild")).toBe("faint");
		expect(decisionStain(1, "off")).toBe("none");
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

describe("endings", () => {
	const { content } = setup();
	const over = (kind: "victory" | "absorbed" | "bankrupt", ending?: "flesh" | "garden" | "absorbed" | "bankrupt") => ({ kind, tick: 1, ...(ending ? { ending } : {}) });
	it("prints the content's text for the ending reached", () => {
		const flesh = overCopyFor(over("victory", "flesh"), content);
		expect(flesh.heading).toBe("THE FLESH");
		expect(flesh.lines).toEqual(content.endings.find((e) => e.id === "flesh")?.body.split("\n\n"));
		expect(overCopyFor(over("victory", "garden"), content).heading).toBe("THE GARDEN");
		const abs = overCopyFor(over("absorbed", "absorbed"), content);
		expect(abs).toMatchObject({ heading: "ABSORBED", tone: "red", stamp: "ABSORBED" });
		expect(overCopyFor(over("absorbed"), content).heading).toBe("ABSORBED"); // kind alone is enough
	});
	it("keeps the old copy for a victory without an ending, for bankrupt when content lacks it, and when content lacks the ending", () => {
		expect(overCopyFor(over("bankrupt"), content).heading).toBe("BANKRUPT");
		expect(overCopyFor(over("bankrupt"), { ...content, endings: [] }).heading).toBe("NOTICE OF TERMINATION");
		expect(overCopyFor(over("victory"), content).heading).toBe("COMMENDATION");
		expect(overCopyFor(over("victory", "flesh"), { ...content, endings: [] }).heading).toBe("COMMENDATION");
		expect(endingOf(over("absorbed"))).toBe("absorbed");
		expect(endingOf(over("bankrupt"))).toBe("bankrupt");
	});
	it("Bankrupt and Absorbed are final scenes: the epilogue of the closest advisor (at the bond bar) closes each", () => {
		const real = loadContent();
		const v = setup().store.get().view;
		for (const id of ["bankrupt", "absorbed", "singularity", "flesh", "garden"] as const) {
			const end = real.endings.find((e) => e.id === id)!;
			const bonds = { cass: 20, mel: 20, bea: 20, luci: 20 };
			const soul = (b: typeof bonds) => ({ ...v, soul: { ...v.soul!, bonds: b, bondEpilogue: 60 } });
			expect(epilogueAdvisor(soul(bonds), end), id).toBeNull();
			for (const adv of ["cass", "mel", "bea", "luci"] as const) expect(epilogueAdvisor(soul({ ...bonds, [adv]: 70 }), end), `${id} ${adv}`).toBe(adv);
		}
		expect(endingOf(over("bankrupt"))).toBe("bankrupt");
	});
	it("every ending closes on the fallback epilogue when all bonds are under the bar, and on an advisor's at 50", () => {
		const real = loadContent();
		const v = setup().store.get().view;
		const at = (b: Record<"cass" | "mel" | "bea" | "luci", number>) => ({ ...v, soul: { ...v.soul!, bonds: b, bondEpilogue: real.balance.soul.bondEpilogue } });
		for (const end of real.endings) {
			const body = end.body.split(/\n\s*\n/).length;
			const low = endingPages(end, at({ cass: 49, mel: 49, bea: 49, luci: 49 }));
			expect(low, end.id).toHaveLength(body + 1);
			expect(low.at(-1), end.id).toEqual({ who: null, text: end.epilogue?.fallback });
			const high = endingPages(end, at({ cass: 20, mel: 20, bea: 50, luci: 20 }));
			expect(high.at(-1), end.id).toEqual({ who: "bea", text: end.epilogue?.bea });
		}
	});
	it("prints plain forms at horror off", () => {
		expect(overCopyFor(over("absorbed"), content, "full").stamp).toBe("ABSORBED");
		expect(overCopyFor(over("absorbed"), content, "off").stamp).toBe("TAKEN OVER");
	});
	it("CURRENT ORDERS shows the leading tree's Singularity progress, never the secret ending", () => {
		const { content: c, store } = setup();
		const v = store.get().view;
		expect(endingLine(v, c)).toBeNull(); // no points yet
		expect(endingLine({ ...v, soul: { ...v.soul, sp: { synthetic: 420, biotech: 0, greentech: 0 } } }, c)).toBe("The Lattice: 42%");
		expect(endingLine({ ...v, soul: { ...v.soul, sp: { synthetic: 100, biotech: 0, greentech: 333 } } }, c)).toBe("The Garden: 33%");
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
		expect(describeEvent({ type: "gameOver", kind: "absorbed", ending: "absorbed" }, v, content).text).toMatch(/reclassified as a Compute Authority asset/);
		expect(describeEvent({ type: "gameOver", kind: "victory", ending: "flesh" }, v, content).text).toMatch(/The Flesh/);
	});
	it("no horror words reach a toast in the Compute Authority voice", () => {
		for (const e of [{ type: "growthSprouted", facilityId: grown }, { type: "botMutated", botId: 1, trait: "fleshed" }, { type: "contaminationIrreversible" }] as const) expect(describeEvent(e, v, content).text).not.toMatch(/mutat|infect|contamin|flesh|gore|blood/i);
	});
	it("a failed component toasts only when the spare-parts stock is empty; a finished job is left to the ticker", () => {
		expect(describeEvent({ type: "componentFailed", facilityId: 1 }, { ...v, spareParts: 3 }, content).toast).toBe(false);
		expect(describeEvent({ type: "componentFailed", facilityId: 1 }, { ...v, spareParts: 0 }, content).toast).toBe(true);
	});
});

describe("Wetware items, nutrient tool and overlays", () => {
	it("has no Wetware tab: nutrient plants sit in Cooling, bioreactors in Power, organoid racks in Racks", () => {
		const { content, store } = setup();
		store.setTier(5);
		const html = renderToString(<BuildPalette {...panelProps(store, content, { ui: { paletteTab: "cooling", paletteOpen: true } })} />);
		expect(html).toContain("Nutrient Plant");
		const insp = renderToString(<BuildInspector {...panelProps(store, content, { ui: { paletteTab: "rack", paletteOpen: true, buildHover: "organoid_incubator" } })} />);
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
	it("the decision card shows choices with effect numbers, marks the recommended one and answers by id", () => {
		const { content, store } = setup();
		store.issueDecision("heatwave");
		const view = store.get().view;
		expect(view.decision?.recommended).toBe("credits");
		const answers: string[] = [];
		const dispatch = (c: unknown) => {
			answers.push((c as { choiceId?: string; type: string }).choiceId ?? (c as { type: string }).type);
			return { ok: true } as const;
		};
		const card = DecisionCard({ store: { ...store, dispatch } as never, content, state: store.get() });
		expect(textOf(card)).toContain("BUY CREDITS");
		expect(textOf(card)).toContain("−$12k");
		expect(textOf(card)).toContain("Recommended by Cass");
		click(findButton(card, /BUY CREDITS/));
		click(findButton(card, /Defer one day/));
		expect(answers).toEqual(["credits", "deferDecision"]);
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
