/**
 * Advisor decisions (M6.3, replacing the Ministry memos): seeded issuing, resolving by the player, and instant/timed effects.
 *
 * Rules:
 *  - at most one decision exists at a time (open, or deferred for a day);
 *  - at most one is issued per game day, and none while the external `decisionGate` is closed (the app closes it for three real
 *    minutes after each decision, because real time is not the sim's business);
 *  - a decision never times out and waiting never changes anything: only the player's choice applies effects;
 *  - "defer one day" hides it once; it comes back (and is announced again) a game day later.
 *
 * Pause: the sim itself never blocks. The clock owner (the app's store/loop) holds the clock while a decision is open, which
 * keeps the sim a pure function of (seed, commands): the same commands give the same game however fast it is played.
 */
import { ADVISOR_IDS, type AdvisorId, type ContentDB, type EventChoice, type EventDef, type EventEffect, SEALED_TREES } from "@aitower/content";
import type { SimEvent } from "../api";
import { type Plan, type PlanCtx, accept, reject } from "../commands/plan";
import { stockParts } from "../commands/operations";
import type { TickCtx } from "../core/context";
import { SCRIPTED_MINUTE_OF_DAY } from "../core/constants";
import { nextRandom } from "../core/rng";
import type { Decision, SimState } from "../core/state";
import { dayOf, minuteOfDay } from "../core/time";
import { earn, spend } from "../economy/ledger";
import { failRack } from "../reliability/reliabilityStep";
import { getDef } from "../world/defs";
import { addAffinity } from "../progression/affinity";
import { addBond, addResidue, addSp, isSealed, leadingTree, rungsHeld, sealOf } from "../progression/soul";
import { featureUnlocked } from "../research/research";
import { expireModifiers, modifierLabel } from "./modifiers";

export const DECISION_HISTORY_LENGTH = 20;
/** "Defer one day". */
export const DEFER_TICKS = 1440;

export function eventDef(content: ContentDB, eventId: string): EventDef | undefined {
	return content.events.find((e) => e.id === eventId);
}

/** Ticks until the next memo roll: intervalTicks ±50 % (uniform), one draw from the events stream. */
export function nextDecisionDelay(state: SimState, content: ContentDB): number {
	return Math.max(1, Math.round(content.balance.events.intervalTicks * (0.5 + nextRandom(state.rng, "events"))));
}

/** Horror gates: `minCorruption` and `path` (the tree the tower leans to most). */
const bioGate = (state: SimState, content: ContentDB, e: EventDef): boolean => (e.minCorruption === undefined || state.corruption >= e.minCorruption) && (e.path === undefined || leadingTree(state, content) === e.path);

function eligible(state: SimState, content: ContentDB): EventDef[] {
	const day = dayOf(state.tick);
	return content.events.filter((e) => {
		if (e.scriptedDay !== undefined || e.category === "story") return false; // scripted events and story scenes are never picked randomly
		if (!bioGate(state, content, e)) return false;
		if (state.tier < e.minTier) return false;
		if (e.maxTier !== undefined && state.tier > e.maxTier) return false;
		if (day < (e.minDay ?? 0)) return false;
		const last = Object.hasOwn(state.lastIssuedDay, e.id) ? state.lastIssuedDay[e.id] : undefined;
		return last === undefined || day - last >= e.cooldownDays;
	});
}

/**
 * Open `e` as the pending decision: it counts toward the one-decision-a-day rule and is announced so the app stops the clock.
 */
export function openDecision(state: SimState, e: EventDef, events: SimEvent[], subject?: string): void {
	const decision: Decision = { id: state.nextId.decision++, eventId: e.id, issuedAt: state.tick, deferred: false, hiddenUntil: 0 };
	if (subject !== undefined) decision.subject = subject;
	state.decision = decision;
	state.lastIssuedDay[e.id] = dayOf(state.tick);
	state.lastDecisionDay = dayOf(state.tick);
	events.push({ type: "decisionIssued", decisionId: decision.id, eventId: e.id });
}

/**
 * Scripted events (`scriptedDay`) are issued once, from 09:00 on their day (or the first free moment after): no weight,
 * cooldown, timing or gate; tier limits apply. Only an already-pending decision makes one wait.
 */
function issueScripted(ctx: TickCtx): void {
	const { state, content, events } = ctx;
	if (state.decision) return;
	const day = dayOf(state.tick);
	if (minuteOfDay(state.tick) < SCRIPTED_MINUTE_OF_DAY) return;
	for (const e of content.events) {
		if (e.scriptedDay === undefined || e.scriptedDay > day || state.scriptedIssued.includes(e.id) || !bioGate(state, content, e)) continue;
		if (state.tier < e.minTier || (e.maxTier !== undefined && state.tier > e.maxTier)) continue;
		state.scriptedIssued.push(e.id);
		openDecision(state, e, events);
		return;
	}
}

/** Ticks a story scene waits after the last answered decision, so scenes do not arrive back to back. */
export const STORY_SPACING_TICKS = 120;
/** Story scenes and objections are checked every this many ticks (they walk the facility list). */
export const STORY_CHECK_TICKS = 10;

/** The advisor with the highest bond (ties go to the earlier of cass, bea, mel, luci). */
export function topBondAdvisor(state: SimState): AdvisorId {
	let best: AdvisorId = ADVISOR_IDS[0];
	for (const id of ADVISOR_IDS) if (state.bonds[id] > state.bonds[best]) best = id;
	return best;
}

/** The scene's own conditions besides its trigger: Level and day. */
export function conditionsHold(state: SimState, e: EventDef): boolean {
	if (state.tier < e.minTier || (e.maxTier !== undefined && state.tier > e.maxTier)) return false;
	return dayOf(state.tick) >= (e.minDay ?? 0);
}

/** Does a story scene's trigger (and its Level and day conditions) hold now? Objections are issued elsewhere. */
export function storyHolds(state: SimState, content: ContentDB, e: EventDef): boolean {
	const t = e.trigger;
	if (!t || t.kind === "objection") return false;
	if (!conditionsHold(state, e)) return false;
	switch (t.kind) {
		case "tick":
			return state.tick >= t.atLeast;
		case "tier":
			return state.tier >= t.atLeast;
		case "rung":
			return rungsHeld(state, content)[t.tree] >= t.rung;
		case "seal":
			return isSealed(state, content, t.tree);
		case "sealRise":
			return SEALED_TREES.some((tree) => sealOf(state, tree) > t.above);
		case "bond":
			return state.bonds[t.advisor] >= t.atLeast;
	}
}

/**
 * Story scenes (docs/SOUL.md): each is issued once, in file order, as soon as it holds. Then objections: the first placed item
 * that scars a tree by `soul.objectionScar` or more draws its champion's objection, once per item. Lessons have no story.
 */
function issueStory(ctx: TickCtx): void {
	const { state, content, events } = ctx;
	if (state.decision || state.lesson || state.tick % STORY_CHECK_TICKS !== 0) return;
	const last = state.decisionHistory.at(-1);
	if (last && state.tick - last.tick < STORY_SPACING_TICKS) return;
	for (const e of content.events) {
		if (e.category !== "story" || state.scriptedIssued.includes(e.id) || !storyHolds(state, content, e)) continue;
		state.scriptedIssued.push(e.id);
		openDecision(state, e, events);
		return;
	}
	const s = content.balance.soul;
	for (const f of state.facilities) {
		const d = getDef(content, f.defId);
		if (!d.seal) continue;
		for (const tree of SEALED_TREES) {
			if ((d.seal[tree] ?? 0) < s.objectionScar) continue;
			const key = `${tree}:${d.id}`;
			if (state.objected.includes(key)) continue;
			state.objected.push(key);
			const ev = content.events.find((x) => x.trigger?.kind === "objection" && x.trigger.path === tree);
			if (!ev || isSealed(state, content, tree)) continue;
			openDecision(state, ev, events, d.id);
			return;
		}
	}
}

function issueRandom(ctx: TickCtx): void {
	const { state, content, events } = ctx;
	const pool = eligible(state, content);
	if (pool.length === 0) return;
	let total = 0;
	for (const e of pool) total += e.weight;
	let r = nextRandom(state.rng, "events") * total;
	let pick = pool[pool.length - 1];
	for (const e of pool) {
		if (r < e.weight) {
			pick = e;
			break;
		}
		r -= e.weight;
	}
	openDecision(state, pick, events);
}

/** Tick stage 9b: expire modifiers, bring back a deferred decision, issue scripted events, roll for a new decision. */
export function decisionStep(ctx: TickCtx): void {
	const { state, content, events } = ctx;
	expireModifiers(state);
	const d = state.decision;
	if (d) {
		if (d.hiddenUntil > 0 && state.tick >= d.hiddenUntil) {
			d.hiddenUntil = 0;
			events.push({ type: "decisionIssued", decisionId: d.id, eventId: d.eventId });
		}
		if (!eventDef(content, d.eventId)) state.decision = null; // unknown event (stale save): drop silently
		return;
	}
	issueStory(ctx);
	if (state.decision) return;
	issueScripted(ctx);
	if (state.decision) return;
	const eb = content.balance.events;
	if (state.tick < state.nextDecisionTick || state.tick < eb.graceTicks) return;
	// Not allowed right now (gate closed, or one already came today): try again next tick; no random draw is spent.
	if (!state.decisionGate || dayOf(state.tick) <= state.lastDecisionDay) return;
	state.nextDecisionTick = state.tick + nextDecisionDelay(state, content);
	issueRandom(ctx);
}

function failRandomRacks(state: SimState, content: ContentDB, count: number, events: SimEvent[]): void {
	const racks = state.facilities.filter((f) => !f.failed && getDef(content, f.defId).kind === "rack");
	const n = Math.min(Math.max(0, Math.floor(count)), racks.length);
	for (let i = 0; i < n; i++) {
		const j = i + Math.floor(nextRandom(state.rng, "events") * (racks.length - i));
		[racks[i], racks[j]] = [racks[j], racks[i]];
		failRack(state, racks[i], events);
	}
}

function removeParts(state: SimState, content: ContentDB, count: number): void {
	let left = count;
	for (const f of state.facilities) {
		if (left <= 0) break;
		if (getDef(content, f.defId).kind !== "depot") continue;
		const n = Math.min(left, f.stored);
		f.stored -= n;
		left -= n;
	}
}

function applyEffect(state: SimState, content: ContentDB, e: EventEffect, events: SimEvent[]): void {
	switch (e.type) {
		case "cash":
			if (e.amount >= 0) earn(state, e.amount);
			else spend(state, "penalties", -e.amount);
			break;
		case "ambient":
			state.modifiers.push({ kind: "ambient", value: e.deltaC, endsAt: state.tick + e.durationTicks, label: modifierLabel("ambient", e.deltaC) });
			break;
		case "gridCap":
		case "energyPrice":
		case "payout":
		case "failureRate":
			state.modifiers.push({ kind: e.type, value: e.factor, endsAt: state.tick + e.durationTicks, label: modifierLabel(e.type, e.factor) });
			break;
		case "failRacks":
			failRandomRacks(state, content, e.count, events);
			break;
		case "spareParts":
			if (e.count >= 0) stockParts({ state, content }, Math.floor(e.count));
			else removeParts(state, content, Math.floor(-e.count));
			break;
		case "affinity":
			// A lean toward a tree is also that many of its Singularity points (the chip reads "Garden +3").
			addAffinity(state, e.path, e.amount);
			addSp(state, e.path, e.amount);
			break;
		case "seal":
			addResidue(state, e.path, e.amount);
			break;
		case "bond":
			addBond(state, e.advisor, e.amount);
			break;
		case "sp":
			addSp(state, e.path, e.amount);
			break;
	}
}

function resolveNow(state: SimState, content: ContentDB, d: Decision, def: EventDef, choice: EventChoice, events: SimEvent[]): void {
	state.decision = null;
	state.stats.decisionsMade++;
	for (const e of choice.effects) applyEffect(state, content, e, events);
	// Taking an advisor's recommendation warms her to you; overruling her cools her a little.
	const sb = content.balance.soul;
	addBond(state, def.advisor, choice.id === def.recommended ? sb.bondFollow + (featureUnlocked(state, content, "openDoor") ? 1 : 0) : sb.bondOverrule);
	state.decisionHistory.push({ decisionId: d.id, eventId: def.id, title: def.title, choiceId: choice.id, outcome: choice.outcome, tick: state.tick });
	if (state.decisionHistory.length > DECISION_HISTORY_LENGTH) state.decisionHistory.splice(0, state.decisionHistory.length - DECISION_HISTORY_LENGTH);
	events.push({ type: "decisionResolved", decisionId: d.id, eventId: def.id, choiceId: choice.id });
}

/** The decision the player can currently see and answer (not deferred), or undefined. */
function openOne(state: SimState, id: number): Decision | undefined {
	const d = state.decision;
	return d && d.id === id && d.hiddenUntil === 0 ? d : undefined;
}

export function planResolveDecision(ctx: PlanCtx, decisionId: number, choiceId: string): Plan {
	const { state, content } = ctx;
	const d = openOne(state, decisionId);
	if (!d) return reject("no such decision");
	const def = eventDef(content, d.eventId);
	if (!def) return reject("decision refers to unknown event");
	const choice = def.choices.find((c) => c.id === choiceId);
	if (!choice) return reject("no such choice");
	return accept(0, (events) => resolveNow(state, content, d, def, choice, events));
}

/** "Defer one day": once per decision. It stays pending, hidden, and comes back a day later. */
export function planDeferDecision(ctx: PlanCtx, decisionId: number): Plan {
	const { state } = ctx;
	const d = openOne(state, decisionId);
	if (!d) return reject("no such decision");
	if (d.deferred) return reject("already deferred once");
	return accept(0, (events) => {
		d.deferred = true;
		d.hiddenUntil = state.tick + DEFER_TICKS;
		events.push({ type: "decisionDeferred", decisionId: d.id, until: d.hiddenUntil });
	});
}

/** The app opens and closes the gate (real-time pacing). */
export function planDecisionGate(ctx: PlanCtx, open: boolean): Plan {
	return accept(0, () => {
		ctx.state.decisionGate = open;
	});
}

/** Remember that an advisor tip was shown, so it fires once per game. */
export function planMarkTip(ctx: PlanCtx, tipId: string): Plan {
	if (typeof tipId !== "string" || tipId.length === 0 || tipId.length > 64) return reject("bad tip id");
	return accept(0, () => {
		if (!ctx.state.advisorTips.includes(tipId) && ctx.state.advisorTips.length < 200) ctx.state.advisorTips.push(tipId);
	});
}
