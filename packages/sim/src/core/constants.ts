/**
 * Constants that the task spec fixes literally but `Balance` (a frozen contract) has no field for.
 * Every other number comes from `ContentDB.balance`. Candidates to move into `balance` later.
 */

/** Real seconds of game time per tick (1 tick = 1 game-minute). Converts kW ↔ kJ per tick. */
export const SECONDS_PER_TICK = 60;
/** Ticks per game hour; converts kW per tick into kWh. */
export const TICKS_PER_HOUR = 60;

/** With no open offer, the next one arrives at most this many ticks later (6 game hours), whatever the interval roll said. */
export const GUARANTEED_OFFER_TICKS = 360;

/** Idle racks (no job) draw this share of their rated power. */
export const IDLE_RACK_POWER_FRACTION = 0.15;
/** Below this power satisfaction, loads on the net switch off ("unpowered"). */
export const MIN_POWERED_SATISFACTION = 0.5;
/** A running genset stops after this many consecutive ticks in which the grid alone covers demand. */
export const GENSET_STOP_SURPLUS_TICKS = 60;

/** Chiller COP derates linearly by this fraction per °C ambient above the reference. */
export const CHILLER_COP_DERATE_PER_C = 0.02;
export const CHILLER_COP_REF_AMBIENT_C = 20;
/** COP never derates below this share of nominal (keeps power finite in heatwaves). */
export const CHILLER_MIN_COP_FRACTION = 0.1;
/** Coolant supply temp rises this many °C per 1.0 (=100 %) of load over capacity (+10 °C per 10 %). */
export const COOLANT_OVERLOAD_C_PER_FRACTION = 100;
/** Overload fraction is capped here so temperatures stay finite. */
export const COOLANT_MAX_OVERLOAD_FRACTION = 1;

/** CRAHs pull air toward this temperature and never below it. */
export const CRAH_TARGET_C = 20;
/** Ambient sinusoid peaks at 15:00. */
export const AMBIENT_PEAK_MINUTE = 15 * 60;
/** Explicit thermal step: each link's k·dt/C is clamped to this (4 links per cell ⇒ Σ ≤ 0.8, stable). */
export const MAX_LINK_COUPLING = 0.2;

/** Training/finetune jobs take free racks up to this many. */
export const TRAINING_MAX_RACKS = 8;

/** Bots head to the charger below this battery level. */
export const BOT_LOW_BATTERY = 0.2;
/** Charging bots accept new work once above this level. */
export const BOT_RESUME_BATTERY = 0.5;
/** Charging is this many times faster than draining. */
export const BOT_CHARGE_RATE_MULTIPLIER = 5;

/** A bot that makes no progress toward its goal for this many ticks gives up: the order is released and retried later. */
export const BOT_STUCK_TICKS = 360;
/** Backoff before a released / unreachable work order (or a stranded bot) is retried: base × 2^(failures-1), capped. */
export const BOT_RETRY_BACKOFF_BASE_TICKS = 30;
export const BOT_RETRY_BACKOFF_MAX_TICKS = 720;
/** A bot waiting at an empty depot looks for a better-stocked one this often (ticks, staggered by bot id). */
export const BOT_DEPOT_RECHECK_TICKS = 10;
/** An idle bot plans routes for at most this many work orders per tick (the rest wait for the next tick). */
export const BOT_MAX_CLAIM_PLANS_PER_TICK = 6;

/** Demolition refunds this share of the build cost. */
export const DEMOLISH_REFUND = 0.5;

/** One history sample every N ticks, keeping the last N samples. */
export const HISTORY_INTERVAL_TICKS = 10;
export const HISTORY_LENGTH = 1440;
/** Completed days kept in the ledger (today is extra). */
export const LEDGER_DAYS = 30;
/** Completed / failed jobs stay visible this long before being pruned. */
export const FINISHED_JOB_RETENTION_TICKS = 1440;

/** Numerical tolerance for float comparisons. */
export const EPS = 1e-9;

/** Share of a training/finetune payout billed progressively at checkpoints; the rest is paid on completion. */
export const TRAINING_PROGRESS_PAY_SHARE = 0.8;
/** A training/finetune offer is accepted only if its idle racks would finish it within this share of the deadline (headroom for throttling and rollbacks). */
export const ACCEPT_DEADLINE_MARGIN = 0.9;

/** Scripted events are issued at 09:00 (minute of day) on their `scriptedDay`. */
export const SCRIPTED_MINUTE_OF_DAY = 9 * 60;
