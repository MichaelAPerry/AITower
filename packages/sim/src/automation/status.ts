/**
 * The Foreman's last status lines. Display only: they are not part of the simulation state (so no snapshot change) and
 * are empty after a load until the next hourly check.
 */
import type { SimState } from "../core/state";

const lines = new WeakMap<SimState, string[]>();

export const setForemanStatus = (state: SimState, out: string[]): void => {
	lines.set(state, out);
};
export const foremanStatusOf = (state: SimState): string[] => (lines.get(state) ?? []).slice();
