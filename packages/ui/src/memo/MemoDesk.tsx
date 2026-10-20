import type { ContentDB } from "@aitower/content";
import type { MemoView, ModifierView, SimView } from "@aitower/sim";
import { memoStain } from "../bio/bio";
import { PATH_COLOR } from "../ascension/ascension";
import { chipParts, effectsOf, isUrgentMemo } from "../calm/calm";
import type { GameState, GameStore } from "@aitower/shared";
import { useEffect } from "react";
import { Icon, Lamp, Stamp } from "../components/common";
import type { UiState } from "../components/context";
import { fmtDuration } from "../format";
import { pushNotice } from "../notices";
import { clampStanding, defaultChoiceLabel, historyRows, memoCountdown, memoFraction, memoUrgent, modifierChip, modifierHurts, openMemos, pruneIds, standingTone } from "./memoDesk";
import "./memo.css";

type SetUi = (patch: Partial<UiState>) => void;

/** The consequence of a choice: plain chips, with affinity effects as path-coloured pills. */
function choiceChipsNode(effects: Parameters<typeof chipParts>[0]) {
	const parts = chipParts(effects);
	if (parts.length === 0) return <em>no effect</em>;
	return (
		<em>
			{parts.map((c, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static list
				<span key={i}>
					{i > 0 && " · "}
					{c.path ? (
						<span className="ui-pathchip" data-path={c.path} style={{ color: PATH_COLOR[c.path] }}>
							{c.text}
						</span>
					) : (
						c.text
					)}
				</span>
			))}
		</em>
	);
}

const CATEGORY: Record<string, string> = { ministry: "COMPUTE AUTHORITY", environmental: "WEATHER SERVICE", operational: "OPERATIONS", client: "CLIENT LIAISON", horror: "CLASSIFIED" };

/** Stamp a memo. The memo is hidden at once; the store applies the answer immediately (or on the next tick while running). */
function answer(store: GameStore, ui: UiState, setUi: SetUi, memo: MemoView, choiceId: string): void {
	const r = store.dispatch({ type: "resolveMemo", memoId: memo.id, choiceId });
	if (!r.ok) {
		pushNotice({ text: `Memo not answered: ${r.reason}`, severity: "warn", key: `memo:${memo.id}` });
		return;
	}
	setUi({ stamped: [...ui.stamped, memo.id] });
}

export function MemoCard({ memo, tick, onAnswer, onAside }: { memo: MemoView; tick: number; onAnswer: (choiceId: string) => void; onAside?: () => void }) {
	const urgent = memoUrgent(memo, tick);
	const id = `memo-${memo.id}`;
	return (
		<article className={`memo-card ${urgent ? "is-urgent" : ""}`} data-memo={memo.id} aria-labelledby={`${id}-t`}>
			<header className="memo-head">
				<span className="memo-from">
					FROM: {CATEGORY[memo.category] ?? "COMPUTE AUTHORITY"} · NO. {String(memo.id).padStart(4, "0")}
				</span>
				{urgent && <Stamp tone="red" className="memo-urgent">Urgent</Stamp>}
			</header>
			<h3 className="memo-title" id={`${id}-t`}>
				{memo.title}
			</h3>
			{memo.body.split("\n\n").map((p) => (
				<p key={p} className="memo-body">
					{p}
				</p>
			))}
			<div className="memo-clock" role="timer" aria-label={memoCountdown(memo, tick)}>
				<span className="memo-bar" aria-hidden="true">
					<i style={{ width: `${Math.round(memoFraction(memo, tick) * 100)}%` }} />
				</span>
				<span className="memo-left">{memoCountdown(memo, tick)}</span>
				<span className="memo-default">
					Unanswered memos resolve as: <b>{defaultChoiceLabel(memo)}</b>
				</span>
			</div>
			<div className="memo-choices">
				{memo.choices.map((c) => (
					<div key={c.id} className="memo-choice">
						<button type="button" className={`ui-stampbtn stamp-green memo-stamp ${c.id === memo.defaultChoice ? "is-default" : ""}`} onClick={() => onAnswer(c.id)} aria-describedby={`${id}-${c.id}`}>
							<span className="rest">{c.label}</span>
							<span className="hot">{c.label}</span>
						</button>
						<span className="memo-hint" id={`${id}-${c.id}`}>
							{c.hint}
						</span>
					</div>
				))}
			</div>
			{onAside && (
				<footer className="memo-foot">
					<button type="button" className="ui-btn" onClick={onAside} title="Close this slip; the memo waits in the inbox">
						To inbox
					</button>
				</footer>
			)}
		</article>
	);
}

/** The urgent memo to pop up: the oldest open, unset-aside one that is urgent. Others only raise the inbox count. */
export const urgentToPop = (view: SimView, content: ContentDB, stamped: readonly number[], aside: readonly number[]): MemoView | null =>
	openMemos(view.memos, stamped).find((m) => !aside.includes(m.id) && isUrgentMemo(m, view, content)) ?? null;

/**
 * The compact slip: category and countdown, a headline, and one stamp per choice with its effects as numbers and icons
 * ("−$160k · ★−4"). The prose waits behind "read memo" (`ui.readMemo`).
 */
export function MemoSlip({ memo, content, tick, open, onRead, onAnswer, onAside }: { memo: MemoView; content: ContentDB; tick: number; open: boolean; onRead: () => void; onAnswer: (choiceId: string) => void; onAside: () => void }) {
	return (
		<article className="memo-slip" data-memo={memo.id} aria-label={memo.title}>
			<header className="memo-slip-from">
				<span>{CATEGORY[memo.category] ?? "COMPUTE AUTHORITY"} · URGENT</span>
				<span title="The memo resolves to its default choice when the time runs out">{memoCountdown(memo, tick)}</span>
			</header>
			<h3 className="memo-slip-title">{memo.title}</h3>
			<div className="memo-slip-stamps">
				{memo.choices.map((c) => (
					<button key={c.id} type="button" className={`memo-slip-stamp ${c.id === memo.defaultChoice ? "is-default" : ""}`} title={c.hint} onClick={() => onAnswer(c.id)}>
						<span>{c.label}</span>
						{choiceChipsNode(effectsOf(content, memo, c.id))}
					</button>
				))}
			</div>
			<footer className="memo-slip-foot">
				<button type="button" className="memo-slip-more" aria-expanded={open} onClick={onRead}>
					{open ? "hide memo" : "read memo"}
				</button>
				<button type="button" className="memo-slip-more" onClick={onAside} title="Close this slip; the memo waits in the inbox">
					later
				</button>
			</footer>
			{open && (
				<div className="memo-slip-body">
					{memo.body.split(/\n\s*\n/).map((p) => (
						<p key={p}>{p}</p>
					))}
				</div>
			)}
		</article>
	);
}

/** An urgent unanswered memo pops up at the top right of the world; everything else raises the inbox count. */
export function MemoPop({ store, content, state, ui, setUi }: { store: GameStore; content: ContentDB; state: GameState; ui: UiState; setUi: SetUi }) {
	const { memos, tick } = state.view;
	// Forget bookkeeping for memos the sim has resolved.
	const stale = ui.stamped.length + ui.aside.length > 0 && (pruneIds(ui.stamped, memos).length !== ui.stamped.length || pruneIds(ui.aside, memos).length !== ui.aside.length);
	useEffect(() => {
		if (stale) setUi({ stamped: pruneIds(ui.stamped, memos), aside: pruneIds(ui.aside, memos) });
	}, [stale, memos, ui.stamped, ui.aside, setUi]);
	const memo = ui.inboxOpen ? null : urgentToPop(state.view, content, ui.stamped, ui.aside);
	if (!memo) return null;
	const stain = memoStain(state.view.corruption ?? 0, state.settings.horrorIntensity);
	return (
		<div className={`ui-memo-pop ${stain === "none" ? "" : `has-stain-${stain}`}`} role="dialog" aria-label="Incoming Authority memo" key={memo.id}>
			<MemoSlip
				memo={memo}
				content={content}
				tick={tick}
				open={ui.readMemo === memo.id}
				onRead={() => setUi({ readMemo: ui.readMemo === memo.id ? null : memo.id })}
				onAnswer={(c) => answer(store, ui, setUi, memo, c)}
				onAside={() => setUi({ aside: [...ui.aside, memo.id] })}
			/>
		</div>
	);
}

/** Inbox drawer: every open memo (answerable here), then the history of resolved ones with their outcomes. */
export function MemoDrawer({ store, content, state, ui, setUi }: { store: GameStore; content: ContentDB; state: GameState; ui: UiState; setUi: SetUi }) {
	const { view } = state;
	const open = openMemos(view.memos, ui.stamped);
	const history = historyRows(view, content);
	return (
		<aside className="ui-memo-drawer ui-panel" aria-label="Compute Authority inbox">
			<div className="ui-panel-title">
				<span className="memo-drawer-title">AUTHORITY INBOX</span>
				<button type="button" className="ui-btn ui-icon-btn" onClick={() => setUi({ inboxOpen: false })} aria-label="Close inbox" title="Close the inbox">
					<Icon name="close" size={12} />
				</button>
			</div>
			<div className="memo-drawer-scroll">
				<h4 className="memo-sect">IN TRAY ({open.length})</h4>
				{open.length === 0 && <p className="memo-empty">No open memos.</p>}
				{open.map((m) => (
					<MemoCard key={m.id} memo={m} tick={view.tick} onAnswer={(c) => answer(store, ui, setUi, m, c)} />
				))}
				<h4 className="memo-sect">RESOLVED ({history.length})</h4>
				{history.length === 0 && <p className="memo-empty">Nothing resolved yet.</p>}
				<ul className="memo-history">
					{history.map((h) => (
						<li key={h.memoId} className="memo-hist">
							<div className="memo-hist-top">
								<b>{h.title}</b>
								<span className={`memo-hist-stamp ${h.auto ? "is-auto" : ""}`}>{h.auto ? `AUTO: ${h.stamp}` : h.stamp}</span>
							</div>
							<div className="memo-hist-out">{h.outcome}</div>
							<div className="memo-hist-when">{fmtDuration(Math.max(0, view.tick - h.tick))} ago</div>
						</li>
					))}
				</ul>
			</div>
		</aside>
	);
}

/** Top-bar inbox lamp with the count of open memos (lit and blinking while any are waiting). */
export function InboxButton({ state, ui, setUi }: { state: GameState; ui: UiState; setUi: SetUi }) {
	const n = openMemos(state.view.memos, ui.stamped).length;
	return (
		<button type="button" className={`ui-btn ui-inbox ${ui.inboxOpen ? "is-on" : ""}`} data-tut="inbox" onClick={() => setUi({ inboxOpen: !ui.inboxOpen })} aria-expanded={ui.inboxOpen} title={n ? `${n} Authority memo${n === 1 ? "" : "s"} waiting` : "Compute Authority inbox: no memos waiting"}>
			<Lamp on={n > 0} tone="red" blink={n > 0} plain />
			<span className="ui-inbox-label ui-hide-narrow">INBOX</span>
			<span className={`ui-inbox-count ${n ? "has" : ""}`}>{n}</span>
		</button>
	);
}

/** Authority standing as a horizontal needle meter, 0–100, with a red zone below 25. */
export function StandingMeter({ standing }: { standing: number }) {
	const v = clampStanding(standing);
	const tone = standingTone(v);
	return (
		// biome-ignore lint/a11y/useSemanticElements: a custom needle meter; a native <meter> cannot be styled into this gauge
		<div className={`ui-standing tone-${tone}`} data-tut="standing" role="meter" aria-label="Authority standing" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} title={`Authority standing ${Math.round(v)} of 100. Below 25 is dangerous; at 0 the Compute Authority shuts you down.`}>
			<span className="ui-dymo">STANDING</span>
			<span className="ui-standing-row">
				<span className="ui-standing-scale" aria-hidden="true">
					<i className="ui-standing-red" />
					<i className="ui-standing-needle" style={{ left: `${v}%` }} />
				</span>
				<span className={`ui-crt ${tone === "red" ? "crt-red" : tone === "green" ? "crt-green" : "crt-amber"} ui-standing-read`}>{Math.round(v)}</span>
			</span>
		</div>
	);
}

const MAX_CHIPS = 2;

/** Active temporary effects, e.g. "HEATWAVE +8 °C · 14h". */
export function ModifierChips({ modifiers, tick }: { modifiers: readonly ModifierView[]; tick: number }) {
	if (modifiers.length === 0) return null;
	const shown = modifiers.slice(0, MAX_CHIPS);
	const hidden = modifiers.slice(MAX_CHIPS);
	return (
		<ul className="ui-modchips" aria-label="Active effects">
			{hidden.length > 0 && (
				<li className="ui-modchip is-more" title={hidden.map((m) => modifierChip(m, tick)).join("\n")}>
					+{hidden.length} MORE
				</li>
			)}
			{shown.map((m) => (
				<li key={`${m.kind}:${m.label}:${m.endsAt}`} className={`ui-modchip ${modifierHurts(m) ? "is-bad" : "is-good"}`}>
					{modifierChip(m, tick)}
				</li>
			))}
		</ul>
	);
}
