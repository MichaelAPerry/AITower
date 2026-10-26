import type { SceneLine } from "@aitower/content";
import type { DecisionView } from "@aitower/sim";
import type { GameStore } from "@aitower/shared";
import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { ADVISORS } from "../advisors/advisors";
import { BACKDROP, PORTRAITS } from "../art";
import { pushNotice } from "../notices";
import "./vn.css";

/** Characters revealed per second by the typewriter (instant with reduced motion). */
export const TYPE_CPS = 55;

type Phase = { kind: "lines"; i: number } | { kind: "choose" } | { kind: "reply"; choiceId: string; i: number };

/** The line shown in a phase, or null while choosing. */
export function lineAt(d: Pick<DecisionView, "lines" | "body" | "advisor" | "choices">, phase: Phase): SceneLine | null {
	const lines = d.lines?.length ? d.lines : [{ who: d.advisor, text: d.body }];
	if (phase.kind === "lines") return lines[phase.i] ?? null;
	if (phase.kind === "reply") return d.choices.find((c) => c.id === phase.choiceId)?.reply?.[phase.i] ?? null;
	return null;
}

/** The phase after the current line (null = the scene is over: file the choice). */
export function nextPhase(d: Pick<DecisionView, "lines" | "body" | "advisor" | "choices">, phase: Phase): Phase | null {
	const lines = d.lines?.length ? d.lines : [{ who: d.advisor, text: d.body }];
	if (phase.kind === "lines") return phase.i + 1 < lines.length ? { kind: "lines", i: phase.i + 1 } : { kind: "choose" };
	if (phase.kind === "reply") {
		const n = d.choices.find((c) => c.id === phase.choiceId)?.reply?.length ?? 0;
		return phase.i + 1 < n ? { ...phase, i: phase.i + 1 } : null;
	}
	return phase;
}

/**
 * A story scene (docs/SOUL.md §3): the tree's floor painting (or the dimmed tower), a caption box, the speaker's portrait and
 * a dialogue box with typewriter text and ▶ choices. The choice is filed only after the advisors have answered it, so the
 * clock stays stopped for the whole scene.
 */
export function StoryScene({ store, decision: d, reduced }: { store: GameStore; decision: DecisionView; reduced: boolean }) {
	const [phase, setPhase] = useState<Phase>({ kind: "lines", i: 0 });
	const [shown, setShown] = useState(0);
	const [sel, setSel] = useState(0);
	const root = useRef<HTMLDivElement>(null);
	const line = lineAt(d, phase);
	const full = line?.text ?? "";
	const typing = shown < full.length;

	// Restart the typewriter on every new line.
	// biome-ignore lint/correctness/useExhaustiveDependencies: a new line is a new phase
	useEffect(() => setShown(reduced ? Number.POSITIVE_INFINITY : 0), [phase, reduced]);
	useEffect(() => {
		if (!typing || reduced) return;
		const t = setInterval(() => setShown((n) => n + 1), 1000 / TYPE_CPS);
		return () => clearInterval(t);
	}, [typing, reduced]);
	useEffect(() => root.current?.focus(), []);

	const file = useCallback(
		(choiceId: string): void => {
			const r = store.dispatch({ type: "resolveDecision", decisionId: d.id, choiceId });
			if (!r.ok) pushNotice({ text: `Not filed: ${r.reason}`, severity: "warn", key: `decision:${d.id}` });
		},
		[store, d.id],
	);

	const advance = (): void => {
		if (phase.kind === "choose") return;
		if (typing) {
			setShown(Number.POSITIVE_INFINITY);
			return;
		}
		const n = nextPhase(d, phase);
		if (n === null && phase.kind === "reply") file(phase.choiceId);
		else if (n) setPhase(n);
	};
	const choose = (choiceId: string): void => {
		const c = d.choices.find((x) => x.id === choiceId);
		if (c?.reply?.length) setPhase({ kind: "reply", choiceId, i: 0 });
		else file(choiceId);
	};

	const onKey = (e: KeyboardEvent<HTMLDivElement>): void => {
		e.stopPropagation();
		if (phase.kind === "choose") {
			if (e.key === "ArrowDown") setSel((s) => (s + 1) % d.choices.length);
			else if (e.key === "ArrowUp") setSel((s) => (s + d.choices.length - 1) % d.choices.length);
			else if (e.key === "Enter" || e.key === " ") choose(d.choices[sel].id);
			else if (/^[1-9]$/.test(e.key) && d.choices[Number(e.key) - 1]) choose(d.choices[Number(e.key) - 1].id);
			else return;
		} else if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") advance();
		else return;
		e.preventDefault();
	};

	// The speaker on stage: the line's, or (while choosing) the scene's lead advisor.
	const who = line?.who ?? d.advisor;
	const mood = line?.mood ?? "neutral";
	const speaker = who === "narrator" ? null : ADVISORS[who];
	const backdrop = d.backdrop ? BACKDROP[d.backdrop] : null;
	const text = full.slice(0, shown);

	return (
		<div
			className={`vn-stage ${backdrop ? "has-backdrop" : ""}`}
			ref={root}
			tabIndex={-1}
			role="dialog"
			aria-modal="true"
			aria-label={d.title}
			data-decision={d.id}
			data-scene={d.eventId}
			onKeyDown={onKey}
			onClick={advance}
		>
			{backdrop && <img className="vn-backdrop" src={backdrop} alt="" draggable={false} />}
			<div className="vn-caption">
				<span>{d.location ?? "AI TOWER"}</span>
				<b>{d.title}</b>
			</div>
			{speaker && who !== "narrator" && (
				<div className="vn-figure" key={who} style={{ ["--adv" as string]: speaker.color }}>
					<img src={PORTRAITS[who][mood]} alt={speaker.name} draggable={false} />
				</div>
			)}
			{/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: keys are handled on the stage */}
			<div className="vn-box" style={{ ["--adv" as string]: speaker?.color ?? "var(--pc-rule)" }} onClick={(e) => phase.kind === "choose" && e.stopPropagation()}>
				{speaker ? <div className="vn-name">{speaker.name}</div> : phase.kind !== "choose" && <div className="vn-name is-narrator">· · ·</div>}
				{phase.kind !== "choose" ? (
					<p className={`vn-text ${who === "narrator" ? "is-narrator" : ""}`} aria-live="polite">
						{text}
						{!typing && <span className="vn-more" aria-hidden="true">▼</span>}
					</p>
				) : (
					<ul className="vn-choices">
						{d.choices.map((c, i) => (
							<li key={c.id}>
								<button type="button" className={`vn-choice ${i === sel ? "is-sel" : ""}`} data-choice={c.id} onMouseEnter={() => setSel(i)} onClick={() => choose(c.id)}>
									<span className="vn-cursor" aria-hidden="true">
										▶
									</span>
									<span className="vn-choice-label">{c.label}</span>
									<span className="vn-choice-hint">{c.hint}</span>
								</button>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}
