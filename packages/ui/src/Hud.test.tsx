import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createFakeContent, createFakeStore } from "./dev/fakeStore";
import { describeEvent } from "./events";
import { Hud } from "./Hud";

describe("Hud (server render smoke test)", () => {
	it("renders top bar, palette, inspector and contracts from a fake store", () => {
		const content = createFakeContent();
		const store = createFakeStore(content);
		const html = renderToString(<Hud store={store} content={content} />);
		expect(html).toContain("ui-topbar");
		expect(html).toContain("$1.28M");
		expect(html).toContain("Helix Labs");
		expect(html).toContain("GPU Rack (air)");
	});
	it("describes facility events with names and a focus cell", () => {
		const content = createFakeContent();
		const v = createFakeStore(content).get().view;
		const d = describeEvent({ type: "rackTripped", facilityId: 9 }, v, content);
		expect(d).toMatchObject({ severity: "error", toast: true, cell: { x: 13, floor: 2 } });
		expect(d.text).toContain("GPU Rack (air) #9");
	});
});
