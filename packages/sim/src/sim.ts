/**
 * Sim façade: createSim / simFromSnapshot and the fixed tick pipeline (ARCHITECTURE §3.3).
 */
import type { ContentDB } from "@aitower/content";
import type { CommandResult, Sim, SimCommand, SimEvent, SimSnapshot, SimView } from "./api";
import { applyCommands, planCommand } from "./commands/apply";
import { toResult, withFunds } from "./commands/plan";
import { planPlace } from "./commands/placement";
import { computeStep } from "./compute/computeStep";
import { type Scratch, type TickCtx, createScratch } from "./core/context";
import { cellCount } from "./core/grid";
import type { SimState } from "./core/state";
import { ambientAt } from "./core/time";
import { coolingSolve } from "./cooling/coolingSolve";
import { economyStep } from "./economy/economyStep";
import { stepBots } from "./logistics/bots";
import { stepLifts } from "./logistics/lifts";
import { rebuildNetworks } from "./networks/rebuild";
import { powerSolve } from "./power/powerSolve";
import { progressionStep } from "./progression/tier";
import { advanceTime } from "./progression/time";
import { reliabilityStep } from "./reliability/reliabilityStep";
import { decode, encode } from "./snapshot/codec";
import { hashValue } from "./snapshot/hash";
import { airFieldStep } from "./thermal/airField";
import { rackThermalStep } from "./thermal/rackThermal";
import { buildView } from "./view/view";
import { createState } from "./world/init";

export const SNAPSHOT_VERSION = 1;

/** Internal implementation; `state` is public for tests and tools (not part of the contract). */
export class SimImpl implements Sim {
	private readonly scratch: Scratch;

	constructor(
		readonly content: ContentDB,
		readonly state: SimState,
	) {
		this.scratch = createScratch(cellCount(state));
	}

	submit(cmd: SimCommand): CommandResult {
		const plan = planCommand(this, cmd);
		if (plan.ok) this.state.pending.push(JSON.parse(JSON.stringify(cmd)) as SimCommand);
		return toResult(plan);
	}

	step(): SimEvent[] {
		const events: SimEvent[] = [];
		const ctx: TickCtx = { state: this.state, content: this.content, events, scratch: this.scratch };
		this.state.ambientC = ambientAt(this.content.balance, this.state.tick);
		applyCommands(ctx); //  1
		rebuildNetworks(ctx); //  2 (dirty only)
		powerSolve(ctx); //  3
		coolingSolve(ctx); //  4
		airFieldStep(ctx); //  5a
		rackThermalStep(ctx); //  5b
		computeStep(ctx); //  6
		reliabilityStep(ctx); //  7
		stepLifts(ctx); //  8a
		stepBots(ctx); //  8b
		economyStep(ctx); //  9 (incl. contract offers)
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

	canBuild(cmd: SimCommand): CommandResult {
		// Placeholder until agent-sim makes validation queue-aware (M1-T1).
		return toResult(planCommand(this, cmd));
	}

	canPlace(defId: string, floor: number, x: number): CommandResult {
		return toResult(withFunds(this, planPlace(this, defId, floor, x)));
	}
}

export function createSim(content: ContentDB, scenarioId: string, seed: number): Sim {
	return new SimImpl(content, createState(content, scenarioId, seed));
}

export function simFromSnapshot(content: ContentDB, snap: SimSnapshot): Sim {
	if (!snap || snap.version !== SNAPSHOT_VERSION) throw new Error(`unsupported snapshot version ${snap?.version}`);
	return new SimImpl(content, decode(snap.state) as SimState);
}
