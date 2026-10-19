/**
 * Tick stage 9: upkeep (prorated per tick), energy bill, rolling 24 h PUE/uptime, bankruptcy,
 * contract offers, history sampling.
 */
import { TICKS_PER_DAY } from "../api";
import type { TickCtx } from "../core/context";
import { HISTORY_INTERVAL_TICKS, HISTORY_LENGTH, MIN_POWERED_SATISFACTION, TICKS_PER_HOUR } from "../core/constants";
import { offersStep } from "../compute/offers";
import { setGameOver } from "../ministry/standing";
import { getDef } from "../world/defs";
import { sampleAudit } from "./audit";
import { clerkStep } from "./clerk";
import { spend } from "./ledger";
import { perk } from "../research/research";

function sum(a: Float64Array): number {
	let s = 0;
	for (let i = 0; i < a.length; i++) s += a[i];
	return s;
}

export function economyStep(ctx: TickCtx): void {
	const { state, content, events } = ctx;
	const m = state.metrics;

	let upkeep = 0;
	let shouldRun = 0;
	let running = 0;
	for (const f of state.facilities) {
		const d = getDef(content, f.defId);
		upkeep += d.upkeepPerDay;
		if (d.kind === "rack" && f.enabled) {
			shouldRun++;
			if (!f.failed && !f.tripped && !f.noCoolant && f.sat >= MIN_POWERED_SATISFACTION) running++;
		}
	}
	spend(state, "upkeep", (upkeep / TICKS_PER_DAY) * perk(state, content, "upkeep"));
	spend(state, "energy", m.energyCost);

	const slot = state.tick % TICKS_PER_DAY;
	m.ringTotalKwh[slot] = m.totalKw / TICKS_PER_HOUR;
	m.ringItKwh[slot] = m.itKw / TICKS_PER_HOUR;
	m.ringShouldRun[slot] = shouldRun;
	m.ringRunning[slot] = running;
	const it = sum(m.ringItKwh);
	m.pue = it > 0 ? sum(m.ringTotalKwh) / it : 1;
	const should = sum(m.ringShouldRun);
	m.uptime = should > 0 ? sum(m.ringRunning) / should : 1;
	sampleAudit(state);

	if (state.cash < 0) {
		state.negativeCashTicks++;
		if (state.negativeCashTicks >= TICKS_PER_DAY && !state.bankrupt) {
			state.bankrupt = true;
			events.push({ type: "bankrupt" });
			setGameOver(state, "bankrupt", events);
		}
	} else {
		state.negativeCashTicks = 0;
		state.bankrupt = false;
	}

	offersStep(ctx);
	clerkStep(ctx);

	if (state.tick % HISTORY_INTERVAL_TICKS === 0) {
		state.history.push({
			tick: state.tick,
			pue: m.pue,
			itKw: m.itKw,
			totalKw: m.totalKw,
			pflops: m.pflops,
			cash: state.cash,
			maxRackC: m.maxRackC,
		});
		if (state.history.length > HISTORY_LENGTH) state.history.splice(0, state.history.length - HISTORY_LENGTH);
	}
}
