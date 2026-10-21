import type { ContentDB } from "@aitower/content";
import type { DecisionView } from "@aitower/sim";
import type { GameState, GameStore } from "@aitower/shared";
import { PATH_COLOR } from "../ascension/ascension";
import { decisionStain } from "../bio/bio";
import { fmtMoney } from "../format";
import { pushNotice } from "../notices";
import { ADVISORS, choiceChipList, effectsOf, priceLine, tally } from "./advisors";
import { Portrait } from "./Portrait";
import "./advisors.css";

const CATEGORY: Record<string, string> = { ministry: "Compute Authority", environmental: "Weather and grid", operational: "Operations", client: "Clients", horror: "Unfiled" };

/** The MAGI vote: Cass, Bea and Mel each back the recommended option or not, in a line; Lucien then names the price. */
export function MagiVote({ decision, content }: { decision: DecisionView; content: ContentDB }) {
	const votes = decision.votes;
	if (!votes) return null;
	const rec = decision.choices.find((c) => c.id === decision.recommended);
	const t = tally(votes);
	return (
		<section className="adv-magi" aria-label="MAGI vote">
			<header>
				<b>MAGI vote</b>
				<span>
					{t.text} {rec?.label}
				</span>
			</header>
			<ul>
				{votes.map((v) => (
					<li key={v.advisor} className={v.approve ? "is-yes" : "is-no"} style={{ ["--adv" as string]: ADVISORS[v.advisor].color }}>
						<Portrait id={v.advisor} size={26} />
						<span className="adv-vote-line">
							<b>{ADVISORS[v.advisor].first}</b> <em>{v.approve ? "Approve" : "Reject"}</em> {v.line}
						</span>
					</li>
				))}
				<li className="is-price" style={{ ["--adv" as string]: ADVISORS.lucien.color }}>
					<Portrait id="lucien" size={26} />
					<span className="adv-vote-line">
						<b>Lucien</b> <em>Price</em> {priceLine(content, decision, fmtMoney)}
					</span>
				</li>
			</ul>
		</section>
	);
}

/**
 * An advisor's decision. The game is paused while it is open (the store holds the clock); there is no timeout and
 * waiting costs nothing. The recommended choice is marked; "Defer one day" hides it once.
 */
export function DecisionCard({ store, content, state }: { store: GameStore; content: ContentDB; state: GameState }) {
	const d = state.view.decision;
	if (!d) return null;
	const a = ADVISORS[d.advisor];
	const answer = (choiceId: string): void => {
		const r = store.dispatch({ type: "resolveDecision", decisionId: d.id, choiceId });
		if (!r.ok) pushNotice({ text: `Decision not filed: ${r.reason}`, severity: "warn", key: `decision:${d.id}` });
	};
	const defer = (): void => {
		const r = store.dispatch({ type: "deferDecision", decisionId: d.id });
		if (!r.ok) pushNotice({ text: `Not deferred: ${r.reason}`, severity: "warn", key: `decision:${d.id}` });
	};
	const stain = decisionStain(state.view.corruption ?? 0, state.settings.horrorIntensity);
	return (
		<div className="adv-scrim" data-decision={d.id}>
			<article className={`adv-card ui-panel ${stain === "none" ? "" : `has-stain-${stain}`}`} role="dialog" aria-modal="false" aria-labelledby="adv-card-title" data-help="decision" style={{ ["--adv" as string]: a.color }} key={d.id}>
				<header className="adv-card-head">
					<Portrait id={d.advisor} size={52} talking />
					<div>
						<small>Decision · game paused · {CATEGORY[d.category] ?? "Operations"}</small>
						<h3 id="adv-card-title">{d.title}</h3>
						<span className="adv-card-by">
							{a.name}, {a.role}
						</span>
					</div>
				</header>
				<p className="adv-card-body">{d.body}</p>
				<MagiVote decision={d} content={content} />
				{/* biome-ignore lint/a11y/useSemanticElements: two option cards, not a form group */}
				<div className="adv-opts" role="group" aria-label="Choices">
					{d.choices.map((c) => {
						const rec = c.id === d.recommended;
						return (
							<button key={c.id} type="button" className={`adv-opt ${rec ? "is-rec" : ""}`} onClick={() => answer(c.id)} data-choice={c.id}>
								<span className="adv-opt-top">
									<b>{c.label}</b>
									{rec && <span className="adv-rec">{`Recommended by ${a.first}`}</span>}
								</span>
								<span className="adv-chips">
									{choiceChipList(effectsOf(content, d, c.id)).map((chip, i) => (
										// biome-ignore lint/suspicious/noArrayIndexKey: static list
										<span key={i} className={`adv-chip ${chip.path ? "ui-pathchip" : ""}`} data-path={chip.path} style={chip.path ? { color: PATH_COLOR[chip.path] } : undefined}>
											{chip.text}
										</span>
									))}
									{effectsOf(content, d, c.id).length === 0 && <span className="adv-chip is-none">no effect</span>}
								</span>
							</button>
						);
					})}
				</div>
				<footer className="adv-card-foot">
					<span>Waiting costs nothing. The clock stays stopped.</span>
					{d.canDefer && (
						<button type="button" className="ui-btn" onClick={defer} title="Hide this decision for one game day. You can do this once.">
							Defer one day
						</button>
					)}
				</footer>
			</article>
		</div>
	);
}
