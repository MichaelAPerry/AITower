import type { ContentDB } from "@aitower/content";
import type { GameStore } from "@aitower/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BottomPanel } from "./components/BottomPanel";
import { BuildPalette } from "./components/BuildPalette";
import type { PanelProps, UiState } from "./components/context";
import { DesktopNotice } from "./components/DesktopNotice";
import { Inspector } from "./components/Inspector";
import { OverlaySwitcher } from "./components/OverlaySwitcher";
import { Toasts } from "./components/Toasts";
import { TopBar } from "./components/TopBar";
import { Tutorial } from "./tutorial/Tutorial";
import { useGameState, useViewport } from "./hooks";
import { useHudKeyboard } from "./keyboard";
import { createMenuController } from "./menu/menuController";
import { newSaveError } from "./menu/slots";
import { SystemMenu } from "./menu/SystemMenu";
import { pushNotice } from "./notices";
import { densityFor, hudScale, isSmallScreen, settingsToClasses, settingsToCssVars } from "./settings";
import "./ui.css";

export interface HudProps {
	store: GameStore;
	content: ContentDB;
}

/** The whole HUD, absolutely positioned over the world canvas; empty areas let pointer events through. */
export function Hud({ store, content }: HudProps) {
	const state = useGameState(store);
	const [ui, setUiState] = useState<UiState>({ bottomTab: "contracts", bottomOpen: true, focusJobId: null, alertsSeenTick: -1 });
	const setUi = useCallback((patch: Partial<UiState>) => setUiState((u) => ({ ...u, ...patch })), []);
	const [menuOpen, setMenuOpen] = useState(false);
	const menu = useMemo(() => createMenuController(store, setMenuOpen), [store]);
	// Unmounting (or swapping the store) with the menu open must not leave the game paused.
	useEffect(() => () => menu.close(), [menu]);
	useHudKeyboard(
		store,
		useCallback(() => setUiState((u) => ({ ...u, bottomOpen: !u.bottomOpen })), []),
		menu,
	);

	// An error toast whenever saveStatus.error changes to a new message.
	const saveError = state.saveStatus.error;
	const lastError = useRef(saveError);
	useEffect(() => {
		const msg = newSaveError(lastError.current, saveError);
		lastError.current = saveError;
		if (msg) pushNotice({ text: msg, severity: "error", key: "save-error" });
	}, [saveError]);

	const { settings } = state;
	const scale = hudScale(settings);
	const viewport = useViewport();
	const density = densityFor(viewport.width, viewport.height, scale);
	const [noticeDismissed, setNoticeDismissed] = useState(false);
	const showNotice = settings.showDesktopNotice && !noticeDismissed && isSmallScreen(viewport.width, viewport.height);

	const alertsOpen = ui.bottomOpen && ui.bottomTab === "alerts";
	const tick = state.view.tick;
	useEffect(() => {
		if (alertsOpen) setUi({ alertsSeenTick: tick });
	}, [alertsOpen, tick, setUi]);

	const props: PanelProps = { store, content, state, ui, setUi, openMenu: menu.open };
	return (
		<div
			className={["aitower-hud", state.view.bankrupt ? "is-bankrupt" : "", `is-density-${density}`, ...settingsToClasses(settings)].filter(Boolean).join(" ")}
			style={settingsToCssVars(settings)}
		>
			<TopBar {...props} />
			<BuildPalette {...props} />
			<div className="ui-center">
				<OverlaySwitcher {...props} />
				<Toasts content={content} state={state} />
				{state.tool.kind !== "select" && <ToolHint {...props} />}
				<Tutorial store={store} content={content} state={state} />
			</div>
			<div className="ui-right">
				<Inspector {...props} />
			</div>
			<BottomPanel {...props} />
			{showNotice && <DesktopNotice store={store} onDismiss={() => setNoticeDismissed(true)} />}
			{menuOpen && <SystemMenu store={store} state={state} menu={menu} />}
		</div>
	);
}

function ToolHint({ content, state }: PanelProps) {
	const t = state.tool;
	const what =
		t.kind === "place"
			? `Placing ${content.facilities[t.defId]?.name ?? t.defId} — click to build`
			: t.kind === "slab"
				? "Slab — drag along a floor"
				: t.kind === "conduit"
					? `${t.layer === "power" ? "Power" : "Coolant"} conduit — drag across, then up/down`
					: t.kind === "lift"
						? "Lift — drag vertically on a column"
						: t.kind === "demolish"
							? "Demolish — click or drag over cells"
							: "";
	return (
		<div className="ui-toolhint ui-panel">
			<span className="ui-lamp lamp-red is-lit is-blink" />
			<span className="ui-dymo">TOOL ARMED</span>
			{what}
			<span className="ui-dim"> · Esc / right-click to exit</span>
		</div>
	);
}
