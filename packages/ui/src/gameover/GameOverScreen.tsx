import type { ContentDB } from "@aitower/content";
import type { HorrorIntensity } from "@aitower/shared";
import type { SimView } from "@aitower/sim";
import { type KeyboardEvent, useEffect, useRef } from "react";
import { Stamp } from "../components/common";
import { focusables, nextFocusIndex } from "../menu/focus";
import { StampBtn } from "../menu/parts";
import { endingOf, type GameOver, isFinal, lifetimeStats, overCopyFor } from "./gameOver";
import "./gameover.css";
import { EndingScene } from "./EndingScene";

export interface GameOverScreenProps {
	over: GameOver;
	view: SimView;
	content: ContentDB;
	/** settings.horrorIntensity: "off" prints the plain forms. */
	horror?: HorrorIntensity;
	/** Open the load drawer of the system menu. */
	onLoad: () => void;
	onNewGame: () => void;
	/** Victory only: keep playing. */
	onContinue: () => void;
	/** True while the system menu is open on top (focus is left alone). */
	menuOpen: boolean;
}

/** Full-screen notice: NOTICE OF TERMINATION (bankrupt, shutdown), COMMENDATION (victory), or the text of the ending reached (living / clean / absorbed). */
export function GameOverScreen({ over, view, content, horror = "full", onLoad, onNewGame, onContinue, menuOpen }: GameOverScreenProps) {
	const root = useRef<HTMLDivElement>(null);
	const copy = overCopyFor(over, content, horror);
	const ending = endingOf(over);
	const final = isFinal(over.kind);

	// biome-ignore lint/correctness/useExhaustiveDependencies: refocus the first button when the notice appears and when the menu hands control back
	useEffect(() => {
		if (!menuOpen && root.current) focusables(root.current)[0]?.focus();
	}, [menuOpen, over.kind]);

	// The three Singularity wins play as a visual-novel scene over their tree's painting.
	const tree = over.kind === "victory" && ending ? content.endings?.find((e) => e.id === ending && e.backdrop) : undefined;
	if (tree) return <EndingScene ending={tree} view={view} content={content} menuOpen={menuOpen} onContinue={onContinue} onNewGame={onNewGame} />;

	const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
		e.stopPropagation();
		if (e.key !== "Tab" || !root.current) return;
		const els = focusables(root.current);
		const i = nextFocusIndex(els.length, els.indexOf(document.activeElement as HTMLElement), e.shiftKey);
		if (i >= 0) {
			e.preventDefault();
			els[i].focus();
		}
	};

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: full-screen modal; the key handler implements the focus loop
		<div className={`ui-over is-${over.kind}${ending ? ` ending-${ending}` : ""}`} ref={root} onKeyDown={onKeyDown}>
			<article className="ui-over-memo" role="alertdialog" aria-modal="true" aria-labelledby="over-title">
				<header className="ui-over-head">
					<span className="ui-over-from">COMPUTE AUTHORITY · ENFORCEMENT</span>
					<span className="ui-over-form">{copy.form}</span>
				</header>
				<h2 className="ui-over-title" id="over-title">
					{copy.heading}
				</h2>
				{copy.lines.map((l) => (
					<p key={l} className="ui-over-line">
						{l}
					</p>
				))}
				<section className="ui-over-record" aria-label="Service record">
					<h3>SERVICE RECORD</h3>
					<dl>
						{lifetimeStats(view).map((r) => (
							<div key={r.label}>
								<dt>{r.label}</dt>
								<dd>{r.value}</dd>
							</div>
						))}
					</dl>
				</section>
				<Stamp tone={copy.tone === "red" ? "red" : "green"} className="ui-over-stamp">
					{copy.stamp}
				</Stamp>
				<footer className="ui-over-acts">
					{final ? <StampBtn tone="green" rest="Load game" onClick={onLoad} /> : <StampBtn tone="green" rest="Continue in sandbox" onClick={onContinue} />}
					<StampBtn tone={final ? "red" : "green"} rest="New game" onClick={onNewGame} />
				</footer>
			</article>
		</div>
	);
}
