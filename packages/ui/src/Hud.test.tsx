import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createFakeContent, createFakeStore } from "./dev/fakeStore";
import { describeEvent } from "./events";
import { createMenuController } from "./menu/menuController";
import { SystemMenu } from "./menu/SystemMenu";
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
	it("has a MENU button and a save lamp in the top bar, and no menu until opened", () => {
		const content = createFakeContent();
		const store = createFakeStore(content);
		const html = renderToString(<Hud store={store} content={content} />);
		expect(html).toContain("ui-menu-btn");
		expect(html).toContain("NOT SAVED");
		expect(html).not.toContain("ui-menu-backdrop");
		expect(html).not.toContain("ui-induction");
	});
	it("applies settings to the HUD root: text scale variable and presentation classes", () => {
		const content = createFakeContent();
		const store = createFakeStore(content);
		store.setSettings({ textScale: 1.5, colorBlind: true, reducedMotion: true, crtEffects: false });
		const html = renderToString(<Hud store={store} content={content} />);
		expect(html).toMatch(/class="aitower-hud [^"]*is-colorblind/);
		expect(html).toContain("is-reduced-motion");
		expect(html).toContain("no-crt");
		expect(html).toContain("--hud-scale:1.5");
		const plain = renderToString(<Hud store={createFakeStore(content)} content={content} />);
		expect(plain).not.toContain("is-colorblind");
		expect(plain).not.toContain("no-crt");
		expect(plain).toContain("--hud-scale:1");
	});
	it("marks status pills so colour-blind mode can add glyphs", () => {
		const content = createFakeContent();
		const html = renderToString(<Hud store={createFakeStore(content)} content={content} />);
		expect(html).toMatch(/ui-pill tone-warn is-status/); // selected rack is throttled
	});
	it("uses the colour-blind heat ramp in the legend when the setting is on", () => {
		const content = createFakeContent();
		const std = createFakeStore(content);
		std.setOverlay("heat");
		expect(renderToString(<Hud store={std} content={content} />)).toContain("var(--heat-18)");
		const cb = createFakeStore(content);
		cb.setOverlay("heat");
		cb.setSettings({ colorBlind: true });
		const html = renderToString(<Hud store={cb} content={content} />);
		expect(html).toContain("#0d0887");
		expect(html).toContain("#f0f921");
		expect(html).not.toContain("var(--heat-18)");
	});
});

describe("SystemMenu (server render)", () => {
	it("renders the cabinet: resume, every drawer, restart induction, and a dialog role", () => {
		const content = createFakeContent();
		const store = createFakeStore(content);
		const menu = createMenuController(store);
		const html = renderToString(<SystemMenu store={store} state={store.get()} menu={menu} />);
		expect(html).toContain('role="dialog"');
		expect(html).toContain('aria-modal="true"');
		for (const t of ["Resume", "Save game", "Load game", "Settings", "Controls", "New game", "Restart induction", "GAME PAUSED"]) expect(html).toContain(t);
	});
	it("shows the settings drawer with every Settings field", () => {
		const content = createFakeContent();
		const store = createFakeStore(content);
		const menu = createMenuController(store);
		const html = renderToString(<SystemMenu store={store} state={store.get()} menu={menu} initial="settings" />);
		for (const t of ["Master volume", "Mute", "Text size", "CRT effects", "Reduced motion", "Colour-blind mode", "Horror intensity", "Autosave", "Desktop notice"]) expect(html).toContain(t);
	});
	it("lists every key and mouse action in the controls drawer", () => {
		const content = createFakeContent();
		const store = createFakeStore(content);
		const html = renderToString(<SystemMenu store={store} state={store.get()} menu={createMenuController(store)} initial="controls" />);
		for (const t of ["Space", "Right-drag", "Middle-drag", "Wheel", "Esc", "Left-drag", "Right-click"]) expect(html).toContain(t);
		expect(html).toContain(">W<");
		expect(html).toContain(">D<");
	});
});
