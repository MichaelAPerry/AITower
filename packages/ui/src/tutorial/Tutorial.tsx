import type { ContentDB } from "@aitower/content";
import type { GameState, GameStore } from "@aitower/shared";
import { useEffect, useRef, useState } from "react";
import type { UiState } from "../components/context";
import { applyClock, clockStatus, releaseClock } from "./clock";
import { centreBox, pickCorner, type Rect } from "./placement";
import { type Baseline, type ClockMode, type Corner, MEMO_EXPLAINER, needsMemoExplainer, stepClock, TUTORIAL_STEPS, type TutorialUi, baselineOf } from "./steps";

const STORAGE_KEY = "aitower.induction.v1";
/** Pause after a task is ticked off, so the player sees the APPROVED stamp before the next memo. */
const ADVANCE_MS = 1400;

interface Saved {
	step: number;
	done: boolean;
	/** The first-memo explainer has been shown. */
	memoExplained?: boolean;
}

function readSaved(): Saved {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) return JSON.parse(raw) as Saved;
	} catch {
		/* storage unavailable: start fresh */
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

/** Global hook so the menu and the title screen can restart or close the induction without prop drilling. */
const listeners = new Set<() => void>();
const notify = (): void => {
	for (const l of listeners) l();
};
export function restartInduction() {
	writeSaved({ step: 0, done: false });
	notify();
}
/** Close the induction for good (New game with the induction box unchecked). */
export function closeInduction() {
	writeSaved({ step: 0, done: true });
	notify();
}

const HL = "data-tut-target";

/** Mark exactly the elements the step points at (first match per selector). Uses an attribute, which React never rewrites. */
function syncHighlight(selectors: string[]): void {
	const root = document.querySelector(".aitower-hud");
	if (!root) return;
	const want = new Set<Element>();
	for (const sel of selectors) {
		const el = root.querySelector(sel);
		if (el) want.add(el);
	}
	for (const el of root.querySelectorAll(`[${HL}]`)) if (!want.has(el)) el.removeAttribute(HL);
	for (const el of want)
		if (!el.hasAttribute(HL)) {
			el.setAttribute(HL, "");
			el.scrollIntoView?.({ block: "nearest" });
		}
}

const toRect = (r: DOMRect): Rect => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });

export interface TutorialProps {
	store: GameStore;
	content: ContentDB;
	state: GameState;
	ui: UiState;
}

export function Tutorial({ store, content, state, ui }: TutorialProps) {
	const [saved, setSaved] = useState<Saved>(readSaved);
	const [completedAt, setCompletedAt] = useState<number | null>(null);
	const [corner, setCorner] = useState<Corner>("br");
	const baseline = useRef<Baseline | null>(null);
	const enteredStep = useRef<number>(-1);
	const clockMode = useRef<ClockMode | null>(null);
	const hadGhost = useRef(false);
	const memoRef = useRef<HTMLElement>(null);
	const ctx = { content };
	const tutUi: TutorialUi = { paletteTab: ui.paletteTab, bottomTab: ui.bottomTab, bottomOpen: ui.bottomOpen, tool: state.tool };

	useEffect(() => {
		const l = () => {
			baseline.current = null;
			enteredStep.current = -1;
			clockMode.current = null;
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
	const explaining = !!step && needsMemoExplainer(!!saved.memoExplained, saved.done, state.view.memos.length);
	const current = explaining ? MEMO_EXPLAINER : step;
	const finish = () => {
		update({ step: saved.step, done: true, memoExplained: saved.memoExplained });
		releaseClock(store);
	};
	const next = () => {
		const n = saved.step + 1;
		if (n >= TUTORIAL_STEPS.length) finish();
		else update({ ...saved, step: n, done: false });
	};
	const back = () => update({ ...saved, step: Math.max(0, saved.step - 1), done: false });
	const explained = () => {
		clockMode.current = null;
		update({ ...saved, memoExplained: true });
	};

	// Enter a step: capture its baseline, run side effects, move the camera.
	// biome-ignore lint/correctness/useExhaustiveDependencies: run once per step change; state, ctx and store are read at entry and must not re-trigger it
	useEffect(() => {
		if (!step || enteredStep.current === saved.step) return;
		enteredStep.current = saved.step;
		baseline.current = baselineOf(state, ctx);
		clockMode.current = null;
		setCompletedAt(null);
		step.onEnter?.(store);
		if (step.focus) store.focus(step.focus);
	}, [saved.step, step]);

	// Clock policy: applied on entry and whenever the step's wanted mode changes, never forced in between.
	const mode: ClockMode | null = current ? stepClock(current, state) : null;
	// biome-ignore lint/correctness/useExhaustiveDependencies: runs when the wanted mode or the step changes; a speed the player picks in between is deliberately left alone
	useEffect(() => {
		if (!mode) return;
		clockMode.current = applyClock(store, mode, clockMode.current);
	}, [mode, current?.id, saved.step]);

	// Ghost marking the spot in the world.
	const ghost = current?.ghost?.(state, tutUi) ?? null;
	const ghostKey = ghost ? JSON.stringify(ghost) : "";
	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the serialised ghost
	useEffect(() => {
		if (ghostKey) store.setGhost(JSON.parse(ghostKey));
		else if (hadGhost.current) store.setGhost(null);
		hadGhost.current = !!ghostKey;
	}, [ghostKey]);
	// biome-ignore lint/correctness/useExhaustiveDependencies: clear our ghost when the step changes or the memo goes away
	useEffect(
		() => () => {
			if (hadGhost.current) {
				store.setGhost(null);
				hadGhost.current = false;
			}
		},
		[current?.id],
	);

	// Spotlight the exact elements; move the memo away from them.
	const targets = current?.targets?.(state, tutUi) ?? [];
	// Runs every render on purpose: targets appear and disappear as panels change, and the work is idempotent.
	useEffect(() => {
		syncHighlight(targets);
		const area = document.querySelector(".aitower-hud .ui-center")?.getBoundingClientRect();
		const me = memoRef.current?.getBoundingClientRect();
		if (!area || !me || !current) return;
		const avoid: Rect[] = [];
		for (const el of document.querySelectorAll(`.aitower-hud [${HL}]`)) avoid.push(toRect(el.getBoundingClientRect()));
		for (const el of document.querySelectorAll(".aitower-hud .ui-memo-pop, .aitower-hud .ui-memo-drawer")) avoid.push(toRect(el.getBoundingClientRect()));
		if (current.focus || ghostKey) avoid.push(centreBox(toRect(area)));
		const c = pickCorner(current.corner ?? "br", toRect(area), { w: me.width, h: me.height }, avoid);
		setCorner((old) => (old === c ? old : c));
	});
	useEffect(
		() => () => {
			for (const el of document.querySelectorAll(`.aitower-hud [${HL}]`)) el.removeAttribute(HL);
		},
		[],
	);

	const satisfied = !explaining && !!step?.done && !!baseline.current && step.done(state, baseline.current, ctx);

	useEffect(() => {
		if (satisfied && completedAt === null) setCompletedAt(Date.now());
	}, [satisfied, completedAt]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: one-shot advance timer keyed on completedAt; `next` is recreated every render and must not restart it
	useEffect(() => {
		if (completedAt === null) return;
		const t = setTimeout(() => next(), ADVANCE_MS);
		return () => clearTimeout(t);
	}, [completedAt]);

	if (!step || !current) return null;

	const isLast = saved.step === TUTORIAL_STEPS.length - 1;
	const clock = clockStatus(mode ?? "pause", state.speed, current.runReason);
	const phase = current.phase?.(state, tutUi) ?? 0;

	return (
		<section ref={memoRef} className={`ui-tutorial pos-${corner}`} aria-live="polite" aria-label="Ministry induction" data-step={current.id}>
			<header className="tut-head">
				<span className="ui-dymo">{explaining ? "MINISTRY MEMO" : "INDUCTION MEMO"}</span>
				{!explaining && (
					<span className="tut-count">
						{saved.step + 1} / {TUTORIAL_STEPS.length}
					</span>
				)}
				<span className="ui-grow" />
				<button type="button" className="ui-btn tut-close" onClick={finish} title="Close the induction for good (RESTART INDUCTION in the menu brings it back)">
					✕ CLOSE
				</button>
			</header>
			<h3 className="tut-title">{current.title}</h3>
			{current.body.map((p) => (
				<p key={p} className="tut-body">
					{p}
				</p>
			))}
			{!explaining && step.task && (
				<div className={`tut-task ${satisfied ? "is-done" : ""}`}>
					<span className="tut-box" aria-hidden="true">
						{satisfied ? "✓" : ""}
					</span>
					<span>
						<b className="tut-todo">YOUR TASK:</b> {step.task}
					</span>
					{satisfied && <span className="tut-stamp">APPROVED</span>}
				</div>
			)}
			{!explaining && step.how && !satisfied && (
				<ol className="tut-how">
					{step.how.map((h, i) => (
						<li key={h} className={i < phase ? "is-past" : i === phase ? "is-now" : ""}>
							{h}
						</li>
					))}
				</ol>
			)}
			<div className={`tut-clock ${clock.running ? "is-running" : "is-stopped"}`} role="status">
				<span className="tut-clock-lamp" aria-hidden="true" />
				{clock.text}
			</div>
			<footer className="tut-actions">
				{!explaining && (
					<button type="button" className="ui-btn tut-skip" onClick={finish}>
						Skip induction
					</button>
				)}
				<span className="ui-grow" />
				{!explaining && saved.step > 0 && (
					<button type="button" className="ui-btn" onClick={back}>
						Back
					</button>
				)}
				{explaining && (
					<button type="button" className="ui-btn is-on" onClick={explained}>
						Understood
					</button>
				)}
				{!explaining && !step.task && (
					<button type="button" className="ui-btn is-on" onClick={next}>
						{isLast ? "File & close" : "Continue"}
					</button>
				)}
				{!explaining && step.task && !satisfied && (
					<button type="button" className="ui-btn tut-later" onClick={next} title="Skip this task">
						Skip task
					</button>
				)}
			</footer>
		</section>
	);
}
