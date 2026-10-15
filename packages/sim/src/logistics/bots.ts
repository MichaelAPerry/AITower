/**
 * Bot state machine: idle at charger → claim oldest unassigned work order → depot (pick a spare
 * part; wait if none) → rack → repair for repairTicks → back to charger. Battery drains 1/batteryTicks
 * per active tick and recharges 5× faster at the home charger; bots below 20 % go charging.
 */
import type { BotDef } from "@aitower/content";
import type { TickCtx } from "../core/context";
import { BOT_CHARGE_RATE_MULTIPLIER, BOT_LOW_BATTERY, BOT_RESUME_BATTERY, MIN_POWERED_SATISFACTION } from "../core/constants";
import { findById } from "../core/grid";
import type { Bot, Facility, SimState } from "../core/state";
import { getDef, serviceTile } from "../world/defs";
import { planRoute, travelCost, WALK_DIRECT } from "./routing";

/** Point the bot at a facility; false if unreachable. */
function setGoal(state: SimState, bot: Bot, f: Facility): boolean {
	const x = serviceTile(f);
	const route = planRoute(state, bot.floor, bot.x, f.floor, x);
	if (route === null) return false;
	bot.goalId = f.id;
	bot.goalX = x;
	bot.goalFloor = f.floor;
	bot.liftId = route;
	bot.leg = "walk";
	return true;
}

const reachable = (state: SimState, bot: Bot, f: Facility): boolean =>
	planRoute(state, bot.floor, bot.x, f.floor, serviceTile(f)) !== null;

/** Nearest reachable depot, preferring ones with stock. */
function chooseDepot(ctx: TickCtx, bot: Bot): Facility | null {
	let best: Facility | null = null;
	let bestKey = Number.POSITIVE_INFINITY;
	for (const f of ctx.state.facilities) {
		if (getDef(ctx.content, f.defId).kind !== "depot" || !reachable(ctx.state, bot, f)) continue;
		const key = (f.stored > 0 ? 0 : 1e9) + travelCost(bot.floor, bot.x, f.floor, serviceTile(f));
		if (key < bestKey) {
			bestKey = key;
			best = f;
		}
	}
	return best;
}

/** Move one tick toward the goal; true once standing on it. */
function travel(ctx: TickCtx, bot: Bot, def: BotDef): boolean {
	const state = ctx.state;
	if (bot.leg === "ride") return false;
	if (bot.leg === "waitLift") {
		if (findById(state.lifts, bot.liftId)) return false;
		bot.leg = "walk";
		bot.liftId = WALK_DIRECT;
	}
	let tx = bot.goalX;
	if (bot.floor !== bot.goalFloor) {
		let lift = bot.liftId >= 0 ? findById(state.lifts, bot.liftId) : undefined;
		if (!lift) {
			const route = planRoute(state, bot.floor, bot.x, bot.goalFloor, bot.goalX);
			if (route === null || route === WALK_DIRECT) return false; // stuck until topology changes
			bot.liftId = route;
			lift = findById(state.lifts, route);
			if (!lift) return false;
		}
		tx = lift.x;
	}
	const dx = tx - bot.x;
	if (Math.abs(dx) <= def.speed) bot.x = tx;
	else bot.x += Math.sign(dx) * def.speed;
	if (bot.x !== tx) return false;
	if (bot.floor !== bot.goalFloor) {
		bot.leg = "waitLift";
		return false;
	}
	return true;
}

function tryClaim(ctx: TickCtx, bot: Bot): boolean {
	const state = ctx.state;
	if (bot.homeId >= 0 && bot.battery < BOT_RESUME_BATTERY) return false;
	for (const wo of state.workOrders) {
		if (wo.botId >= 0) continue;
		const rack = findById(state.facilities, wo.facilityId);
		if (!rack || !reachable(state, bot, rack)) continue;
		if (bot.carrying) {
			if (!setGoal(state, bot, rack)) continue;
			bot.task = "target";
		} else {
			const depot = chooseDepot(ctx, bot);
			if (!depot || !setGoal(state, bot, depot)) continue;
			bot.task = "depot";
		}
		wo.botId = bot.id;
		bot.workOrderId = wo.id;
		return true;
	}
	return false;
}

function goHome(state: SimState, bot: Bot): void {
	const home = bot.homeId >= 0 ? findById(state.facilities, bot.homeId) : undefined;
	if (home && setGoal(state, bot, home)) bot.task = "charger";
	else bot.task = "none";
}

function releaseOrder(state: SimState, bot: Bot): void {
	const wo = findById(state.workOrders, bot.workOrderId);
	if (wo && wo.botId === bot.id) wo.botId = -1;
	bot.workOrderId = -1;
}

const atHome = (state: SimState, bot: Bot): Facility | undefined => {
	const home = bot.homeId >= 0 ? findById(state.facilities, bot.homeId) : undefined;
	return home && bot.leg === "walk" && bot.floor === home.floor && bot.x === serviceTile(home) ? home : undefined;
};

function stepBot(ctx: TickCtx, bot: Bot): void {
	const { state, content, events } = ctx;
	const def = content.bots[bot.defId];
	if (!def) return;

	// Work order vanished (rack demolished): drop the task, keep any part.
	if (bot.workOrderId >= 0 && !findById(state.workOrders, bot.workOrderId)) {
		bot.workOrderId = -1;
		if (bot.task === "depot" || bot.task === "target" || bot.task === "repair") bot.task = "none";
	}

	switch (bot.task) {
		case "none": {
			if (tryClaim(ctx, bot)) break;
			const home = atHome(state, bot);
			if (home) {
				if (bot.battery < 1) bot.task = "charge";
			} else if (bot.homeId >= 0) goHome(state, bot);
			break;
		}
		case "depot": {
			if (bot.battery < BOT_LOW_BATTERY && bot.homeId >= 0) {
				releaseOrder(state, bot);
				goHome(state, bot);
				break;
			}
			let depot = findById(state.facilities, bot.goalId);
			if (!depot || getDef(content, depot.defId).kind !== "depot" || (depot.stored === 0 && bot.leg === "walk" && bot.x === bot.goalX && bot.floor === bot.goalFloor)) {
				const alt = chooseDepot(ctx, bot);
				if (alt && alt !== depot && (alt.stored > 0 || !depot)) {
					if (setGoal(state, bot, alt)) depot = alt;
				}
			}
			if (!depot) {
				releaseOrder(state, bot);
				bot.task = "none";
				break;
			}
			if (travel(ctx, bot, def) && depot.stored > 0) {
				depot.stored--;
				bot.carrying = true;
				const wo = findById(state.workOrders, bot.workOrderId);
				const rack = wo ? findById(state.facilities, wo.facilityId) : undefined;
				if (rack && setGoal(state, bot, rack)) bot.task = "target";
				else {
					releaseOrder(state, bot);
					bot.task = "none";
				}
			}
			break;
		}
		case "target": {
			if (travel(ctx, bot, def)) {
				bot.task = "repair";
				bot.timer = def.repairTicks;
			}
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
					events.push({ type: "repaired", facilityId: rack.id, botId: bot.id });
				}
				state.workOrders = state.workOrders.filter((w) => w.id !== bot.workOrderId);
				bot.workOrderId = -1;
				bot.carrying = false;
				goHome(state, bot);
			}
			break;
		}
		case "charger": {
			if (bot.homeId < 0 || bot.goalId !== bot.homeId) {
				goHome(state, bot);
				if (bot.task !== "charger") break;
			}
			if (travel(ctx, bot, def)) bot.task = bot.battery < 1 ? "charge" : "none";
			break;
		}
		case "charge": {
			const home = atHome(state, bot);
			if (!home) {
				bot.task = "none";
				break;
			}
			if (bot.battery >= BOT_RESUME_BATTERY && tryClaim(ctx, bot)) break;
			if (home.enabled && home.sat >= MIN_POWERED_SATISFACTION) {
				home.charging = true;
				bot.battery = Math.min(1, bot.battery + BOT_CHARGE_RATE_MULTIPLIER / def.batteryTicks);
				if (bot.battery >= 1) bot.task = "none";
			}
			break;
		}
	}

	const active = bot.task !== "none" && bot.task !== "charge";
	if (active) bot.battery = Math.max(0, bot.battery - 1 / def.batteryTicks);
}

export function stepBots(ctx: TickCtx): void {
	for (const f of ctx.state.facilities) f.charging = false;
	for (const bot of ctx.state.bots) stepBot(ctx, bot);
}
