import type { ContentDB } from "@aitower/content";
import { type KeyboardEvent, useEffect, useRef } from "react";
import { TITLE_END_ART, TITLE_LOGO } from "../art";
import type { SongId } from "../title/titleMusic";
import type { TitleEndingTree } from "../title/titleState";
import { rollCreditLines, endingThemeLine, musicCreditLines } from "./credits";
import "./creditsRoll.css";

/** Seconds the roll scrolls for: most of a ~3 minute song. */
export const ROLL_SECONDS = 200;
/** The first second ignores skip input, so a click meant for the last story page does not skip the roll. */
export const SKIP_GUARD_MS = 1000;
/** Esc / Space / Enter / click skip once the guard time has passed. */
export const canSkip = (elapsedMs: number): boolean => elapsedMs >= SKIP_GUARD_MS;

/**
 * Full-screen credits roll after a tree's success ending: that tree's ending picture and logo behind a slow scroll of the who-made-it and music credits the system menu shows
 * (see credits.ts), without the menu's quotes, the ending theme listed first. Esc / Space / Enter / click or the Skip button ends it; so does the end of the scroll. The song is not touched here.
 */
export function CreditsRoll({ tree, song, onDone, seconds = ROLL_SECONDS }: { tree: TitleEndingTree; song: SongId; content?: ContentDB /* accepted for callers; the roll shows no quotes */; onDone: () => void; seconds?: number }) {
	const root = useRef<HTMLDivElement>(null);
	const t0 = useRef(Date.now());
	useEffect(() => {
		root.current?.focus();
	}, []);
	const skip = (): void => {
		if (canSkip(Date.now() - t0.current)) onDone();
	};
	const onKey = (e: KeyboardEvent<HTMLDivElement>): void => {
		e.stopPropagation();
		if (e.key === "Escape" || e.key === " " || e.key === "Enter") {
			e.preventDefault();
			skip();
		}
	};
	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: the key handler is on the same element
		<div className={`cr-roll cr-roll-${tree}`} ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Credits" data-credits-roll={tree} onKeyDown={onKey} onClick={skip}>
			<img className="cr-roll-art" src={TITLE_END_ART[tree]} alt="" draggable={false} />
			<div className="cr-roll-shade" />
			<img className="cr-roll-logo" src={TITLE_LOGO.src} alt="" draggable={false} />
			<div className="cr-roll-view">
				<div className="cr-roll-scroll" style={{ animationDuration: `${seconds}s` }} onAnimationEnd={onDone} data-credits-scroll>
					<p className="cr-roll-theme" data-credit-theme>
						{endingThemeLine(song)}
					</p>
					<ul className="cr-roll-lines">
						{rollCreditLines().map((l) => (
							<li key={l}>{l}</li>
						))}
					</ul>
					<ul className="cr-roll-lines" data-credit-music>
						{musicCreditLines().map((l) => (
							<li key={l.text} className={l.id === song ? "is-playing" : undefined}>
								{l.text}
							</li>
						))}
					</ul>
				</div>
			</div>
			<button
				type="button"
				className="cr-roll-skip"
				data-credits-skip
				onClick={(e) => {
					e.stopPropagation();
					onDone();
				}}
			>
				Skip ▶▶
			</button>
		</div>
	);
}
