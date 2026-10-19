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
import type { ContentDB, ContractSpec, JobKind } from "@aitower/content";

export type { JobKind };

export const TICKS_PER_DAY = 1440;
export const START_MINUTE_OF_DAY = 360;

// ─── Commands ──────────────────────────────────────────────────────────────

export type ConduitLayer = "power" | "coolant";

export type SimCommand =
	/** Build floor slab on `floor` from x0..x1 inclusive. Above ground needs slab below; skips cells already built. */
	| { type: "buildSlab"; floor: number; x0: number; x1: number }
	/** Place a facility with its left edge at x. */
	| { type: "place"; defId: string; floor: number; x: number }
	/** Lay conduit on the given cells (any shape; vertical runs are risers). Cells need slab or an adjacent conduit. */
	| { type: "buildConduit"; layer: ConduitLayer; cells: CellRef[] }
	/** Build a lift shaft at column x spanning floorMin..floorMax (all floors need slab at x). */
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
	/** Answer an open Ministry memo with one of its choice ids. */
	| { type: "resolveMemo"; memoId: number; choiceId: string }
	/** Spend research points on a tech node (prerequisites researched, tier ≥ minTier, enough RP). */
	| { type: "research"; techId: string }
	/** Set the Contracts Clerk's standing order (needs the `contractsClerk` feature researched). */
	| { type: "setClerk"; policy: ClerkPolicy }
	/** Borrow from the Ministry Credit Office (up to the tier's limit). */
	| { type: "takeLoan"; amount: number }
	/** Repay principal (up to what is owed and what cash allows). */
	| { type: "repayLoan"; amount: number };

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
	| { type: "liftArrived"; liftId: number; floor: number }
	| { type: "tierUp"; tier: number; reward: number }
	| { type: "newDay"; day: number }
	| { type: "bankrupt" }
	| { type: "memoIssued"; memoId: number; eventId: string }
	/** `auto` = timed out and resolved with the default choice. */
	| { type: "memoResolved"; memoId: number; eventId: string; choiceId: string; auto: boolean }
	| { type: "standingChanged"; standing: number; delta: number }
	| { type: "gameOver"; kind: GameOverKind }
	| { type: "researched"; techId: string }
	| { type: "clerkAccepted"; contractId: number; jobId: number }
	| { type: "loanTaken"; amount: number }
	| { type: "loanRepaid"; amount: number }
	/** A quarterly audit was filed; the report is `view.reports.at(-1)`. */
	| { type: "quarterReport"; quarter: number; grade: AuditGrade };

// ─── View (read-only snapshot for render/ui/audio) ──────────────────────

export type FacilityStatus =
	| "ok"
	| "idle" // rack with no job
	| "disabled"
	| "unpowered" // not on a power net, or net satisfaction 0
	| "brownout" // net satisfaction < 1
	| "noCoolant" // needsCoolant but no coolant net / net over capacity
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
}

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

export type GameOverKind = "bankrupt" | "shutdown" | "victory";

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
	standingDelta: number;
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
	memosAnswered: number;
	researchPointsEarned: number;
}

export interface MemoView {
	id: number;
	eventId: string;
	category: import("@aitower/content").EventCategory;
	title: string;
	body: string;
	choices: { id: string; label: string; hint: string }[];
	defaultChoice: string;
	issuedAt: number;
	expiresAt: number;
}

/** A temporary effect currently in force (from a resolved memo). */
export interface ModifierView {
	label: string;
	kind: "ambient" | "gridCap" | "energyPrice" | "payout" | "failureRate";
	value: number;
	endsAt: number;
}

export interface SimView {
	tick: number;
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
	ambientC: number;
	facilities: FacilityView[];
	lifts: LiftView[];
	bots: BotView[];
	powerNets: PowerNetView[];
	coolantNets: CoolantNetView[];
	offers: ContractView[];
	jobs: JobView[];
	workOrders: WorkOrderView[];
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
	/** Open (unanswered) Ministry memos, oldest first. */
	memos: MemoView[];
	/** Last 20 resolved memos, newest last, with the outcome text shown to the player. */
	memoHistory: { memoId: number; eventId: string; title: string; choiceId: string; outcome: string; tick: number; auto: boolean }[];
	modifiers: ModifierView[];
	/** Ministry standing 0..100; 0 ⇒ gameOver "shutdown". */
	standing: number;
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
	 * "bankrupt" / "shutdown" are final; the sim keeps stepping but the UI should offer load / new game.
	 */
	gameOver: { kind: GameOverKind; tick: number } | null;
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
