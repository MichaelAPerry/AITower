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
import { GameOverScreen } from "./gameover/GameOverScreen";
import { gameOverToShow, keepDismissed, overKey } from "./gameover/gameOver";
import { MemoDrawer, MemoPop, ModifierChips } from "./memo/MemoDesk";
import { TitleScreen } from "./title/TitleScreen";
import { showTitleAtBoot } from "./title/titleState";
import { Objective } from "./objective/Objective";
import { Tutorial } from "./tutorial/Tutorial";
import { useGameState, useViewport } from "./hooks";
import { useHudKeyboard } from "./keyboard";
import { createMenuController } from "./menu/menuController";
import { newSaveError } from "./menu/slots";
import { type MenuSection, SystemMenu } from "./menu/SystemMenu";
import { pushNotice } from "./notices";
import { densityFor, hudScale, isSmallScreen, settingsToClasses, settingsToCssVars } from "./settings";
import "./ui.css";

export interface HudProps {
	store: GameStore;
	content: ContentDB;
	/** Show the title screen over a paused game. Default: yes, unless the URL has ?new (the e2e smoke test relies on that). */
	title?: boolean;
}

/** The whole HUD, absolutely positioned over the world canvas; empty areas let pointer events through. */
export function Hud({ store, content, title }: HudProps) {
	const state = useGameState(store);
	const [ui, setUiState] = useState<UiState>({ bottomTab: "contracts", bottomOpen: true, focusJobId: null, alertsSeenTick: -1, paletteTab: "structure", inboxOpen: false, stamped: [], aside: [] });
	const setUi = useCallback((patch: Partial<UiState>) => setUiState((u) => ({ ...u, ...patch })), []);
	const [menuOpen, setMenuOpen] = useState(false);
	const menu = useMemo(() => createMenuController(store, setMenuOpen), [store]);
	const [menuSection, setMenuSection] = useState<MenuSection>("save");
	const [titleOpen, setTitleOpen] = useState(() => title ?? (typeof location !== "undefined" && showTitleAtBoot(location.search)));
	const [dismissedOver, setDismissedOver] = useState<string | null>(null);
	const titleOpenRef = useRef(titleOpen);
	titleOpenRef.current = titleOpen;
	const overRef = useRef(false);
	const openMenuAt = useCallback(
		(section: MenuSection) => {
			setMenuSection(section);
			menu.open();
		},
		[menu],
	);
	useEffect(() => {
		if (!menuOpen) setMenuSection("save");
	}, [menuOpen]);
	// Unmounting (or swapping the store) with the menu open must not leave the game paused.
	useEffect(() => () => menu.close(), [menu]);
	useHudKeyboard(
		store,
		useCallback(() => setUiState((u) => ({ ...u, bottomOpen: !u.bottomOpen })), []),
		menu,
		useCallback(() => titleOpenRef.current || overRef.current, []),
	);

	// Game over: shown once per game. Bankrupt and shutdown are final; victory can be dismissed (sandbox).
	const gameOver = state.view.gameOver;
	const over = titleOpen ? null : gameOverToShow(gameOver, dismissedOver);
	overRef.current = !!over;
	useEffect(() => {
		setDismissedOver((k) => keepDismissed(gameOver, k));
	}, [gameOver]);
	const overId = over ? overKey(over) : null;
	// biome-ignore lint/correctness/useExhaustiveDependencies: pause once when a game-over appears
	useEffect(() => {
		if (overId) store.setSpeed(0);
	}, [overId]);
	// A load or import replaced the game: leave the title or the game-over notice and run at 1×.
	const onReplaced = (): void => {
		if (titleOpen || over) store.setSpeed(1);
		setTitleOpen(false);
	};

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

	const props: PanelProps = { store, content, state, ui, setUi, openMenu: () => openMenuAt("save") };
	return (
		<div
			className={["aitower-hud", state.view.bankrupt ? "is-bankrupt" : "", `is-density-${density}`, ...settingsToClasses(settings)].filter(Boolean).join(" ")}
			style={settingsToCssVars(settings)}
		>
			<TopBar {...props} />
			<BuildPalette {...props} />
			<div className="ui-center">
				<OverlaySwitcher {...props} />
				<ModifierChips modifiers={state.view.modifiers} tick={state.view.tick} />
				<Toasts content={content} state={state} />
				<MemoPop store={store} state={state} ui={ui} setUi={setUi} />
				{ui.inboxOpen && <MemoDrawer store={store} content={content} state={state} ui={ui} setUi={setUi} />}
				{state.tool.kind !== "select" && <ToolHint {...props} />}
				{!titleOpen && !over && <Objective {...props} />}
				{!titleOpen && !over && <Tutorial store={store} content={content} state={state} ui={ui} />}
			</div>
			<div className="ui-right">
				<Inspector {...props} />
			</div>
			<BottomPanel {...props} />
			{showNotice && <DesktopNotice store={store} onDismiss={() => setNoticeDismissed(true)} />}
			{titleOpen && <TitleScreen store={store} state={state} menuOpen={menuOpen} openMenu={openMenuAt} onStart={() => setTitleOpen(false)} />}
			{over && (
				<GameOverScreen
					over={over}
					view={state.view}
					menuOpen={menuOpen}
					onLoad={() => openMenuAt("load")}
					onNewGame={() => {
						store.newGame();
						store.setSpeed(1);
					}}
					onContinue={() => {
						setDismissedOver(overKey(over));
						store.setSpeed(1);
					}}
				/>
			)}
			{menuOpen && <SystemMenu key={menuSection} store={store} state={state} menu={menu} initial={menuSection} fromTitle={titleOpen} onReplaced={onReplaced} />}
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
