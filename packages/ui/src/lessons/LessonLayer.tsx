import type { AdvisorId, ContentDB, LessonDef } from "@aitower/content";
import { type GameState, type GameStore, recordLesson } from "@aitower/shared";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ADVISORS } from "../advisors/advisors";
import { Say } from "../advisors/AdvisorStrip";
import { Portrait } from "../advisors/Portrait";
import type { PanelProps, UiState } from "../components/context";
import { type Ack, articleTitle, baselineAck, goalModel, lessonDefOf, nextLessonOf, pendingMessage, resultModel, slotGhost, stepOf, stepPulse } from "./lessons";
import "./lessons.css";

const HL = "data-lesson-pulse";

/** Pulse exactly the elements the current step points at. */
function syncPulse(selectors: string[]): void {
	const root = document.querySelector(".aitower-hud");
	if (!root) return;
	const want = new Set<Element>();
	for (const sel of selectors) {
		const el = root.querySelector(sel);
		if (el) want.add(el);
	}
	for (const el of root.querySelectorAll(`[${HL}]`)) if (!want.has(el)) el.removeAttribute(HL);
	for (const el of want) if (!el.hasAttribute(HL)) el.setAttribute(HL, "");
}

export interface LessonArgs {
	store: GameStore;
	content: ContentDB;
	state: GameState;
	ui: UiState;
	setUi: PanelProps["setUi"];
	/** False while the title screen, the opening crawl or a game-over notice is up. */
	enabled: boolean;
	onFreeBuild: () => void;
	onReplay: (lessonScenario: string) => void;
}

export interface LessonUi {
	/** A lesson is running (or showing its result). */
	active: boolean;
	advisor: AdvisorId | undefined;
	/** The teacher's line for the advisor strip, or null outside a lesson. */
	teacher: ReactNode | null;
	/** Drawers the lesson has opened so far (the Handbook is always open). */
	drawers: string[];
	/** Goal bar, checklist and result screen. */
	layer: ReactNode | null;
}

/**
 * The lesson controller: owns the teacher's pacing (which line is up, when the clock stops and restarts), the slot highlight
 * and the persisted progress. The sim decides everything else (`state.view.lesson`).
 */
export function useLesson({ store, content, state, ui, setUi, enabled, onFreeBuild, onReplay }: LessonArgs): LessonUi {
	const view = state.view;
	const lv = view.lesson;
	const def = lessonDefOf(content, view);
	const [ack, setAck] = useState<Ack>({});
	const lastTick = useRef(-1);
	const seeded = useRef(false);
	const [firstTime, setFirstTime] = useState(false);
	const recorded = useRef<string | null>(null);

	// A game loaded mid-lesson, or a new lesson (the tick went backwards): start from what is already behind the player.
	useEffect(() => {
		if (!lv || !def) {
			seeded.current = false;
			return;
		}
		if (!seeded.current || view.tick < lastTick.current) {
			seeded.current = true;
			setAck(baselineAck(def, lv));
		}
		lastTick.current = view.tick;
	}, [lv, def, view.tick]);

	const active = lv?.status === "active";
	const msg = enabled && def && lv && active ? pendingMessage(def, lv, ack) : null;

	// The clock stops while a teacher line is up.
	const msgKey = msg ? `${msg.key}:${msg.n}` : null;
	// biome-ignore lint/correctness/useExhaustiveDependencies: stop once when a pausing line appears or the clock is restarted under it
	useEffect(() => {
		if (msg?.pause && state.speed !== 0) store.setSpeed(0);
	}, [msgKey, state.speed]);

	const runClock = useCallback(
		(next: Ack) => {
			if (def && lv && !pendingMessage(def, lv, next) && store.get().speed === 0 && !store.get().view.decision) store.setSpeed(def.speed);
		},
		[def, lv, store],
	);
	const cont = (): void => {
		if (!msg || !def || !lv) return;
		const next = { ...ack, [msg.key]: msg.n };
		setAck(next);
		runClock(next);
	};

	// The step's overlay (the Power overlay lights up when the generator step begins).
	const stepId = def && lv && active ? stepOf(def, lv)?.id : null;
	const overlay = def && lv && active ? stepOf(def, lv)?.overlay : undefined;
	const prevStep = useRef<string | null | undefined>(undefined);
	// biome-ignore lint/correctness/useExhaustiveDependencies: only when the step changes
	useEffect(() => {
		if (overlay && enabled) store.setOverlay(overlay);
		// A finished step puts the tool down and closes the catalog, so the next step starts from a quiet screen.
		if (prevStep.current !== undefined && prevStep.current !== stepId && enabled) {
			store.setTool({ kind: "select" });
			setUi({ paletteOpen: false, buildHover: null });
		}
		prevStep.current = stepId;
	}, [stepId]);

	// The blueprint slot and the pulse on the next thing to click.
	const ghost = useMemo(() => (def && lv && enabled ? slotGhost(def, lv, content) : null), [def, lv, content, enabled]);
	const ghostKey = ghost ? JSON.stringify(ghost) : null;
	const tool = state.tool;
	// biome-ignore lint/correctness/useExhaustiveDependencies: re-apply when the slot or the armed tool changes
	useEffect(() => {
		if (!ghost) return;
		// While the pointer is over the world the tool's own ghost follows it; otherwise the slot stays marked.
		const apply = (): void => {
			const over = document.querySelector("canvas")?.matches(":hover");
			if (!over) store.setGhost(ghost);
		};
		apply();
		const iv = setInterval(apply, 350);
		return () => {
			clearInterval(iv);
			store.setGhost(null);
		};
	}, [ghostKey, tool.kind === "place" ? tool.defId : tool.kind]);
	const curStep = def && lv && active ? def.steps[lv.current] : undefined;
	// A step that asks for a panel counts the act of opening it (the sim cannot see the UI): mark a tip the step waits for.
	const wantsTrees = curStep?.panel === "trees";
	const tipId = curStep ? `les:${curStep.id}` : null;
	// biome-ignore lint/correctness/useExhaustiveDependencies: when the panel opens during its step
	useEffect(() => {
		if (wantsTrees && ui.trees && tipId && enabled) store.submit({ type: "markTip", tipId });
	}, [wantsTrees, ui.trees, tipId, enabled]);
	const slot = curStep?.slot ?? curStep?.focus;
	const slotX = slot?.x;
	const slotFloor = slot?.floor;
	useEffect(() => {
		if (slotX !== undefined && slotFloor !== undefined && enabled) store.focus({ x: slotX, floor: slotFloor });
	}, [slotX, slotFloor, enabled, store]);
	const pulse = def && lv && enabled && !msg ? stepPulse(def, lv, content, ui).join("|") : "";
	useEffect(() => {
		syncPulse(pulse ? pulse.split("|") : []);
		return () => syncPulse([]);
	}, [pulse]);

	// A finished lesson stops the clock and records its stars once.
	const done = lv && lv.status !== "active" ? `${lv.id}:${lv.status}:${lv.endTick}` : null;
	// biome-ignore lint/correctness/useExhaustiveDependencies: once per finish
	useEffect(() => {
		if (!done || !lv || !enabled) return;
		store.setSpeed(0);
		store.setTool({ kind: "select" });
		setUi({ paletteOpen: false, buildHover: null });
		if (lv.status === "won" && recorded.current !== done) {
			recorded.current = done;
			setFirstTime(recordLesson(lv.id, lv.stars).first);
		}
	}, [done, enabled]);

	if (!lv || !def) return { active: false, advisor: undefined, teacher: null, drawers: [], layer: null };
	const step = stepOf(def, lv);
	const speaker = msg?.advisor ?? step?.advisor ?? def.advisor;
	const adv = ADVISORS[speaker];
	const handbookTarget = step?.handbook ?? def.handbook[0];
	const openHandbook = (id: string): void => setUi({ drawer: "handbook", encyId: id, paletteOpen: false, buildHover: null });
	const last = msg ? msg.n === msg.of : false;

	const teacher = active ? (
		<div className="adv-tip les-teacher" style={{ ["--adv" as string]: adv.color }} data-lesson-teacher>
			<b className="adv-who">{adv.first}</b>
			<div className="adv-body">
				<p className="adv-text">
					<Say text={msg ? msg.line : (step?.text ?? def.goal)} />
				</p>
				<span className="adv-acts">
					{msg && (
						<button type="button" className="ui-btn is-on adv-go" data-lesson-continue onClick={cont}>
							{last ? "Got it" : "Next"}
						</button>
					)}
					{msg && msg.of > 1 && <span className="les-count">{msg.n} / {msg.of}</span>}
					{handbookTarget && (
						<button type="button" className="adv-link" onClick={() => openHandbook(handbookTarget)}>
							Handbook: {articleTitle(content, handbookTarget)}
						</button>
					)}
				</span>
			</div>
		</div>
	) : null;

	const layer = enabled ? (
		<>
			{active && <GoalBar def={def} lv={lv} total={content.lessons.length} onSkip={onFreeBuild} onHandbook={() => handbookTarget && openHandbook(handbookTarget)} />}
			{active && <Steps content={content} def={def} lv={lv} onHandbook={openHandbook} />}
			{!active && <LessonResult content={content} def={def} lv={lv} firstTime={firstTime} openHandbook={openHandbook} onReplay={() => onReplay(def.scenario)} onNext={onReplay} onFreeBuild={onFreeBuild} />}
		</>
	) : null;
	return { active: true, advisor: speaker, teacher, drawers: active ? lv.drawers : [], layer };
}

function GoalBar({ def, lv, total, onSkip, onHandbook }: { def: LessonDef; lv: NonNullable<GameState["view"]["lesson"]>; total: number; onSkip: () => void; onHandbook: () => void }) {
	const g = goalModel(lv);
	return (
		<section className="les-goal ui-glass" aria-label="Lesson goal" data-lesson-goal>
			<div className="les-goal-head">
				<span className="ui-label">
					LESSON {def.number} OF {total} · {def.title.toUpperCase()}
				</span>
				<span className="les-goal-text">{def.goal}</span>
			</div>
			{def.meter && (
			<div className={`les-meter tone-${g.tone}`} role="img" aria-label={`Load ${Math.round(g.loadKw)} kilowatts of ${Math.round(g.capacityKw)} kilowatts capacity`}>
				<div className="les-meter-line">
					<span>
						<span className="ui-label">LOAD</span> <b>{Math.round(g.loadKw)} kW</b>
					</span>
					<span>
						<span className="ui-label">CAPACITY</span> <b>{Math.round(g.capacityKw)} kW</b>
					</span>
					<span>
						<span className="ui-label">HEADROOM</span> <b>{g.capacityKw > 0 ? `${Math.round(g.headroomPct)}%` : "none"}</b>
					</span>
					<span>
						<span className="ui-label">PUE</span> <b>{g.pue > 0 ? g.pue.toFixed(2) : "none"}</b>
					</span>
				</div>
				<div className="les-bar">
					<i style={{ width: `${Math.round(g.frac * 100)}%` }} />
				</div>
			</div>
			)}
			{def.holdLabel && (
				<div className="les-hold" title={def.goal}>
					<span className="ui-label">{def.holdLabel.toUpperCase()}</span>
					<div className="les-bar is-hold">
						<i style={{ width: `${Math.round(g.hold * 100)}%` }} />
					</div>
					<small>{g.holdText}</small>
				</div>
			)}
			<div className="les-goal-acts">
				<button type="button" className="ui-btn" onClick={onHandbook}>
					Handbook
				</button>
				<button type="button" className="ui-btn les-skip" onClick={onSkip} title="Leave the lesson and start a Free Build game">
					Skip lesson
				</button>
			</div>
		</section>
	);
}

function Steps({ content, def, lv, onHandbook }: { content: ContentDB; def: LessonDef; lv: NonNullable<GameState["view"]["lesson"]>; onHandbook: (id: string) => void }) {
	return (
		<section className="les-steps ui-glass" aria-label="Lesson steps" data-lesson-steps>
			<h3 className="ui-label">STEPS</h3>
			<ol>
				{def.steps.map((s, i) => {
					const done = lv.stepsDone.includes(s.id);
					return (
						<li key={s.id} className={done ? "is-done" : i === lv.current ? "is-now" : ""}>
							<span className="les-tick" aria-hidden="true">
								{done ? "✓" : i + 1}
							</span>
							<span>{s.text}</span>
						</li>
					);
				})}
			</ol>
			{def.handbook[0] && (
				<button type="button" className="adv-link" onClick={() => onHandbook(def.handbook[0])}>
					Handbook: {articleTitle(content, def.handbook[0])}
				</button>
			)}
		</section>
	);
}

function Stars({ n }: { n: number }) {
	return (
		<span className="les-stars" role="img" aria-label={`${n} of 3 stars`}>
			{[1, 2, 3].map((i) => (
				<b key={i} className={i <= n ? "is-on" : ""}>
					★
				</b>
			))}
		</span>
	);
}

function LessonResult({ content, def, lv, firstTime, openHandbook, onReplay, onNext, onFreeBuild }: { content: ContentDB; def: LessonDef; lv: NonNullable<GameState["view"]["lesson"]>; firstTime: boolean; openHandbook: (id: string) => void; onReplay: () => void; onNext: (scenario: string) => void; onFreeBuild: () => void }) {
	const r = resultModel(def, lv, firstTime, (id) => articleTitle(content, id));
	const nextLesson = r.won ? nextLessonOf(content, def) : undefined;
	const adv = ADVISORS[def.advisor];
	return (
		<div className="les-result-back">
			<section className="les-result ui-panel" role="dialog" aria-modal="true" aria-label={r.won ? "Lesson complete" : "Lesson failed"} data-lesson-result style={{ ["--adv" as string]: adv.color }}>
				<span className="ui-label">
					LESSON {def.number} · {def.title.toUpperCase()}
				</span>
				<h2>{r.won ? "Lesson complete" : "Not this time"}</h2>
				{r.won && r.starred && <Stars n={r.stars} />}
				{r.won && (
					<ul className="les-rows">
						{r.rows.map((x) => (
							<li key={x.label} className={x.earned ? "is-on" : ""}>
								<span className="les-star-dot" aria-hidden="true">
									{x.earned ? "★" : "☆"}
								</span>
								<b>{x.label}</b>
								<span>{x.value}</span>
							</li>
						))}
					</ul>
				)}
				<p className="les-learned">
					<b>What you learned.</b> <Say text={r.learned} />
				</p>
				<div className="les-links">
					{r.handbook.map((h) => (
						<button key={h.id} type="button" className="adv-link" onClick={() => openHandbook(h.id)}>
							Handbook: {h.label}
						</button>
					))}
				</div>
				<div className="les-outro">
					<Portrait id={def.advisor} size={40} talking />
					<p>{r.won ? def.outro : "The lesson ran out of money before it ran out of day. Have another go; the numbers are the same."}</p>
				</div>
				{r.bonus > 0 && <p className="les-bonus">+${r.bonus.toLocaleString("en-US")} starting cash in every Free Build game from now on.</p>}
				<div className="les-result-acts">
					<button type="button" className="ui-btn" onClick={onReplay}>
						{r.won ? "Replay lesson" : "Try again"}
					</button>
					{nextLesson && (
						<button type="button" className="ui-btn is-on" onClick={() => onNext(nextLesson.scenario)} data-lesson-next>
							Next lesson: {nextLesson.title}
						</button>
					)}
					<button type="button" className={`ui-btn ${nextLesson ? "" : "is-on"}`} onClick={onFreeBuild} data-lesson-freebuild>
						Free Build
					</button>
				</div>
			</section>
		</div>
	);
}
