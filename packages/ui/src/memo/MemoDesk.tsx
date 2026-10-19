import type { ContentDB } from "@aitower/content";
import type { MemoView, ModifierView } from "@aitower/sim";
import type { GameState, GameStore } from "@aitower/shared";
import { useEffect } from "react";
import { Icon, Lamp, Stamp } from "../components/common";
import type { UiState } from "../components/context";
import { fmtDuration } from "../format";
import { pushNotice } from "../notices";
import { clampStanding, defaultChoiceLabel, historyRows, memoCountdown, memoFraction, memoToPop, memoUrgent, modifierChip, modifierHurts, openMemos, pruneIds, standingTone } from "./memoDesk";
import "./memo.css";

type SetUi = (patch: Partial<UiState>) => void;

const CATEGORY: Record<string, string> = { ministry: "MINISTRY", environmental: "WEATHER BUREAU", operational: "OPERATIONS", client: "CLIENT LIAISON", horror: "CLASSIFIED" };

/** Stamp a memo. The memo is hidden at once; the store applies the answer immediately (or on the next tick while running). */
function answer(store: GameStore, ui: UiState, setUi: SetUi, memo: MemoView, choiceId: string): void {
	const r = store.dispatch({ type: "resolveMemo", memoId: memo.id, choiceId });
	if (!r.ok) {
		pushNotice({ text: `Memo not filed: ${r.reason}`, severity: "warn", key: `memo:${memo.id}` });
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
					FROM: {CATEGORY[memo.category] ?? "MINISTRY"} · NO. {String(memo.id).padStart(4, "0")}
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
					Unanswered memos are filed as: <b>{defaultChoiceLabel(memo)}</b>
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

/** The newest unanswered memo slides in at the top right of the world; the player can answer it or set it aside in the inbox. */
export function MemoPop({ store, state, ui, setUi }: { store: GameStore; state: GameState; ui: UiState; setUi: SetUi }) {
	const { memos, tick } = state.view;
	// Forget bookkeeping for memos the sim has resolved.
	const stale = ui.stamped.length + ui.aside.length > 0 && (pruneIds(ui.stamped, memos).length !== ui.stamped.length || pruneIds(ui.aside, memos).length !== ui.aside.length);
	useEffect(() => {
		if (stale) setUi({ stamped: pruneIds(ui.stamped, memos), aside: pruneIds(ui.aside, memos) });
	}, [stale, memos, ui.stamped, ui.aside, setUi]);
	const memo = ui.inboxOpen ? null : memoToPop(memos, ui.stamped, ui.aside);
	if (!memo) return null;
	const waiting = openMemos(memos, ui.stamped).length;
	const stain = memoStain(state.view.corruption ?? 0, state.settings.horrorIntensity);
	return (
		<div className={`ui-memo-pop ${stain === "none" ? "" : `has-stain-${stain}`}`} role="dialog" aria-label="Incoming Ministry memo" key={memo.id}>
			<MemoCard memo={memo} tick={tick} onAnswer={(c) => answer(store, ui, setUi, memo, c)} onAside={() => setUi({ aside: [...ui.aside, memo.id] })} />
			{waiting > 1 && <div className="memo-more">{waiting - 1} more in the inbox</div>}
		</div>
	);
}

/** Inbox drawer: every open memo (answerable here), then the history of resolved ones with their outcomes. */
export function MemoDrawer({ store, content, state, ui, setUi }: { store: GameStore; content: ContentDB; state: GameState; ui: UiState; setUi: SetUi }) {
	const { view } = state;
	const open = openMemos(view.memos, ui.stamped);
	const history = historyRows(view, content);
	return (
		<aside className="ui-memo-drawer ui-panel" aria-label="Ministry inbox">
			<div className="ui-panel-title">
				<span className="memo-drawer-title">MINISTRY INBOX</span>
				<button type="button" className="ui-btn ui-icon-btn" onClick={() => setUi({ inboxOpen: false })} aria-label="Close inbox" title="Close the inbox">
					<Icon name="close" size={12} />
				</button>
			</div>
			<div className="memo-drawer-scroll">
				<h4 className="memo-sect">IN TRAY ({open.length})</h4>
				{open.length === 0 && <p className="memo-empty">The tray is empty. The Ministry will write when it has something to say.</p>}
				{open.map((m) => (
					<MemoCard key={m.id} memo={m} tick={view.tick} onAnswer={(c) => answer(store, ui, setUi, m, c)} />
				))}
				<h4 className="memo-sect">FILED ({history.length})</h4>
				{history.length === 0 && <p className="memo-empty">Nothing has been filed yet.</p>}
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
		<button type="button" className={`ui-btn ui-inbox ${ui.inboxOpen ? "is-on" : ""}`} data-tut="inbox" onClick={() => setUi({ inboxOpen: !ui.inboxOpen })} aria-expanded={ui.inboxOpen} title={n ? `${n} Ministry memo${n === 1 ? "" : "s"} waiting` : "Ministry inbox: no memos waiting"}>
			<Lamp on={n > 0} tone="red" blink={n > 0} plain />
			<span className="ui-inbox-label ui-hide-narrow">INBOX</span>
			<span className={`ui-inbox-count ${n ? "has" : ""}`}>{n}</span>
		</button>
	);
}

/** Ministry standing as a horizontal needle meter, 0–100, with a red zone below 25. */
export function StandingMeter({ standing }: { standing: number }) {
	const v = clampStanding(standing);
	const tone = standingTone(v);
	return (
		// biome-ignore lint/a11y/useSemanticElements: a custom needle meter; a native <meter> cannot be styled into this gauge
		<div className={`ui-standing tone-${tone}`} data-tut="standing" role="meter" aria-label="Ministry standing" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} title={`Ministry standing ${Math.round(v)} of 100. Below 25 is dangerous; at 0 the Ministry shuts you down.`}>
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
