/** Corruption: moves toward its target by at most +0.1 / −0.02 per day (applied per tick). */
import { TICKS_PER_DAY } from "../api";
import { CORRUPTION_FALL_PER_DAY, CORRUPTION_GROWTHS_SATURATION, CORRUPTION_RISE_PER_DAY, CORRUPTION_W_GROWTHS, CORRUPTION_W_ORGANOID, CORRUPTION_W_SHARE, } from "../core/constants";
export function corruptionStep(ctx) {
    const { state, content } = ctx;
    const irr = content.balance.bio.irreversibleShare;
    const share = irr > 0 ? state.contaminatedShare / irr : 0;
    const m = state.metrics;
    const organoid = m.pflops > 0 ? Math.min(1, m.organoidPflops / m.pflops) : 0;
    let growths = 0;
    for (const f of state.facilities)
        if (f.grown)
            growths++;
    const target = Math.min(1, CORRUPTION_W_SHARE * share + CORRUPTION_W_ORGANOID * organoid + CORRUPTION_W_GROWTHS * Math.min(1, growths / CORRUPTION_GROWTHS_SATURATION));
    const c = state.corruption;
    state.corruption = Math.min(1, Math.max(0, target > c ? Math.min(target, c + CORRUPTION_RISE_PER_DAY / TICKS_PER_DAY) : Math.max(target, c - CORRUPTION_FALL_PER_DAY / TICKS_PER_DAY)));
}
