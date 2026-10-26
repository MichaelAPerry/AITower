/**
 * The dating systems (docs/VN_WRITING.md, "Dating systems proposal"): After-hours visits, gifts and the inbox.
 *
 * Everything here is a pure function of the state and the commands: scene and message picks use no random stream, only the day,
 * the advisor and what was already seen, so the sim stays deterministic and the other streams are never shifted.
 *
 *  - Visit (`visitAdvisor`): once per game day the player picks one advisor. She earns `soul.afterHoursBond`, and a short scene
 *    from her After-hours pool (stage-banded by `minBond` / `maxBond`; unseen scenes first) opens as a decision.
 *  - Gift (`giveGift`): each advisor has one liked and one disliked item (`ContentDB.gifts`). Giving an item you own is allowed
 *    once per advisor and item, and moves her bond by `soul.giftLiked` / `soul.giftDisliked`.
 *  - Inbox: at noon, at most one text a day (`ContentDB.messages`), rotating through the advisors. A one-tap reply earns
 *    `soul.messageBond`; leaving it costs nothing.
 */
import { ADVISOR_IDS, type AdvisorId, type ContentDB, type EventDef, type MessageDef } from "@aitower/content";
import type { SimEvent } from "../api";
import { type Plan, type PlanCtx, accept, reject } from "../commands/plan";
import type { TickCtx } from "../core/context";
import type { SimState } from "../core/state";
import { dayOf, minuteOfDay } from "../core/time";
import { addBond } from "../progression/soul";
import { addFlag, conditionsHold, openDecision } from "./decisions";

/** Texts arrive at this minute of the day (noon). */
export const MESSAGE_MINUTE = 12 * 60;
/** The inbox keeps this many texts; a new one pushes the oldest out. */
export const INBOX_CAP = 6;

// ─── After hours ──────────────────────────────────────────────────────────────

/** Why the player cannot visit anyone now, or null. */
export function visitBlock(state: SimState): string | null {
	if (state.lesson) return "Not during a lesson";
	if (state.decision) return "Answer the open decision first";
	if (state.afterHoursDay === dayOf(state.tick)) return "You already stayed late today";
	return null;
}

/** The After-hours scenes of `advisor` for her current stage (`minBond` / `maxBond` hold). */
export function visitPool(state: SimState, content: ContentDB, advisor: AdvisorId): EventDef[] {
	return content.events.filter((e) => e.category === "story" && e.trigger?.kind === "afterHours" && e.advisor === advisor && conditionsHold(state, e));
}

/** Scenes of an earlier stage (her bond has outgrown their `maxBond`), which may be replayed as filler unless they are `staged`. */
function lowerPool(state: SimState, content: ContentDB, advisor: AdvisorId): EventDef[] {
	return content.events.filter(
		(e) => e.category === "story" && e.trigger?.kind === "afterHours" && e.advisor === advisor && !e.staged && e.maxBond !== undefined && state.bonds[e.maxBond.advisor] >= e.maxBond.below && conditionsHold(state, e, true),
	);
}

/** A weighted pick that uses no random stream: the day, the advisor and how many scenes were seen decide. */
function weightedPick(state: SimState, advisor: AdvisorId, list: EventDef[]): EventDef {
	let total = 0;
	for (const e of list) total += e.weight;
	const h = (Math.imul(dayOf(state.tick) + 1, 2654435761) + Math.imul(ADVISOR_IDS.indexOf(advisor) + 1, 40503) + Math.imul(state.afterSeen.length + 1, 977)) >>> 0;
	let r = ((h % 100000) / 100000) * total;
	for (const e of list) {
		if (r < e.weight) return e;
		r -= e.weight;
	}
	return list[list.length - 1];
}

/**
 * Deterministic pick. Unseen scenes of her current stage first, then unseen scenes of an earlier stage, and only then a repeat
 * (the one seen longest ago). Scenes are banded by `minBond` / `maxBond`, so intimacy lines appear only once earned.
 */
export function pickVisit(state: SimState, content: ContentDB, advisor: AdvisorId): EventDef | undefined {
	const stage = visitPool(state, content, advisor);
	const fresh = stage.filter((e) => !state.afterSeen.includes(e.id));
	if (fresh.length > 0) return weightedPick(state, advisor, fresh);
	const lower = lowerPool(state, content, advisor);
	const lowerFresh = lower.filter((e) => !state.afterSeen.includes(e.id));
	if (lowerFresh.length > 0) return weightedPick(state, advisor, lowerFresh);
	const all = [...stage, ...lower];
	if (all.length === 0) return undefined;
	let oldest = all[0];
	for (const e of all) if (state.afterSeen.indexOf(e.id) < state.afterSeen.indexOf(oldest.id)) oldest = e;
	return oldest;
}

export function planVisitAdvisor(ctx: PlanCtx, advisor: string): Plan {
	const { state, content } = ctx;
	if (!ADVISOR_IDS.includes(advisor as AdvisorId)) return reject("no such advisor");
	const blocked = visitBlock(state);
	if (blocked) return reject(blocked);
	const who = advisor as AdvisorId;
	return accept(0, (events) => {
		state.afterHoursDay = dayOf(state.tick);
		addBond(state, who, content.balance.soul.afterHoursBond);
		const scene = pickVisit(state, content, who);
		events.push({ type: "visited", advisor: who });
		if (!scene) return;
		state.afterSeen = [...state.afterSeen.filter((x) => x !== scene.id), scene.id];
		openDecision(state, scene, events, undefined, false);
	});
}

// ─── Gifts ────────────────────────────────────────────────────────────────────

export const giftKey = (advisor: AdvisorId, defId: string): string => `${advisor}:${defId}`;

/** How `advisor` takes `defId`: "liked", "disliked", or null when it is neither's business. */
export function giftTaste(content: ContentDB, advisor: AdvisorId, defId: string): "liked" | "disliked" | null {
	const g = content.gifts.find((x) => x.advisor === advisor);
	if (!g) return null;
	return g.liked === defId ? "liked" : g.disliked === defId ? "disliked" : null;
}

export function planGiveGift(ctx: PlanCtx, advisor: string, facilityId: number): Plan {
	const { state, content } = ctx;
	if (!ADVISOR_IDS.includes(advisor as AdvisorId)) return reject("no such advisor");
	const who = advisor as AdvisorId;
	const f = state.facilities.find((x) => x.id === facilityId);
	if (!f) return reject("no such facility");
	const taste = giftTaste(content, who, f.defId);
	if (!taste) return reject("She has no use for that");
	const key = giftKey(who, f.defId);
	if (state.gifted.includes(key)) return reject("You already gave her one");
	return accept(0, (events) => {
		state.gifted.push(key);
		const s = content.balance.soul;
		addBond(state, who, taste === "liked" ? s.giftLiked : s.giftDisliked);
		addFlag(state, taste === "liked" ? `gift_${who}` : `gift_${who}_bad`);
		events.push({ type: "gifted", advisor: who, defId: f.defId, liked: taste === "liked" });
	});
}

/** Gifts the player could give right now: an owned item an advisor has a taste for, not given yet. One entry per advisor and item. */
export function giftable(state: SimState, content: ContentDB): { advisor: AdvisorId; defId: string; facilityId: number; liked: boolean }[] {
	const out: { advisor: AdvisorId; defId: string; facilityId: number; liked: boolean }[] = [];
	for (const g of content.gifts) {
		for (const defId of [g.liked, g.disliked]) {
			if (state.gifted.includes(giftKey(g.advisor, defId))) continue;
			const f = state.facilities.find((x) => x.defId === defId);
			if (f) out.push({ advisor: g.advisor, defId, facilityId: f.id, liked: defId === g.liked });
		}
	}
	return out;
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export function messageOf(content: ContentDB, msgId: string): MessageDef | undefined {
	return content.messages.find((m) => m.id === msgId);
}

function messageFits(state: SimState, m: MessageDef): boolean {
	const b = state.bonds[m.from];
	return !state.messageSeen.includes(m.id) && (m.minBond === undefined || b >= m.minBond) && (m.maxBond === undefined || b < m.maxBond);
}

/** Stage 9c: at noon, once a day, an advisor texts. The sender rotates; one with nothing new to say is skipped. */
export function datingStep(ctx: TickCtx): void {
	const { state, content, events } = ctx;
	if (minuteOfDay(state.tick) !== MESSAGE_MINUTE || state.lesson || state.gameOver) return;
	const day = dayOf(state.tick);
	if (day < 1 || state.messageDay >= day || content.messages.length === 0) return;
	state.messageDay = day;
	const start = state.messageSeen.length % ADVISOR_IDS.length;
	for (let k = 0; k < ADVISOR_IDS.length; k++) {
		const from = ADVISOR_IDS[(start + k) % ADVISOR_IDS.length];
		const pool = content.messages.filter((m) => m.from === from && messageFits(state, m));
		if (pool.length === 0) continue;
		const m = pool[(Math.imul(day + 1, 2654435761) >>> 0) % pool.length];
		state.messageSeen.push(m.id);
		state.inbox.push({ msgId: m.id, from, tick: state.tick, tapped: null });
		if (state.inbox.length > INBOX_CAP) state.inbox.splice(0, state.inbox.length - INBOX_CAP);
		events.push({ type: "messageReceived", from, msgId: m.id });
		return;
	}
}

/** `tap` is the reply's index, or -1 to leave it unanswered for good. */
export function planReplyMessage(ctx: PlanCtx, msgId: string, tap: number): Plan {
	const { state, content } = ctx;
	const item = state.inbox.find((x) => x.msgId === msgId);
	if (!item) return reject("no such message");
	if (item.tapped !== null) return reject("already answered");
	const m = messageOf(content, msgId);
	if (!m) return reject("no such message");
	if (!Number.isInteger(tap) || tap < -1 || tap >= m.taps.length) return reject("no such reply");
	return accept(0, (events: SimEvent[]) => {
		item.tapped = tap;
		if (tap < 0) return;
		addBond(state, item.from, content.balance.soul.messageBond);
		events.push({ type: "messageAnswered", from: item.from, msgId });
	});
}
