/**
 * A tiny in-memory channel between whoever runs the checks (the HUD's toast layer, the lesson layer) and whoever shows the result
 * (the unlock strip, the ending screen's "New: ..." line). Nothing here is saved: the profile is the record.
 */
import type { AdvisorKey } from "@aitower/shared";
import { useSyncExternalStore } from "react";
import type { AwardResult } from "./achievements";

/** What this run has earned so far (ids), for the ending screen. Cleared when a new game or a load starts. */
export interface RunAwards {
	achievements: string[];
	portraits: AdvisorKey[];
	bed: boolean;
}

const none = (): RunAwards => ({ achievements: [], portraits: [], bed: false });
let run: RunAwards = none();
const strips = new Set<(r: AwardResult) => void>();
const watchers = new Set<() => void>();
const notify = (): void => {
	for (const w of watchers) w();
};

/** Record what was just earned and hand it to the strip. */
export function publishAwards(r: AwardResult): void {
	if (!r.won.length && !r.portraits.length && !r.bed) return;
	run = { achievements: [...run.achievements, ...r.won.map((d) => d.id)], portraits: [...run.portraits, ...r.portraits], bed: run.bed || r.bed };
	for (const s of strips) s(r);
	notify();
}

/** The unlock strip listens here. Returns the unsubscribe. */
export function onAwards(fn: (r: AwardResult) => void): () => void {
	strips.add(fn);
	return () => strips.delete(fn);
}

export const runAwards = (): RunAwards => run;

export function resetRunAwards(): void {
	if (!run.achievements.length && !run.portraits.length && !run.bed) return;
	run = none();
	notify();
}

const watch = (fn: () => void): (() => void) => {
	watchers.add(fn);
	return () => watchers.delete(fn);
};

/** React hook: the current run's awards (re-renders when one lands). */
export const useRunAwards = (): RunAwards => useSyncExternalStore(watch, runAwards, runAwards);
