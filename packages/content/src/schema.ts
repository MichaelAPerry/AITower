/**
 * CONTRACT — owned by the orchestrator. Changes need orchestrator sign-off
 * because `sim`, `render`, `ui` and `audio` all depend on these shapes.
 *
 * Everything the player can place (except slabs, conduits and lifts) is a
 * FacilityDef. Facilities sit on a single floor and span `width` tiles.
 * Units: kW, kWh, °C, $, ticks (1 tick = 1 game-minute).
 */

/** The build-menu categories. Wetware items are filed under these too: organoid racks under rack, bioreactors under power, the rest under cooling. */
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
	| "carbon" // carbon capture / algae façade: earns `green.creditsPerDay` carbon credits (paid at midnight)
	// ── Synthetic special ──
	| "transfer"; // consciousness transfer unit: while powered, moves one person into the Lattice every `transfer.everyHours` hours (SP)

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
	/** crah: the temperature it pulls the air toward, °C (default 20). A perfusion unit holds tissue at 37. */
	holdC?: number;
	/** crah: only cells under organoid (bio-cooled) racks are cooled (perfusion units). */
	bioOnly?: boolean;
	/** crah: outside-air cooling. Full capacity at or below `fullBelowC` ambient, falling linearly to `hotFactor` at `hotC` (and flat beyond). */
	freeAir?: { fullBelowC: number; hotC: number; hotFactor: number };
	/** crah: racks within `radius` on its floor fail at this multiple of their rate (a cold room). */
	failureFactor?: number;
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
	/** Only on the roof: the top floor of the tower as built (canopy, wind mast). */
	roofOnly?: boolean;
	/** Only on a tile at the edge of the floor slab (an exterior wall: PV wall panels). */
	exteriorOnly?: boolean;
	/** Only in a basement (floor below 0: the geothermal well). */
	basementOnly?: boolean;
}

/** A short real quotation shown as quiet flavour text. Every one is recorded, with a verification URL, in docs/QUOTES.md. */
export interface Flavor {
	quote: string;
	author: string;
	/** Short citation shown on hover, e.g. "Mind, 1950". */
	source?: string;
}

/** One person is transferred every `everyHours` game hours (at hour 0, `everyHours`, ...) while the unit is enabled, working and powered; each adds `sp` Synthetic SP. */
export interface TransferSpec {
	everyHours: number;
	sp: number;
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
	/** Consciousness Transfer Unit (kind "transfer"): the schedule and the SP of one transfer. */
	transfer?: TransferSpec;
	flavor?: Flavor;
	/**
	 * The reframe (docs/REFRAME.md): the rung of a tree rack, 1..4. A rung rack is never placed from the menu: it is reached by
	 * retrofitting a base rack (or the previous rung of its tree) in place. Absent on base racks and on everything that is not a tree rack.
	 */
	rung?: number;
	/** The item this one upgrades: placing this on top of it swaps in place and costs `cost` minus half of the old item's cost. Support items only: racks retrofit. */
	upgradesFrom?: string;
	/**
	 * The Soul (docs/SOUL.md): which Singularity tree this item belongs to. Absent = "shared". Drives SP weights and the
	 * tree badge on build cards.
	 */
	line?: TreeLine;
	/**
	 * Secret numbers. Placing it adds the positive values to that tree's permanent scar; while it runs it adds
	 * value × `soul.residuePerDay` per day to the tree's residue (negative values clean residue). Hidden from the player
	 * unless the tree's champion trusts them (bond ≥ `soul.bondReveal`).
	 */
	seal?: SealSpec;
}

/** The tree a facility belongs to. */
export type TreeLine = "shared" | "synthetic" | "biotech" | "greentech";
/** The two trees that can be sealed (Synthetic never closes). */
export type SealedTree = "biotech" | "greentech";
export const SEALED_TREES: readonly SealedTree[] = ["biotech", "greentech"];
export type SealSpec = Partial<Record<SealedTree, number>>;

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
	/** Tier thresholds: tier n requires totalPflops ≥ pflops[n-1] and techs[n-1] researched nodes. `uptime[n-1]` is that Level's operating target, which the quarterly audit grades (it is not a gate). */
	tiers: {
		pflops: number[];
		uptime: number[];
		reward: number[];
		/** Minimum researched tech nodes to reach tier n (index n−1; 0 or absent = no research needed). */
		techs?: number[];
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
	/** Ascension: the path is chosen at `minTier` (Level), once. A sealed tree throws the player back onto Synthetic. */
	ascension: { minTier: number };
	/** Failure endings that are not bankruptcy or shutdown. */
	endings: {
		/** Absorbed: corruption reaches this (any path, at Level ≥ ascension.minTier). */
		absorbed: { corruption: number };
	};
	/** The Soul (docs/SOUL.md): Singularity points, secret seal numbers and advisor bonds. */
	soul: SoulBalance;
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
	/** A lesson scenario: the id of the `LessonDef` this site runs (it never appears in the Free Build picker). */
	lesson?: string;
	/** Tech already researched when the site opens (lessons that start mid-game). */
	researched?: string[];
}

// ─── Lessons (M6.4) ───────────────────────────────────────────────────

/** Values the sim already tracks that a lesson may test. Everything is read from the tick that was just solved. */
export type LessonMetric =
	/** Compute racks built (any state). */
	| "racks"
	/** Compute racks that hold a job and are powered. */
	| "racksBusy"
	/** Compute racks that have no power (a blackout). */
	| "racksDark"
	| "gensets"
	/** Power on offer minus power demanded, as a percentage of the power on offer (all nets). Negative when short. */
	| "headroomPct"
	/** Demand in kW (all nets). */
	| "demandKw"
	/** Supply in kW (all nets). */
	| "supplyKw"
	/** kW demanded beyond what is on offer (0 when covered). */
	| "shortKw"
	/** Hottest rack, °C. */
	| "maxRackC"
	| "uptime"
	| "cash"
	| "pflops"
	| "day"
	/** Air handlers, chillers and coolant units standing. */
	| "coolers"
	/** Storage arrays and tape libraries standing. */
	| "storageRacks"
	/** Jobs queued, running or stalled (accepted and not finished). */
	| "jobsLive"
	/** Jobs stalled for want of storage. */
	| "jobsStalled"
	/** Jobs finished and paid since the lesson began. */
	| "jobsDone"
	/** Contract offers waiting on the board. */
	| "offers"
	/** Spare parts in the depots. */
	| "parts"
	/** Maintenance bots. */
	| "bots"
	/** Tech nodes researched. */
	| "techs"
	/** Research points on hand. */
	| "rp"
	/** The Level (tier). */
	| "tier"
	/** 1 when the Foreman is switched on. */
	| "foreman"
	/** Racks retrofitted down a tree. */
	| "treeRacks"
	/** Power Usage Effectiveness, as the sim computes it (0 until something runs). */
	| "pue"
	/** Solar panels and wind masts standing. */
	| "cleanPower"
	/** Green Singularity points banked. */
	| "greenSp"
	/** Lesson prompts the player has acknowledged in the UI (a panel opened). Counts the "les:" tips. */
	| "tips"
	/** Battery banks standing. */
	| "batteries"
	/** Battery charge, % of the storage on hand (100 when there is no battery). */
	| "upsPct"
	/** Game-minutes the racks were dark or over capacity during this lesson (after its first scripted beat). */
	| "downTicks"
	/** Lowest headroom % seen while the success conditions held (100 until they do). */
	| "minHeadroom"
	/** Lowest cash seen during this lesson, $. */
	| "minCash"
	/** Game-minutes during this lesson in which every battery bank stood empty. */
	| "drainTicks"
	/** Game-minutes during this lesson in which a job's data did not fit in the powered storage. */
	| "stallTicks"
	/** Game-minutes during this lesson in which the Foreman was on. */
	| "foremanTicks"
	/** Scripted beats fired so far. */
	| "beats"
	/** Grid import now, as % of what the intakes can give (0 while a feeder trip is on). */
	| "gridPct";
export type LessonOp = ">=" | ">" | "<=" | "<";
export interface LessonCond {
	metric: LessonMetric;
	op: LessonOp;
	value: number;
}
/** What a scripted beat does to the sim when it fires. */
export type LessonEffect =
	/** A client job starts at once (inference; needs `pflops` sustained). */
	| { type: "job"; pflops: number; durationTicks: number; payout: number }
	/** The grid import is scaled by `factor` for `durationTicks` (0 = a tripped feeder). */
	| { type: "gridCap"; factor: number; durationTicks: number; label: string }
	/** Component failures are scaled by `factor` for `durationTicks` (0 = nothing breaks). */
	| { type: "failureRate"; factor: number; durationTicks: number; label: string }
	/** A contract offer appears on the board (a client the lesson picks; the player still accepts it). `storageTB` > 0 makes it a training job that needs storage. */
	| { type: "offer"; kind: "inference" | "training"; pflops: number; durationTicks: number; payout: number; storageTB?: number; workPfh?: number; client?: string }
	/** Research points are handed over. */
	| { type: "rp"; amount: number };
/** A scripted moment: fires once, the first tick every `when` holds. */
export interface LessonBeat {
	id: string;
	when: LessonCond[];
	effects: LessonEffect[];
}
/** One checklist line. Steps complete in order; a done step stays done. */
export interface LessonStep {
	id: string;
	/** The checklist line. */
	text: string;
	/** Done when all hold. */
	when: LessonCond[];
	/** What the player may build from this step on: facility ids, each with an optional cap on how many may exist. */
	allow: { defId: string; max?: number }[];
	/** The teacher's lines for this step, shown one at a time. Markup {{term|label}} links a Handbook term. */
	say: string[];
	/** Optional: the blueprint slot to highlight for a placement step. */
	slot?: { floor: number; x: number; defId: string };
	/** Lines the teacher says once the step is done (and `afterBeat`, if given, has fired). */
	after?: string[];
	afterBeat?: string;
	/** The overlay to switch on when this step begins. */
	overlay?: "normal" | "heat" | "power" | "coolant";
	/** Who speaks this step's lines, when it is not the lesson's own advisor. */
	advisor?: AdvisorId;
	/** Drawers (tabs on the screen edge) the player may open from this step on: "contracts", "research", "automation", "insights". The Handbook is always open. */
	drawers?: string[];
	/** The Supplies tab (spare parts, bots) is open from this step on. */
	supplies?: boolean;
	/** While this step is current, opening this panel counts as the step's action: the UI marks the tip `les:<step id>` (metric `tips`). */
	panel?: "trees";
	/** Pan the camera here while this step is current (a rack to click, say). */
	focus?: { floor: number; x: number };
	/** Extra things to pulse while this step is current: CSS selectors inside the HUD (e.g. `[data-tut="dtab-contracts"]`). */
	pulse?: string[];
	/** Pause the clock while the teacher talks (the player presses Continue). */
	pause?: boolean;
	/** Handbook article for the "?" chip on the checklist. */
	handbook?: string;
}
export interface LessonDef {
	id: string;
	number: number;
	title: string;
	advisor: AdvisorId;
	/** The real datacenter concept, one sentence (Lessons tab, result screen). */
	concept: string;
	/** The goal bar: "Two racks, one day, no blackouts." */
	goal: string;
	/** The scenario this lesson runs on (`Scenario.lesson` points back). */
	scenario: string;
	/** Speed the game runs at (the lesson sets it; the player may change it). */
	speed: 1 | 3 | 10;
	/** Effects applied when the lesson starts, before tick 0 (a permanent feeder limit, say). Only `gridCap` and `failureRate` are supported. */
	setup?: LessonEffect[];
	/** Command types the player may issue; any other is refused ("Not part of this lesson"). */
	commands: string[];
	/** Tech ids the player may research (any other is refused). Absent = research is not part of the lesson. */
	research?: string[];
	/** The goal bar shows the power meter (load, capacity, headroom). */
	meter?: boolean;
	/** Label for the success-hold bar in the goal bar (e.g. "hours running"); absent = no bar. */
	holdLabel?: string;
	/** False: no stars; finishing is the reward. Default true. */
	starred?: boolean;
	/** The result screen's line when the lesson is lost (default: ran out of money). */
	failed?: string;
	/** The result screen's "Passed" line. */
	passed?: string;
	steps: LessonStep[];
	beats: LessonBeat[];
	/** Success: all hold, continuously, for `holdTicks`. */
	win: { when: LessonCond[]; holdTicks: number };
	/** Failure: any holds. */
	lose: LessonCond[];
	/** Star 2: all hold when the lesson is won (the metrics include the lesson's running tallies, e.g. `downTicks`). Used when `starred` is not false. */
	stars2: LessonCond[];
	/** Star 3: all hold when the lesson is won. */
	stars3: LessonCond[];
	/** The result screen says in plain words what earns star 2 / star 3. */
	star2Text: string;
	star3Text: string;
	/** One line on the result screen. */
	learned: string;
	/** Handbook article ids linked from the result screen. */
	handbook: string[];
	/** Free Build starting-cash bonus the first time it is completed, $. */
	bonus: number;
	/** Teacher's closing line on the result screen. */
	outro: string;
}

// ─── Advisor decisions (events) ───────────────────────────────────────

/** The four advisors: Cass Parr (Facilities, Cooling), Bea Altasar (Power, Green), Dr. Mel Kiorre (Compute, Wetware, Synthetic), Luci Ferro (CFO). */
export type AdvisorId = "cass" | "bea" | "mel" | "luci";
/** Each tree's champion: she argues for it and speaks when it reaches a new rung. */
export const CHAMPION: Record<AscensionPath, AdvisorId> = { synthetic: "luci", biotech: "mel", greentech: "bea" };

/** Tuning for Singularity points, seals and bonds (docs/REFRAME.md). */
export interface SoulBalance {
	/** SP that ends the game with that tree. */
	spTarget: number;
	/** SP per PFLOPS-hour of a tree rack's delivered compute, before the tree's weight and factor. */
	spPerPflopHour: number;
	/** What one PFLOPS of each tree's racks is worth. Base racks score for no tree. */
	spWeights: Record<AscensionPath, number>;
	/** Green racks earn this share of full speed on any power; the rest scales with the green score. */
	greenFloor: number;
	/** A tree is sealed at this seal (scar + residue): no new retrofits, its racks stop scoring. */
	sealMax: number;
	/** Running facilities add seal × this per day to residue. */
	residuePerDay: number;
	/** A placed facility whose seal for a tree is at least this draws an objection from the tree's champion (once per item). */
	objectionScar: number;
	/** Starting bond per advisor (0..100). */
	bondStart: Record<AdvisorId, number>;
	/** Bond needed for the ending epilogue (the advisor with the highest bond at this level or more). */
	bondEpilogue: number;
	/** Bond change when the player takes / overrules an advisor's recommendation. */
	bondFollow: number;
	bondOverrule: number;
}

/** One line of a visual-novel scene. */
export interface SceneLine {
	who: AdvisorId | "narrator";
	text: string;
	/** Portrait expression (default neutral). */
	mood?: "neutral" | "pleased" | "displeased" | "unsettling";
}

/**
 * When a story scene (category "story") is issued: once, as soon as it holds and no other decision is pending. `tick` is absolute;
 * `rung` fires the first time the tower holds a rack of that tree at that rung or higher; `objection` scenes are issued by the sim
 * for a placed item (see `SoulBalance.objectionScar`).
 */
export type StoryTrigger =
	| { kind: "tick"; atLeast: number }
	| { kind: "tier"; atLeast: number }
	| { kind: "rung"; tree: AscensionPath; rung: number }
	| { kind: "objection"; path: SealedTree }
	/** The first time that tree's seal reaches `soul.sealMax`. */
	| { kind: "seal"; tree: SealedTree }
	/** The first time any tree's seal is above `above` (the seal tip). The starter tower begins at 10 and the bar shows whole numbers, so 10.5 is the first visible rise. */
	| { kind: "sealRise"; above: number }
	/** The first time any advisor's bond differs from its `soul.bondStart` (the bond tip: after the first taken or overruled advice). */
	| { kind: "bondMoved" }
	/** The first time that advisor's bond reaches `atLeast`. */
	| { kind: "bond"; advisor: AdvisorId; atLeast: number };
export const ADVISOR_IDS: readonly AdvisorId[] = ["cass", "bea", "mel", "luci"];

/** One specialist's vote on a multi-area decision: backs the recommended option (approve) or not. */
export interface EventVote {
	advisor: "cass" | "bea" | "mel";
	approve: boolean;
	/** One short line of reasoning. */
	line: string;
}

export type EventCategory = "ministry" | "environmental" | "operational" | "client" | "horror" | "story";

/**
 * Effects are applied by the sim when the player resolves a decision. Waiting never applies anything.
 * Durations are in ticks. Multipliers stack multiplicatively while active.
 */
export type EventEffect =
	| { type: "cash"; amount: number }
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
	| { type: "affinity"; path: AscensionPath; amount: number }
	/** Hidden: add to a tree's seal residue (negative cleans it). Never shown as a chip. */
	| { type: "seal"; path: SealedTree; amount: number }
	/** Hidden: change an advisor's bond. Never shown as a chip. */
	| { type: "bond"; advisor: AdvisorId; amount: number }
	/** Add (or remove) Singularity points of a tree directly (Mel's shortcuts, Cass's slow week). */
	| { type: "sp"; path: AscensionPath; amount: number };

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
	/** Story scenes: what the advisors say back after this choice (pushback, approval). */
	reply?: SceneLine[];
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
	/** Story scenes: when the scene is issued (see `StoryTrigger`). */
	trigger?: StoryTrigger;
	/** Story scenes: the dialogue before the choice. `{item}` is replaced by the subject facility's name. */
	lines?: SceneLine[];
	/** Story scenes: the backdrop (a tree floor) and the caption box text. */
	backdrop?: AscensionPath | "title";
	location?: string;
	/** The advisor's recommended choice id (marked on the card). */
	recommended: string;
	/** MAGI vote (Cass, Bea, Mel, in that order) when the decision touches more than one specialist area. Luci then names the price. */
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
	/** Advisor who sells the lane: Cass Parr, Bea Altasar, Dr. Mel Kiorre or Luci Ferro. */
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
export type EndingId = "singularity" | "flesh" | "garden" | "absorbed" | "bankrupt";

/** Text of an ending, shown on the game-over sheet. */
export interface EndingDef {
	id: EndingId;
	title: string;
	/** Prose, paragraphs separated by "\n\n". */
	body: string;
	/** The tree whose floor art stands in until the ending's own painting (`art`) exists (absent = the plain stage). */
	backdrop?: AscensionPath;
	/** File name (no extension) of the ending's own 640x420 painting in packages/ui/src/art, e.g. "bg-end-lattice". */
	art?: string;
	/**
	 * Coda in the voice of the advisor with the highest bond (if ≥ `soul.bondEpilogue`). `fallback` is shown, as narration,
	 * when no advisor qualifies.
	 */
	epilogue?: Partial<Record<AdvisorId, string>> & { fallback?: string };
}

/** A tree: its name and what it is about (the Trees panel and the Handbook). */
export interface PathDef {
	id: AscensionPath;
	name: string;
	description: string;
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
/** contractsClerk: auto-accept offers. foreman: auto-build (Automation drawer). foremanPace: the Foreman builds twice as many facilities per hour. openDoor: taking an advisor's advice gives +1 extra bond. */
export type FeatureId = "contractsClerk" | "foreman" | "foremanPace" | "openDoor";

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
	/** The tree this node leans to (research affinity, lane colour). It gates nothing. */
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
	/** Lessons in order (see `Scenario.lesson`). */
	lessons: LessonDef[];
	events: EventDef[];
	tech: TechNode[];
	/** Research tree lanes, in display order (always present in loaded content). */
	lanes?: LaneDef[];
	paths: PathDef[];
	endings: EndingDef[];
	generateContract: ContractGenerator;
}
