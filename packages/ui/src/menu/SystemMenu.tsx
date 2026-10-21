import type { ContentDB } from "@aitower/content";
import type { GameState, GameStore } from "@aitower/shared";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { Icon } from "../components/common";
import { focusables, nextFocusIndex } from "./focus";
import type { MenuController } from "./menuController";
import { ControlsPane, type Flash, LessonsPane, LoadPane, NewGamePane, SavePane, SettingsPane } from "./panes";
import { useSaves } from "./useSaves";
import "./menu.css";

export type MenuSection = "save" | "load" | "settings" | "controls" | "new" | "lessons";

const DRAWERS: { id: MenuSection; label: string; form: string; title: string }[] = [
	{ id: "save", label: "Save game", form: "SAVE", title: "Save game" },
	{ id: "load", label: "Load game", form: "LOAD", title: "Load game" },
	{ id: "settings", label: "Settings", form: "SETTINGS", title: "Settings" },
	{ id: "controls", label: "Controls", form: "CONTROLS", title: "Controls · keys and mouse" },
	{ id: "lessons", label: "Lessons", form: "LESSONS", title: "Lessons · learn by doing" },
	{ id: "new", label: "New game", form: "NEW GAME", title: "New game" },
];

export interface SystemMenuProps {
	store: GameStore;
	state: GameState;
	content?: ContentDB;
	menu: MenuController;
	/** Drawer to show first (dev harness / tests, title screen, game-over screen). */
	initial?: MenuSection;
	/** Opened from the title screen: only Load, Settings and Controls (there is no game to save or discard yet). */
	fromTitle?: boolean;
	/** The running game was replaced by a load or import (the title screen leaves on this). */
	onReplaced?: () => void;
	/** Close the menu and open the Handbook drawer. */
	onEncyclopedia?: () => void;
}

/**
 * The system menu: a bakelite filing cabinet. Modal: focus is trapped, Esc closes (restoring the game
 * speed), and key presses never reach the game's hotkeys or the camera while it is open.
 */
export function SystemMenu({ store, state, content, menu, initial = "save", fromTitle = false, onReplaced, onEncyclopedia }: SystemMenuProps) {
	const [section, setSection] = useState<MenuSection>(initial);
	const [flash, setFlash] = useState<Flash | null>(null);
	const root = useRef<HTMLDivElement>(null);
	const resume = useRef<HTMLButtonElement>(null);
	const { saves, error, reload } = useSaves(store, state.saveStatus.lastSavedAt);

	useEffect(() => {
		resume.current?.focus();
		// Pull stray focus back inside (clicks on the backdrop, programmatic focus elsewhere).
		const onFocusIn = (e: FocusEvent): void => {
			if (root.current && e.target instanceof Node && !root.current.contains(e.target)) resume.current?.focus();
		};
		document.addEventListener("focusin", onFocusIn);
		return () => {
			document.removeEventListener("focusin", onFocusIn);
		};
	}, []);

	const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
		// Nothing typed or pressed in the menu may reach the game hotkeys or the camera.
		e.stopPropagation();
		if (e.key === "Escape") {
			e.preventDefault();
			menu.close();
			return;
		}
		if (e.key === "Tab" && root.current) {
			const els = focusables(root.current);
			const i = nextFocusIndex(els.length, els.indexOf(document.activeElement as HTMLElement), e.shiftKey);
			if (i >= 0) {
				e.preventDefault();
				els[i].focus();
			}
		}
	};

	const go = (id: MenuSection): void => {
		setSection(id);
		setFlash(null);
	};
	const drawers = fromTitle ? DRAWERS.filter((d) => d.id === "load" || d.id === "settings" || d.id === "controls" || d.id === "lessons") : DRAWERS;
	const active = drawers.find((d) => d.id === section) ?? drawers[0];
	const common = { store, state, content, menu, flash: setFlash, onReplaced };

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop; key handling implements the focus trap
		<div className={`ui-menu-backdrop ${fromTitle ? "is-over-title" : ""}`} ref={root} onKeyDown={onKeyDown} onMouseDown={(e) => e.target === e.currentTarget && e.preventDefault()}>
			<div className="ui-menu ui-panel" role="dialog" aria-modal="true" aria-label="System menu">
				<header className="ui-menu-head ui-panel-title">
					<span className="ui-menu-plate">
						<b>SYSTEM</b>
						<i>MENU</i>
					</span>
					{!fromTitle && <span className="ui-dymo ui-menu-paused">GAME PAUSED</span>}
					<span className="ui-grow" />
					<button type="button" className="ui-btn ui-icon-btn" onClick={menu.close} aria-label="Close menu" title="Close menu (Esc)">
						<Icon name="close" size={12} />
					</button>
				</header>
				<div className="ui-menu-body">
					<nav className="ui-menu-rail" aria-label="Menu sections">
						<button ref={resume} type="button" className="ui-btn is-go ui-resume" onClick={menu.close}>
							<Icon name="play" size={11} /> {fromTitle ? "Back" : "Resume"}
						</button>
						{drawers.map((d) => (
							<button key={d.id} type="button" className={`ui-drawer ${section === d.id ? "is-open" : ""}`} aria-current={section === d.id ? "page" : undefined} onClick={() => go(d.id)}>
								<span className="ui-drawer-label">{d.label}</span>
							</button>
						))}
						<span className="ui-grow" />
						{!fromTitle && onEncyclopedia && (
							<button
								type="button"
								className="ui-btn ui-induct-btn"
								onClick={() => {
									menu.close();
									onEncyclopedia();
								}}
								title="Handbook (H)"
							>
								Handbook
							</button>
						)}
					</nav>
					<section className="ui-menu-pane ui-form" aria-label={active.label}>
						<div className="ui-form-head">
							<span>{active.title}</span>
							<span>{active.form}</span>
						</div>
						<div className="ui-menu-scroll">
							{error && section !== "controls" && section !== "settings" && <div className="ui-menu-note is-error">Could not read saves: {error}</div>}
							{section === "save" && <SavePane {...common} saves={saves} reload={reload} />}
							{section === "load" && <LoadPane {...common} saves={saves} reload={reload} />}
							{section === "settings" && <SettingsPane {...common} />}
							{section === "controls" && <ControlsPane />}
							{section === "new" && <NewGamePane {...common} />}
							{section === "lessons" && <LessonsPane {...common} fromTitle={fromTitle} />}
						</div>
						<div className={`ui-menu-note ${flash ? `is-${flash.tone}` : "is-idle"}`} role="status" aria-live="polite">
							{flash?.text ?? " "}
						</div>
					</section>
				</div>
			</div>
		</div>
	);
}
