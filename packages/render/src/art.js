export const NEURAL_MIN_WIDTH = 5;
export const rackVariant = (def) => def.rack?.cooling === "bio"
    ? /neural|pit/i.test(def.id ?? "") || (def.width ?? 0) >= NEURAL_MIN_WIDTH
        ? "neural"
        : /dna|vault/i.test(def.id ?? "") || ((def.rack.pflops ?? 0) === 0 && (def.rack.storageTB ?? 0) > 0)
            ? "dna"
            : "organoid"
    : (def.rack?.pflops ?? 0) === 0 && (def.rack?.storageTB ?? 0) > 0
        ? "storage"
        : def.rack?.cooling === "immersion"
            ? "immersion"
            : def.rack?.cooling === "dlc"
                ? "dlc"
                : "air";
export const artTier = (unlockTier) => (unlockTier >= 4 ? 4 : unlockTier === 3 ? 3 : unlockTier === 2 ? 2 : 1);
/**
 * Which extras cabinet `i` of `n` gets at a tier. Rules that keep every width looking right:
 * - the cornice runs on every cabinet from tier 2 (continuous brass band);
 * - tier >= 3 puts a hopper on the first cabinet and, when n >= 3, on the last (plus the middle at tier 4 for n >= 4);
 * - gauges: tier 2 on the first cabinet only, tier 3 on first and last, tier 4 on every cabinet;
 * - tier 4 adds pilasters everywhere and one crest on the second cabinet (n >= 2) or no crest at n = 1.
 */
export const cabinetDetail = (tier, i, n) => {
    const first = i === 0;
    const last = i === n - 1;
    const mid = n >= 4 && i === Math.floor(n / 2);
    return {
        cornice: tier >= 2,
        gauge: tier === 2 ? first : tier === 3 ? first || last : tier >= 4,
        hopper: tier >= 3 && (first || (n >= 3 && last) || (tier >= 4 && mid)),
        pilasters: tier >= 4,
        crest: tier >= 4 && n >= 2 && i === 1,
    };
};
export const widthClass = (w) => (w <= 1 ? "narrow" : w <= 3 ? "standard" : "wide");
export const bodyArt = (def, grown = false) => def.growth || grown ? "growth" : def.kind === "sterilizer" && def.bio?.cullsGrowths ? "culling_room" : def.kind;
/** Everything the drawing code branches on, in one testable value. */
export const artSpec = (def) => {
    const variant = def.kind === "rack" ? rackVariant(def) : null;
    return {
        kind: def.kind,
        body: bodyArt(def),
        variant,
        tier: artTier(def.unlockTier),
        width: def.width,
        widthClass: widthClass(def.width),
        immersion: variant === "immersion",
    };
};
export const trimDetail = (tier, width) => ({
    topRail: tier >= 2,
    plinth: tier >= 2,
    pilasters: tier >= 3,
    finials: tier >= 4 && width >= 2,
});
/**
 * Widths (tiles) the non-rack bodies were drawn for. They hold their art at this size; a wider def gets the
 * body at native width plus an enamel annex bay for the extra tiles (see `annexTiles`). Depots and chargers scale
 * freely, racks add a cabinet per tile.
 */
export const NATIVE_WIDTH = {
    crah: 2,
    chiller: 4,
    cdu: 2,
    grid_tie: 4,
    genset: 4,
    ups: 3,
};
/** Tiles the kind's body art actually spans (<= def.width). */
export const bodyWidth = (def) => {
    const n = NATIVE_WIDTH[def.kind];
    return n === undefined ? def.width : Math.min(def.width, n);
};
/** Extra tiles to fill with the annex bay. */
export const annexTiles = (def) => def.width - bodyWidth(def);
/** Height in px of a rack's vertical status light strip: a taller light means a higher unlock tier. */
export const stripHeight = (tier) => [10, 14, 18, 22][tier - 1];
