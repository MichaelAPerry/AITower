/**
 * CONTRACT — owned by the orchestrator. Changes need orchestrator sign-off
 * because `sim`, `render`, `ui` and `audio` all depend on these shapes.
 *
 * Everything the player can place (except slabs, conduits and lifts) is a
 * FacilityDef. Facilities sit on a single floor and span `width` tiles.
 * Units: kW, kWh, °C, $, ticks (1 tick = 1 game-minute).
 */

export type BuildCategory = "rack" | "power" | "cooling" | "logistics";

export type FacilityKind =
	| "rack" // IT load: produces FLOPS and heat
	| "grid_tie" // utility connection: power source, capped import
	| "genset" // backup generator: starts after a delay when the net is short
	| "ups" // battery: charges from surplus, bridges shortfalls
	| "crah" // air handler: removes heat from air cells within `radius` tiles on its floor
	| "chiller" // coolant source: removes heat from a coolant net, uses power = Q / COP
	| "cdu" // coolant distribution unit: adds coolant capacity cap for liquid racks on its net
	| "depot" // parts depot: bots pick spare parts here
	| "charger"; // bot dock: bots spawn & recharge here

export type CoolingMode = "air" | "dlc" | "immersion";

export interface RackSpec {
	cooling: CoolingMode;
	/** Electrical draw at 100% utilisation. All of it becomes heat. */
	powerKw: number;
	/** Share of heat rejected into the coolant net (rest goes to air). 0 for air racks. */
	liquidFraction: number;
	/** Compute delivered at full clocks, in PFLOPS. 0 for storage racks. */
	pflops: number;
	storageTB: number;
	/** Base probability of a component failure per game-day at nominal temperature. */
	failurePerDay: number;
}

export interface PowerSpec {
	/** Max continuous output (sources) or max charge/discharge rate (ups). */
	capacityKw: number;
	/** ups only: energy storage. */
	storageKwh?: number;
	/** genset only: ticks from start request to producing power. */
	startDelayTicks?: number;
	/** Cost per kWh produced. grid_tie uses balance.energyPrice instead. */
	costPerKwh?: number;
	/** Round-trip/conversion efficiency 0..1 (ups). Losses count toward PUE. */
	efficiency?: number;
}

export interface CoolingSpec {
	/** Heat removal capacity in kW (crah, chiller) or flow capacity in kW-of-heat (cdu). */
	capacityKw: number;
	/** chiller: coefficient of performance at 20°C ambient. Power = Q / COP. */
	cop?: number;
	/** crah: horizontal reach in tiles on its own floor. */
	radius?: number;
	/** crah: fan power per kW removed is folded into `facilityKw`. */
}

export interface LogisticsSpec {
	/** depot: max spare parts stored. charger: bots that can dock simultaneously. */
	capacity: number;
	/** charger: kW drawn while charging bots. */
	chargeKw?: number;
}

export interface PlacementRules {
	minFloor?: number;
	maxFloor?: number;
	/** Requires a coolant conduit under at least one of its cells. */
	needsCoolant?: boolean;
	/** Requires a power conduit under at least one of its cells (default true for anything drawing power). */
	needsPower?: boolean;
}

export interface FacilityDef {
	id: string;
	name: string;
	description: string;
	kind: FacilityKind;
	category: BuildCategory;
	/** Width in tiles (1 tile ≈ 1 m). Height is always one floor. */
	width: number;
	cost: number;
	upkeepPerDay: number;
	/** Tier rating required to build (1 = available at start). */
	unlockTier: number;
	/** Constant parasitic draw when enabled (fans, pumps, controls). */
	facilityKw: number;
	/** Pixel-art hint for the renderer: base body colour (#rrggbb) and accent (#rrggbb). */
	color: string;
	accent: string;
	rack?: RackSpec;
	power?: PowerSpec;
	cooling?: CoolingSpec;
	logistics?: LogisticsSpec;
	placement?: PlacementRules;
	/** Tech node that must be researched before this can be built (in addition to `unlockTier`). Absent = no research needed. */
	tech?: string;
}

export interface BotDef {
	id: string;
	name: string;
	cost: number;
	/** Walk speed in tiles per tick. */
	speed: number;
	/** Battery capacity in ticks of activity. */
	batteryTicks: number;
	/** Ticks to swap a failed component. */
	repairTicks: number;
	color: string;
	/** Tech node that must be researched before this bot can be bought. */
	tech?: string;
	/** Flies straight between floors (no lift needed); drawn as a drone. */
	flying?: boolean;
	/** Spare parts carried per depot trip (default 1); repairs queued work orders in turn. */
	carry?: number;
}

export interface StructureCosts {
	/** Per tile of floor slab above ground. */
	slabPerTile: number;
	/** Per tile of floor slab below ground (excavation). */
	basementSlabPerTile: number;
	powerConduitPerTile: number;
	coolantConduitPerTile: number;
	/** Per floor of lift shaft. */
	liftPerFloor: number;
	/** Fixed cost per lift (the car). */
	liftBase: number;
	sparePart: number;
}

export interface LiftSpec {
	/** Floors per tick. */
	speed: number;
	/** Bots per car. */
	capacity: number;
	/** Ticks doors stay open at a stop. */
	dwellTicks: number;
	facilityKw: number;
}

/** Tunable simulation constants. Sim must read every magic number from here. */
export interface Balance {
	startingCash: number;
	/** $ per kWh for grid import (base, before time-of-day multiplier). */
	energyPrice: number;
	/** 24 multipliers, one per game hour. */
	energyPriceByHour: number[];
	/** Outdoor ambient °C: mean and daily swing (sinusoid, peak at 15:00). */
	ambientMeanC: number;
	ambientSwingC: number;
	thermal: {
		/** Heat capacity of one air cell, kJ/°C (gameplay-scaled). */
		airCellHeatCapacity: number;
		/** Horizontal conductance between open-air cells, kW/°C. */
		airConductance: number;
		/** Vertical conductance through a slab, kW/°C. */
		slabConductance: number;
		/** Conductance to outdoors for edge / unbuilt cells, kW/°C. */
		envelopeConductance: number;
		/** Extra upward transfer per °C difference when the lower cell is hotter, kW/°C. */
		buoyancy: number;
		/** Rack temperature easing factor per tick (0..1). */
		rackEase: number;
		/** Rack temp rise above inlet at full load with nominal cooling, °C. */
		rackDeltaC: number;
		okC: number;
		throttleC: number;
		tripC: number;
		tripHysteresisC: number;
		/** Clock factor at throttleC (linear from 1 at okC). */
		minClock: number;
		/** Ticks a tripped rack stays down after cooling below trip − hysteresis. */
		tripCooldownTicks: number;
		/** Coolant net supply temp when within capacity, °C. */
		coolantSupplyC: number;
		/** Failure hazard multiplier per °C above okC. */
		hazardPerDegree: number;
	};
	economy: {
		/** Penalty per tick a running inference/serving job's rack is down, as fraction of its pay rate. */
		slaPenaltyFactor: number;
		/** Contracts offered at most this many at a time. */
		maxOffers: number;
		/** New contract offer roughly every N ticks. */
		offerIntervalTicks: number;
		/** Offers expire after N ticks if not accepted. */
		offerExpiryTicks: number;
	};
	/** Tier thresholds: tier n requires totalPflops ≥ pflops[n-1] AND uptime ≥ uptime[n-1] (rolling day). */
	tiers: { pflops: number[]; uptime: number[]; reward: number[] };
	/** Ministry standing (0..100). Reaching 0 ends the game ("shutdown"). */
	standing: {
		start: number;
		/** Change per completed day with uptime ≥ the current tier's uptime target (+) or below it (−). */
		dailyGood: number;
		dailyBad: number;
		/** Change on a missed training deadline / completed job. */
		jobFailed: number;
		jobCompleted: number;
	};
	/** Research points (RP): earned from delivered compute, spent on tech nodes. */
	research: {
		/** RP per PFLOP-hour of delivered compute (all job kinds). */
		pointsPerPflopHour: number;
		/** RP bonus per completed job. */
		pointsPerJob: number;
	};
	/** Contracts Clerk (auto-accept), unlocked by a tech node with the `contractsClerk` feature. */
	clerk: {
		/** Share of each clerk-accepted job's earnings kept by the clerk (0..1). */
		feeShare: number;
	};
	/** Ministry Credit Office. */
	loans: {
		/** Max outstanding principal by clearance: index = tier − 1 (same indexing as `tiers`). */
		maxByTier: number[];
		/** Interest charged at midnight on the outstanding principal (e.g. 0.004 = 0.4 %/day). */
		dailyRate: number;
	};
	/** Ministry levy: share of a day's positive profit (revenue − costs) charged at midnight. */
	tax: { profitShare: number };
	/** Quarterly audit: every `periodDays` the Ministry grades the facility (see `QuarterReport` in sim/api). */
	audit: {
		periodDays: number;
		/** Standing change per grade A..E. */
		standingByGrade: number[];
		/** Cash grant (+) or fine (−) per grade A..E, as a share of the quarter's revenue. */
		cashShareByGrade: number[];
	};
	events: {
		/** Mean ticks between new memos (seeded jitter ±50%). */
		intervalTicks: number;
		/** At most this many unresolved memos at once. */
		maxOpen: number;
		/** First memo no earlier than this tick (lets the player settle in). */
		graceTicks: number;
	};
}

export type JobKind = "training" | "finetune" | "inference";

/** Client company template used by the contract generator. */
export interface ClientTemplate {
	id: string;
	name: string;
	sector: "frontier" | "biotech" | "finance" | "gov" | "climate" | "media";
	/** Relative weight when picking a client. */
	weight: number;
	kinds: JobKind[];
	/** Min tier before this client shows up. */
	minTier: number;
	/** Pay multiplier on top of the base rate. */
	payMultiplier: number;
	/** Requires all allocated racks to be liquid-cooled. */
	needsLiquid?: boolean;
}

/** A contract as generated; the sim assigns the id. */
export interface ContractSpec {
	clientId: string;
	clientName: string;
	kind: JobKind;
	/** Total work in PFLOP-hours (training/finetune). For inference: required PFLOPS sustained. */
	work: number;
	/** inference only: required sustained PFLOPS. */
	sustainedPflops?: number;
	/** Duration in ticks (inference runs this long; training must finish within it). */
	durationTicks: number;
	/** Training/finetune: paid on completion. Inference: paid per tick while meeting sustainedPflops. */
	payout: number;
	/** Penalty if a training job misses its deadline. */
	penalty: number;
	needsLiquid: boolean;
	/**
	 * Dataset size. While running, Σ storageTB of running jobs must be ≤ Σ storageTB of
	 * powered storage racks, else the newest jobs stall. 0 for inference.
	 */
	storageTB: number;
	/** Training checkpoints every N ticks: on rack failure, progress rolls back to last checkpoint. */
	checkpointTicks: number;
}

export interface ContractGenContext {
	tier: number;
	/** Current total PFLOPS capacity of the facility (to scale job sizes). */
	capacityPflops: number;
	day: number;
}

/** Deterministic: must use only `rng` (returns [0,1)) for randomness. */
export type ContractGenerator = (rng: () => number, ctx: ContractGenContext, db: ContentDB) => ContractSpec;

export interface Scenario {
	id: string;
	name: string;
	/** Lot width in tiles. */
	width: number;
	floorMin: number;
	floorMax: number;
	/** Pre-built slab spans: [floor, x0, x1] inclusive. */
	slabs: [number, number, number][];
	/** Pre-placed facilities. */
	facilities: { defId: string; floor: number; x: number }[];
	/** Pre-built conduits: [layer, floor, x0, x1] horizontal runs inclusive. */
	conduits: ["power" | "coolant", number, number, number][];
	lifts: { x: number; floorMin: number; floorMax: number }[];
	bots: { defId: string; floor: number; x: number }[];
	spareParts: number;
}

// ─── Ministry memos (events) ──────────────────────────────────────────

export type EventCategory = "ministry" | "environmental" | "operational" | "client" | "horror";

/**
 * Effects are applied by the sim when a memo choice is resolved (or when the memo times out with its default choice).
 * Durations are in ticks. Multipliers stack multiplicatively while active.
 */
export type EventEffect =
	| { type: "cash"; amount: number }
	| { type: "standing"; amount: number }
	/** Ambient temperature offset (heatwave / cold snap). */
	| { type: "ambient"; deltaC: number; durationTicks: number }
	/** Grid import capacity multiplier (brownout = 0.5, blackout = 0). */
	| { type: "gridCap"; factor: number; durationTicks: number }
	/** Grid energy price multiplier. */
	| { type: "energyPrice"; factor: number; durationTicks: number }
	/** Contract payout multiplier for new offers. */
	| { type: "payout"; factor: number; durationTicks: number }
	/** Rack failure-rate multiplier. */
	| { type: "failureRate"; factor: number; durationTicks: number }
	/** Immediately fail N random healthy racks (seeded). */
	| { type: "failRacks"; count: number }
	| { type: "spareParts"; count: number };

export interface EventChoice {
	/** Stable id, e.g. "approve" | "deny" | "file". */
	id: string;
	/** Button label in Ministry voice, e.g. "APPROVE", "DENY", "FILE IN TRIPLICATE". */
	label: string;
	/** One-line plain-English consequence shown under the button (must state the real numbers). */
	hint: string;
	/** Memo shown after resolving. */
	outcome: string;
	effects: EventEffect[];
}

export interface EventDef {
	id: string;
	category: EventCategory;
	/** Memo heading. */
	title: string;
	/** Memo body: dry Ministry prose, 1–3 short paragraphs separated by "\n\n". */
	body: string;
	/** Relative pick weight among eligible events. */
	weight: number;
	minTier: number;
	maxTier?: number;
	/** Not before this game day. */
	minDay?: number;
	/** Min days before the same event may recur. */
	cooldownDays: number;
	/**
	 * Scripted: issued exactly once, at 09:00 on this game day, regardless of weight, cooldown and timing (still subject to
	 * minTier/maxTier). Never picked randomly.
	 */
	scriptedDay?: number;
	/** Auto-resolve with `defaultChoice` after this many ticks unanswered. */
	timeoutTicks: number;
	defaultChoice: string;
	choices: EventChoice[];
}

// ─── Research (tech tree) ─────────────────────────────────────────────

export type TechBranch = "compute" | "cooling" | "power" | "logistics" | "administration";

/** Permanent multipliers granted by researched tech; they stack multiplicatively. */
export type PerkKind =
	| "failureRate" // rack failure hazard
	| "energyPrice" // grid energy price
	| "payout" // payout of new offers
	| "coolingCapacity" // crah, chiller and cdu capacity
	| "repairSpeed" // divides bot repair ticks
	| "upkeep" // facility upkeep
	| "researchRate" // RP earned
	| "botSpeed"; // bot walk/fly speed

/** Gameplay features switched on by tech. */
export type FeatureId = "contractsClerk";

export type TechEffect = { type: "perk"; kind: PerkKind; factor: number } | { type: "feature"; feature: FeatureId };

export interface TechNode {
	id: string;
	name: string;
	/** One or two sentences in Ministry voice that also state the real effect. */
	description: string;
	branch: TechBranch;
	/** Clearance (tier) required before it can be researched. */
	minTier: number;
	/** Research points. */
	cost: number;
	/** Tech ids that must be researched first. */
	requires: string[];
	/** Perks and features. Facility/bot unlocks are declared on the facility/bot (`tech`). */
	effects: TechEffect[];
}

export interface ContentDB {
	facilities: Record<string, FacilityDef>;
	bots: Record<string, BotDef>;
	clients: ClientTemplate[];
	structure: StructureCosts;
	lift: LiftSpec;
	balance: Balance;
	scenarios: Record<string, Scenario>;
	events: EventDef[];
	tech: TechNode[];
	generateContract: ContractGenerator;
}
