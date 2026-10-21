/**
 * CONTRACT — owned by the orchestrator. Changes need orchestrator sign-off
 * because `sim`, `render`, `ui` and `audio` all depend on these shapes.
 *
 * Everything the player can place (except slabs, conduits and lifts) is a
 * FacilityDef. Facilities sit on a single floor and span `width` tiles.
 * Units: kW, kWh, °C, $, ticks (1 tick = 1 game-minute).
 */

/** `bio`: the Wetware tab (nutrient plant, sterile bay, quarantine, bioreactor, organoid racks may also live here). */
export type BuildCategory = "rack" | "power" | "cooling" | "logistics" | "bio";

export type FacilityKind =
	| "rack" // IT load: produces FLOPS and heat
	| "grid_tie" // utility connection: power source, capped import
	| "genset" // backup generator: starts after a delay when the net is short
	| "ups" // battery: charges from surplus, bridges shortfalls
	| "crah" // air handler: removes heat from air cells within `radius` tiles on its floor
	| "chiller" // coolant source: removes heat from a coolant net, uses power = Q / COP
	| "cdu" // coolant distribution unit: adds coolant capacity cap for liquid racks on its net
	| "depot" // parts depot: bots pick spare parts here
	| "charger" // bot dock: bots spawn & recharge here
	// ── Biotech (M3) ──
	| "nutrient" // nutrient plant: feeds a nutrient net (`bio.nutrientCapacity`)
	| "sterilizer" // sterile bay / culling room: removes contamination within `bio.radius` (and growths if `bio.cullsGrowths`)
	| "quarantine" // quarantine lock: contamination barely crosses its cells (`balance.bio.quarantineLeak`)
	| "bioreactor" // power source fed by the nutrient net (`power.capacityKw`), emits contamination
	// ── Greentech (M4) ──
	| "solar" // power source: `power.capacityKw` × daylight (0 at night, peak at 13:00) × weather
	| "wind" // power source: `power.capacityKw` × seeded wind (changes hourly; Dunkelflaute pulls it down)
	| "heat_export" // district-heat exchanger: removes up to `green.exportKw` of heat from air cells within `green.radius` and sells it
	| "carbon"; // carbon capture / algae façade: earns `green.creditsPerDay` carbon credits (paid at midnight)

/** `bio`: organoid tissue. Needs a nutrient net and a temperature band (`rack.bio`); too cold is also a fault. */
export type CoolingMode = "air" | "dlc" | "immersion" | "bio";

/** Organoid/wetware rack parameters (racks with `cooling: "bio"`). */
export interface OrganoidSpec {
	/** Ideal die (tissue) temperature, °C (e.g. 37). */
	targetC: number;
	/** Full speed within ±toleranceC; clock falls off linearly to `minClock` at ±2×tolerance; beyond 3× the tissue fails. */
	toleranceC: number;
	/** Nutrient units drawn per tick at full load. */
	nutrientUse: number;
	/** Contamination emitted into its own cells per tick at full load (0..1 units). */
	contamination: number;
}

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
	/** cooling "bio" only. */
	bio?: OrganoidSpec;
}

/** Greentech parameters for kinds heat_export / carbon. */
export interface GreenSpec {
	/** heat_export: max heat removed and sold, kW. */
	exportKw?: number;
	/** heat_export: reach in tiles on its own floor. */
	radius?: number;
	/** carbon: credits earned per day while powered (each credit pays `balance.green.creditPrice`). */
	creditsPerDay?: number;
}

/** Biotech plant parameters for kinds nutrient / sterilizer / bioreactor (and growth sources). */
export interface BioSpec {
	/** nutrient: units per tick supplied to its nutrient net. */
	nutrientCapacity?: number;
	/** bioreactor: nutrient units per tick consumed at full output. */
	nutrientUse?: number;
	/** sterilizer: contamination removed per tick from each cell within `radius` (scaled by power satisfaction). */
	cleanRate?: number;
	/** sterilizer: reach in tiles on its own floor. */
	radius?: number;
	/** sterilizer: also kills growths within `radius` (culling room). */
	cullsGrowths?: boolean;
	/** Contamination emitted into its own cells per tick while running (bioreactor, growths). */
	contamination?: number;
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
	/** Requires a nutrient conduit under at least one of its cells. */
	needsNutrient?: boolean;
}

/** A short real quotation shown as quiet flavour text. Every one is recorded, with a verification URL, in docs/QUOTES.md. */
export interface Flavor {
	quote: string;
	author: string;
	/** Short citation shown on hover, e.g. "Mind, 1950". */
	source?: string;
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
	/** Superseded: not offered for building, but saves that already hold one keep working. */
	retired?: boolean;
	bio?: BioSpec;
	green?: GreenSpec;
	/**
	 * Growth: never buildable by the player; the sim sprouts it on contaminated empty slab. It works without
	 * conduits (free, unreliable), can be demolished, and counts as a `grown` facility in the view.
	 */
	growth?: boolean;
	flavor?: Flavor;
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
	flavor?: Flavor;
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
	tiers: {
		pflops: number[];
		uptime: number[];
		reward: number[];
		/** Minimum researched tech nodes to reach tier n (index n−1; 0 or absent = no research needed). */
		techs?: number[];
	};
	/** Ministry standing (0..100). Reaching 0 ends the game ("shutdown"). */
	standing: {
		start: number;
		/** Change per completed day with uptime ≥ the current tier's uptime target (+) or below it (−). */
		dailyGood: number;
		/** Daily change when the uptime target is missed by `dailyMissSpan` or more. */
		dailyBad: number;
		/** Daily change for a near miss (shortfall → 0); in between it scales linearly. */
		dailyNearMiss: number;
		/** Uptime shortfall (0..1) at which the daily change reaches `dailyBad`. */
		dailyMissSpan: number;
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
	/** Contamination field, mutations, growths (M3). Contamination is 0..1 per cell. */
	bio: {
		/** Share of the difference exchanged with each open neighbour per tick (slab-separated floors use `slabFactor`). */
		diffusion: number;
		slabFactor: number;
		/** Fraction lost per tick everywhere. */
		decay: number;
		/** Share of normal diffusion that crosses a quarantine cell (0 = sealed). */
		quarantineLeak: number;
		/** Rack failure hazard ×(1 + k × contamination at the rack). */
		hazardPerContamination: number;
		/** Bot speed ×(1 − k × contamination at the bot), floored at 0.3. */
		botSlowPerContamination: number;
		/** A bot mutates after this many ticks (cumulative) on cells at or above `mutationThreshold`. */
		mutationThreshold: number;
		mutationExposureTicks: number;
		/** Empty slab cells at or above this contamination may sprout a growth. */
		growthThreshold: number;
		/** Chance per qualifying cell per day (rolled hourly with the right share). */
		growthChancePerDay: number;
		/** Contaminated share (cells ≥ 0.5 among built cells) beyond which resisting gets much harder. */
		irreversibleShare: number;
		/** Sterilizer effectiveness multiplier once irreversible. */
		irreversibleCleanFactor: number;
		/** $ per nutrient unit supplied. */
		nutrientPrice: number;
	};
	/** Ascension: the path is chosen at `minTier` (Clearance), once, and never changes. */
	ascension: { minTier: number };
	/** Path endings (biotech in M3). Each must hold continuously for `days` days. */
	endings: {
		/** Embrace: corruption ≥ minCorruption and organoid PFLOPS ≥ pflops. */
		livingTower: { minCorruption: number; pflops: number; days: number };
		/** Resist: corruption ≤ maxCorruption and organoid PFLOPS ≥ pflops. */
		cleanTower: { maxCorruption: number; pflops: number; days: number };
		/** Secret: corruption reaches this (any path, at Clearance ≥ ascension.minTier). */
		absorbed: { corruption: number };
		/** Greentech: path green, green score ≥ minScore and Σ delivered PFLOPS ≥ pflops, for `days` days. */
		greenExemplar?: { minScore: number; pflops: number; days: number };
		/** Synthetic: path synthetic, refinement ≥ minScore and Σ delivered PFLOPS ≥ pflops, for `days` days. */
		millionMinds?: { minScore: number; pflops: number; days: number };
	};
	/** Greentech economy (M4). */
	green: {
		/** $ per kWh of heat sold by heat exporters. */
		heatPrice: number;
		/** $ per carbon credit. */
		creditPrice: number;
		/** Dunkelflaute: chance per day of a calm, dark spell that pulls solar and wind to `droughtFactor` for `droughtHours`. */
		droughtChancePerDay: number;
		droughtFactor: number;
		droughtHours: number;
	};
	/** Automation (M4): standing orders the player can toggle. */
	automation: {
		/** Spare parts are bought in batches of this size. */
		partsBatch: number;
		/** The Foreman places at most this many facilities per game-hour. */
		foremanPerHour: number;
	};
	events: {
		/** Mean ticks between new advisor decisions (seeded jitter ±50%). */
		intervalTicks: number;
		/** First decision no earlier than this tick (lets the player settle in). */
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
	/** Requires organoid (`cooling: "bio"`) racks; pays the bio premium via payMultiplier. */
	needsBio?: boolean;
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
	/** Only organoid (`cooling: "bio"`) racks may serve it. Absent = false. */
	needsBio?: boolean;
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
	/** One or two sentences for the title screen's scenario picker. */
	description?: string;
	/** Overrides `balance.startingCash`. */
	startingCash?: number;
	/** Starting clearance (default 1). */
	startTier?: number;
	/** Sandbox: no bankruptcy and no Ministry shutdown; audits still filed. */
	sandbox?: boolean;
}

// ─── Advisor decisions (events) ───────────────────────────────────────

/** The four advisors: Cass Parr (Facilities, Cooling), Bea Altasar (Power, Green), Dr. Mel Kiorre (Compute, Wetware, Synthetic), Lucien Ferro (CFO). */
export type AdvisorId = "cass" | "bea" | "mel" | "lucien";
export const ADVISOR_IDS: readonly AdvisorId[] = ["cass", "bea", "mel", "lucien"];

/** One specialist's vote on a multi-area decision: backs the recommended option (approve) or not. */
export interface EventVote {
	advisor: "cass" | "bea" | "mel";
	approve: boolean;
	/** One short line of reasoning. */
	line: string;
}

export type EventCategory = "ministry" | "environmental" | "operational" | "client" | "horror";

/**
 * Effects are applied by the sim when the player resolves a decision. Waiting never applies anything.
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
	| { type: "spareParts"; count: number }
	/** Nudge the tower toward an ascension path (affinity points; see SimView.affinity). */
	| { type: "affinity"; path: AscensionPath; amount: number };

export interface EventChoice {
	/** Stable id, e.g. "approve" | "deny" | "file". */
	id: string;
	/** Button label in Ministry voice, e.g. "APPROVE", "DENY", "FILE IN TRIPLICATE". */
	label: string;
	/** One-line plain-English consequence shown under the button (must state the real numbers). */
	hint: string;
	/** Text shown after resolving. */
	outcome: string;
	effects: EventEffect[];
}

export interface EventDef {
	id: string;
	category: EventCategory;
	/** The advisor who brings it. */
	advisor: AdvisorId;
	/** Decision heading. */
	title: string;
	/** Advisor text: short, numbers first, under 40 words. */
	body: string;
	/** Relative pick weight among eligible events. */
	weight: number;
	minTier: number;
	maxTier?: number;
	/** Not before this game day. */
	minDay?: number;
	/** Min days before the same event may recur. */
	cooldownDays: number;
	/** Only when `view.corruption` ≥ this (horror escalation). */
	minCorruption?: number;
	/** Only after this ascension path was chosen. */
	path?: AscensionPath;
	/**
	 * Scripted: issued exactly once, at 09:00 on this game day, regardless of weight, cooldown and timing (still subject to
	 * minTier/maxTier). Never picked randomly.
	 */
	scriptedDay?: number;
	/** The advisor's recommended choice id (marked on the card). */
	recommended: string;
	/** MAGI vote (Cass, Bea, Mel, in that order) when the decision touches more than one specialist area. Lucien then names the price. */
	votes?: EventVote[];
	choices: EventChoice[];
}

// ─── Research (tech tree) ─────────────────────────────────────────────

export type TechBranch = "compute" | "cooling" | "power" | "logistics" | "administration" | "wetware";

/** Lanes of the research tree: one row-group per branch of the player's choices. Wetware, Green and Synthetic are path lanes. */
export type TechLane = "adm" | "log" | "pow" | "cool" | "comp" | "wet" | "green" | "syn";

/** Equipment line inside the Cooling and Compute lanes. */
export type TechLine = "air" | "liquid" | "immersion";

/** Identity and advisor pitch of one research lane (data/lanes.json); the tree shows it on hover and in the Inspector. */
export interface LaneDef {
	id: TechLane;
	name: string;
	/** Short label for chips and narrow headers. */
	short: string;
	/** Present for the path lanes (Wetware, Green, Synthetic). */
	path?: AscensionPath;
	/** Lane colour (hex). */
	color: string;
	/** Advisor who sells the lane: Cass Parr, Bea Altasar, Dr. Mel Kiorre or Lucien Ferro. */
	advisor: string;
	/** What the lane is for, in a few words. */
	identity: string;
	/** A number or two the player can check against the catalogue. */
	signature: string;
	/** One line in the advisor's voice: why go down this lane. */
	pitch: string;
}

export type AscensionPath = "biotech" | "greentech" | "synthetic";

/** Ending ids (see `Balance.endings`). */
export type EndingId = "livingTower" | "cleanTower" | "absorbed" | "greenExemplar" | "millionMinds";

/** Text of an ending, shown on the game-over sheet. */
export interface EndingDef {
	id: EndingId;
	title: string;
	/** Ministry prose, paragraphs separated by "\n\n". */
	body: string;
}

/** An ascension path as offered at Clearance `balance.ascension.minTier`. */
export interface PathDef {
	id: AscensionPath;
	name: string;
	description: string;
	/** False = shown as "coming soon" and cannot be chosen. */
	available: boolean;
}

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
/** contractsClerk: auto-accept offers. foreman: auto-build (Automation drawer). foremanPace: the Foreman builds twice as many facilities per hour. */
export type FeatureId = "contractsClerk" | "foreman" | "foremanPace";

export type TechEffect = { type: "perk"; kind: PerkKind; factor: number } | { type: "feature"; feature: FeatureId };

export interface TechNode {
	id: string;
	name: string;
	/** One or two sentences in Ministry voice that also state the real effect. */
	description: string;
	branch: TechBranch;
	/** Row-group in the research tree (see `LaneDef`). Content validation requires it; hand-built test fixtures may omit it (the UI falls back to the branch). */
	lane?: TechLane;
	/** Equipment line (Air, Liquid, Immersion) for nodes in the Cooling and Compute lanes; absent = no sub-lane. */
	line?: TechLine;
	/** Clearance (tier) required before it can be researched. */
	minTier: number;
	/** Research points. */
	cost: number;
	/** Tech ids that must be researched first. */
	requires: string[];
	/** Perks and features. Facility/bot unlocks are declared on the facility/bot (`tech`). */
	effects: TechEffect[];
	/** Only researchable after this ascension path was chosen. */
	path?: AscensionPath;
	flavor?: Flavor;
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
	/** Research tree lanes, in display order (always present in loaded content). */
	lanes?: LaneDef[];
	paths: PathDef[];
	endings: EndingDef[];
	generateContract: ContractGenerator;
}
