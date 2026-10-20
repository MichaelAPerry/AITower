import type { ContentDB } from "@aitower/content";
import type { GameStore } from "@aitower/shared";
import type { QuarterReport } from "@aitower/sim";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PanelProps, UiState } from "./components/context";
import { DesktopNotice } from "./components/DesktopNotice";
import { Inspector } from "./components/Inspector";
import { Toasts } from "./components/Toasts";
import { BuildBar } from "./build/BuildBar";
import { BuildInspector } from "./build/BuildInspector";
import { Drawer, DrawerTabs, NextChip, PalettePopover, Ticker, WIDE } from "./calm/Parts";
import { TopStrip } from "./calm/TopStrip";
import { nextDrawer } from "./calm/calm";
import { AscensionSheet } from "./ascension/AscensionSheet";
import { ascensionDue } from "./ascension/ascension";
import { AuditSheet } from "./finance/AuditSheet";
import { auditToShow, createLogCursor } from "./finance/auditTrigger";
import { GameOverScreen } from "./gameover/GameOverScreen";
import { gameOverToShow, keepDismissed, overKey } from "./gameover/gameOver";
import { MemoDrawer, MemoPop } from "./memo/MemoDesk";
import { reducedMotion } from "./title/crawl";
import { OpeningCrawl } from "./title/OpeningCrawl";
import { TitleScreen } from "./title/TitleScreen";
import { showTitleAtBoot } from "./title/titleState";
import { HelpLayer } from "./help/HelpLayer";
import { GoalsCard } from "./goals/GoalsCard";
import { Tutorial } from "./tutorial/Tutorial";
import { Assistant } from "./assistant/Assistant";
import { recommendedIds, suggestions } from "./assistant/suggest";
import { useGameState, useViewport } from "./hooks";
import { useHudKeyboard } from "./keyboard";
import { createMenuController } from "./menu/menuController";
import { newSaveError } from "./menu/slots";
import { type MenuSection, SystemMenu } from "./menu/SystemMenu";
import { pushNotice } from "./notices";
import { conduitName } from "./tools/controller";
import { densityFor, hudScale, isSmallScreen, settingsToClasses, settingsToCssVars } from "./settings";
import "./ui.css";
// After ui.css, so these can refine its base rules.
import "./clerk/clerk.css";
import "./finance/finance.css";
import "./research/research.css";
import "./bio/bio.css";
import "./calm/calm.css";
import "./calm/theme.css";
import "./build/build.css";
import "./panel/panel.css";
import "./help/help.css";

export interface HudProps {
	store: GameStore;
	content: ContentDB;
	/** Show the title screen over a paused game. Default: yes, unless the URL has ?new (the e2e smoke test relies on that). */
	title?: boolean;
}

/** The whole HUD, absolutely positioned over the world canvas; empty areas let pointer events through. */
export function Hud({ store, content, title }: HudProps) {
	const state = useGameState(store);
	const [ui, setUiState] = useState<UiState>({ drawer: null, paletteOpen: false, focusJobId: null, alertsSeenTick: -1, paletteTab: "rack", inboxOpen: false, financeTab: "ledger", stamped: [], aside: [] });
	const setUi = useCallback((patch: Partial<UiState>) => setUiState((u) => ({ ...u, ...patch })), []);
	const [menuOpen, setMenuOpen] = useState(false);
	const menu = useMemo(() => createMenuController(store, setMenuOpen), [store]);
	// FORM A-5 (ascension) pauses the same way: the choice is irreversible, so nothing may happen while it is read.
	const [ascensionOpen, setAscensionOpen] = useState(false);
	const ascension = useMemo(() => createMenuController(store, setAscensionOpen), [store]);
	// The quarterly audit sheet does not pause. `auditRef` lets the Esc handler (a stable object) see the current report.
	const [audit, setAudit] = useState<QuarterReport | null>(null);
	const auditRef = useRef<QuarterReport | null>(null);
	auditRef.current = audit;
	const auditSheet = useMemo(() => ({ isOpen: () => auditRef.current !== null, close: () => setAudit(null) }), []);
	// Esc closes the open drawer or the palette popover (the key handler is a stable object, so it reads the state through a ref).
	const uiRef = useRef(ui);
	uiRef.current = ui;
	const drawerCloser = useMemo(() => ({ isOpen: () => uiRef.current.drawer !== null || uiRef.current.paletteOpen || !!uiRef.current.help, close: () => setUiState((u) => ({ ...u, drawer: null, paletteOpen: false, buildHover: null, help: false })) }), []);
	const [menuSection, setMenuSection] = useState<MenuSection>("save");
	const [titleOpen, setTitleOpen] = useState(() => title ?? (typeof location !== "undefined" && showTitleAtBoot(location.search)));
	const [dismissedOver, setDismissedOver] = useState<string | null>(null);
	// The opening crawl plays once over every new game (the game stays paused); `run` = resume at 1× afterwards (no induction).
	const [crawl, setCrawl] = useState<{ run: boolean } | null>(null);
	const crawlRef = useRef(crawl);
	crawlRef.current = crawl;
	const finishCrawl = useCallback(() => {
		const c = crawlRef.current;
		if (!c) return; // ended already (a click and the timer can both land)
		crawlRef.current = null;
		setCrawl(null);
		if (c.run) store.setSpeed(1);
	}, [store]);
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
	useEffect(() => () => ascension.close(), [ascension]);
	useHudKeyboard(
		store,
		{
			toggleDrawer: useCallback((id) => setUiState((u) => ({ ...u, drawer: nextDrawer(u.drawer, id), paletteOpen: false })), []),
			togglePalette: useCallback(() => setUiState((u) => ({ ...u, paletteOpen: !u.paletteOpen, drawer: null, buildHover: null })), []),
			toggleHelp: useCallback(() => setUiState((u) => ({ ...u, help: !u.help })), []),
		},
		menu,
		useCallback(() => titleOpenRef.current || overRef.current || crawlRef.current !== null, []),
		{ ascension, audit: auditSheet, drawer: drawerCloser },
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
		if (overId) {
			ascension.close();
			store.setSpeed(0);
		}
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

	// A filed quarterly audit pops its sheet once (entries already in the log when the HUD mounts, or from before a load, do not).
	const cursor = useRef(createLogCursor());
	// biome-ignore lint/correctness/useExhaustiveDependencies: scan the log only when it changes; the view is read at that moment
	useEffect(() => {
		const r = auditToShow(cursor.current, state.log, state.view.reports);
		if (r) setAudit(r);
	}, [state.log]);

	const alertsOpen = ui.drawer === "log";
	const tick = state.view.tick;
	useEffect(() => {
		if (alertsOpen) setUi({ alertsSeenTick: tick });
	}, [alertsOpen, tick, setUi]);

	// The sheet has nothing to offer once a path is chosen (or after a load of a game that has one): close it.
	const ascensionStale = ascensionOpen && !ascensionDue(state.view, content);
	useEffect(() => {
		if (ascensionStale) ascension.close();
	}, [ascensionStale, ascension]);

	// UNIT-7: candidates come from the pure helper; the same list feeds the catalog's Recommended row.
	const assistantOn = settings.assistant !== false;
	const candidates = useMemo(() => (assistantOn ? suggestions(state.view, content) : []), [assistantOn, state.view, content]);
	const recommended = useMemo(() => recommendedIds(candidates), [candidates]);
	const openResearch = useCallback(
		(techId?: string) => {
			const node = typeof techId === "string" ? content.tech?.find((t) => t.id === techId) : undefined;
			setUiState((u) => ({ ...u, drawer: "research", paletteOpen: false, buildHover: null, ...(node ? { researchSel: node.id, researchTab: node.branch } : {}) }));
		},
		[content],
	);
	const props: PanelProps = { store, content, state, ui, setUi, openMenu: () => openMenuAt("save"), openResearch, openAscension: ascension.open, openAudit: setAudit };
	return (
		<div
			className={["aitower-hud", state.view.bankrupt ? "is-bankrupt" : "", ui.drawer ? "has-drawer" : "", ui.drawer && WIDE.has(ui.drawer) ? "has-wide" : "", ui.help ? "is-help" : "", `is-density-${density}`, ...settingsToClasses(settings)].filter(Boolean).join(" ")}
			style={settingsToCssVars(settings)}
		>
			<TopStrip {...props} />
			<HelpLayer ui={ui} setUi={setUi} scale={scale} />
			<div className="ui-center">
				<GoalsCard state={state} content={content} />
				<NextChip {...props} />
				<Toasts content={content} state={state} />
				<MemoPop store={store} content={content} state={state} ui={ui} setUi={setUi} />
				{ui.inboxOpen && <MemoDrawer store={store} content={content} state={state} ui={ui} setUi={setUi} />}
				{state.tool.kind !== "select" && <ToolHint {...props} />}
				{!titleOpen && !crawl && !over && <Tutorial store={store} content={content} state={state} ui={ui} setUi={setUi} />}
				<PalettePopover {...props} recommended={recommended} />
				<BuildBar ui={ui} setUi={setUi} />
				<Ticker {...props} />
				<div className="ui-right">
					{ui.paletteOpen ? <BuildInspector {...props} /> : <Inspector {...props} />}
				</div>
				{assistantOn && !titleOpen && !crawl && !over && <Assistant {...props} candidates={candidates} />}
				<DrawerTabs ui={ui} setUi={setUi} />
				<Drawer {...props} />
			</div>
			{audit && !titleOpen && <AuditSheet report={audit} onClose={() => setAudit(null)} />}
			{ascensionOpen && !titleOpen && !over && (
				<AscensionSheet
					store={store}
					content={content}
					view={state.view}
					onClose={ascension.close}
					onFiled={(f) => {
						setUi({ pathFiled: f });
						ascension.close();
					}}
				/>
			)}
			{showNotice && <DesktopNotice store={store} onDismiss={() => setNoticeDismissed(true)} />}
			{titleOpen && (
				<TitleScreen
					store={store}
					state={state}
					content={content}
					menuOpen={menuOpen}
					openMenu={openMenuAt}
					onStart={(how) => {
						setTitleOpen(false);
						if (how?.newGame) setCrawl({ run: how.run });
					}}
				/>
			)}
			{crawl && !titleOpen && !over && <OpeningCrawl reduced={reducedMotion(settings.reducedMotion)} onDone={finishCrawl} />}
			{over && (
				<GameOverScreen
					over={over}
					view={state.view}
					content={content}
					horror={settings.horrorIntensity}
					menuOpen={menuOpen}
					onLoad={() => openMenuAt("load")}
					onNewGame={() => {
						store.newGame();
						store.setSpeed(0);
						setCrawl({ run: true });
					}}
					onContinue={() => {
						setDismissedOver(overKey(over));
						store.setSpeed(1);
					}}
				/>
			)}
			{menuOpen && <SystemMenu key={menuSection} store={store} state={state} menu={menu} onEncyclopedia={() => setUi({ drawer: "encyclopedia", paletteOpen: false })} initial={menuSection} fromTitle={titleOpen} onReplaced={onReplaced} />}
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
					? `${conduitName(t.layer)} — drag across, then up/down`
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
