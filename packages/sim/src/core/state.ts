/**
 * The complete, serialisable simulation state. Everything that influences future ticks lives here
 * (including RNG streams and queued commands); nothing persistent is kept elsewhere.
 * Entity arrays are kept sorted by ascending id (ids are monotonic, never reused).
 */
import type { ContractSpec } from "@aitower/content";
import type { ClerkPolicy, GameOverKind, JobStatus, LedgerDay, LifetimeStats, MetricSample, QuarterReport, SimCommand } from "../api";
import type { RngState } from "./rng";

export interface Facility {
	id: number;
	defId: string;
	floor: number;
	x: number;
	width: number;
	enabled: boolean;
	/** Network ids (-1 = none). */
	powerNet: number;
	coolantNet: number;
	/** Power satisfaction this tick (1 when the facility needs no power). */
	sat: number;
	/** Requested electrical draw this tick, kW. */
	demandKw: number;
	/** Actual electrical draw this tick, kW. */
	powerKw: number;
	/** Rack: heat produced. Cooling: heat removed. kW. */
	heatKw: number;
	/** Rack: die temperature. Others: mean air temp at their cells. °C */
	tempC: number;
	// ── rack ──
	/** Allocated to a job at power-solve time (drives demand & delivered compute this tick). */
	busy: boolean;
	thermalClock: number;
	/** thermalClock × power factor; 0 when down. */
	clock: number;
	/** PFLOPS delivered this tick. */
	pflops: number;
	health: number;
	jobId: number;
	failed: boolean;
	tripped: boolean;
	/** Trip recovery: -1 still too hot, >0 ticks of cooldown left. */
	cooldown: number;
	throttled: boolean;
	noCoolant: boolean;
	/** Coolant supply temp seen by a liquid rack, °C. */
	coolantC: number;
	// ── genset ──
	gensetMode: GensetMode;
	gensetTimer: number;
	surplusTicks: number;
	// ── ups ──
	storedKwh: number;
	// ── depot ──
	stored: number;
	// ── charger ──
	/** At least one bot charged here during the last logistics step. */
	charging: boolean;
}

export const GensetMode = { Off: 0, Starting: 1, Running: 2 } as const;
export type GensetMode = (typeof GensetMode)[keyof typeof GensetMode];

export interface Lift {
	id: number;
	x: number;
	floorMin: number;
	floorMax: number;
	powerNet: number;
	sat: number;
	carFloor: number;
	dir: -1 | 0 | 1;
	doorsOpen: boolean;
	doorTimer: number;
	/** Bot ids on board, in boarding order. */
	riders: number[];
}

/** What the bot is trying to do. */
export type BotTask = "none" | "depot" | "target" | "repair" | "charger" | "charge";
/** How it is currently moving toward the goal. */
export type BotLeg = "walk" | "waitLift" | "ride";

export interface Bot {
	id: number;
	defId: string;
	x: number;
	floor: number;
	battery: number;
	carrying: boolean;
	/** Spare parts held (≥ 1 while `carrying`; more than 1 only for bots with `carry` > 1). */
	parts: number;
	task: BotTask;
	leg: BotLeg;
	/** Facility the bot is heading to (-1 none). */
	goalId: number;
	goalX: number;
	goalFloor: number;
	/** Lift used for the current route (-1 = walk directly). */
	liftId: number;
	workOrderId: number;
	/** Home charger facility id (-1 none). */
	homeId: number;
	/** Repair ticks remaining. */
	timer: number;
	/** Floor at which the current lift ride ends (a transfer floor on multi-lift routes; = goalFloor on the last hop). */
	exitFloor: number;
	/** Consecutive ticks without progress toward the goal; the bot gives up at BOT_STUCK_TICKS. */
	stuck: number;
	/** Tick before which an idle bot does not retry (stranded / no depot reachable). */
	retryAt: number;
	/** Consecutive failed attempts, drives the bot-level backoff. */
	fails: number;
	/** `SimState.topologyRev` the current path was planned against; a mismatch triggers a re-plan. */
	routeRev: number;
}

export interface Offer {
	id: number;
	spec: ContractSpec;
	expiresAt: number;
}

export interface Job {
	id: number;
	contractId: number;
	spec: ContractSpec;
	status: JobStatus;
	acceptedAt: number;
	deadline: number;
	/** training: PFLOP-hours done. inference: ticks elapsed. */
	progress: number;
	total: number;
	lastCheckpoint: number;
	/** Productive ticks since the last checkpoint. */
	sinceCheckpoint: number;
	pflops: number;
	rackIds: number[];
	/** Gross revenue earned so far (inference streams, training at checkpoints / completion). */
	earned: number;
	/** Accepted by the Contracts Clerk: every payment withholds `balance.clerk.feeShare`. */
	clerk: boolean;
	finishedAt: number;
}

export interface WorkOrder {
	id: number;
	facilityId: number;
	botId: number;
	createdAt: number;
	/** Times a bot gave up on this order (unreachable / timed out). */
	attempts: number;
	/** Tick before which the order is not offered to bots again (backoff after a failed attempt). */
	retryAt: number;
	/** `SimState.topologyRev` when the backoff was set; any later topology change lifts the backoff immediately. */
	retryRev: number;
}

/** An open Ministry memo; the text lives in `ContentDB.events[eventId]`. */
export interface Memo {
	id: number;
	eventId: string;
	issuedAt: number;
	expiresAt: number;
}

export interface MemoRecord {
	memoId: number;
	eventId: string;
	title: string;
	choiceId: string;
	outcome: string;
	tick: number;
	auto: boolean;
}

export type ModifierKind = "ambient" | "gridCap" | "energyPrice" | "payout" | "failureRate";

/** A timed effect from a resolved memo; active while `tick < endsAt`. ambient adds `value` °C, the others multiply by `value`. */
export interface Modifier {
	kind: ModifierKind;
	value: number;
	endsAt: number;
	label: string;
}

export interface PowerNet {
	id: number;
	supplyKw: number;
	demandKw: number;
	satisfaction: number;
	storedKwh: number;
	storageCapacityKwh: number;
	gridImportKw: number;
	gensetKw: number;
}

export interface CoolantNet {
	id: number;
	capacityKw: number;
	loadKw: number;
	supplyTempC: number;
}

/** Per-tick totals plus rolling 24 h rings (index = tick % 1440). */
export interface Metrics {
	ringTotalKwh: Float64Array;
	ringItKwh: Float64Array;
	ringShouldRun: Float64Array;
	ringRunning: Float64Array;
	itKw: number;
	totalKw: number;
	gridKw: number;
	gensetKw: number;
	pflops: number;
	energyCost: number;
	pue: number;
	uptime: number;
	maxRackC: number;
}

/** One closed day, kept until the quarterly audit that covers it. */
export interface AuditDay {
	day: number;
	/** Mean of the per-tick samples of the rolling 24 h uptime / PUE. */
	uptime: number;
	pue: number;
	revenue: number;
	/** energy + upkeep + construction + penalties + taxes + interest + fees. */
	costs: number;
	penalties: number;
}

/** Running totals for the next quarterly audit. */
export interface AuditTracker {
	/** Today's per-tick samples. */
	samples: number;
	uptimeSum: number;
	pueSum: number;
	/** Closed days of the current audit period. */
	days: AuditDay[];
	/** Jobs completed / failed in the current audit period. */
	jobsCompleted: number;
	jobsFailed: number;
}

export interface SimState {
	scenarioId: string;
	seed: number;
	tick: number;
	width: number;
	floorMin: number;
	floorMax: number;
	// ── grid layers (index = (floor - floorMin) * width + x) ──
	slab: Uint8Array;
	power: Uint8Array;
	coolant: Uint8Array;
	facilityAt: Int32Array;
	liftAt: Int32Array;
	airTemp: Float32Array;
	powerNetOf: Int32Array;
	coolantNetOf: Int32Array;
	powerNetCount: number;
	coolantNetCount: number;
	netsDirty: boolean;
	/** Bumped when anything bots route over changes (slab, lift or facility added/removed); triggers path re-validation. */
	topologyRev: number;
	// ── entities ──
	facilities: Facility[];
	lifts: Lift[];
	bots: Bot[];
	offers: Offer[];
	jobs: Job[];
	workOrders: WorkOrder[];
	nextId: { facility: number; lift: number; bot: number; contract: number; job: number; workOrder: number; memo: number };
	powerNets: PowerNet[];
	coolantNets: CoolantNet[];
	/** Share of storage-rack capacity in use (drives storage rack power). */
	storageUtil: number;
	nextOfferTick: number;
	// ── economy / progression ──
	cash: number;
	tier: number;
	bankrupt: boolean;
	negativeCashTicks: number;
	ledger: LedgerDay[];
	today: LedgerDay;
	history: MetricSample[];
	metrics: Metrics;
	ambientC: number;
	rng: RngState;
	// ── Ministry ──
	memos: Memo[];
	/** Last 20 resolved memos, oldest first. */
	memoHistory: MemoRecord[];
	modifiers: Modifier[];
	/** Earliest tick for the next memo roll. */
	nextMemoTick: number;
	/** Game day each event was last issued (cooldowns). */
	lastIssuedDay: Record<string, number>;
	/** 0..100; 0 ends the game ("shutdown"). */
	standing: number;
	gameOver: { kind: GameOverKind; tick: number } | null;
	// ── Research, clerk, credit, audits (snapshot v4) ──
	/** Unspent research points (float). */
	researchPoints: number;
	/** Researched tech ids, in research order. */
	techResearched: string[];
	clerkPolicy: ClerkPolicy;
	/** Contracts accepted by the clerk so far. */
	clerkAccepted: number;
	/** Outstanding loan principal. */
	loanPrincipal: number;
	/** Filed quarterly audits, oldest first (last 8). */
	reports: QuarterReport[];
	audit: AuditTracker;
	stats: LifetimeStats;
	/** Ids of scripted events already issued. */
	scriptedIssued: string[];
	/** Commands accepted by submit(), applied at the start of the next step. */
	pending: SimCommand[];
}
