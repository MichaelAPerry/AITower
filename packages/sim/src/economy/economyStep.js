/**
 * Tick stage 9: upkeep (prorated per tick), energy bill, rolling 24 h PUE/uptime, bankruptcy,
 * contract offers, history sampling.
 */
import { TICKS_PER_DAY } from "../api";
import { GREEN_SMOOTHING, GREEN_W_ENERGY, GREEN_W_HEAT, HISTORY_INTERVAL_TICKS, HISTORY_LENGTH, MIN_POWERED_SATISFACTION, TICKS_PER_HOUR, TOP_TIER_RACK } from "../core/constants";
import { offersStep } from "../compute/offers";
import { setGameOver } from "../ministry/standing";
import { getDef } from "../world/defs";
import { sampleAudit } from "./audit";
import { clerkStep } from "./clerk";
import { spend } from "./ledger";
import { perk } from "../research/research";
function sum(a) {
    let s = 0;
    for (let i = 0; i < a.length; i++)
        s += a[i];
    return s;
}
export function economyStep(ctx) {
    const { state, content, events } = ctx;
    const m = state.metrics;
    let upkeep = 0;
    let shouldRun = 0;
    let running = 0;
    let topTierPflops = 0;
    for (const f of state.facilities) {
        const d = getDef(content, f.defId);
        upkeep += d.upkeepPerDay;
        if (d.kind === "rack" && d.unlockTier >= TOP_TIER_RACK)
            topTierPflops += f.pflops;
        if (d.kind === "rack" && f.enabled) {
            shouldRun++;
            if (!f.failed && !f.tripped && !f.noCoolant && !f.noNutrient && f.sat >= MIN_POWERED_SATISFACTION)
                running++;
        }
    }
    spend(state, "upkeep", (upkeep / TICKS_PER_DAY) * perk(state, content, "upkeep"));
    spend(state, "energy", m.energyCost);
    const slot = state.tick % TICKS_PER_DAY;
    m.ringTotalKwh[slot] = m.totalKw / TICKS_PER_HOUR;
    m.ringItKwh[slot] = m.itKw / TICKS_PER_HOUR;
    m.ringShouldRun[slot] = shouldRun;
    m.ringRunning[slot] = running;
    m.ringGreenKwh[slot] = m.greenKw / TICKS_PER_HOUR;
    m.ringHeatKwh[slot] = m.heatExportKw / TICKS_PER_HOUR;
    const it = sum(m.ringItKwh);
    m.pue = it > 0 ? sum(m.ringTotalKwh) / it : 1;
    const should = sum(m.ringShouldRun);
    m.uptime = should > 0 ? sum(m.ringRunning) / should : 1;
    sampleAudit(state);
    // Greentech: 0.7 × green share of the last 24 h of energy + 0.3 × exported heat ÷ IT energy, smoothed. Synthetic: uptime × top-tier share.
    const totalKwh = sum(m.ringTotalKwh);
    const greenShare = totalKwh > 0 ? Math.min(1, sum(m.ringGreenKwh) / totalKwh) : 0;
    const heatShare = it > 0 ? Math.min(1, sum(m.ringHeatKwh) / it) : 0;
    const greenTarget = GREEN_W_ENERGY * greenShare + GREEN_W_HEAT * heatShare;
    state.greenScore = Math.min(1, Math.max(0, state.greenScore + (greenTarget - state.greenScore) * GREEN_SMOOTHING));
    state.refinement = m.pflops > 0 ? Math.min(1, Math.max(0, m.uptime * Math.min(1, topTierPflops / m.pflops))) : 0;
    if (state.sandbox) {
        state.negativeCashTicks = 0;
        state.bankrupt = false;
    }
    else if (state.cash < 0) {
        state.negativeCashTicks++;
        if (state.negativeCashTicks >= TICKS_PER_DAY && !state.bankrupt) {
            state.bankrupt = true;
            events.push({ type: "bankrupt" });
            setGameOver(state, "bankrupt", events);
        }
    }
    else {
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
        if (state.history.length > HISTORY_LENGTH)
            state.history.splice(0, state.history.length - HISTORY_LENGTH);
    }
}
