import type { ContentDB } from "@aitower/content";
import type { GameState, GameStore } from "@aitower/shared";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { UiState } from "../components/context";
import { applyClock, releaseClock } from "./clock";
import { type Placed, placeBubble, type Rect, type Side } from "./placement";
import { activeHint, type Baseline, baselineOf, type ClockMode, HINTS, type HintId, type HintsSeen, hotRack, TUTORIAL_STEPS, type TutorialUi } from "./steps";
import "./coach.css";

const STORAGE_KEY = "aitower.induction.v2";
const HINTS_KEY = "aitower.hints.v1";
/** Pause after the action is done, so the player sees the tick before the next bubble. */
const ADVANCE_MS = 700;

interface Saved {
	step: number;
	done: boolean;
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

function readHints(): HintsSeen {
	try {
		const raw = localStorage.getItem(HINTS_KEY);
		if (raw) return JSON.parse(raw) as HintsSeen;
	} catch {
		/* storage unavailable: show the hints */
	}
	return {};
}

function writeHints(h: HintsSeen) {
	try {
		localStorage.setItem(HINTS_KEY, JSON.stringify(h));
	} catch {
		/* best effort */
	}
}

/** Global hook so the menu and the title screen can restart or close the tutorial without prop drilling. */
const listeners = new Set<() => void>();
const notify = (): void => {
	for (const l of listeners) l();
};
export function restartInduction() {
	writeSaved({ step: 0, done: false });
	notify();
}
/** Close the tutorial for good (New game with the tutorial box unchecked). */
export function closeInduction() {
	writeSaved({ step: 0, done: true });
	notify();
}

const HL = "data-tut-target";

/** Pulse exactly the elements the step points at (first match per selector); returns the first one found. */
function syncHighlight(selectors: string[]): Element | null {
	const root = document.querySelector(".aitower-hud");
	if (!root) return null;
	const want = new Set<Element>();
	let first: Element | null = null;
	for (const sel of selectors) {
		const el = root.querySelector(sel);
		if (el) {
			want.add(el);
			first ??= el;
		}
	}
	for (const el of root.querySelectorAll(`[${HL}]`)) if (!want.has(el)) el.removeAttribute(HL);
	for (const el of want)
		if (!el.hasAttribute(HL)) {
			el.setAttribute(HL, "");
			el.scrollIntoView?.({ block: "nearest" });
		}
	return first;
}

export interface TutorialProps {
	store: GameStore;
	content: ContentDB;
	state: GameState;
	ui: UiState;
	setUi: (patch: Partial<UiState>) => void;
}

interface Bubble {
	id: string;
	text: string;
	targets: string[];
	sides: Side[];
	/** Step counter ("2 of 5"), absent for hints. */
	count?: string;
	onGotIt?: () => void;
	done: boolean;
}

export function Tutorial({ store, content, state, ui, setUi }: TutorialProps) {
	const [saved, setSaved] = useState<Saved>(readSaved);
	const [seen, setSeen] = useState<HintsSeen>(readHints);
	const [completedAt, setCompletedAt] = useState<number | null>(null);
	const baseline = useRef<Baseline | null>(null);
	const enteredStep = useRef<number>(-1);
	const clockMode = useRef<ClockMode | null>(null);
	const hadGhost = useRef(false);
	const openedByUs = useRef(false);
	const uiRef = useRef(ui);
	uiRef.current = ui;
	const ctx = { content };
	const tutUi: TutorialUi = { paletteTab: ui.paletteTab, drawer: ui.drawer, paletteOpen: ui.paletteOpen, tool: state.tool };

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
	const hintId: HintId | null = activeHint(state, seen, ctx);
	const dismissHint = (id: HintId) => {
		const n = { ...seen, [id]: true };
		writeHints(n);
		setSeen(n);
	};
	// Opening the inbox is what the memo hint asks for: it has done its job.
	useEffect(() => {
		if (hintId === "memo" && ui.inboxOpen) dismissHint("memo");
	});
	// Point the camera at the hot rack once, when its hint first shows.
	const hotId = hintId === "heat" ? hotRack(state, ctx) : undefined;
	// biome-ignore lint/correctness/useExhaustiveDependencies: focus once per hint
	useEffect(() => {
		if (hotId) store.focus({ x: hotId.x, floor: hotId.floor });
	}, [hotId?.id]);

	const step = saved.done ? undefined : TUTORIAL_STEPS[saved.step];
	const finish = () => {
		update({ step: saved.step, done: true });
		releaseClock(store);
	};
	const next = () => {
		const n = saved.step + 1;
		if (n >= TUTORIAL_STEPS.length) finish();
		else update({ step: n, done: false });
	};
	const back = () => update({ step: Math.max(0, saved.step - 1), done: false });

	// Enter a step: capture its baseline, run side effects, move the camera.
	// biome-ignore lint/correctness/useExhaustiveDependencies: run once per step change; state, ctx and store are read at entry and must not re-trigger it
	useEffect(() => {
		if (!step || enteredStep.current === saved.step) return;
		enteredStep.current = saved.step;
		baseline.current = baselineOf(state, ctx);
		clockMode.current = null;
		setCompletedAt(null);
		openedByUs.current = step.id === "accept" && uiRef.current.drawer !== "contracts";
		step.onEnter?.(store, setUi);
		if (step.focus) store.focus(step.focus);
	}, [saved.step, step]);

	// Clock policy: applied on entry and whenever the step changes, never forced in between.
	const mode: ClockMode | null = step ? step.clock : null;
	// biome-ignore lint/correctness/useExhaustiveDependencies: runs when the step changes; a speed the player picks in between is deliberately left alone
	useEffect(() => {
		if (!mode) return;
		clockMode.current = applyClock(store, mode, clockMode.current);
	}, [mode, step?.id]);

	// Ghost marking the spot in the world (only while a step shows it).
	const ghost = !hintId ? (step?.ghost?.(state, tutUi) ?? null) : null;
	const ghostKey = ghost ? JSON.stringify(ghost) : "";
	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the serialised ghost
	useEffect(() => {
		if (ghostKey) store.setGhost(JSON.parse(ghostKey));
		else if (hadGhost.current) store.setGhost(null);
		hadGhost.current = !!ghostKey;
	}, [ghostKey]);
	// biome-ignore lint/correctness/useExhaustiveDependencies: clear our ghost when the step changes
	useEffect(
		() => () => {
			if (hadGhost.current) {
				store.setGhost(null);
				hadGhost.current = false;
			}
		},
		[step?.id],
	);

	const satisfied = !hintId && !!step?.done && !!baseline.current && step.done(state, baseline.current, ctx);
	useEffect(() => {
		if (satisfied && completedAt === null) setCompletedAt(Date.now());
	}, [satisfied, completedAt]);
	// biome-ignore lint/correctness/useExhaustiveDependencies: one-shot advance timer keyed on completedAt; `next` is recreated every render and must not restart it
	useEffect(() => {
		if (completedAt === null) return;
		const t = setTimeout(() => {
			// The drawer the tutorial opened for the accept step closes again so the world is visible.
			if (step?.id === "accept" && openedByUs.current && uiRef.current.drawer === "contracts") setUi({ drawer: null });
			next();
		}, step?.linger ?? ADVANCE_MS);
		return () => clearTimeout(t);
	}, [completedAt]);

	// What the bubble says now: a hint interrupts the steps.
	let bubble: Bubble | null = null;
	if (hintId) {
		const h = HINTS[hintId];
		bubble = { id: `hint-${h.id}`, text: h.text, targets: h.targets, sides: h.sides, onGotIt: () => dismissHint(h.id), done: false };
	} else if (step) {
		bubble = {
			id: step.id,
			text: satisfied && step.doneText ? step.doneText : step.text(state, tutUi),
			targets: step.targets(state, tutUi),
			sides: step.sides ?? ["below"],
			count: `${saved.step + 1} of ${TUTORIAL_STEPS.length}`,
			onGotIt: step.done ? undefined : next,
			done: satisfied,
		};
	}

	// Pulse the targets; place the bubble next to the first one.
	const bubbleRef = useRef<HTMLElement>(null);
	const [placed, setPlaced] = useState<(Placed & { key: string }) | null>(null);
	const targetsKey = bubble ? bubble.targets.join("|") : "";
	const measure = useCallback(() => {
		const el = bubbleRef.current;
		const center = document.querySelector(".aitower-hud .ui-center");
		if (!bubble || !el || !center) return;
		const first = syncHighlight(bubble.targets);
		const cr = center.getBoundingClientRect();
		const scale = center.clientWidth > 0 ? cr.width / center.clientWidth : 1;
		const local = (r: DOMRect): Rect => ({ left: (r.left - cr.left) / scale, top: (r.top - cr.top) / scale, right: (r.right - cr.left) / scale, bottom: (r.bottom - cr.top) / scale });
		const bounds: Rect = { left: 8, top: 8, right: center.clientWidth - 8, bottom: center.clientHeight - 8 };
		// No element to point at (a spot in the world): float above the middle of the world.
		const cx = center.clientWidth / 2;
		const cy = center.clientHeight / 2;
		const target = first ? local(first.getBoundingClientRect()) : { left: cx - 20, top: cy - 20, right: cx + 20, bottom: cy + 20 };
		const p = placeBubble(target, { w: el.offsetWidth, h: el.offsetHeight }, bounds, bubble.sides);
		const key = `${bubble.id}|${Math.round(p.left)}|${Math.round(p.top)}|${p.side}|${Math.round(p.arrow)}`;
		setPlaced((old) => (old?.key === key ? old : { ...p, key }));
	}, [bubble]);
	// Runs every render on purpose: targets appear and move as panels open, and the work is idempotent.
	useLayoutEffect(measure);
	// biome-ignore lint/correctness/useExhaustiveDependencies: re-measure on resize and on a slow tick (drawers slide in)
	useEffect(() => {
		window.addEventListener("resize", measure);
		const iv = setInterval(measure, 400);
		return () => {
			window.removeEventListener("resize", measure);
			clearInterval(iv);
		};
	}, [measure, targetsKey]);
	useEffect(
		() => () => {
			for (const el of document.querySelectorAll(`.aitower-hud [${HL}]`)) el.removeAttribute(HL);
		},
		[],
	);

	if (!bubble) return null;
	return (
		<section
			ref={bubbleRef}
			className={`ui-coach side-${placed?.side ?? "below"} ${bubble.done ? "is-done" : ""} ${placed ? "is-placed" : ""}`}
			style={placed ? { left: placed.left, top: placed.top, "--arrow": `${placed.arrow}px` } as React.CSSProperties : undefined}
			aria-live="polite"
			aria-label="Tutorial"
			data-step={bubble.id}
		>
			<p className="coach-text">
				{bubble.done && (
					<span className="coach-tick" aria-hidden="true">
						✓{" "}
					</span>
				)}
				{bubble.text}
			</p>
			<footer className="coach-actions">
				{bubble.count && <span className="coach-count">{bubble.count}</span>}
				{bubble.count && saved.step > 0 && (
					<button type="button" className="coach-link" onClick={back}>
						Back
					</button>
				)}
				{bubble.count && (
					<button type="button" className="coach-link" onClick={finish}>
						Skip tutorial
					</button>
				)}
				<span className="ui-grow" />
				{bubble.onGotIt && (
					<button type="button" className="ui-btn is-on coach-ok" onClick={bubble.onGotIt}>
						Got it
					</button>
				)}
			</footer>
		</section>
	);
}
