import type { AdvisorId } from "@aitower/content";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { findItem } from "../build/catalog";
import type { PanelProps } from "../components/context";
import { Term } from "../glossary/Term";
import { fmtDuration } from "../format";
import { cheapestAvailable } from "../research/tech";
import { type HeatWatch, initialHeatWatch, watchHeat } from "../objective/heat";
import { ADVISORS, ADVISOR_ORDER, parseMarkup } from "./advisors";
import { Portrait } from "./Portrait";
import type { AdvisorAction, HandbookLink } from "./suggest";
import { type Line, TIP_GAP_MS, TIP_SHOW_MS, answerFor, nextTip, tipCandidates } from "./talk";
import "./advisors.css";

/** Text with {{term|label}} markers: Terms are underlined and link to the Handbook. */
export function Say({ text }: { text: string }): ReactNode {
	return (
		<>
			{parseMarkup(text).map((g, i) =>
				"term" in g ? (
					// biome-ignore lint/suspicious/noArrayIndexKey: static segments
					<Term key={i} id={g.term}>
						{g.text}
					</Term>
				) : (
					// biome-ignore lint/suspicious/noArrayIndexKey: static segments
					<span key={i}>{g.text}</span>
				),
			)}
		</>
	);
}

/** Carry out a line's action in the HUD. */
export function runAction(a: AdvisorAction, p: Pick<PanelProps, "store" | "content" | "setUi" | "openResearch" | "openAscension">): void {
	const { store, content, setUi } = p;
	if ("focus" in a && a.focus) store.focus(a.focus);
	switch (a.kind) {
		case "build": {
			const item = findItem(a.defId, content);
			if (!item) return;
			setUi({ paletteOpen: true, paletteTab: item.category, drawer: null, buildHover: null });
			store.setTool(item.tool);
			return;
		}
		case "lift":
			setUi({ paletteOpen: true, paletteTab: "structure", drawer: null, buildHover: null });
			store.setTool({ kind: "lift" });
			return;
		case "supplies":
			setUi({ paletteOpen: true, paletteTab: "supplies", drawer: null, buildHover: null });
			return;
		case "drawer":
			setUi({ drawer: a.drawer, paletteOpen: false, buildHover: null });
			return;
		case "research":
			p.openResearch(a.techId ?? cheapestAvailable(store.get().view, content)?.id);
			return;
		case "ascension":
			p.openAscension();
			return;
		case "dossier":
			setUi({ dossier: true, paletteOpen: false, drawer: null, buildHover: null });
			return;
	}
}

/** Ticks of the first game day, in which only urgent problems may speak. */
const FIRST_DAY = 1440;


function HandbookChips({ links, setUi }: { links: HandbookLink[]; setUi: PanelProps["setUi"] }) {
	return (
		<>
			{links.map((l) => (
				<button key={l.entry} type="button" className="adv-link" onClick={() => setUi({ drawer: "handbook", encyId: l.entry, paletteOpen: false, buildHover: null })}>
					Handbook: {l.label}
				</button>
			))}
		</>
	);
}

/** One advisor line with its actions. */
function LineBody({ line, props, onDone }: { line: Line; props: PanelProps; onDone?: () => void }) {
	return (
		<div className="adv-body">
			<p className="adv-text">
				<Say text={line.text} />
			</p>
			<span className="adv-acts">
				{line.action && line.cta && (
					<button
						type="button"
						className="ui-btn is-on adv-go"
						onClick={() => {
							if (line.action) runAction(line.action, props);
							onDone?.();
						}}
					>
						{line.cta}
					</button>
				)}
				<HandbookChips links={line.links} setUi={props.setUi} />
			</span>
		</div>
	);
}

/**
 * The advisor strip: one docked strip at the bottom of the world with four portrait buttons and at most one line.
 *  - Tips (non-blocking): a real condition shows one line for ~20 real seconds, then collapses to a dot on the portrait.
 *    Each concept fires once per game (saved with the game via `markTip`). Never stacks; a tip waits for a quiet gap.
 *  - Ask: clicking a portrait answers from that advisor's area with live numbers (ranked), with Handbook links.
 * Decisions are not here: they open a card of their own and pause the game.
 */
export function AdvisorStrip(props: PanelProps & { /** A lesson's teacher speaks in the strip instead of the tips. */ teacher?: ReactNode; teacherAdvisor?: AdvisorId }) {
	const { store, content, state, teacher, teacherAdvisor } = props;
	const view = state.view;
	const tipsOn = state.settings.advisorTips !== false && !teacher;
	const [shown, setShown] = useState<Line | null>(null);
	const [chips, setChips] = useState<Partial<Record<AdvisorId, Line>>>({});
	const [asking, setAsking] = useState<AdvisorId | null>(null);
	const lastEnd = useRef(Number.NEGATIVE_INFINITY);
	const firedLocal = useRef(new Set<string>());
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Heat tips wait for the heat to last (HeatWatch), so a momentary blip over the line stays quiet.
	const heat = useRef<HeatWatch>(initialHeatWatch());
	const candidates = useMemo(() => {
		heat.current = watchHeat(heat.current, view, content);
		// The first game day stays quiet: only real problems may interrupt it.
		return tipCandidates(view, content, heat.current.confirmed).filter((l) => l.urgent || view.tick >= FIRST_DAY);
	}, [view, content]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: `shown` refreshes the set after a tip is added to the local ref
	const fired = useMemo(() => new Set([...view.advisorTips, ...firedLocal.current]), [view.advisorTips, shown]);
	const decisionOpen = view.decision !== null;

	const collapse = useCallback((line: Line, keepChip: boolean) => {
		if (timer.current) clearTimeout(timer.current);
		timer.current = null;
		lastEnd.current = Date.now();
		setShown(null);
		if (keepChip) setChips((c) => ({ ...c, [line.advisor]: line }));
	}, []);

	// Show the next tip when it is quiet: no decision, no lesson, nothing on screen, not asking, and a gap since the last one.
	useEffect(() => {
		if (!tipsOn || decisionOpen || asking || shown) return;
		if (Date.now() - lastEnd.current < TIP_GAP_MS) return;
		const next = nextTip(candidates, fired, null);
		if (!next) return;
		firedLocal.current.add(next.id);
		store.dispatch({ type: "markTip", tipId: next.id });
		setShown(next);
		setChips((c) => ({ ...c, [next.advisor]: undefined }));
		timer.current = setTimeout(() => collapse(next, true), TIP_SHOW_MS);
	}, [tipsOn, decisionOpen, asking, shown, candidates, fired, store, collapse]);

	// The gap is real time, so poll lightly while a tip is waiting for its turn.
	const [, bump] = useState(0);
	const waiting = tipsOn && !shown && !asking && !decisionOpen && nextTip(candidates, fired, null) !== null;
	useEffect(() => {
		if (!waiting) return;
		const iv = setInterval(() => bump((n) => n + 1), 1500);
		return () => clearInterval(iv);
	}, [waiting]);

	// A problem tip that has resolved itself leaves quietly (no chip: there is nothing left to say).
	useEffect(() => {
		if (shown?.urgent && !candidates.some((c) => c.id === shown.id)) collapse(shown, false);
	}, [shown, candidates, collapse]);
	useEffect(
		() => () => {
			if (timer.current) clearTimeout(timer.current);
		},
		[],
	);

	// A decision opening clears the strip: nothing competes with the card.
	useEffect(() => {
		if (decisionOpen) {
			if (shown) collapse(shown, true);
			setAsking(null);
		}
	}, [decisionOpen, shown, collapse]);

	const ask = (id: AdvisorId): void => {
		if (shown) collapse(shown, true);
		setChips((c) => ({ ...c, [id]: undefined }));
		setAsking((a) => (a === id ? null : id));
	};
	useEffect(() => {
		if (!asking) return;
		// Capture phase: Esc closes the answer and goes no further (it must not also open the system menu).
		const onKey = (e: KeyboardEvent): void => {
			if (e.key !== "Escape") return;
			e.stopImmediatePropagation();
			setAsking(null);
		};
		window.addEventListener("keydown", onKey, true);
		return () => window.removeEventListener("keydown", onKey, true);
	}, [asking]);

	const answer = asking ? answerFor(asking, view, content, heat.current.confirmed) : null;
	const speaking = teacherAdvisor ?? shown?.advisor ?? null;

	return (
		<aside className="adv-strip" data-help="advisors" aria-label="Advisors">
			{answer && asking && (
				<section className="adv-ask ui-panel" aria-live="polite" style={{ ["--adv" as string]: ADVISORS[asking].color }}>
					<header className="adv-ask-head">
						<Portrait id={asking} size={34} talking />
						<div>
							<b>{ADVISORS[asking].name}</b>
							<small>{ADVISORS[asking].role}</small>
						</div>
						<button type="button" className="ui-btn adv-x" aria-label="Close" onClick={() => setAsking(null)}>
							×
						</button>
					</header>
					<ol className="adv-ranked">
						{answer.lines.map((l) => (
							<li key={l.id}>
								<LineBody line={l} props={props} onDone={() => setAsking(null)} />
							</li>
						))}
					</ol>
				</section>
			)}
			<div className="adv-bar ui-panel">
				{/* biome-ignore lint/a11y/useSemanticElements: a toolbar of portrait buttons, not a form group */}
				<div className="adv-faces" role="group" aria-label="Ask an advisor">
					{ADVISOR_ORDER.map((id) => (
						<button
							key={id}
							type="button"
							className={`adv-face ${speaking === id ? "is-speaking" : ""} ${asking === id ? "is-asked" : ""} ${chips[id] ? "has-chip" : ""}`}
							style={{ ["--adv" as string]: ADVISORS[id].color }}
							aria-pressed={asking === id}
							aria-label={`Ask ${ADVISORS[id].name}, ${ADVISORS[id].role}${chips[id] ? " (a tip is waiting)" : ""}`}
							title={`${ADVISORS[id].name}: ${ADVISORS[id].role}. Click to ask what to worry about.`}
							onClick={() => ask(id)}
						>
							<Portrait id={id} size={40} talking={speaking === id} />
							{chips[id] && <i className="adv-dot" aria-hidden="true" />}
						</button>
					))}
				</div>
				<div className="adv-line" role="status" aria-live="polite">
					{teacher ? (
						teacher
					) : shown ? (
						<div className="adv-tip" style={{ ["--adv" as string]: ADVISORS[shown.advisor].color }}>
							<b className="adv-who">{ADVISORS[shown.advisor].first}</b>
							<LineBody line={shown} props={props} onDone={() => collapse(shown, false)} />
							<button type="button" className="ui-btn adv-x" aria-label="Dismiss tip" onClick={() => collapse(shown, true)}>
								×
							</button>
						</div>
					) : view.decisionReturnsAt !== null ? (
						<span className="adv-quiet">A deferred decision returns in {fmtDuration(Math.max(0, view.decisionReturnsAt - view.tick))}.</span>
					) : (
						<span className="adv-quiet">Click a face to ask what to worry about.</span>
					)}
				</div>
			</div>
		</aside>
	);
}
