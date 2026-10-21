import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createFakeContent, createFakeStore } from "./dev/fakeStore";
import { describeEvent } from "./events";
import { Drawer } from "./calm/Parts";
import { BuildPalette } from "./components/BuildPalette";
import { panelProps } from "./dev/walk";
import { easiestOffer } from "./calm/Panels";
import { createMenuController } from "./menu/menuController";
import { SystemMenu } from "./menu/SystemMenu";
import { Hud } from "./Hud";

describe("Hud (server render smoke test)", () => {
	it("renders top bar, palette, inspector and contracts from a fake store", () => {
		const content = createFakeContent();
		const store = createFakeStore(content);
		const html = renderToString(<Hud store={store} content={content} />);
		expect(html).toContain("ui-strip");
		expect(html).toContain("$1.28M");
		expect(html).toContain("PER HOUR");
		expect(html).toContain("bld-bar");
		expect(html).toContain("ui-ticker");
		expect(html).not.toContain("ui-bottom"); // no bottom panel, no open drawer, no palette
		expect(html).not.toContain("ui-edge");
		const drawer = renderToString(<Drawer {...panelProps(store, content, { ui: { drawer: "contracts" } })} />);
		expect(drawer).toContain("Helix Labs");
		expect(renderToString(<BuildPalette {...panelProps(store, content, { ui: { paletteTab: "rack", paletteOpen: true } })} />)).toContain("GPU Rack (air)");
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
		expect(html).toContain("ui-savelamp");
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
		const gauges = (st: typeof std) => renderToString(<Drawer {...panelProps(st, content, { ui: { drawer: "insights" } })} />);
		expect(gauges(std)).toContain("var(--heat-18)");
		const cb = createFakeStore(content);
		cb.setOverlay("heat");
		cb.setSettings({ colorBlind: true });
		const html = gauges(cb);
		expect(html).toContain("#0d0887");
		expect(html).toContain("#f0f921");
		expect(html).not.toContain("var(--heat-18)");
	});
});

describe("SystemMenu (server render)", () => {
	it("renders the cabinet: resume, every drawer (Lessons included), and a dialog role", () => {
		const content = createFakeContent();
		const store = createFakeStore(content);
		const menu = createMenuController(store);
		const html = renderToString(<SystemMenu store={store} state={store.get()} menu={menu} />);
		expect(html).toContain('role="dialog"');
		expect(html).toContain('aria-modal="true"');
		for (const t of ["Resume", "Save game", "Load game", "Settings", "Controls", "New game", "Lessons", "GAME PAUSED"]) expect(html).toContain(t);
	});
	it("shows the settings drawer with every Settings field", () => {
		const content = createFakeContent();
		const store = createFakeStore(content);
		const menu = createMenuController(store);
		const html = renderToString(<SystemMenu store={store} state={store.get()} menu={menu} initial="settings" />);
		for (const t of ["Master volume", "Music volume", "Mute", "Text size", "CRT effects", "Reduced motion", "Colour-blind mode", "Horror intensity", "Autosave", "Desktop notice"]) expect(html).toContain(t);
	});
	it("lists every key and mouse action in the controls drawer", () => {
		const content = createFakeContent();
		const store = createFakeStore(content);
		const html = renderToString(<SystemMenu store={store} state={store.get()} menu={createMenuController(store)} initial="controls" />);
		for (const t of ["Space", "Right-drag", "Middle-drag", "Wheel", "Esc", "Left-drag", "Right-click"]) expect(html).toContain(t);
		expect(html).toContain(">W<");
		expect(html).toContain(">D<");
	});

	it("shows the title screen over the game when asked (and not by default in tests); the menu is not open", () => {
		const content = createFakeContent();
		const store = createFakeStore(content);
		const plain = renderToString(<Hud store={store} content={content} />);
		expect(plain).not.toContain("ui-title-cabinet");
		const html = renderToString(<Hud store={store} content={content} title />);
		expect(html).toContain("ui-title-cabinet");
		expect(html).toContain("AI<b>TOWER</b>");
		expect(html).not.toContain("ui-induction");
		// no lesson UI runs behind the title screen
		expect(html).not.toContain("les-goal");
	});

	it("opens an advisor decision card with the recommended choice, effect chips and a defer button; the top bar shows standing", () => {
		const content = createFakeContent();
		const store = createFakeStore(content);
		store.issueDecision("heatwave");
		store.setStanding(18);
		store.addModifier({ label: "Heatwave", kind: "ambient", value: 8, endsAt: store.get().view.tick + 840 });
		const html = renderToString(<Hud store={store} content={content} />);
		expect(html).toContain("adv-card");
		expect(html).toContain("Notice of Unseasonable Warmth");
		expect(html).toContain("Cass Parr");
		expect(html).toContain("Recommended by Cass");
		expect(html).toContain("BUY CREDITS");
		expect(html).toContain("−$12k"); // the choice shows its effect as a number
		expect(html).toContain("no effect");
		expect(html).toContain("Defer one day");
		expect(html).toContain("game paused");
		expect(html).not.toContain("AUTO-RESOLVES"); // decisions never expire
		expect(html).toContain("tone-red"); // standing 18 is below 25
		expect(renderToString(<Drawer {...panelProps(store, content, { ui: { drawer: "insights" } })} />)).toContain("HEATWAVE +8 °C · 14h");
	});
	it("shows the advisor strip with four portraits and no decision card when nothing is pending", () => {
		const content = createFakeContent();
		const store = createFakeStore(content);
		const html = renderToString(<Hud store={store} content={content} />);
		expect(html).not.toContain("adv-card");
		for (const n of ["Cass Parr", "Bea Altasar", "Dr. Mel Kiorre", "Lucien Ferro"]) expect(html).toContain(`Ask ${n}`);
		expect(html).not.toContain("UNIT-7");
		expect(html).not.toContain("ui-inbox");
	});

	it("renders each game-over notice once the sim reports it", () => {
		const content = createFakeContent();
		for (const [kind, heading, buttons] of [
			["bankrupt", "NOTICE OF TERMINATION", ["Load game", "New game"]],
			["shutdown", "NOTICE OF TERMINATION", ["Load game", "New game"]],
			["victory", "COMMENDATION", ["Continue in sandbox", "New game"]],
		] as const) {
			const store = createFakeStore(content);
			store.triggerGameOver(kind);
			const html = renderToString(<Hud store={store} content={content} />);
			expect(html, kind).toContain(heading);
			expect(html, kind).toContain("SERVICE RECORD");
			for (const b of buttons) expect(html, `${kind} ${b}`).toContain(`>${b}<`);
			if (kind !== "victory") expect(html).not.toContain("Continue in sandbox");
		}
		const clean = renderToString(<Hud store={createFakeStore(content)} content={content} />);
		expect(clean).not.toContain("ui-over-memo");
	});

	it("uses Compute Authority wording for decision, standing and game-over events", () => {
		const content = createFakeContent();
		const store = createFakeStore(content);
		const id = store.issueDecision("audit");
		store.dispatch({ type: "resolveDecision", decisionId: id, choiceId: "comply" });
		store.advance(1);
		const v = store.get().view;
		const resolved = describeEvent({ type: "decisionResolved", decisionId: id, eventId: "audit", choiceId: "comply" }, v, content);
		expect(resolved).toMatchObject({ toast: true });
		expect(resolved.text).toBe("Decided: COMPLY. The Inspector counted 4,112 cables and left.");
		expect(describeEvent({ type: "standingChanged", standing: 42, delta: -8 }, v, content)).toMatchObject({ text: "Reputation falls by 8 to 42", severity: "warn", toast: true });
		expect(describeEvent({ type: "standingChanged", standing: 51, delta: 1 }, v, content)).toMatchObject({ severity: "good", toast: false });
		expect(describeEvent({ type: "gameOver", kind: "shutdown" }, v, content).text).toContain("NOTICE OF TERMINATION");
		expect(describeEvent({ type: "gameOver", kind: "victory" }, v, content).text).toContain("COMMENDATION");
	});

	it("the Goals card points at an offer the starter site can serve (no liquid cooling, no stored data first)", () => {
		const offers = [
			{ id: 1, needsLiquid: true, storageTB: 0 },
			{ id: 2, needsLiquid: false, storageTB: 120 },
			{ id: 3, needsLiquid: false, storageTB: 0 },
		];
		expect(easiestOffer(offers)?.id).toBe(3);
		expect(easiestOffer(offers.slice(0, 2))?.id).toBe(2);
		expect(easiestOffer(offers.slice(0, 1))?.id).toBe(1);
		expect(easiestOffer([])).toBeUndefined();
	});
});
