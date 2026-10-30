import type { ContentDB } from "@aitower/content";
import type { GameStore } from "@aitower/shared";
import type { QuarterReport } from "@aitower/sim";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PanelProps, UiState } from "./components/context";
import { CursorHint } from "./components/CursorHint";
import { DesktopNotice } from "./components/DesktopNotice";
import { Inspector } from "./components/Inspector";
import { LevelUpCard } from "./levelup/LevelUpCard";
import { AchievementToast } from "./achievements/AchievementToast";
import { Toasts } from "./components/Toasts";
import { BuildBar } from "./build/BuildBar";
import { BuildInspector } from "./build/BuildInspector";
import { rightPanelFor } from "./build/plain";
import { Drawer, DrawerTabs, NextChip, PalettePopover, Ticker, WIDE } from "./calm/Parts";
import { TopStrip } from "./calm/TopStrip";
import { type DrawerId, nextDrawer } from "./calm/calm";
import { AuditSheet } from "./finance/AuditSheet";
import { auditToShow, createLogCursor } from "./finance/auditTrigger";
import { GameOverScreen } from "./gameover/GameOverScreen";
import { gameOverToShow, keepDismissed, overKey } from "./gameover/gameOver";
import { DecisionCard } from "./advisors/DecisionCard";
import { TreesPanel } from "./soul/TreesPanel";
import { reducedMotion } from "./title/crawl";
import { OpeningCrawl } from "./title/OpeningCrawl";
import { TitleScreen } from "./title/TitleScreen";
import { showTitleAtBoot } from "./title/titleState";
import { HelpLayer } from "./help/HelpLayer";
import { GoalsCard } from "./goals/GoalsCard";
import { useLesson } from "./lessons/LessonLayer";
import { lessonActive, lessonTabs } from "./lessons/lessons";
import { AdvisorStrip } from "./advisors/AdvisorStrip";
import { useGameState, useViewport } from "./hooks";
import { useHudKeyboard } from "./keyboard";
import { createMenuController } from "./menu/menuController";
import { newSaveError } from "./menu/slots";
import { type MenuSection, SystemMenu } from "./menu/SystemMenu";
import { pushNotice } from "./notices";
import { densityFor, hudScale, isSmallScreen, settingsToClasses, settingsToCssVars } from "./settings";
import "./ui.css";
// After ui.css, so these can refine its base rules.
import "./clerk/clerk.css";
import "./finance/finance.css";
import "./research/research.css";
import "./bio/bio.css";
import "./calm/calm.css";
import "./calm/theme.css";
import { TermProvider } from "./glossary/Term";
import "./build/build.css";
import "./build/tier.css";
import "./panel/panel.css";
import "./help/help.css";
// The PC-98 look goes last: it swaps the theme tokens and frames (docs/SOUL.md §5).
import "./pc98/pc98.css";

export interface HudProps {
	store: GameStore;
	content: ContentDB;
	/** Show the title screen over a paused game. Default: yes, unless the URL has ?new (the e2e smoke test relies on that). */
	title?: boolean;
}

/** The whole HUD, absolutely positioned over the world canvas; empty areas let pointer events through. */
export function Hud({ store, content, title }: HudProps) {
	const state = useGameState(store);
	const [ui, setUiState] = useState<UiState>({ drawer: null, paletteOpen: false, focusJobId: null, alertsSeenTick: -1, paletteTab: "rack", financeTab: "ledger" });
	const setUi = useCallback((patch: Partial<UiState>) => setUiState((u) => ({ ...u, ...patch })), []);
	const [menuOpen, setMenuOpen] = useState(false);
	const menu = useMemo(() => createMenuController(store, setMenuOpen), [store]);
	// The quarterly audit sheet does not pause. `auditRef` lets the Esc handler (a stable object) see the current report.
	const [audit, setAudit] = useState<QuarterReport | null>(null);
	const auditRef = useRef<QuarterReport | null>(null);
	auditRef.current = audit;
	const auditSheet = useMemo(() => ({ isOpen: () => auditRef.current !== null, close: () => setAudit(null) }), []);
	// Esc closes the open drawer or the palette popover (the key handler is a stable object, so it reads the state through a ref).
	const uiRef = useRef(ui);
	uiRef.current = ui;
	const drawerCloser = useMemo(() => ({ isOpen: () => uiRef.current.drawer !== null || uiRef.current.paletteOpen || !!uiRef.current.help, close: () => setUiState((u) => ({ ...u, drawer: null, paletteOpen: false, buildHover: null, help: false })) }), []);
	// The Trees panel does not pause the game; Esc closes it.
	const treesCloser = useMemo(() => ({ isOpen: () => uiRef.current.trees === true, close: () => setUiState((u) => ({ ...u, trees: false })) }), []);
	const [menuSection, setMenuSection] = useState<MenuSection>("save");
	const [titleOpen, setTitleOpen] = useState(() => title ?? (typeof location !== "undefined" && showTitleAtBoot(location.search)));
	const [dismissedOver, setDismissedOver] = useState<string | null>(null);
	// The opening crawl plays once over every new game (the game stays paused); `run` = resume at 1× afterwards (no lesson).
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
	const lessonRef = useRef(false);
	const lessonDrawersRef = useRef<string[]>([]);
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
	// The coach-mark tutorial is gone (Lesson 1 replaced it): forget what it kept.
	useEffect(() => {
		try {
			localStorage.removeItem("aitower.induction.v2");
			localStorage.removeItem("aitower.induction.v1");
			localStorage.removeItem("aitower.hints.v1");
		} catch {
			/* storage blocked */
		}
	}, []);
	useHudKeyboard(
		store,
		{
			toggleDrawer: useCallback((id) => {
				// A lesson keeps the screen quiet: only the Handbook and the drawers the current step has opened.
				if (lessonRef.current && id !== "handbook" && !lessonDrawersRef.current.includes(id)) return;
				setUiState((u) => ({ ...u, drawer: nextDrawer(u.drawer, id), paletteOpen: false }));
			}, []),
			openSearch: useCallback(() => setUiState((u) => ({ ...u, drawer: "handbook", paletteOpen: false, buildHover: null, searchFocus: (u.searchFocus ?? 0) + 1 })), []),
			togglePalette: useCallback(() => setUiState((u) => ({ ...u, paletteOpen: !u.paletteOpen, drawer: null, buildHover: null })), []),
			toggleHelp: useCallback(() => setUiState((u) => ({ ...u, help: !u.help })), []),
		},
		menu,
		useCallback(() => titleOpenRef.current || overRef.current || crawlRef.current !== null, []),
		{ audit: auditSheet, trees: treesCloser, drawer: drawerCloser },
	);

	// Game over: shown once per game. Bankrupt and absorbed are final; victory can be dismissed (sandbox).
	const gameOver = state.view.gameOver;
	const over = titleOpen ? null : gameOverToShow(gameOver, dismissedOver);
	overRef.current = !!over;
	const startFreeBuild = useCallback(() => {
		store.newGame();
		store.setSpeed(0);
		setUiState((u) => ({ ...u, drawer: null, paletteOpen: false }));
		setCrawl({ run: true });
	}, [store]);
	const lesson = useLesson({
		store,
		content,
		state,
		ui,
		setUi,
		enabled: !titleOpen && !crawl && !over,
		onFreeBuild: startFreeBuild,
		onReplay: (scenario) => {
			store.newGame(undefined, scenario);
			store.setSpeed(0);
			setUiState((u) => ({ ...u, drawer: null, paletteOpen: false }));
		},
	});
	const inLesson = lesson.active && lessonActive(state.view);
	lessonRef.current = inLesson;
	lessonDrawersRef.current = lesson.drawers;
	useEffect(() => {
		setDismissedOver((k) => keepDismissed(gameOver, k));
	}, [gameOver]);
	const overId = over ? overKey(over) : null;
	// biome-ignore lint/correctness/useExhaustiveDependencies: pause once when a game-over appears
	useEffect(() => {
		if (overId) {
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

	const openResearch = useCallback(
		(techId?: string) => {
			const node = typeof techId === "string" ? content.tech?.find((t) => t.id === techId) : undefined;
			setUiState((u) => ({ ...u, drawer: "research", paletteOpen: false, buildHover: null, ...(node ? { researchSel: node.id, researchTab: node.branch } : {}) }));
		},
		[content],
	);
	const openHandbookAt = useCallback((target: string) => setUiState((u) => ({ ...u, drawer: "handbook", encyId: target, paletteOpen: false, buildHover: null })), []);
	// Calm: a decision opens alone. Whatever drawer or catalog was open closes, so the card has the screen to itself.
	const decisionId = state.view.decision?.id ?? null;
	useEffect(() => {
		if (decisionId !== null) setUiState((u) => (u.drawer || u.paletteOpen ? { ...u, drawer: null, paletteOpen: false, buildHover: null } : u));
	}, [decisionId]);
	const props: PanelProps = { store, content, state, ui, setUi, openMenu: () => openMenuAt("save"), openResearch, openAudit: setAudit };
	return (
		<TermProvider open={openHandbookAt}>
		<div
			className={["aitower-hud", state.view.bankrupt ? "is-bankrupt" : "", ui.drawer ? "has-drawer" : "", ui.paletteOpen ? "is-building" : "", ui.drawer && WIDE.has(ui.drawer) ? "has-wide" : "", ui.drawer === "research" && ui.researchView !== "list" ? "has-tree" : "", ui.help ? "is-help" : "", inLesson ? "is-lesson" : "", `is-density-${density}`, ...settingsToClasses(settings)].filter(Boolean).join(" ")}
			style={settingsToCssVars(settings)}
		>
			<TopStrip {...props} />
			<HelpLayer ui={ui} setUi={setUi} scale={scale} />
			<div className="ui-center">
				{!lesson.active && <GoalsCard state={state} content={content} />}
				{!lesson.active && <NextChip {...props} />}
				{lesson.layer}
				<Toasts content={content} state={state} />
				<LevelUpCard content={content} state={state} />
				{!titleOpen && !over && <DecisionCard store={store} content={content} state={state} onHandbook={(id) => setUi({ drawer: "handbook", encyId: id, paletteOpen: false, buildHover: null })} />}
				<CursorHint state={state} />
				<PalettePopover {...props} />
				<BuildBar ui={ui} setUi={setUi} tabs={lessonTabs(content, state.view)} />
				<Ticker {...props} />
				<div className="ui-right">
					{rightPanelFor({ paletteOpen: ui.paletteOpen, inLesson, hovering: !!ui.buildHover, selected: !!state.selection }) === "build" ? <BuildInspector {...props} /> : <Inspector {...props} />}
				</div>
				{!titleOpen && !crawl && !over && <AdvisorStrip {...props} teacher={lesson.teacher} teacherAdvisor={lesson.advisor} />}
				<DrawerTabs ui={ui} setUi={setUi} content={content} state={state} only={inLesson ? (["handbook", ...lesson.drawers] as DrawerId[]) : undefined} />
				<Drawer {...props} />
			</div>
			{ui.trees && !titleOpen && !over && state.view.soul && <TreesPanel view={state.view} content={content} onClose={() => setUi({ trees: false })} />}
			{audit && !titleOpen && <AuditSheet report={audit} onClose={() => setAudit(null)} />}
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
						if (how && "newGame" in how) setCrawl({ run: how.run });
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
			<AchievementToast state={state} content={content} deferOk={menuOpen || !!over} />
			{menuOpen && <SystemMenu key={menuSection} store={store} state={state} content={content} menu={menu} onEncyclopedia={() => setUi({ drawer: "handbook", paletteOpen: false })} initial={menuSection} fromTitle={titleOpen} onReplaced={onReplaced} />}
		</div>
		</TermProvider>
	);
}
