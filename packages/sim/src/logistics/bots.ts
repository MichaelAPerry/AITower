/**
 * Bot state machine: idle at charger → claim the oldest available work order → depot (pick a spare part;
 * wait if none) → rack → repair for repairTicks → back to charger. Battery drains 1/batteryTicks per active tick
 * and recharges 5× faster at the home charger; bots below 20 % go charging.
 *
 * Robustness (no livelock, no permanent stuck):
 *  - routes may chain several lifts (see routing.ts); a path is re-planned whenever `topologyRev` changes;
 *  - a bot that cannot reach its target, or makes no progress for BOT_STUCK_TICKS, releases its work order; the
 *    order backs off exponentially (`retryAt`) before it is offered again, and the bot goes back to its charger;
 *  - a bot that finds no reachable depot (or cannot get home) backs off itself (`retryAt`, `fails`) and retries.
 * Per-tick cost is independent of the number of facilities: depots/chargers come from an index rebuilt only when
 * the topology changes, and one shortest-path search per claim attempt serves every candidate.
 */
import type { BotDef } from "@aitower/content";
import { addContamination } from "../bio/contamination";
import { contaminationAt } from "../bio/index";
import type { TickCtx } from "../core/context";
import {
	BOT_DEPOT_RECHECK_TICKS,
	BOT_LOW_BATTERY,
	BOT_MAX_CLAIM_PLANS_PER_TICK,
	BOT_RESUME_BATTERY,
	BOT_RETRY_BACKOFF_BASE_TICKS,
	BOT_RETRY_BACKOFF_MAX_TICKS,
	BOT_CHARGE_RATE_MULTIPLIER,
	BOT_MIN_CONTAMINATION_SPEED,
	BOT_STUCK_TICKS,
	FLESHED_REPAIR_CONTAMINATION,
	FLESHED_REPAIR_FACTOR,
	MIN_POWERED_SATISFACTION,
	TENDRILED_EXTRA_CARRY,
} from "../core/constants";
import { findById } from "../core/grid";
import type { Bot, Facility, Lift, SimState, WorkOrder } from "../core/state";
import { perk } from "../research/research";
import { serviceTile } from "../world/defs";
import { beginSearch, ensureNav, type Hop, routeTo, type RouteResult, WALK_DIRECT } from "./routing";

type Travel = "arrived" | "moving" | "blocked";

/** Ticks to wait after `failures` consecutive failures. */
export const backoffTicks = (failures: number): number =>
	Math.min(BOT_RETRY_BACKOFF_MAX_TICKS, BOT_RETRY_BACKOFF_BASE_TICKS * 2 ** Math.min(Math.max(failures - 1, 0), 16));

const liftPowered = (lift: Lift): boolean => lift.powerNet >= 0 && lift.sat >= MIN_POWERED_SATISFACTION;

/** Walk / fly speed with the `botSpeed` tech perk. */
const speedOf = (ctx: TickCtx, def: BotDef, bot: Bot): number =>
	def.speed *
	perk(ctx.state, ctx.content, "botSpeed") *
	Math.max(BOT_MIN_CONTAMINATION_SPEED, 1 - ctx.content.balance.bio.botSlowPerContamination * contaminationAt(ctx.state, bot.x, bot.floor));

/** Parts currently held (a bot poked into `carrying` without a count holds one). */
const heldParts = (bot: Bot): number => (bot.carrying ? Math.max(1, bot.parts) : 0);

function setParts(bot: Bot, n: number): void {
	bot.parts = Math.max(0, n);
	bot.carrying = bot.parts > 0;
}

/** Spare parts per depot trip (`BotDef.carry`, default 1). */
const carryOf = (def: BotDef, bot: Bot): number => Math.max(1, Math.floor(def.carry ?? 1)) + (bot.trait === "tendriled" ? TENDRILED_EXTRA_CARRY : 0);

/** Search from the bot's position; follow with `route`. Flying bots need no search: they fly straight. */
function search(ctx: TickCtx, bot: Bot, def: BotDef): void {
	if (def.flying) return;
	ensureNav(ctx.scratch.nav, ctx.state, ctx.content);
	beginSearch(ctx.scratch.nav, ctx.state, ctx.content, speedOf(ctx, def, bot), bot.floor, bot.x);
}

/** Route from the last `search` (or, for a flying bot, the straight flight from where it is) to a position. */
function route(ctx: TickCtx, bot: Bot, def: BotDef, floor: number, x: number): RouteResult | null {
	// A tendriled bot never rides lifts (nor flies between floors): only its own floor is reachable.
	if (bot.trait === "tendriled" && floor !== bot.floor) return null;
	if (def.flying) {
		const sp = Math.max(speedOf(ctx, def, bot), 1e-6);
		return { lift: WALK_DIRECT, exit: floor, cost: Math.max(Math.abs(x - bot.x), Math.abs(floor - bot.floor)) / sp };
	}
	return routeTo(ctx.scratch.nav, ctx.state, floor, x);
}

function takeHop(state: SimState, bot: Bot, hop: Hop): void {
	bot.liftId = hop.lift;
	bot.exitFloor = hop.lift === WALK_DIRECT ? bot.goalFloor : hop.exit;
	bot.leg = "walk";
	bot.routeRev = state.topologyRev;
}

function aimAt(state: SimState, bot: Bot, f: Facility, hop: Hop): void {
	bot.goalId = f.id;
	bot.goalX = serviceTile(f);
	bot.goalFloor = f.floor;
	bot.stuck = 0;
	takeHop(state, bot, hop);
}

/** Point the bot at a facility; false if unreachable. */
function setGoal(ctx: TickCtx, bot: Bot, def: BotDef, f: Facility): boolean {
	search(ctx, bot, def);
	const r = route(ctx, bot, def, f.floor, serviceTile(f));
	if (!r) return false;
	aimAt(ctx.state, bot, f, r);
	return true;
}

/** Re-plan the path to the current goal from where the bot stands; false if the goal is now unreachable. */
function replan(ctx: TickCtx, bot: Bot, def: BotDef): boolean {
	search(ctx, bot, def);
	const r = route(ctx, bot, def, bot.goalFloor, bot.goalX);
	if (!r) return false;
	takeHop(ctx.state, bot, r);
	return true;
}

/** Best reachable depot (preferring ones with stock) from the last search. */
function chooseDepot(ctx: TickCtx, bot: Bot, def: BotDef): { depot: Facility; route: RouteResult } | null {
	let best: { depot: Facility; route: RouteResult } | null = null;
	let bestKey = Number.POSITIVE_INFINITY;
	for (const f of ctx.scratch.nav.depots) {
		const r = route(ctx, bot, def, f.floor, serviceTile(f));
		if (!r) continue;
		const key = (f.stored > 0 ? 0 : 1e9) + r.cost;
		if (key < bestKey) {
			bestKey = key;
			best = { depot: f, route: r };
		}
	}
	return best;
}

/** Flying bot: a straight line to the goal, at most `speed` tiles and `speed` floors per tick (floor is fractional in flight). */
function fly(ctx: TickCtx, bot: Bot, def: BotDef): Travel {
	bot.leg = "walk";
	bot.liftId = WALK_DIRECT;
	const dx = bot.goalX - bot.x;
	const df = bot.goalFloor - bot.floor;
	const t = Math.max(Math.abs(dx), Math.abs(df)) / Math.max(speedOf(ctx, def, bot), 1e-6);
	if (t <= 1) {
		bot.x = bot.goalX;
		bot.floor = bot.goalFloor;
		return "arrived";
	}
	bot.x += dx / t;
	bot.floor += df / t;
	return "moving";
}

/** Move one tick toward the goal. */
function travel(ctx: TickCtx, bot: Bot, def: BotDef): Travel {
	const state = ctx.state;
	if (def.flying) return fly(ctx, bot, def);
	if (bot.leg === "ride") return "moving";
	if (bot.leg === "waitLift") {
		if (findById(state.lifts, bot.liftId)) return "moving";
		bot.leg = "walk";
		bot.liftId = WALK_DIRECT;
	}
	let tx = bot.goalX;
	if (bot.floor !== bot.goalFloor) {
		let lift = bot.liftId >= 0 ? findById(state.lifts, bot.liftId) : undefined;
		if (!lift) {
			if (!replan(ctx, bot, def)) return "blocked";
			lift = bot.liftId >= 0 ? findById(state.lifts, bot.liftId) : undefined;
			if (!lift) return "blocked";
		}
		tx = lift.x;
	} else if (bot.liftId >= 0) bot.liftId = WALK_DIRECT;
	const dx = tx - bot.x;
	const speed = speedOf(ctx, def, bot);
	if (Math.abs(dx) <= speed) bot.x = tx;
	else bot.x += Math.sign(dx) * speed;
	if (bot.x !== tx) return "moving";
	if (bot.floor !== bot.goalFloor) {
		bot.leg = "waitLift";
		return "moving";
	}
	return "arrived";
}

const atHome = (state: SimState, bot: Bot): Facility | undefined => {
	const home = bot.homeId >= 0 ? findById(state.facilities, bot.homeId) : undefined;
	return home && bot.leg === "walk" && bot.floor === home.floor && bot.x === serviceTile(home) ? home : undefined;
};

/** Back an order off after a failed attempt; a later topology change lifts it. */
function backOffOrder(state: SimState, wo: WorkOrder): void {
	wo.attempts++;
	wo.retryAt = state.tick + backoffTicks(wo.attempts);
	wo.retryRev = state.topologyRev;
}

/** Bot-level failure: wait `backoffTicks(fails)` before the next attempt. */
function backOff(state: SimState, bot: Bot): void {
	bot.fails++;
	bot.retryAt = state.tick + backoffTicks(bot.fails);
}

function goHome(ctx: TickCtx, bot: Bot, def: BotDef): void {
	const home = bot.homeId >= 0 ? findById(ctx.state.facilities, bot.homeId) : undefined;
	if (home && setGoal(ctx, bot, def, home)) bot.task = "charger";
	else {
		bot.task = "none";
		if (home) backOff(ctx.state, bot); // exists but unreachable: retry later
	}
}

/** Drop the work order without blaming it (low battery, vanished depot). */
function releaseOrder(state: SimState, bot: Bot): void {
	const wo = findById(state.workOrders, bot.workOrderId);
	if (wo && wo.botId === bot.id) wo.botId = -1;
	bot.workOrderId = -1;
}

/** Take a bot out of its lift car (timeout while riding). */
function eject(state: SimState, bot: Bot): void {
	for (const lift of state.lifts) {
		const i = lift.riders.indexOf(bot.id);
		if (i < 0) continue;
		lift.riders.splice(i, 1);
		bot.floor = Math.min(lift.floorMax, Math.max(lift.floorMin, Math.round(lift.carFloor)));
		bot.x = lift.x;
	}
}

/** The bot cannot finish its job: the order goes back to the queue with backoff, the bot returns to its charger. */
function giveUp(ctx: TickCtx, bot: Bot, def: BotDef): void {
	const { state } = ctx;
	const wo = findById(state.workOrders, bot.workOrderId);
	if (wo && wo.botId === bot.id) {
		wo.botId = -1;
		backOffOrder(state, wo);
	}
	bot.workOrderId = -1;
	if (bot.leg === "ride") eject(state, bot);
	bot.leg = "walk";
	bot.liftId = WALK_DIRECT;
	bot.stuck = 0;
	goHome(ctx, bot, def);
}

/** Ticks a fresh work order waits for its nearest idle bot before any bot may take it. */
export const NEAREST_BOT_TICKS = 30;
/** A floor counts like this many tiles of walking when comparing bot distances. */
const FLOOR_TILES = 20;

/** A bot parked at its dock with enough battery and no back-off: it could take an order now. */
function idleAtHome(state: SimState, b: Bot): boolean {
	return b.workOrderId < 0 && (b.task === "none" || b.task === "charge") && b.battery >= BOT_RESUME_BATTERY && state.tick >= b.retryAt;
}

/**
 * Another idle bot is closer to the rack than `bot` (floors weighted as FLOOR_TILES tiles, ties to the lower id). Keeps every
 * repair from going to the bots of the first dock: each dock serves the racks around it (playtest bug: other docks unused).
 */
function closerIdleBot(state: SimState, bot: Bot, rack: { floor: number; x: number }): boolean {
	const dist = (b: Bot): number => Math.abs(b.floor - rack.floor) * FLOOR_TILES + Math.abs(b.x - rack.x);
	const mine = dist(bot);
	for (const o of state.bots) {
		if (o.id === bot.id || !idleAtHome(state, o)) continue;
		const d = dist(o);
		if (d < mine || (d === mine && o.id < bot.id)) return true;
	}
	return false;
}

/** A work order nobody holds and that is not backing off after a failed attempt. */
const claimable = (state: SimState, wo: WorkOrder): boolean => wo.botId < 0 && !(wo.retryAt > state.tick && wo.retryRev === state.topologyRev);

/**
 * Claim the oldest available work order (by id, so assignment is deterministic); false when none could be taken.
 * `chain`: a carrying bot that just finished a repair looks for its next order (no charge threshold, no self back-off).
 */
function tryClaim(ctx: TickCtx, bot: Bot, def: BotDef, chain = false): boolean {
	const { state } = ctx;
	if (!chain && bot.homeId >= 0 && bot.battery < BOT_RESUME_BATTERY) return false;
	const speaksForAll = atHome(state, bot) !== undefined || bot.homeId < 0;
	let searched = false;
	let plans = 0;
	let sawUnreachable = false;
	for (const wo of state.workOrders) {
		if (!claimable(state, wo)) continue;
		const rack = findById(state.facilities, wo.facilityId);
		if (!rack) continue;
		// A fresh order goes to its nearest idle bot; after NEAREST_BOT_TICKS anyone may take it (so an unreachable "nearest" never stalls it).
		if (!chain && state.tick - wo.createdAt < NEAREST_BOT_TICKS && closerIdleBot(state, bot, rack)) continue;
		if (plans++ >= BOT_MAX_CLAIM_PLANS_PER_TICK) break;
		if (!searched) {
			search(ctx, bot, def);
			searched = true;
		}
		const toRack = route(ctx, bot, def, rack.floor, serviceTile(rack));
		if (!toRack) {
			// A bot parked at its charger speaks for every bot: back the order off (so nobody rescans it every
			// tick). A stranded bot just skips it and throttles itself below.
			if (speaksForAll) backOffOrder(state, wo);
			else sawUnreachable = true;
			continue;
		}
		if (bot.carrying) {
			aimAt(state, bot, rack, toRack);
			bot.task = "target";
		} else {
			const pick = chooseDepot(ctx, bot, def);
			if (!pick) {
				backOff(state, bot); // no reachable depot: wait at the charger and retry later
				return false;
			}
			aimAt(state, bot, pick.depot, pick.route);
			bot.task = "depot";
		}
		wo.botId = bot.id;
		bot.workOrderId = wo.id;
		bot.fails = 0;
		return true;
	}
	if (sawUnreachable && !chain) backOff(state, bot);
	return false;
}

function stepBot(ctx: TickCtx, bot: Bot): void {
	const { state, content, events } = ctx;
	const def = content.bots[bot.defId];
	if (!def) return;

	// Work order vanished (rack demolished): drop the task, keep any part.
	if (bot.workOrderId >= 0 && !findById(state.workOrders, bot.workOrderId)) {
		bot.workOrderId = -1;
		if (bot.task === "depot" || bot.task === "target" || bot.task === "repair") bot.task = "none";
	}

	// Topology changed (slab / lift / facility added or removed): re-validate the path.
	if (bot.routeRev !== state.topologyRev) {
		bot.routeRev = state.topologyRev;
		bot.retryAt = 0; // something was built or removed: whatever the bot was waiting for may now be possible
		bot.fails = 0;
		if ((bot.task === "depot" || bot.task === "target" || bot.task === "charger") && bot.leg !== "ride" && !replan(ctx, bot, def)) {
			giveUp(ctx, bot, def);
		}
	}

	const px = bot.x;
	const pf = bot.floor;
	const pt = bot.task;
	const pl = bot.leg;

	switch (bot.task) {
		case "none": {
			if (state.tick < bot.retryAt) break; // backing off (stranded / nothing reachable)
			if (tryClaim(ctx, bot, def)) break;
			const home = atHome(state, bot);
			if (home) {
				if (bot.battery < 1) bot.task = "charge";
			} else if (bot.homeId >= 0) goHome(ctx, bot, def);
			break;
		}
		case "depot": {
			if (bot.battery < BOT_LOW_BATTERY && bot.homeId >= 0) {
				releaseOrder(state, bot);
				goHome(ctx, bot, def);
				break;
			}
			let depot = findById(state.facilities, bot.goalId);
			const isDepot = depot !== undefined && ctx.scratch.nav.depots.includes(depot);
			const there = bot.leg === "walk" && bot.x === bot.goalX && bot.floor === bot.goalFloor;
			if (!isDepot || (depot?.stored === 0 && there && (state.tick + bot.id) % BOT_DEPOT_RECHECK_TICKS === 0)) {
				search(ctx, bot, def);
				const alt = chooseDepot(ctx, bot, def);
				if (alt && alt.depot !== depot && (alt.depot.stored > 0 || !isDepot)) {
					aimAt(state, bot, alt.depot, alt.route);
					depot = alt.depot;
				} else if (!isDepot) depot = undefined;
			}
			if (!depot) {
				releaseOrder(state, bot);
				bot.task = "none";
				break;
			}
			const t = travel(ctx, bot, def);
			if (t === "blocked") {
				search(ctx, bot, def);
				const alt = chooseDepot(ctx, bot, def);
				if (alt && alt.depot !== depot) aimAt(state, bot, alt.depot, alt.route);
				else giveUp(ctx, bot, def);
			} else if (t === "arrived" && depot.stored > 0) {
				// Take up to `carry` parts, but no more than the queued orders it could use (its own plus unclaimed ones).
				let orders = 1;
				for (const o of state.workOrders) if (o.id !== bot.workOrderId && claimable(state, o) && findById(state.facilities, o.facilityId)) orders++;
				const take = Math.min(carryOf(def, bot), orders, depot.stored);
				depot.stored -= take;
				setParts(bot, take);
				const wo = findById(state.workOrders, bot.workOrderId);
				const rack = wo ? findById(state.facilities, wo.facilityId) : undefined;
				if (rack && setGoal(ctx, bot, def, rack)) bot.task = "target";
				else giveUp(ctx, bot, def); // rack gone or unreachable: keep the part, retry the order later
			}
			break;
		}
		case "target": {
			const t = travel(ctx, bot, def);
			if (t === "arrived") {
				bot.task = "repair";
				bot.timer = (def.repairTicks / perk(state, content, "repairSpeed")) * (bot.trait === "fleshed" ? FLESHED_REPAIR_FACTOR : 1);
			} else if (t === "blocked") giveUp(ctx, bot, def);
			break;
		}
		case "repair": {
			bot.timer--;
			if (bot.timer <= 0) {
				const wo = findById(state.workOrders, bot.workOrderId);
				const rack = wo ? findById(state.facilities, wo.facilityId) : undefined;
				if (rack) {
					rack.failed = false;
					rack.health = 1;
					state.stats.repairs++;
					events.push({ type: "repaired", facilityId: rack.id, botId: bot.id });
					if (bot.trait === "fleshed" && Math.round(bot.floor) >= state.floorMin && Math.round(bot.floor) <= state.floorMax) {
						addContamination(state, Math.min(state.width - 1, Math.max(0, Math.round(bot.x))), Math.round(bot.floor), FLESHED_REPAIR_CONTAMINATION);
					}
				}
				state.workOrders = state.workOrders.filter((w) => w.id !== bot.workOrderId);
				bot.workOrderId = -1;
				setParts(bot, heldParts(bot) - 1);
				// A bot with parts left goes on to the next unclaimed order before heading home.
				if (bot.carrying && bot.battery >= BOT_LOW_BATTERY && tryClaim(ctx, bot, def, true)) break;
				goHome(ctx, bot, def);
			}
			break;
		}
		case "charger": {
			if (bot.homeId < 0 || bot.goalId !== bot.homeId) {
				goHome(ctx, bot, def);
				if (bot.task !== "charger") break;
			}
			const t = travel(ctx, bot, def);
			if (t === "arrived") {
				bot.fails = 0;
				bot.task = bot.battery < 1 ? "charge" : "none";
			} else if (t === "blocked") {
				bot.task = "none";
				backOff(state, bot);
			}
			break;
		}
		case "charge": {
			const home = atHome(state, bot);
			if (!home) {
				bot.task = "none";
				break;
			}
			if (bot.battery >= BOT_RESUME_BATTERY && state.tick >= bot.retryAt && tryClaim(ctx, bot, def)) break;
			if (home.enabled && home.sat >= MIN_POWERED_SATISFACTION) {
				home.charging = true;
				bot.battery = Math.min(1, bot.battery + BOT_CHARGE_RATE_MULTIPLIER / def.batteryTicks);
				if (bot.battery >= 1) bot.task = "none";
			}
			break;
		}
	}

	// Progress watchdog for bots that are going somewhere.
	if (bot.task === "depot" || bot.task === "target" || bot.task === "charger") {
		let progressed = bot.x !== px || bot.floor !== pf || bot.task !== pt || bot.leg !== pl;
		if (bot.leg === "ride") {
			// The lift moves riders itself; a powered lift that still carries the bot is progress.
			const lift = findById(state.lifts, bot.liftId);
			progressed = lift !== undefined && liftPowered(lift) && lift.riders.includes(bot.id);
		}
		bot.stuck = progressed ? 0 : bot.stuck + 1;
		if (bot.stuck >= BOT_STUCK_TICKS) giveUp(ctx, bot, def);
	} else bot.stuck = 0;

	// Mutation: cumulative time on contaminated cells.
	const bioCfg = content.balance.bio;
	if (bot.trait === null && contaminationAt(state, bot.x, bot.floor) >= bioCfg.mutationThreshold && ++bot.exposure >= bioCfg.mutationExposureTicks) {
		bot.trait = (bot.id + state.seed) % 2 === 0 ? "fleshed" : "tendriled";
		events.push({ type: "botMutated", botId: bot.id, trait: bot.trait });
	}

	const active = bot.task !== "none" && bot.task !== "charge";
	if (active) bot.battery = Math.max(0, bot.battery - 1 / def.batteryTicks);
}

/** Free orders that claim a bot which does not hold them (only possible after external edits / corrupt saves). */
function reclaimOrphans(state: SimState): void {
	for (const wo of state.workOrders) {
		if (wo.botId < 0) continue;
		const bot = findById(state.bots, wo.botId);
		if (!bot || bot.workOrderId !== wo.id) wo.botId = -1;
	}
}

export function stepBots(ctx: TickCtx): void {
	ensureNav(ctx.scratch.nav, ctx.state, ctx.content);
	if (ctx.state.tick % 30 === 0) reclaimOrphans(ctx.state);
	for (const f of ctx.scratch.nav.chargers) f.charging = false;
	for (const bot of ctx.state.bots) stepBot(ctx, bot);
}
