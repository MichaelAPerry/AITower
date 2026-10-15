// PLACEHOLDER — replaced by agent-sim. Signatures are part of the contract.
import type { ContentDB } from "@aitower/content";
import type { Sim, SimSnapshot } from "./api";

export function createSim(_content: ContentDB, _scenarioId: string, _seed: number): Sim {
	throw new Error("createSim: not implemented");
}

export function simFromSnapshot(_content: ContentDB, _snap: SimSnapshot): Sim {
	throw new Error("simFromSnapshot: not implemented");
}
