import type { AdvisorId, ContentDB, EndingDef } from "@aitower/content";
import type { SimView } from "@aitower/sim";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { ADVISORS } from "../advisors/advisors";
import { endingBackdrop, PORTRAITS } from "../art";
import { newLines } from "../achievements/gallery";
import "../achievements/achievements.css";
import { useRunAwards } from "../achievements/awardBus";
import { StampBtn } from "../menu/parts";
import { endingKicker, lifetimeStats, paragraphs } from "./gameOver";
import "../vn/vn.css";

/**
 * The advisor whose epilogue closes the ending: the one with the highest bond, if it reaches `bondEpilogue` (ties go to the
 * earlier in this order).
 */
export function epilogueAdvisor(view: Pick<SimView, "soul">, ending: EndingDef): AdvisorId | null {
	const s = view.soul;
	if (!s || !ending.epilogue) return null;
	let best: AdvisorId | null = null;
	for (const id of ["cass", "mel", "bea", "luci"] as const) {
		if (!ending.epilogue[id] || s.bonds[id] < s.bondEpilogue) continue;
		if (best === null || s.bonds[id] > s.bonds[best]) best = id;
	}
	return best;
}

/** The pages of an ending: its paragraphs, then the closest advisor's epilogue, or the ending's narrated fallback if nobody qualifies. */
export function endingPages(ending: EndingDef, view: Pick<SimView, "soul">): { who: AdvisorId | null; text: string }[] {
	const who = epilogueAdvisor(view, ending);
	return [
		...paragraphs(ending.body).map((text) => ({ who: null, text })),
		...(who && ending.epilogue?.[who]
			? [{ who, text: ending.epilogue[who] as string }]
			: ending.epilogue?.fallback
				? [{ who: null, text: ending.epilogue.fallback }]
				: []),
	];
}

/**
 * A Singularity ending as a visual-novel scene: the tree's floor painting, the ending's paragraphs in the dialogue box, the
 * epilogue of the advisor the player is closest to (or, when no bond reaches the bar, the ending's narrated fallback), then the
 * service record and the buttons.
 */
export function EndingScene({ ending, view, menuOpen, final = false, onContinue, onLoad, onNewGame }: { ending: EndingDef; view: SimView; content: ContentDB; menuOpen: boolean; /** Absorbed and Bankrupt: no sandbox, offer Load game instead of Continue. */ final?: boolean; onContinue: () => void; onLoad?: () => void; onNewGame: () => void }) {
	const backdrop = endingBackdrop(ending);
	const pages = endingPages(ending, view);
	const [i, setI] = useState(0);
	const root = useRef<HTMLDivElement>(null);
	const done = i >= pages.length;
	const fresh = newLines(useRunAwards());
	useEffect(() => {
		if (!menuOpen) root.current?.focus();
	}, [menuOpen]);
	const next = (): void => setI((n) => Math.min(pages.length, n + 1));
	const onKey = (e: KeyboardEvent<HTMLDivElement>): void => {
		e.stopPropagation();
		if (!done && (e.key === "Enter" || e.key === " " || e.key === "ArrowRight")) {
			e.preventDefault();
			next();
		}
	};
	const page = pages[i];
	const speaker = page?.who ? ADVISORS[page.who] : null;
	return (
		<div className={`vn-stage ${backdrop ? "has-backdrop" : "is-plain"} ui-over ending-${ending.id}`} ref={root} tabIndex={-1} role="alertdialog" aria-modal="true" aria-label={ending.title} onKeyDown={onKey} onClick={done ? undefined : next}>
			{backdrop && <img className="vn-backdrop" src={backdrop} alt="" draggable={false} />}
			<div className="vn-caption">
				<span>{endingKicker(ending.id)}</span>
				<b>{ending.title}</b>
			</div>
			{speaker && page?.who && (
				<div className="vn-figure" style={{ ["--adv" as string]: speaker.color }}>
					<img src={PORTRAITS[page.who].pleased} alt={speaker.name} draggable={false} />
				</div>
			)}
			{!done ? (
				<div className="vn-box" style={{ ["--adv" as string]: speaker?.color ?? "var(--pc-rule)" }}>
					<div className={`vn-name ${speaker ? "" : "is-narrator"}`}>{speaker ? speaker.name : `${i + 1} / ${pages.length}`}</div>
					<p className={`vn-text ${speaker ? "" : "is-narrator"}`}>
						{page?.text}
						<span className="vn-more" aria-hidden="true">
							▼
						</span>
					</p>
				</div>
			) : (
				// biome-ignore lint/a11y/noStaticElementInteractions: stops the stage's click-to-advance; the buttons inside take the input
				<div className="vn-box vn-record" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
					<div className="vn-name">SERVICE RECORD</div>
					{fresh.length > 0 && (
						<p className="vn-new" data-ach-new>
							{fresh.map((l) => (
								<span key={l}>{l}</span>
							))}
						</p>
					)}
					<dl className="vn-stats">
						{lifetimeStats(view).map((r) => (
							<div key={r.label}>
								<dt>{r.label}</dt>
								<dd>{r.value}</dd>
							</div>
						))}
					</dl>
					<footer className="ui-over-acts">
						{final ? <StampBtn tone="green" rest="Load game" onClick={onLoad ?? onNewGame} /> : <StampBtn tone="green" rest="Continue in sandbox" onClick={onContinue} />}
						<StampBtn tone={final ? "red" : "green"} rest="New game" onClick={onNewGame} />
					</footer>
				</div>
			)}
		</div>
	);
}
