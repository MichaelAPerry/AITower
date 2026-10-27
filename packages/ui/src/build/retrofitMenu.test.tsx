/** The reframe in the UI (docs/REFRAME.md): tree racks are not in the build menu, and a rack's inspector offers the three Retrofit branches. */
import { isRetrofitOnly, loadContent } from "@aitower/content";
import type { GameStore } from "@aitower/shared";
import type { CommandResult, FacilityView, SimCommand } from "@aitower/sim";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BuildPalette, paletteDefs } from "../components/BuildPalette";
import { RetrofitSection } from "../components/Inspector";
import { createFakeContent, createFakeStore } from "../dev/fakeStore";
import { findItem } from "./catalog";
import { panelProps } from "../dev/walk";
import type { SimView } from "@aitower/sim";

const content = loadContent();
const bareView = (tier = 5): SimView => ({ path: null, tier, techResearched: [], facilities: [], soul: undefined }) as unknown as SimView;

/** A store that answers canBuild from a table and records what is dispatched. */
const store = (reasons: Partial<Record<"synthetic" | "biotech" | "greentech", string | null>>): { s: GameStore; sent: SimCommand[] } => {
	const sent: SimCommand[] = [];
	const answer = (cmd: SimCommand): CommandResult => {
		const why = cmd.type === "retrofit" ? reasons[cmd.tree] : null;
		return why ? { ok: false, reason: why } : { ok: true };
	};
	const s = { canBuild: answer, dispatch: (cmd: SimCommand) => {
			sent.push(cmd);
			return answer(cmd);
		} } as unknown as GameStore;
	return { s, sent };
};
const fv = (defId: string): FacilityView => ({ id: 7, defId, floor: 1, x: 6, width: 2, status: "ok", enabled: true }) as unknown as FacilityView;
const walk = (el: unknown, out: { type: unknown; props: Record<string, unknown> }[] = []): { type: unknown; props: Record<string, unknown> }[] => {
	if (el === null || typeof el !== "object") return out;
	if (Array.isArray(el)) {
		for (const c of el) walk(c, out);
		return out;
	}
	const e = el as { type?: unknown; props?: Record<string, unknown> };
	if (e.props) {
		out.push({ type: e.type, props: e.props });
		walk(e.props.children, out);
	}
	return out;
};
const text = (el: unknown): string =>
	walk(el)
		.map((n) => (typeof n.props.children === "string" ? n.props.children : ""))
		.join(" ");

describe("tree racks are not in the build menu", () => {
	it("no rung rack, and none of the cut items, is on any palette shelf", () => {
		const shelves = (["rack", "bio", "power", "cooling", "logistics"] as const).flatMap((tab) => paletteDefs(content, bareView(), tab));
		expect(shelves.length).toBeGreaterThan(10);
		for (const d of shelves) expect(isRetrofitOnly(d), d.id).toBe(false);
		const ids = shelves.map((d) => d.id);
		for (const cut of ["rack_culture_s", "nutrient_tank_s", "rack_imm_gpu2", "rack_imm_gpu3", "rack_organoid_3m"]) expect(ids).not.toContain(cut);
		for (const base of ["rack_air_gpu", "rack_air_gpu2", "rack_infer"]) expect(ids).toContain(base);
	});

	it("the rack catalog renders the base racks and not the Lattice, Flesh or Garden racks", () => {
		const fc = createFakeContent();
		const html = renderToString(<BuildPalette {...panelProps(createFakeStore(fc), content, { ui: { paletteTab: "rack", paletteOpen: true } })} />);
		expect(html).toContain(content.facilities.rack_air_gpu.name);
		for (const id of ["rack_dlc_gpu", "organoid_incubator", "rack_neuromorphic", "rack_mind_lattice"]) expect(html).not.toContain(content.facilities[id].name);
		// The wetware tab has no specialist cards and no commit row any more.
		const wet = renderToString(<BuildPalette {...panelProps(createFakeStore(fc), content, { ui: { paletteTab: "bio", paletteOpen: true } })} />);
		expect(wet).not.toContain("Commit to");
	});

	it("a tree rack can still be looked up by id (suggestions and the inspector use it), but is not buildable", () => {
		expect(findItem("rack_dlc_gpu", content)?.def?.rung).toBe(1);
	});
});

describe("the rack inspector's Retrofit section", () => {
	it("is shown for racks and nothing else, with three branch buttons", () => {
		const { s } = store({});
		const base = RetrofitSection({ store: s, content, f: fv("rack_air_gpu") });
		const t = text(base);
		for (const branch of ["Synthetic", "Bio", "Green"]) expect(t).toContain(branch);
		expect(walk(base).filter((n) => n.type === "button" && String(n.props.className).includes("ui-retrofit-btn"))).toHaveLength(3);
		expect(RetrofitSection({ store: s, content, f: fv("chiller") })).toBeNull();
		expect(RetrofitSection({ store: s, content, f: fv("rack_storage") })).toBeNull();
		expect(RetrofitSection({ store: s, content, f: { ...fv("rack_air_gpu"), grown: true } })).toBeNull();
	});

	it("each button says what the rack becomes and the price; a locked one says why and is disabled", () => {
		const { s } = store({ biotech: "requires research: Wetware Annex Programme", greentech: "requires tier 3" });
		const html = renderToString(<RetrofitSection store={s} content={content} f={fv("rack_air_gpu")} />).replace(/<!-- -->/g, "");
		expect(html).toContain("LC-2 Liquid-Cooled Rack");
		expect(html).toMatch(/\$1\.2\d?M/); // 1.4M less half of the 0.4M AC-1
		expect(html).toContain("OC-1 Organoid Cabinet");
		expect(html).toContain("NM-1 Neuromorphic Rack");
		expect(html).toContain("requires research: Wetware Annex Programme");
		expect(html).toContain("requires tier 3");
		const buttons = html.match(/<button[^>]*ui-retrofit-btn[^>]*>/g) ?? [];
		expect(buttons).toHaveLength(3);
		expect(buttons[0]).not.toContain("disabled");
		expect(buttons[1]).toContain("disabled");
		expect(buttons[2]).toContain("disabled");
	});

	it("clicking an open branch dispatches the retrofit for that rack and tree", () => {
		const { s, sent } = store({});
		const el = RetrofitSection({ store: s, content, f: fv("rack_air_gpu2") });
		const bio = walk(el).find((n) => n.type === "button" && String(n.props.className).includes("ui-retrofit-btn") && String(n.props.title).includes("OC-1"));
		(bio?.props.onClick as (() => void) | undefined)?.();
		expect(sent).toEqual([{ type: "retrofit", facilityId: 7, tree: "biotech" }]);
	});

	it("a tree rack advances down its own tree; the other branches start again at rung 1", () => {
		const { s } = store({});
		const html = renderToString(<RetrofitSection store={s} content={content} f={fv("rack_dlc_gpu2")} />).replace(/<!-- -->/g, "");
		expect(html).toContain("LC-4 Blade Rack"); // Synthetic: the next rung
		expect(html).toContain("OC-1 Organoid Cabinet"); // Bio: rung 1 again
		expect(html).toContain("starts again at rung 1");
		const top = renderToString(<RetrofitSection store={s} content={content} f={fv("rack_mind_lattice")} />).replace(/<!-- -->/g, "");
		expect(top).toContain("Already the last rung of The Lattice");
	});
});
