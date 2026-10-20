const TICKS_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
/** Tuning for job sizes & pay. Not part of Balance (schema is frozen), so it lives here. */
export const CONTRACT_TUNING = {
    /** $ per PFLOP-hour delivered, before the client multiplier. */
    rate: { training: 130, finetune: 150, inference: 145 },
    /** Capacity floor used for sizing when the facility has (almost) no compute. */
    minRefPflops: 20,
    /** The sim's scheduler gives a training/finetune job at most this many racks. */
    maxRacksPerTrainingJob: 8,
    /** Organoid-only (`needsBio`) offers are sized against at most this many of the best bio racks. */
    bioRefRacks: 4,
    training: { days: [0.5, 3], slack: [1.4, 2.0] },
    finetune: { hours: [2, 8], capacityShare: [0.3, 0.8], slack: [1.5, 2.5] },
    inference: { share: [0.2, 0.6], days: [0.5, 2] },
    penaltyShare: [0.25, 0.5],
    /** Checkpoint interval chosen from multiples of this step (60..240). */
    checkpointStep: 60,
    checkpointSteps: 4,
    storageTB: { min: 200, max: 4000, finetuneMax: 800, base: 600, perTier: 1100 },
};
const lerp = (range, t) => range[0] + (range[1] - range[0]) * t;
const roundTo = (v, step) => Math.round(v / step) * step;
/** Weighted pick among clients unlocked at `tier` (falls back to the lowest-tier clients). */
export function pickClient(rng, tier, clients) {
    if (clients.length === 0)
        throw new Error("generateContract: no clients");
    let pool = clients.filter((c) => c.minTier <= tier);
    if (pool.length === 0) {
        const lowest = Math.min(...clients.map((c) => c.minTier));
        pool = clients.filter((c) => c.minTier === lowest);
    }
    const total = pool.reduce((s, c) => s + c.weight, 0);
    let r = rng() * total;
    for (const c of pool) {
        r -= c.weight;
        if (r < 0)
            return c;
    }
    return pool[pool.length - 1];
}
/** Best per-rack PFLOPS available at this tier (for capping training jobs to what 8 racks can do). */
function bestRackPflops(db, tier) {
    let best = 0;
    for (const def of Object.values(db.facilities)) {
        if (def.rack && def.unlockTier <= tier && def.rack.pflops > best)
            best = def.rack.pflops;
    }
    return best > 0 ? best : CONTRACT_TUNING.minRefPflops;
}
/** Best organoid (`cooling: "bio"`) rack PFLOPS unlocked at this tier, 0 if none; growths are not buildable and are skipped. */
function bestBioPflops(db, tier) {
    let best = 0;
    for (const def of Object.values(db.facilities)) {
        if (def.rack?.cooling === "bio" && !def.growth && def.unlockTier <= tier && def.rack.pflops > best)
            best = def.rack.pflops;
    }
    return best;
}
export const generateContract = (rng, ctx, db) => {
    const T = CONTRACT_TUNING;
    const client = pickClient(rng, ctx.tier, db.clients);
    const kind = client.kinds[Math.min(client.kinds.length - 1, Math.floor(rng() * client.kinds.length))];
    const needsBio = client.needsBio === true;
    // Organoid-only jobs run on bio racks alone, so size them against a few bio racks, not the whole facility.
    const bioBest = needsBio ? bestBioPflops(db, ctx.tier) : 0;
    const ref = needsBio && bioBest > 0 ? Math.min(Math.max(T.minRefPflops, ctx.capacityPflops), T.bioRefRacks * bioBest) : Math.max(T.minRefPflops, ctx.capacityPflops);
    // Training/finetune jobs only get up to N racks, so don't size them beyond that.
    const trainRef = Math.min(ref, T.maxRacksPerTrainingJob * (needsBio && bioBest > 0 ? bioBest : bestRackPflops(db, ctx.tier)));
    const mult = client.payMultiplier;
    const storageMax = Math.min(T.storageTB.max, T.storageTB.base + T.storageTB.perTier * Math.max(1, ctx.tier));
    let work;
    let durationTicks;
    let payout;
    let storageTB;
    let sustainedPflops;
    if (kind === "training") {
        const days = lerp(T.training.days, rng());
        work = trainRef * days * HOURS_PER_DAY;
        durationTicks = roundTo(days * lerp(T.training.slack, rng()) * HOURS_PER_DAY * TICKS_PER_HOUR, TICKS_PER_HOUR);
        payout = work * T.rate.training * mult;
        storageTB = roundTo(lerp([T.storageTB.min, storageMax], rng()), 50);
    }
    else if (kind === "finetune") {
        const hours = lerp(T.finetune.hours, rng());
        const share = lerp(T.finetune.capacityShare, rng());
        work = trainRef * share * hours;
        durationTicks = roundTo(hours * lerp(T.finetune.slack, rng()) * TICKS_PER_HOUR, TICKS_PER_HOUR);
        payout = work * T.rate.finetune * mult;
        storageTB = roundTo(lerp([T.storageTB.min, Math.min(storageMax, T.storageTB.finetuneMax)], rng()), 50);
    }
    else {
        const share = lerp(T.inference.share, rng());
        const days = lerp(T.inference.days, rng());
        sustainedPflops = Math.max(1, Math.round(ref * share * 10) / 10);
        work = sustainedPflops;
        durationTicks = roundTo(days * HOURS_PER_DAY * TICKS_PER_HOUR, TICKS_PER_HOUR);
        payout = sustainedPflops * (durationTicks / TICKS_PER_HOUR) * T.rate.inference * mult;
        storageTB = 0;
    }
    durationTicks = Math.max(TICKS_PER_HOUR, durationTicks);
    work = Math.round(work * 10) / 10;
    payout = roundTo(payout, 100);
    const penalty = roundTo(payout * lerp(T.penaltyShare, rng()), 100);
    const checkpointTicks = T.checkpointStep * (1 + Math.min(T.checkpointSteps - 1, Math.floor(rng() * T.checkpointSteps)));
    const spec = {
        clientId: client.id,
        clientName: client.name,
        kind,
        work,
        durationTicks,
        payout,
        penalty,
        needsLiquid: client.needsLiquid ?? false,
        storageTB,
        checkpointTicks,
    };
    if (needsBio)
        spec.needsBio = true;
    if (sustainedPflops !== undefined)
        spec.sustainedPflops = sustainedPflops;
    return spec;
};
