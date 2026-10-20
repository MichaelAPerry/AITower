import type { ContentDB } from "@aitower/content";
import type { GameState, GameStore } from "@aitower/shared";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { focusables, nextFocusIndex } from "../menu/focus";
import type { MenuSection } from "../menu/SystemMenu";
import { useSaves } from "../menu/useSaves";
import { closeInduction, restartInduction } from "../tutorial/Tutorial";
import { scenarioCards, showPicker, validScenario } from "./scenarios";
import { backdropCaption, continueSummary, inductionDefault, startGame, type TitleItem, titleBackdrop, titleItems } from "./titleState";
import "./title.css";

export interface TitleScreenProps {
	store: GameStore;
	state: GameState;
	/** True while the system menu is open over the title (the title stops grabbing focus). */
	menuOpen: boolean;
	openMenu: (section: MenuSection) => void;
	/** The player picked a game; remove the title. A new game says so (and whether the clock should run once the crawl ends), so the HUD can play the opening crawl. */
	onStart: (how?: { newGame: true; run: boolean }) => void;
	/** Scenarios for the picker. Without content there is no picker. */
	content?: ContentDB;
}

const LABEL: Record<TitleItem, string> = { continue: "CONTINUE", new: "NEW GAME", load: "LOAD GAME", settings: "SETTINGS", controls: "CONTROLS" };

/**
 * The title screen: the AITOWER nameplate and the menu. The game stays paused
 * until the player picks. Arrow keys and Enter drive it; Esc does nothing here.
 */
export function TitleScreen({ store, state, menuOpen, openMenu, onStart, content }: TitleScreenProps) {
	const root = useRef<HTMLDivElement>(null);
	const { saves } = useSaves(store, state.saveStatus.lastSavedAt);
	const [induction, setInduction] = useState<boolean | null>(null);
	const cards = content ? scenarioCards(content) : [];
	const [picked, setPicked] = useState<string | null>(null);
	const scenarioId = content ? validScenario(content, picked) : undefined;
	const ticked = induction ?? (saves ? inductionDefault(saves, scenarioId) : true);
	const now = Date.now();

	// Hold the game paused behind the title.
	useEffect(() => {
		store.setSpeed(0);
	}, [store]);

	// The renderer shows the loaded tower behind the menu, panning slowly with a day/night cycle.
	useEffect(() => {
		store.setTitleScene?.(true);
		return () => store.setTitleScene?.(false);
	}, [store]);

	// Focus the first entry when the list appears and whenever the menu hands control back.
	// biome-ignore lint/correctness/useExhaustiveDependencies: only the arrival of the saves and the menu closing matter
	useEffect(() => {
		if (!saves || menuOpen || !root.current) return;
		focusables(root.current)[0]?.focus();
	}, [!!saves, menuOpen]);

	const items = saves ? titleItems(saves) : [];
	const auto = saves?.find((s) => s.id === "auto");
	const hooks = { restartInduction, closeInduction };

	const pick = (item: TitleItem): void => {
		if (item === "continue") {
			startGame(store, { kind: "continue" }, hooks);
			onStart();
		} else if (item === "new") {
			startGame(store, { kind: "new", induction: ticked, scenarioId, crawl: true }, hooks);
			onStart({ newGame: true, run: !ticked });
		} else openMenu(item);
	};

	const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
		e.stopPropagation();
		if (e.key === "Escape") {
			e.preventDefault();
			return;
		}
		if (!root.current) return;
		const dir = e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey) ? 1 : e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey) ? -1 : 0;
		if (!dir) return;
		e.preventDefault();
		const els = focusables(root.current);
		const i = nextFocusIndex(els.length, els.indexOf(document.activeElement as HTMLElement), dir < 0);
		if (i >= 0) els[i].focus();
	};

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: full-screen modal; the key handler implements arrow navigation and the focus loop
		<div className="ui-title" ref={root} onKeyDown={onKeyDown} data-menu-open={menuOpen || undefined}>
			<div className="ui-title-sky" aria-hidden="true">
				<span className="ui-title-sign">{saves ? backdropCaption(titleBackdrop(saves)) : "COMPUTE AUTHORITY"}</span>
			</div>
			<div className="ui-title-cabinet ui-panel" role="dialog" aria-modal="true" aria-label="AItower title screen">
				<div className="ui-title-plate">
					<span className="ui-title-brand">
						AI<b>TOWER</b>
					</span>
					<span className="ui-title-sub">LICENSED AI COMPUTE OPERATOR</span>
				</div>
				<div className="ui-crt crt-amber ui-title-crt">
					{!saves && <p className="ui-title-wait">LOADING SAVES…</p>}
					{saves && (
						<ul className="ui-title-menu">
							{items.map((item) => (
								<li key={item}>
									<button type="button" className="ui-title-item" onClick={() => pick(item)}>
										<span className="ui-title-cursor" aria-hidden="true">
											▶
										</span>
										<span className="ui-title-label">{LABEL[item]}</span>
										{item === "continue" && auto && <span className="ui-title-detail">{continueSummary(auto, now)}</span>}
										{item === "load" && <span className="ui-title-detail">{saves.length} saved</span>}
									</button>
									{item === "new" && (
										<label className="ui-title-check">
											<input
												type="checkbox"
												checked={ticked}
												onChange={(e) => setInduction(e.currentTarget.checked)}
												onKeyDown={(e) => {
													if (e.key === "Enter") {
														e.preventDefault();
														setInduction(!ticked);
													}
												}}
											/>
											<span>Tutorial</span>
										</label>
									)}
								</li>
							))}
						</ul>
					)}
				</div>
				{showPicker(cards) && (
					<fieldset className="ui-title-sites">
						<legend className="ui-dymo">CHOOSE A SITE</legend>
						<div className="ui-title-cards" role="radiogroup" aria-label="Scenario">
							{cards.map((c) => (
								// biome-ignore lint/a11y/useSemanticElements: card-styled radio
								<button key={c.id} type="button" role="radio" aria-checked={c.id === scenarioId} className={`ui-title-card ${c.id === scenarioId ? "is-on" : ""}`} data-scenario={c.id} onClick={() => setPicked(c.id)}>
									<span className="ui-title-card-head">
										<b>{c.name}</b>
										{c.sandbox && <span className="ui-tag">SANDBOX</span>}
										<span className="ui-title-card-facts">{c.facts}</span>
									</span>
									<span className="ui-title-card-desc">{c.description}</span>
								</button>
							))}
						</div>
					</fieldset>
				)}
				<div className="ui-title-foot">
					<span className="ui-dymo">ENTER OR CLICK TO PROCEED</span>
					{saves && saves.length > 0 && (
						<button
							type="button"
							className="ui-btn"
							onClick={() => {
								startGame(store, { kind: "new", induction: true, crawl: true }, hooks);
								onStart({ newGame: true, run: false });
							}}
							title="Start a fresh site with the tutorial"
						>
							Restart tutorial
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
