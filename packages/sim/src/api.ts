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
	| { type: "buyBot"; defId: string };

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
	| { type: "bankrupt" };

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

export type BotState = "idle" | "toDepot" | "toTarget" | "repairing" | "toCharger" | "charging" | "waitingLift" | "riding";

export interface BotView {
	id: number;
	defId: string;
	/** Fractional tile position. */
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
	/** Queue a command; it is validated and applied at the start of the next step(). Returns a pre-validation result. */
	submit(cmd: SimCommand): CommandResult;
	/** Advance exactly one tick. Returns events emitted during it. */
	step(): SimEvent[];
	/** Cheap read-only view; arrays may be reused between calls, don't mutate. */
	view(): SimView;
	snapshot(): SimSnapshot;
	/** Stable hash of the full state, for determinism tests. */
	hash(): string;
	/** Pure placement check usable for UI ghosts. */
	canPlace(defId: string, floor: number, x: number): CommandResult;
}

export interface SimFactory {
	create(content: ContentDB, scenarioId: string, seed: number): Sim;
	fromSnapshot(content: ContentDB, snap: SimSnapshot): Sim;
}
