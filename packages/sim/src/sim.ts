/**
 * Sim façade: createSim / simFromSnapshot and the fixed tick pipeline (ARCHITECTURE §3.3).
 */
import type { ContentDB } from "@aitower/content";
import type { CommandResult, Sim, SimCommand, SimEvent, SimSnapshot, SimView } from "./api";
import { applyCommands, planCommand, planNormalized } from "./commands/apply";
import { toResult } from "./commands/plan";
import { normalizeCommand } from "./commands/shape";
import { computeStep } from "./compute/computeStep";
import { type Scratch, type TickCtx, createScratch } from "./core/context";
import { cellCount } from "./core/grid";
import type { SimState } from "./core/state";
import { ambientAt } from "./core/time";
import { automationStep } from "./automation/automationStep";
import { weatherStep } from "./green/weather";
import { memoStep } from "./ministry/memos";
import { ambientOffset } from "./ministry/modifiers";
import { jobStanding } from "./ministry/standing";
import { contaminationStep } from "./bio/contamination";
import { corruptionStep } from "./bio/corruption";
import { growthStep } from "./bio/growth";
import { nutrientSolve } from "./bio/nutrient";
import { coolingSolve } from "./cooling/coolingSolve";
import { economyStep } from "./economy/economyStep";
import { spend } from "./economy/ledger";
import { stepBots } from "./logistics/bots";
import { stepLifts } from "./logistics/lifts";
import { rebuildNetworks } from "./networks/rebuild";
import { powerSolve } from "./power/powerSolve";
import { affinityStep } from "./progression/affinity";
import { progressionStep } from "./progression/tier";
import { advanceTime } from "./progression/time";
import { reliabilityStep } from "./reliability/reliabilityStep";
import { encode } from "./snapshot/codec";
import { deepClone } from "./snapshot/clone";
import { loadSnapshot } from "./snapshot/load";
import { SNAPSHOT_VERSION } from "./snapshot/migrate";
import { hashValue } from "./snapshot/hash";
import { airFieldStep } from "./thermal/airField";
import { rackThermalStep } from "./thermal/rackThermal";
import { buildView } from "./view/view";
import { createState } from "./world/init";

export { SNAPSHOT_VERSION };

/** Internal implementation; `state` is public for tests and tools (not part of the contract). */
export class SimImpl implements Sim {
	private readonly scratch: Scratch;

	constructor(
		readonly content: ContentDB,
		readonly state: SimState,
	) {
		this.scratch = createScratch(cellCount(state));
	}

	/**
	 * Lazily created copy of the state with every queued command already applied, so validation sees what the
	 * next step() will see (buildSlab then place on it; two purchases that together exceed cash). Dropped by
	 * step(). Invariant: it only diverges from `state` through accepted commands, hence code that edits `state`
	 * directly between submits (tests, tools) must call `invalidateProjection()`.
	 */
	private projected: SimState | null = null;

	private projection(): SimState {
		if (this.projected) return this.projected;
		const p = deepClone(this.state);
		const queued = p.pending;
		p.pending = [];
		this.projected = p;
		// Replay commands that were queued before the projection existed (e.g. restored from a save).
		for (const cmd of queued) this.advance(p, planCommand({ state: p, content: this.content }, cmd));
		return p;
	}

	private advance(p: SimState, plan: ReturnType<typeof planCommand>): void {
		if (!plan.ok) return;
		if (plan.cost !== 0) spend(p, "construction", plan.cost);
		plan.apply([]);
	}

	invalidateProjection(): void {
		this.projected = null;
	}

	submit(cmd: SimCommand): CommandResult {
		const norm = normalizeCommand(cmd);
		if (!norm.ok) return { ok: false, reason: norm.reason };
		try {
			const p = this.projection();
			const plan = planNormalized({ state: p, content: this.content }, norm.cmd);
			if (!plan.ok) return toResult(plan);
			this.advance(p, plan);
			this.state.pending.push(norm.cmd);
			return { ok: true };
		} catch {
			this.projected = null;
			return { ok: false, reason: "internal error while validating command" };
		}
	}

	canBuild(cmd: SimCommand): CommandResult {
		const norm = normalizeCommand(cmd);
		if (!norm.ok) return { ok: false, reason: norm.reason };
		try {
			// Only clone when something is queued; a bare state is validated in place.
			const st = this.projected ?? (this.state.pending.length > 0 ? this.projection() : this.state);
			return toResult(planNormalized({ state: st, content: this.content }, norm.cmd));
		} catch {
			return { ok: false, reason: "internal error while validating command" };
		}
	}

	flush(): SimEvent[] {
		if (this.state.pending.length === 0) return [];
		this.projected = null;
		const events: SimEvent[] = [];
		// Exactly stage 1 of step(): nothing runs before it, so applying it now is identical to applying it next tick.
		applyCommands({ state: this.state, content: this.content, events, scratch: this.scratch });
		return events;
	}

	step(): SimEvent[] {
		this.projected = null;
		const events: SimEvent[] = [];
		const ctx: TickCtx = { state: this.state, content: this.content, events, scratch: this.scratch };
		this.state.ambientC = ambientAt(this.content.balance, this.state.tick) + ambientOffset(this.state);
		applyCommands(ctx); //  1
		rebuildNetworks(ctx); //  2 (dirty only)
		weatherStep(ctx); //  2b hourly wind, daily drought roll
		powerSolve(ctx); //  3
		nutrientSolve(ctx); //  3b nutrient nets
		coolingSolve(ctx); //  4
		airFieldStep(ctx); //  5a
		rackThermalStep(ctx); //  5b
		computeStep(ctx); //  6
		reliabilityStep(ctx); //  7
		stepLifts(ctx); //  8a
		stepBots(ctx); //  8b
		contaminationStep(ctx); //  8c contamination field
		growthStep(ctx); //  8d growth cull + sprouting
		corruptionStep(ctx); //  8e
		economyStep(ctx); //  9 (incl. contract offers)
		memoStep(ctx); //  9b modifiers expire, memos time out / are issued
		jobStanding(ctx); //  9c standing from this tick's job outcomes
		automationStep(ctx); //  9d hourly standing orders (research, parts, bots, Foreman)
		affinityStep(ctx); //  9e hourly path affinity from running facilities
		progressionStep(ctx); // 10
		advanceTime(ctx); // 11
		return events;
	}

	view(): SimView {
		return buildView(this.state, this.content);
	}

	snapshot(): SimSnapshot {
		return { version: SNAPSHOT_VERSION, scenarioId: this.state.scenarioId, seed: this.state.seed, state: encode(this.state) };
	}

	hash(): string {
		return hashValue(this.state);
	}

	canPlace(defId: string, floor: number, x: number): CommandResult {
		return this.canBuild({ type: "place", defId, floor, x });
	}
}

export function createSim(content: ContentDB, scenarioId: string, seed: number): Sim {
	return new SimImpl(content, createState(content, scenarioId, seed));
}

export function simFromSnapshot(content: ContentDB, snap: SimSnapshot): Sim {
	return new SimImpl(content, loadSnapshot(content, snap));
}
