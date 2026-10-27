import { loadContent } from "@aitower/content";
import type { SimView } from "@aitower/sim";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BuildPalette, treeHidden } from "../components/BuildPalette";
import { createFakeContent, createFakeStore } from "../dev/fakeStore";
import { panelProps } from "../dev/walk";

const content = loadContent();
const view = (soul: Record<string, unknown> = {}, path: string | null = null): SimView =>
	({ path, tier: 5, facilities: [], soul: { bonds: { cass: 0, bea: 0, mel: 0, luci: 0 }, sealedOut: [], ...soul } }) as unknown as SimView;

describe("uncommitted trees hide their specialist items", () => {
	it("hides Bio and Green specialists until the commit; starter items stay", () => {
		const organoid = content.facilities.rack_organoid_2;
		const photonic = content.facilities.rack_photonic;
		const culture = content.facilities.rack_culture_s;
		expect(organoid.tier).toBe("specialist");
		expect(treeHidden(organoid, view())).toBe(true);
		expect(treeHidden(photonic, view())).toBe(true);
		expect(treeHidden(culture, view())).toBe(false);
		expect(treeHidden(organoid, view({}, "biotech"))).toBe(false);
		expect(treeHidden(photonic, view({}, "biotech"))).toBe(true);
	});
	it("a preview unit stays visible when its bond allows it", () => {
		const incubator = content.facilities.organoid_incubator;
		expect(treeHidden(incubator, view({ bonds: { cass: 0, bea: 0, mel: 40, luci: 0 } }))).toBe(false);
		expect(treeHidden(incubator, view())).toBe(true);
	});
	it("the wetware tab shows the commit row and no specialist cards before the commit", () => {
		const store = createFakeStore(createFakeContent());
		const html = renderToString(<BuildPalette {...panelProps(store, content, { ui: { paletteTab: "bio", paletteOpen: true } })} />);
		expect(html).toContain("Commit to The Flesh to unlock");
		expect(html).not.toContain(content.facilities.rack_organoid_3.name);
	});
});
