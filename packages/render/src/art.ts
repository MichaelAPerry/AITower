/**
 * Pure art selection for facilities: which cabinet variant a def gets and how much brass detailing its
 * `unlockTier` earns. Kept free of Pixi so it can be tested; `pixi/facilityArt.ts` draws from the result.
 */
import type { FacilityDef } from "@aitower/content";

/** Rack cabinet variant. Immersion racks get a glass tank; DLC racks a manifold; storage racks reels. */
export type RackVariant = "air" | "dlc" | "storage" | "immersion";

export const rackVariant = (def: Pick<FacilityDef, "rack">): RackVariant =>
	(def.rack?.pflops ?? 0) === 0 && (def.rack?.storageTB ?? 0) > 0
		? "storage"
		: def.rack?.cooling === "immersion"
			? "immersion"
			: def.rack?.cooling === "dlc"
				? "dlc"
				: "air";

/** Detail level: 1 = plain enamel, 2 = brass trim, 3 = gauges and a card hopper, 4 = full Ministry regalia. */
export type ArtTier = 1 | 2 | 3 | 4;

export const artTier = (unlockTier: number): ArtTier => (unlockTier >= 4 ? 4 : unlockTier === 3 ? 3 : unlockTier === 2 ? 2 : 1);

/** Per-cabinet extras of a rack. `i` is the cabinet index within a rack of `n` cabinets (n = def.width). */
export interface CabinetDetail {
	/** Brass cornice band along the top. */
	cornice: boolean;
	/** Brass pressure gauge in the side column. */
	gauge: boolean;
	/** Punch-card hopper on the cabinet top (cards poke out). */
	hopper: boolean;
	/** Brass pilasters down both sides. */
	pilasters: boolean;
	/** Brass Ministry crest on top (one per rack, never above the pneumatic receiver of the first cabinet). */
	crest: boolean;
}

/**
 * Which extras cabinet `i` of `n` gets at a tier. Rules that keep every width looking right:
 * - the cornice runs on every cabinet from tier 2 (continuous brass band);
 * - tier >= 3 puts a hopper on the first cabinet and, when n >= 3, on the last (plus the middle at tier 4 for n >= 4);
 * - gauges: tier 2 on the first cabinet only, tier 3 on first and last, tier 4 on every cabinet;
 * - tier 4 adds pilasters everywhere and one crest on the second cabinet (n >= 2) or no crest at n = 1.
 */
export const cabinetDetail = (tier: ArtTier, i: number, n: number): CabinetDetail => {
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

export type WidthClass = "narrow" | "standard" | "wide";
export const widthClass = (w: number): WidthClass => (w <= 1 ? "narrow" : w <= 3 ? "standard" : "wide");

export interface ArtSpec {
	kind: FacilityDef["kind"];
	variant: RackVariant | null;
	tier: ArtTier;
	width: number;
	widthClass: WidthClass;
	immersion: boolean;
}

/** Everything the drawing code branches on, in one testable value. */
export const artSpec = (def: Pick<FacilityDef, "kind" | "width" | "unlockTier" | "rack">): ArtSpec => {
	const variant = def.kind === "rack" ? rackVariant(def) : null;
	return {
		kind: def.kind,
		variant,
		tier: artTier(def.unlockTier),
		width: def.width,
		widthClass: widthClass(def.width),
		immersion: variant === "immersion",
	};
};

/** Edge trim of non-rack facilities (they have no cabinets): rails, pilasters and finials by tier. */
export interface TrimDetail {
	topRail: boolean;
	plinth: boolean;
	pilasters: boolean;
	finials: boolean;
}

export const trimDetail = (tier: ArtTier, width: number): TrimDetail => ({
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
export const NATIVE_WIDTH: Partial<Record<FacilityDef["kind"], number>> = {
	crah: 2,
	chiller: 4,
	cdu: 2,
	grid_tie: 4,
	genset: 4,
	ups: 3,
};

/** Tiles the kind's body art actually spans (<= def.width). */
export const bodyWidth = (def: Pick<FacilityDef, "kind" | "width">): number => {
	const n = NATIVE_WIDTH[def.kind];
	return n === undefined ? def.width : Math.min(def.width, n);
};

/** Extra tiles to fill with the annex bay. */
export const annexTiles = (def: Pick<FacilityDef, "kind" | "width">): number => def.width - bodyWidth(def);
