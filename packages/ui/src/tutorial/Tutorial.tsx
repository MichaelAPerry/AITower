import type { ContentDB } from "@aitower/content";
import type { GameState, GameStore } from "@aitower/shared";
import { useEffect, useRef, useState } from "react";
import { type Baseline, TUTORIAL_STEPS, baselineOf } from "./steps";

const STORAGE_KEY = "aitower.induction.v1";
/** Pause after a task is ticked off, so the player sees the APPROVED stamp before the next memo. */
const ADVANCE_MS = 1400;

interface Saved {
	step: number;
	done: boolean;
}

function readSaved(): Saved {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) return JSON.parse(raw) as Saved;
	} catch {
		/* storage unavailable — start fresh */
	}
	return { step: 0, done: false };
}

function writeSaved(s: Saved) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
	} catch {
		/* best effort */
	}
}

/** Global hook so the system menu's RESTART INDUCTION button can reopen the tutorial without prop drilling. */
const listeners = new Set<() => void>();
export function restartInduction() {
	writeSaved({ step: 0, done: false });
	for (const l of listeners) l();
}

export interface TutorialProps {
	store: GameStore;
	content: ContentDB;
	state: GameState;
}

export function Tutorial({ store, content, state }: TutorialProps) {
	const [saved, setSaved] = useState<Saved>(readSaved);
	const [completedAt, setCompletedAt] = useState<number | null>(null);
	const baseline = useRef<Baseline | null>(null);
	const enteredStep = useRef<number>(-1);
	const ctx = { content };

	useEffect(() => {
		const l = () => {
			baseline.current = null;
			enteredStep.current = -1;
			setCompletedAt(null);
			setSaved(readSaved());
		};
		listeners.add(l);
		return () => {
			listeners.delete(l);
		};
	}, []);

	const update = (s: Saved) => {
		writeSaved(s);
		setSaved(s);
	};

	const step = saved.done ? undefined : TUTORIAL_STEPS[saved.step];
	const next = () => {
		const n = saved.step + 1;
		update(n >= TUTORIAL_STEPS.length ? { step: n, done: true } : { step: n, done: false });
	};
	const back = () => update({ step: Math.max(0, saved.step - 1), done: false });
	const skip = () => update({ step: saved.step, done: true });

	// Enter a step: capture its baseline, run side effects, move the camera.
	// biome-ignore lint/correctness/useExhaustiveDependencies: run once per step change; state, ctx and store are read at entry and must not re-trigger it
	useEffect(() => {
		if (!step || enteredStep.current === saved.step) return;
		enteredStep.current = saved.step;
		baseline.current = baselineOf(state, ctx);
		setCompletedAt(null);
		step.onEnter?.(store);
		if (step.focus) store.focus(step.focus);
	}, [saved.step, step]);

	// Spotlight the step's target element.
	useEffect(() => {
		if (!step?.target) return;
		const el = document.querySelector(`.aitower-hud ${step.target}`);
		el?.classList.add("tut-target");
		return () => el?.classList.remove("tut-target");
	}, [step]);

	const satisfied = !!step?.done && !!baseline.current && step.done(state, baseline.current, ctx);

	useEffect(() => {
		if (satisfied && completedAt === null) setCompletedAt(Date.now());
	}, [satisfied, completedAt]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: one-shot advance timer keyed on completedAt; `next` is recreated every render and must not restart it
	useEffect(() => {
		if (completedAt === null) return;
		const t = setTimeout(() => next(), ADVANCE_MS);
		return () => clearTimeout(t);
	}, [completedAt]);

	if (!step) return null;

	const isLast = saved.step === TUTORIAL_STEPS.length - 1;

	return (
		<section className="ui-tutorial" aria-live="polite" aria-label="Ministry induction">
			<header className="tut-head">
				<span className="ui-dymo">INDUCTION MEMO</span>
				<span className="tut-count">
					{saved.step + 1} / {TUTORIAL_STEPS.length}
				</span>
			</header>
			<h3 className="tut-title">{step.title}</h3>
			{step.body.map((p) => (
				<p key={p} className="tut-body">
					{p}
				</p>
			))}
			{step.task && (
				<div className={`tut-task ${satisfied ? "is-done" : ""}`}>
					<span className="tut-box" aria-hidden="true">
						{satisfied ? "✓" : ""}
					</span>
					<span>{step.task}</span>
					{satisfied && <span className="tut-stamp">APPROVED</span>}
				</div>
			)}
			<footer className="tut-actions">
				<button type="button" className="ui-btn tut-skip" onClick={skip}>
					Skip induction
				</button>
				<span className="ui-grow" />
				{saved.step > 0 && (
					<button type="button" className="ui-btn" onClick={back}>
						Back
					</button>
				)}
				{!step.task && (
					<button type="button" className="ui-btn is-on" onClick={next}>
						{isLast ? "File & close" : "Continue"}
					</button>
				)}
				{step.task && !satisfied && (
					<button type="button" className="ui-btn tut-later" onClick={next} title="Skip this task">
						Skip task
					</button>
				)}
			</footer>
		</section>
	);
}
