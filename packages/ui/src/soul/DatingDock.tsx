import type { AdvisorId, ContentDB } from "@aitower/content";
import type { GameState, GameStore } from "@aitower/shared";
import { useEffect, useRef, useState } from "react";
import { ADVISOR_ORDER, ADVISORS } from "../advisors/advisors";
import { Portrait } from "../advisors/Portrait";
import { pushNotice } from "../notices";
import { stageName, unreadCount } from "./soul";
import "./soul.css";

/**
 * The dating side of the HUD: the After-hours button (once a game day, pick who to stay late with), the inbox of one-line texts
 * with one-tap replies, and the "Give it to her?" prompt when you place something an advisor has a taste for.
 */
export function DatingDock({ store, content, state }: { store: GameStore; content: ContentDB; state: GameState }) {
	const soul = state.view.soul;
	const [panel, setPanel] = useState<"visit" | "texts" | null>(null);
	const unread = unreadCount(soul);
	const decisionOpen = state.view.decision !== null;

	// Gift prompt: offered once per item, for items that appear after the HUD mounted.
	const known = useRef<Set<string> | null>(null);
	const [offer, setOffer] = useState<{ advisor: AdvisorId; facilityId: number; defId: string } | null>(null);
	useEffect(() => {
		const keys = new Set(soul.giftable.map((g) => `${g.advisor}:${g.defId}`));
		if (known.current === null) {
			known.current = keys;
			return;
		}
		const fresh = soul.giftable.find((g) => !known.current?.has(`${g.advisor}:${g.defId}`));
		known.current = new Set([...known.current, ...keys]);
		if (fresh) setOffer({ advisor: fresh.advisor, facilityId: fresh.facilityId, defId: fresh.defId });
	}, [soul.giftable]);
	const give = (): void => {
		if (!offer) return;
		const r = store.dispatch({ type: "giveGift", advisor: offer.advisor, facilityId: offer.facilityId });
		if (!r.ok) pushNotice({ text: r.reason, severity: "warn", key: "gift" });
		setOffer(null);
	};

	useEffect(() => {
		if (decisionOpen) setPanel(null);
	}, [decisionOpen]);
	useEffect(() => {
		if (!panel) return;
		const onKey = (e: KeyboardEvent): void => {
			if (e.key !== "Escape") return;
			e.stopImmediatePropagation();
			setPanel(null);
		};
		window.addEventListener("keydown", onKey, true);
		return () => window.removeEventListener("keydown", onKey, true);
	}, [panel]);

	const visit = (advisor: AdvisorId): void => {
		const r = store.dispatch({ type: "visitAdvisor", advisor });
		if (!r.ok) pushNotice({ text: r.reason, severity: "warn", key: "visit" });
		setPanel(null);
	};
	const reply = (msgId: string, tap: number): void => {
		const r = store.dispatch({ type: "replyMessage", msgId, tap });
		if (!r.ok) pushNotice({ text: r.reason, severity: "warn", key: "reply" });
	};
	const free = soul.afterHours.available;

	return (
		<div className="dating-dock" data-dating>
			{offer && (
				<section className="dating-card ui-panel" style={{ ["--adv" as string]: ADVISORS[offer.advisor].color }} data-gift-offer={offer.advisor}>
					<Portrait id={offer.advisor} size={34} />
					<p>
						<b>{content.facilities[offer.defId]?.name}</b> is up. Give it to {ADVISORS[offer.advisor].first}?
					</p>
					<span className="dating-taps">
						<button type="button" className="ui-btn is-on" data-give onClick={give}>
							Give it to her
						</button>
						<button type="button" className="ui-btn" onClick={() => setOffer(null)}>
							Keep it
						</button>
					</span>
				</section>
			)}
			{panel === "visit" && (
				<section className="dating-card ui-panel" aria-label="After hours" data-panel="visit">
					<header>
						<b>AFTER HOURS</b>
						<span>Who do you stay late with?</span>
					</header>
					<div className="dating-faces">
						{ADVISOR_ORDER.map((id) => (
							<button key={id} type="button" className="dating-face" style={{ ["--adv" as string]: ADVISORS[id].color }} data-visit={id} onClick={() => visit(id)}>
								<Portrait id={id} size={44} />
								<b>{ADVISORS[id].first}</b>
								<small>{stageName(soul.bonds[id])}</small>
							</button>
						))}
					</div>
				</section>
			)}
			{panel === "texts" && (
				<section className="dating-card ui-panel" aria-label="Texts" data-panel="texts">
					<header>
						<b>TEXTS</b>
						<button type="button" className="ui-btn adv-x" aria-label="Close" onClick={() => setPanel(null)}>
							×
						</button>
					</header>
					{soul.inbox.length === 0 ? (
						<p className="dating-empty">Nothing yet.</p>
					) : (
						<ul className="dating-texts">
							{[...soul.inbox].reverse().map((m) => {
								const def = content.messages.find((x) => x.id === m.msgId);
								if (!def) return null;
								return (
									<li key={m.msgId} style={{ ["--adv" as string]: ADVISORS[m.from].color }} data-msg={m.msgId}>
										<Portrait id={m.from} size={26} />
										<div>
											<p>
												<b>{ADVISORS[m.from].first}</b> {def.text}
											</p>
											{m.tapped === null ? (
												<span className="dating-taps">
													{def.taps.map((t, i) => (
														<button key={t.label} type="button" className="ui-btn" data-tap={i} onClick={() => reply(m.msgId, i)}>
															{t.label}
														</button>
													))}
													<button type="button" className="ui-btn" data-tap="-1" onClick={() => reply(m.msgId, -1)}>
														Later
													</button>
												</span>
											) : m.tapped >= 0 ? (
												<p className="dating-back">
													<em>{def.taps[m.tapped]?.label}</em> {ADVISORS[m.from].first}: {def.taps[m.tapped]?.back}
												</p>
											) : (
												<p className="dating-back">Left on read.</p>
											)}
										</div>
									</li>
								);
							})}
						</ul>
					)}
				</section>
			)}
			<div className="dating-bar">
				<button type="button" className={`ui-btn dating-btn ${free ? "is-on is-ready" : ""}`} disabled={!free || decisionOpen} title={free ? "Stay late with one advisor (once a day)" : (soul.afterHours.reason ?? "")} data-after-hours onClick={() => setPanel(panel === "visit" ? null : "visit")}>
					AFTER HOURS
				</button>
				<button type="button" className="ui-btn dating-btn" data-texts onClick={() => setPanel(panel === "texts" ? null : "texts")}>
					TEXTS{unread > 0 ? ` (${unread})` : ""}
				</button>
			</div>
		</div>
	);
}
