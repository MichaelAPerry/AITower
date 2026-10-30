import type { ContentDB } from "@aitower/content";
import { type GameState, type GameStore, freeBuildBonus, loadLessonProgress, loadProfile } from "@aitower/shared";
import { counter } from "../achievements/gallery";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { fmtMoney } from "../format";
import { focusables, nextFocusIndex } from "../menu/focus";
import type { MenuSection } from "../menu/SystemMenu";
import { useSaves } from "../menu/useSaves";
import { scenarioCards, showPicker, validScenario } from "./scenarios";
import { backdropCaption, continueSummary, startGame, type TitleItem, titleBackdrop, titleItems } from "./titleState";
import "./title.css";
import "./title-pc98.css";
import { BACKDROP } from "../art";

export interface TitleScreenProps {
	store: GameStore;
	state: GameState;
	/** True while the system menu is open over the title (the title stops grabbing focus). */
	menuOpen: boolean;
	openMenu: (section: MenuSection) => void;
	/** The player picked a game; remove the title. A Free Build game says so, so the HUD can play the opening crawl; a lesson starts straight away with its teacher. */
	onStart: (how?: { newGame: true; run: boolean } | { lesson: true }) => void;
	/** Scenarios for the picker. Without content there is no picker. */
	content?: ContentDB;
}

const LABEL: Record<TitleItem, string> = { continue: "CONTINUE", lesson: "START LESSON 1", new: "FREE BUILD", load: "LOAD GAME", achievements: "ACHIEVEMENTS", settings: "SETTINGS", controls: "CONTROLS" };

/**
 * The title screen: the AITOWER nameplate and the menu. The game stays paused
 * until the player picks. Arrow keys and Enter drive it; Esc does nothing here.
 */
export function TitleScreen({ store, state, menuOpen, openMenu, onStart, content }: TitleScreenProps) {
	const root = useRef<HTMLDivElement>(null);
	const { saves } = useSaves(store, state.saveStatus.lastSavedAt);
	const cards = content ? scenarioCards(content) : [];
	const [picked, setPicked] = useState<string | null>(null);
	const scenarioId = content ? validScenario(content, picked) : undefined;
	// A sandbox site opens paused (the crawl ends without starting the clock).
	const sandboxPick = !!scenarioId && !!content?.scenarios?.[scenarioId]?.sandbox;
	const lessonOne = content?.lessons?.[0];
	const lessonProgress = loadLessonProgress();
	const lessonDone = lessonOne ? lessonProgress.done[lessonOne.id] !== undefined : false;
	const bonus = content ? freeBuildBonus(content.lessons, lessonProgress) : 0;
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

	const pick = (item: TitleItem): void => {
		if (item === "continue") {
			startGame(store, { kind: "continue" });
			onStart();
		} else if (item === "lesson") {
			if (lessonOne && !lessonDone) {
				startGame(store, { kind: "lesson", scenarioId: lessonOne.scenario });
				onStart({ lesson: true });
			} else openMenu("lessons");
		} else if (item === "new") {
			startGame(store, { kind: "new", scenarioId, crawl: true });
			onStart({ newGame: true, run: !sandboxPick });
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
				<img className="ui-title-art" src={BACKDROP.title} alt="" draggable={false} />
				<span className="ui-title-sign">{saves ? backdropCaption(titleBackdrop(saves)) : "COMPUTE AUTHORITY"}</span>
			</div>
			<div className="ui-title-cabinet ui-panel" role="dialog" aria-modal="true" aria-label="AItower title screen">
				<div className="ui-title-plate">
					<span className="ui-title-brand">
						AI<b>TOWER</b>
					</span>
					<span className="ui-title-sub">THREE ROADS TO THE END OF THE WORLD</span>
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
										<span className="ui-title-label">{item === "lesson" && lessonDone ? "LESSONS" : LABEL[item]}</span>
										{item === "continue" && auto && <span className="ui-title-detail">{continueSummary(auto, now)}</span>}
										{item === "load" && <span className="ui-title-detail">{saves.length} saved</span>}
										{item === "achievements" && <span className="ui-title-detail">{counter(loadProfile())} earned \u00b7 off-duty gallery</span>}
										{item === "lesson" && <span className="ui-title-detail">{lessonDone ? "replay or pick one" : "build a rack · 4 min · recommended"}</span>}
										{item === "new" && <span className="ui-title-detail">{bonus > 0 ? `sandbox sites · +${fmtMoney(bonus)} head start` : "sandbox sites, no teacher"}</span>}
									</button>
								</li>
							))}
						</ul>
					)}
				</div>
				{showPicker(cards) && (
					<fieldset className="ui-title-sites">
						<legend className="ui-dymo">FREE BUILD SITE</legend>
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
				</div>
			</div>
		</div>
	);
}
