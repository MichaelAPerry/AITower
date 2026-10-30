/**
 * CONTRACT — owned by the orchestrator. This is the only surface `render`,
 * `ui`, `audio` and `app` may use. Changes need orchestrator sign-off.
 *
 * Coordinates: `x` = tile column 0..width-1, `floor` = floorMin..floorMax
 * (0 = ground, negatives = basements). Grid arrays are row-major with
 * index = (floor - floorMin) * width + x.
 *
 * Time: 1 tick = 1 game-minute, 1440 ticks per day. Day 0 starts at 06:00
 * (tick 0 ⇒ minuteOfDay 360).
 */
import type { AdvisorId, AscensionPath, ContentDB, ContractSpec, EndingId, JobKind, SealedTree, TechBranch } from "@aitower/content";

export type { AdvisorId, AscensionPath, EndingId, JobKind, SealedTree };

export const TICKS_PER_DAY = 1440;
export const START_MINUTE_OF_DAY = 360;

// ─── Commands ──────────────────────────────────────────────────────────────

export type ConduitLayer = "power" | "coolant" | "nutrient";

export type SimCommand =
	/** Build floor slab on `floor` from x0..x1 inclusive. Above ground needs slab below; skips cells already built. */
	| { type: "buildSlab"; floor: number; x0: number; x1: number }
	/** Place a facility with its left edge at x. */
	| { type: "place"; defId: string; floor: number; x: number }
	/** Lay conduit on the given cells (any shape; vertical runs are risers). Cells need slab or an adjacent conduit. */
	| { type: "buildConduit"; layer: ConduitLayer; cells: CellRef[] }
	/**
	 * Build a lift shaft at column x spanning floorMin..floorMax (all floors need slab at x). If the span overlaps or touches
	 * an existing lift in that column, that lift is extended instead (one floor is enough; only new floors are paid for).
	 */
	| { type: "buildLift"; x: number; floorMin: number; floorMax: number }
	/**
	 * Demolish whatever is top-most at the cell: facility ▸ lift ▸ conduit (layer
	 * given, or both) ▸ slab. Refunds 50% of cost.
	 */
	| { type: "demolish"; floor: number; x: number; layer?: ConduitLayer }
	| { type: "setEnabled"; facilityId: number; enabled: boolean }
	| { type: "acceptContract"; contractId: number }
	| { type: "declineContract"; contractId: number }
	| { type: "cancelJob"; jobId: number }
	| { type: "buyParts"; count: number }
	/** Spawn a bot at the first charger with space. */
	| { type: "buyBot"; defId: string }
	/** Answer the open advisor decision with one of its choice ids. */
	| { type: "resolveDecision"; decisionId: number; choiceId: string }
	/** "Defer one day": once per decision; it returns a game day later. */
	| { type: "deferDecision"; decisionId: number }
	/** App-side pacing: while closed no new decision is issued (the app closes it for 3 real minutes after each one). */
	| { type: "decisionGate"; open: boolean }
	/** Remember an advisor tip as shown, so it never fires again in this game. */
	| { type: "markTip"; tipId: string }
	/** Spend research points on a tech node (prerequisites researched, tier ≥ minTier, enough RP). */
	| { type: "research"; techId: string }
	/** Set the Contracts Clerk's standing order (needs the `contractsClerk` feature researched). */
	| { type: "setClerk"; policy: ClerkPolicy }
	/** Borrow from the Ministry Credit Office (up to the tier's limit). */
	| { type: "takeLoan"; amount: number }
	/** Repay principal (up to what is owed and what cash allows). */
	| { type: "repayLoan"; amount: number }
	/** Replace the automation standing orders (the Foreman part needs the `foreman` feature researched). */
	| { type: "setAutomation"; policy: AutomationPolicy }
	/**
	 * Swap a facility in place for the next item down its tree (`FacilityDef.upgradesFrom`): costs the new item minus 50% of the old
	 * one. `defId` picks the target when the facility upgrades to more than one item (default: the first one the player may build).
	 */
	| { type: "upgradeFacility"; facilityId: number; defId?: string }
	/**
	 * Retrofit a rack in place toward a tree (docs/REFRAME.md): a base rack, or a rack of another tree, becomes rung 1 of `tree`;
	 * a rack of `tree` becomes its next rung. Same tiles, the tree's sprite. Costs the new rack minus 50% of the old one (a rack of
	 * another tree counts as a plain AC-1). Needs the rung's Level and research, the new rack's site (coolant or nutrient conduit),
	 * and a tree that is not closed (seal below `soul.sealMax`).
	 */
	| { type: "retrofit"; facilityId: number; tree: AscensionPath };

/**
 * Standing orders, each independently toggled. Checked once per game-hour, deterministic, and paid like the player would
 * pay (through the normal commands' rules).
 */
export interface AutomationPolicy {
	/** Spend RP on the next affordable node: first by `branches` order (empty = any branch), then cheapest, then id. */
	research: { enabled: boolean; branches: TechBranch[] };
	/** Keep at least `keep` spare parts in stock (buys `balance.automation.partsBatch` at a time). */
	parts: { enabled: boolean; keep: number };
	/** Keep one bot per `racksPerBot` racks, up to `maxBots` (buys the best unlocked bot type). */
	bots: { enabled: boolean; racksPerBot: number; maxBots: number };
	/**
	 * The Foreman places facilities on already-built slab with a power conduit under it: compute racks when offers go
	 * unserved, an air handler when racks run hot, a grid tie / genset when power is short. It never spends below `reserve`
	 * and places at most `balance.automation.foremanPerHour` per hour. It never builds slab, floors or conduits (yet).
	 */
	foreman: ForemanPolicy;
}

/** Which rack line the Foreman builds: one cooling line, or "auto" (best PFLOPS per dollar of what it can support). */
export type ForemanLine = "auto" | "air" | "liquid" | "immersion";
/** Highest tier a category may build: "auto" is the highest unlocked (no cap). Path items need the path chosen, whatever the cap. */
export type ForemanTierCap = "auto" | "standard" | "advanced" | "frontier";

/**
 * The Foreman's build spec. `racks`, `cooling` and `power` switch the three kinds of job. Racks follow `rackLine` ("Racks: Liquid line")
 * and build the best unlocked item of it up to `rackCap`; cooling matches the racks and power matches the load, each up to its own cap.
 * With `cooling` / `power` on, a rack is only placed with cooling / power headroom, and the support item is queued first.
 */
export interface ForemanPolicy {
	enabled: boolean;
	reserve: number;
	racks: boolean;
	cooling: boolean;
	power: boolean;
	rackLine: ForemanLine;
	rackCap: ForemanTierCap;
	coolingCap: ForemanTierCap;
	powerCap: ForemanTierCap;
}

/**
 * The clerk accepts, once per tick at most, the oldest offer that can start (same check as acceptContract) and matches
 * every rule. Its fee (`balance.clerk.feeShare`) is withheld from that job's earnings.
 */
export interface ClerkPolicy {
	enabled: boolean;
	/** Job kinds it may accept. */
	kinds: JobKind[];
	/** Minimum pay in $ per PFLOP-hour (see `payPerPflopHour`). 0 = any. */
	minPayPerPflopHour: number;
	/** Never accept an offer whose missed-deadline penalty exceeds this ($). 0 = no limit. */
	maxPenalty: number;
	/** May accept offers that need liquid-cooled racks. */
	allowLiquid: boolean;
}

/** Pay rate of an offer in $ per PFLOP-hour: training/finetune payout ÷ work; inference payout ÷ (PFLOPS × hours). */
export function payPerPflopHour(spec: ContractSpec): number {
	if (spec.kind === "inference") {
		const pf = spec.sustainedPflops ?? spec.work;
		const hours = spec.durationTicks / 60;
		return pf > 0 && hours > 0 ? spec.payout / (pf * hours) : 0;
	}
	return spec.work > 0 ? spec.payout / spec.work : 0;
}

export interface CellRef {
	x: number;
	floor: number;
}

export type CommandResult = { ok: true } | { ok: false; reason: string };

// ─── Events (emitted by step()) ──────────────────────────────────────────

export type SimEvent =
	| { type: "commandRejected"; command: SimCommand; reason: string }
	| { type: "built"; what: "slab" | "conduit" | "lift" | "facility"; floor: number; x: number }
	| { type: "demolished"; floor: number; x: number }
	| { type: "rackThrottled"; facilityId: number }
	| { type: "rackTripped"; facilityId: number }
	| { type: "rackRecovered"; facilityId: number }
	| { type: "componentFailed"; facilityId: number }
	| { type: "repaired"; facilityId: number; botId: number }
	| { type: "powerShortfall"; netId: number; satisfaction: number }
	| { type: "gensetStarted"; facilityId: number }
	| { type: "gensetStopped"; facilityId: number }
	| { type: "upsDepleted"; facilityId: number }
	| { type: "contractOffered"; contractId: number }
	| { type: "contractExpired"; contractId: number }
	| { type: "jobStarted"; jobId: number }
	| { type: "jobCompleted"; jobId: number; payout: number }
	| { type: "jobFailed"; jobId: number; penalty: number }
	| { type: "jobRolledBack"; jobId: number; lostWork: number }
	| { type: "jobStalledStorage"; jobId: number; needTB: number; capacityTB: number }
	| { type: "liftArrived"; liftId: number; floor: number }
	| { type: "tierUp"; tier: number; reward: number }
	| { type: "newDay"; day: number }
	| { type: "bankrupt" }
	/** A decision opened (or came back from deferral). The app stops the clock. */
	| { type: "decisionIssued"; decisionId: number; eventId: string }
	| { type: "decisionDeferred"; decisionId: number; until: number }
	| { type: "decisionResolved"; decisionId: number; eventId: string; choiceId: string }
	/** `ending` is set for path endings (kind "victory", or "absorbed" for the secret one). */
	| { type: "gameOver"; kind: GameOverKind; ending?: EndingId }
	| { type: "researched"; techId: string }
	| { type: "clerkAccepted"; contractId: number; jobId: number }
	| { type: "loanTaken"; amount: number }
	| { type: "loanRepaid"; amount: number }
	/** A quarterly audit was filed; the report is `view.reports.at(-1)`. */
	| { type: "quarterReport"; quarter: number; grade: AuditGrade }
	/** The sim grew a facility (a growth) on contaminated slab. */
	| { type: "growthSprouted"; facilityId: number }
	| { type: "botMutated"; botId: number; trait: BotTrait }
	/** The contaminated share crossed `balance.bio.irreversibleShare` (emitted once). */
	| { type: "contaminationIrreversible" }
	/** Money a job paid: training checkpoints and completion, inference summed per game-hour (for "+$" floaters). */
	| { type: "earned"; jobId: number; amount: number }
	| { type: "autoBuilt"; facilityId: number }
	| { type: "autoBought"; what: "parts" | "bot"; count: number }
	| { type: "droughtStarted" }
	| { type: "droughtEnded" }
	/** A rack was retrofitted in place toward a tree. */
	| { type: "retrofitted"; facilityId: number; tree: AscensionPath; rung: number }
	/** A Consciousness Transfer Unit moved one person into the Lattice (+`sp` Synthetic SP). The renderer walks someone in from the lift. */
	| { type: "consciousnessTransferred"; facilityId: number; sp: number };

// ─── View (read-only snapshot for render/ui/audio) ──────────────────────

export type FacilityStatus =
	| "ok"
	| "idle" // rack with no job
	| "disabled"
	| "unpowered" // not on a power net, or net satisfaction 0
	| "brownout" // net satisfaction < 1
	| "noCoolant" // needsCoolant but no coolant net / net over capacity
	| "noNutrient" // needsNutrient but no nutrient net / net short
	| "tooCold" // organoid rack below its band (throttled or dying from cold)
	| "throttled"
	| "tripped"
	| "failed"; // awaiting repair

export interface FacilityView {
	id: number;
	defId: string;
	floor: number;
	x: number;
	width: number;
	enabled: boolean;
	status: FacilityStatus;
	/** Rack: die temperature °C. Others: air temp at their cells. */
	tempC: number;
	/** Rack clock factor 0..1 (thermal × power). */
	clock: number;
	/** 0..1, drops on failure; 1 after repair. */
	health: number;
	/** Actual electrical draw this tick. */
	powerKw: number;
	/** Heat output this tick (racks) or heat removed (cooling). */
	heatKw: number;
	/** Rack: job it's allocated to. */
	jobId: number | null;
	powerNet: number | null;
	coolantNet: number | null;
	nutrientNet: number | null;
	/** Grown by the sim (a growth), not built by the player. */
	grown: boolean;
	/** Contamination at its cells (max), 0..1. */
	contamination: number;
	/** genset: running? ups: charge 0..1. depot: parts stored. */
	running?: boolean;
	charge?: number;
	stored?: number;
}

export interface LiftView {
	id: number;
	x: number;
	floorMin: number;
	floorMax: number;
	/** Fractional floor of the car (interpolate for smooth motion). */
	carFloor: number;
	dir: -1 | 0 | 1;
	doorsOpen: boolean;
	riders: number;
	/** False while the shaft has no power (no conduit under or beside it, or a dead net): the car cannot move and bots do not route through it. */
	powered?: boolean;
}

/** `flying`: a flying bot moving between floors (its `floor` is fractional meanwhile). */
export type BotState = "idle" | "toDepot" | "toTarget" | "repairing" | "toCharger" | "charging" | "waitingLift" | "riding" | "flying";

export interface BotView {
	id: number;
	defId: string;
	/** Fractional tile index: x = 3.0 means standing centred in tile 3 (renderer draws at (x + 0.5) × tileWidth). */
	x: number;
	/** Fractional floor (fractional only while riding a lift). */
	floor: number;
	state: BotState;
	/** 0..1 */
	battery: number;
	carrying: boolean;
	workOrderId: number | null;
	/** Mutation from contamination exposure, or null. */
	trait: BotTrait | null;
	/** Spare parts it is carrying (0 or absent when none). */
	parts?: number;
}

/** fleshed: repairs faster but contaminates where it works. tendriled: carries more parts but never rides lifts. */
export type BotTrait = "fleshed" | "tendriled";

export interface PowerNetView {
	id: number;
	supplyKw: number;
	demandKw: number;
	/** 0..1 */
	satisfaction: number;
	storedKwh: number;
	storageCapacityKwh: number;
	gridImportKw: number;
}

export interface NutrientNetView {
	id: number;
	/** Units per tick. */
	supply: number;
	demand: number;
	/** 0..1 */
	satisfaction: number;
}

export interface CoolantNetView {
	id: number;
	capacityKw: number;
	loadKw: number;
	supplyTempC: number;
}

export interface ContractView extends ContractSpec {
	id: number;
	/** Tick at which an un-accepted offer expires. */
	expiresAt: number;
}

export type JobStatus = "queued" | "running" | "stalled" | "completed" | "failed";

export interface JobView {
	id: number;
	contractId: number;
	clientName: string;
	kind: JobKind;
	status: JobStatus;
	/** training/finetune: done / total PFLOP-hours. inference: elapsed / duration ticks. */
	progress: number;
	total: number;
	deadline: number;
	/** PFLOPS currently delivered. */
	pflops: number;
	rackIds: number[];
	payout: number;
	lastCheckpoint: number;
}

export interface WorkOrderView {
	id: number;
	facilityId: number;
	botId: number | null;
	createdAt: number;
	/** 1-based place in the queue of unassigned orders (oldest first), or null once a bot has taken it. */
	queuePos?: number | null;
	/** ok: a bot can path to the rack; noRoute: no ground bot can reach its slab (missing, unpowered or unconnected lift); noBots: there are no bots at all. */
	route?: "ok" | "noRoute" | "noBots";
}

/** At-a-glance upkeep: spare parts, the bot fleet and the repair queue. */
export interface MaintenanceView {
	parts: number;
	/** Room for parts across all depots. */
	partsCapacity: number;
	botsTotal: number;
	/** Bots on a job (fetching a part, travelling to or repairing a rack). */
	botsBusy: number;
	botsIdle: number;
	/** Open work orders no bot has taken. */
	waiting: number;
	/** Open work orders (any state) whose rack no bot can reach. */
	noRoute: number;
}

export interface LedgerDay {
	day: number;
	revenue: number;
	energy: number;
	upkeep: number;
	construction: number;
	penalties: number;
	/** Ministry levy on the day's profit (charged at midnight, so it lands on the day it is charged for). */
	taxes: number;
	/** Loan interest. */
	interest: number;
	/** Contracts Clerk fees withheld from earnings. */
	fees: number;
}

export interface MetricSample {
	tick: number;
	pue: number;
	itKw: number;
	totalKw: number;
	pflops: number;
	cash: number;
	maxRackC: number;
}

/** `absorbed`: the secret ending (the tower absorbed you); final like bankrupt. */
export type GameOverKind = "bankrupt" | "victory" | "absorbed";

export type AuditGrade = "A" | "B" | "C" | "D" | "E";

/** Quarterly Ministry audit (every `balance.audit.periodDays` days, filed at midnight). */
export interface QuarterReport {
	quarter: number;
	/** Days covered, inclusive. */
	fromDay: number;
	toDay: number;
	revenue: number;
	/** energy + upkeep + construction + penalties + taxes + interest + fees. */
	costs: number;
	/** Mean of the daily uptimes. */
	uptime: number;
	/** Mean of the daily PUE samples. */
	pue: number;
	jobsCompleted: number;
	jobsFailed: number;
	penalties: number;
	grade: AuditGrade;
	/** Grant (+) or fine (−) applied. */
	cashDelta: number;
	/** One dry Ministry sentence explaining the grade. */
	remark: string;
}

/** Totals since the start of the game. */
export interface LifetimeStats {
	revenue: number;
	pflopHours: number;
	jobsCompleted: number;
	jobsFailed: number;
	peakPflops: number;
	facilitiesBuilt: number;
	componentFailures: number;
	repairs: number;
	decisionsMade: number;
	researchPointsEarned: number;
}

/** The Trees panel's numbers for one tree (docs/REFRAME.md). */
export interface TreeView {
	tree: AscensionPath;
	sp: number;
	/** SP a day at the compute delivered right now (weight and factor included). */
	spPerDay: number;
	/** Days to `spTarget` at that rate, or null when the rate is 0. */
	daysToWin: number | null;
	/** Highest rung held by a rack of this tree (0 = none). */
	rung: number;
	/** Racks of this tree standing, and the PFLOPS they deliver now / have installed. */
	racks: number;
	pflops: number;
	installedPflops: number;
	/** Multiplier on the tree's racks now: 1 for the Lattice, 1 − seal for the Flesh, green speed × (1 − seal) for the Garden. 0 when closed. */
	factor: number;
	/** Seal 0..sealMax (the Lattice has none: null). */
	seal: number | null;
	/** Seal reached `sealMax`: no new retrofits, and its racks stop scoring. */
	closed: boolean;
	/** The racks and buildings that scar this tree most (top 3), counting what stands now. */
	hurting: { defId: string; name: string; count: number; seal: number }[];
}

/**
 * The Soul (docs/SOUL.md, docs/REFRAME.md): Singularity points, the seal meters and the bonds. The seal is hidden per item but
 * shown in total; the three `trees` carry everything the Trees panel needs.
 */
export interface SoulView {
	sp: Record<AscensionPath, number>;
	spTarget: number;
	seal: Record<SealedTree, number>;
	sealMax: number;
	bonds: Record<AdvisorId, number>;
	bondEpilogue: number;
	trees: Record<AscensionPath, TreeView>;
	/** The green score 0..1, its two parts, and the Green speed it gives (`greenFloor` + the rest × score). */
	green: { score: number; cleanPower: number; heatShare: number; speed: number };
}

export interface DecisionView {
	id: number;
	eventId: string;
	advisor: import("@aitower/content").AdvisorId;
	category: import("@aitower/content").EventCategory;
	title: string;
	body: string;
	choices: { id: string; label: string; hint: string; /** Story scenes: what the advisors say back after this choice. */ reply?: import("@aitower/content").SceneLine[] }[];
	/** Story scenes: the dialogue before the choice (`{item}` already replaced). */
	lines?: import("@aitower/content").SceneLine[];
	/** Story scenes: backdrop and caption box. */
	backdrop?: AscensionPath | "title";
	location?: string;
	/** Objection scenes: the facility the scene is about. */
	subject?: { defId: string; name: string };
	/** The advisor's recommended choice id. */
	recommended: string;
	/** MAGI vote (Cass, Bea, Mel) when the decision spans several areas. */
	votes?: import("@aitower/content").EventVote[];
	issuedAt: number;
	/** "Defer one day" is still available. */
	canDefer: boolean;
}

/** A temporary effect currently in force (from a resolved memo). */
export interface ModifierView {
	label: string;
	kind: "ambient" | "gridCap" | "energyPrice" | "payout" | "failureRate";
	value: number;
	endsAt: number;
}

/** The running (or just finished) lesson, for the goal bar, checklist and result screen. */
export interface LessonView {
	id: string;
	status: "active" | "won" | "lost";
	/** Ids of the steps done, in order. */
	stepsDone: string[];
	/** Index of the first step not done (= steps.length when all are). */
	current: number;
	/** Ids of the beats that have fired. */
	beatsFired: string[];
	/** Ticks the success conditions have held, of `holdGoal`. */
	holdTicks: number;
	holdGoal: number;
	minHeadroom: number;
	downTicks: number;
	stars: number;
	/** Bonus stars earned (set when the lesson is won): star 2, star 3. */
	star2: boolean;
	star3: boolean;
	/** Facilities that may be placed right now (all others are refused), with how many may exist. */
	allowed: { defId: string; max?: number }[];
	/** Live: power usage effectiveness (total power over rack power), 0 when nothing runs. */
	pue: number;
	/** Drawers the lesson has opened so far ("contracts", "research", ...). */
	drawers: string[];
	/** The Supplies tab (spare parts, bots) is open. */
	supplies: boolean;
	/** Live: all power nets summed, kW. */
	loadKw: number;
	capacityKw: number;
	headroomPct: number;
	startTick: number;
	endTick: number;
}

export interface SimView {
	tick: number;
	/** TB of datasets the active jobs need (every queued, running or stalled job). */
	storageNeedTB?: number;
	/** TB of powered, healthy storage racks (Storage Arrays and Tape Libraries). */
	storageCapacityTB?: number;
	day: number;
	/** 0..1439 */
	minuteOfDay: number;
	width: number;
	floorMin: number;
	floorMax: number;
	/** 1 where a slab exists. */
	slab: Uint8Array;
	/** 1 where conduit exists. */
	power: Uint8Array;
	coolant: Uint8Array;
	/** Air temperature °C per cell. */
	airTemp: Float32Array;
	/** Power/coolant net id per cell (-1 none) — for overlays. */
	powerNetOf: Int32Array;
	coolantNetOf: Int32Array;
	/** 1 where nutrient conduit exists. */
	nutrient: Uint8Array;
	nutrientNetOf: Int32Array;
	/** Contamination 0..1 per cell. */
	contamination: Float32Array;
	ambientC: number;
	facilities: FacilityView[];
	lifts: LiftView[];
	bots: BotView[];
	powerNets: PowerNetView[];
	coolantNets: CoolantNetView[];
	nutrientNets: NutrientNetView[];
	offers: ContractView[];
	jobs: JobView[];
	workOrders: WorkOrderView[];
	maintenance: MaintenanceView;
	cash: number;
	spareParts: number;
	tier: number;
	energyPrice: number;
	/** Rolling 24h values. */
	pue: number;
	uptime: number;
	itKw: number;
	totalKw: number;
	pflops: number;
	/** Last 30 completed days + today (last element). */
	ledger: LedgerDay[];
	/** One sample every 10 ticks, last 1440 samples. */
	history: MetricSample[];
	bankrupt: boolean;
	/** The open advisor decision, or null. While it is open the app holds the clock. */
	decision: DecisionView | null;
	/** Tick a deferred decision returns, or null. */
	decisionReturnsAt: number | null;
	/** App pacing gate (see the `decisionGate` command). */
	decisionGate: boolean;
	/** Last 20 resolved decisions, newest last, with the outcome text shown to the player. */
	decisionHistory: { decisionId: number; eventId: string; title: string; choiceId: string; outcome: string; tick: number }[];
	/** Advisor tip ids already shown this game. */
	advisorTips: string[];
	/** The lesson this site runs (null in Free Build). */
	lesson: LessonView | null;
	modifiers: ModifierView[];
	/** Rolling 24 h uptime target of the current Level (the quarterly audit grades against it). */
	uptimeTarget: number;
	/** What the next Level asks for (null at the top Level): installed PF, rolling uptime, researched nodes (techsDone counts the ones held now). */
	tierNeed: { tier: number; pflops: number; uptime: number; techs: number; techsDone: number } | null;
	/**
	 * Body-horror scalar 0..1 (drives render, audio and memos). Grows with the contaminated share, wetware share of
	 * compute and growths; never decreases by more than a little per day (the building remembers).
	 */
	corruption: number;
	/** Days in a row at 99% day-mean uptime or better with pflops above 0 (the Month of Calm and Cass's portrait). */
	uptimeStreak: number;
	/** Share of built cells with contamination ≥ 0.5. */
	contaminatedShare: number;
	/** The contaminated share crossed `balance.bio.irreversibleShare` at some point. */
	irreversible: boolean;
	/** Chosen ascension path, or null. */
	path: AscensionPath | null;
	/**
	 * 0..1 score of the chosen path, driving its reskin stages (25/50/75/100 %): biotech = corruption, greentech =
	 * greenScore, synthetic = refinement. With no path chosen: corruption (the wetware seeds appear before the choice).
	 */
	pathScore: number;
	/** Greentech score 0..1: share of energy from solar/wind/bioreactor-free green sources blended with heat exported. */
	greenScore: number;
	/**
	 * How strongly the tower leans to each path, as shares summing to 1 (all 0 before any lean). Points come from what is
	 * built (path-flavoured facilities), researched (path-branch nodes) and chosen in memos (`affinity` effects). At
	 * Clearance `ascension.minTier` the UI pre-selects the leading path for the player to confirm.
	 */
	affinity: { biotech: number; greentech: number; synthetic: number };
	/** Synthetic score 0..1: uptime × share of compute on top-tier racks. */
	refinement: number;
	/** A Dunkelflaute (calm, dark spell) is in force. */
	drought: boolean;
	/** The scenario is a sandbox (no bankruptcy). */
	sandbox: boolean;
	automation: { policy: AutomationPolicy; foremanUnlocked: boolean; /** Why the Foreman skipped or queued each job at its last check ("Racks: Waiting: 160 kW needed, 110 kW free"). Empty before the first check after a load. */ foremanStatus: string[]; /** Placements per game-hour the Foreman is allowed now. */ foremanPerHour: number };
	/** PFLOPS currently delivered by organoid (`cooling: "bio"`) racks. */
	organoidPflops: number;
	/** Singularity points, seals and bonds (docs/SOUL.md). */
	soul: SoulView;
	/** Unspent research points. */
	researchPoints: number;
	/** Researched tech ids, in research order. */
	techResearched: string[];
	clerk: { unlocked: boolean; policy: ClerkPolicy; acceptedTotal: number };
	loan: { principal: number; max: number; dailyRate: number };
	/** Filed quarterly audits, oldest first (last 8). */
	reports: QuarterReport[];
	stats: LifetimeStats;
	/**
	 * Set once when the game ends. "victory" = reached the top tier (play may continue in sandbox: the sim keeps running).
	 * "bankrupt" and "absorbed" are final; the sim keeps stepping but the UI should offer load / new game.
	 */
	gameOver: { kind: GameOverKind; tick: number; ending?: EndingId } | null;
}

// ─── Snapshot & façade ───────────────────────────────────────────────────

/** Opaque, JSON-serialisable. `version` enables migrations. */
export interface SimSnapshot {
	version: number;
	scenarioId: string;
	seed: number;
	state: unknown;
}

export interface Sim {
	/**
	 * Queue a command; it is validated and applied at the start of the next step(). The returned pre-validation
	 * accounts for commands already queued this tick (e.g. buildSlab then place on that slab, or two purchases that
	 * together exceed cash). Never throws, even for malformed input.
	 */
	submit(cmd: SimCommand): CommandResult;
	/** Same validation as submit() (including queued commands) without queueing anything. For UI ghosts. Never throws. */
	canBuild(cmd: SimCommand): CommandResult;
	/** Advance exactly one tick. Returns events emitted during it. */
	step(): SimEvent[];
	/**
	 * Apply queued commands now, without advancing time (used while the game is paused, so a stamped contract or a
	 * placed cabinet appears at once). Equivalent to the command stage at the start of the next step(): same final
	 * state and hash. Power, cooling and statuses still update on the next tick.
	 */
	flush(): SimEvent[];
	/** Cheap read-only view; arrays may be reused between calls, don't mutate. */
	view(): SimView;
	snapshot(): SimSnapshot;
	/** Stable hash of the full state, for determinism tests. */
	hash(): string;
	/** Pure placement check usable for UI ghosts. */
	canPlace(defId: string, floor: number, x: number): CommandResult;
}

/**
 * `fromSnapshot` validates the snapshot (version, scenario, array lengths, known def ids, references) and migrates
 * older versions. On failure it throws an Error whose message starts with "Invalid save:" and never returns a sim
 * that would later throw in step().
 */
export interface SimFactory {
	create(content: ContentDB, scenarioId: string, seed: number): Sim;
	fromSnapshot(content: ContentDB, snap: SimSnapshot): Sim;
}
