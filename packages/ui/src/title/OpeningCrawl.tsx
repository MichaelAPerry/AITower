import { type KeyboardEvent, useEffect, useRef } from "react";
import { CRAWL_FADE_S, CRAWL_LINES, crawlSeconds, isSkipKey, lineDelay } from "./crawl";
import "./crawl.css";

/**
 * The opening crawl, shown once over a freshly started game (which stays paused). Esc, Enter, Space, a click or the Skip
 * button end it. With reduced motion every line is shown at once and it waits for the player; otherwise it ends by itself.
 */
export function OpeningCrawl({ onDone, reduced }: { onDone: () => void; reduced: boolean }) {
	const root = useRef<HTMLDivElement>(null);
	const done = useRef(onDone);
	done.current = onDone;
	useEffect(() => {
		root.current?.focus();
		if (reduced) return;
		const h = setTimeout(() => done.current(), crawlSeconds() * 1000);
		return () => clearTimeout(h);
	}, [reduced]);
	const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
		// Nothing typed here may reach the game hotkeys or the camera.
		e.stopPropagation();
		if (isSkipKey(e.key)) {
			e.preventDefault();
			onDone();
		}
	};
	return (
		<div className={`ui-crawl ${reduced ? "is-still" : ""}`} ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Opening crawl" onKeyDown={onKeyDown} onClick={onDone}>
			<div className="ui-crawl-text">
				{CRAWL_LINES.map((line, i) => (
					<p key={line} className="ui-crawl-line" style={reduced ? undefined : { animationDelay: `${lineDelay(i)}s`, animationDuration: `${CRAWL_FADE_S}s` }}>
						{line}
					</p>
				))}
			</div>
			<button
				type="button"
				className="ui-btn ui-crawl-skip"
				onClick={(e) => {
					e.stopPropagation();
					onDone();
				}}
			>
				{reduced ? "Begin" : "Skip"} <kbd>Esc</kbd>
			</button>
		</div>
	);
}
