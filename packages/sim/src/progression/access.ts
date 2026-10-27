/**
 * Who may place what: Level and research (docs/REFRAME.md has no commit and no bond gates). One function, `placeBlock`,
 * answers "why can this player not place `d` right now?" for the `place`, `upgradeFacility` and `retrofit` commands, the Foreman
 * and the UI. A tree rack is never placed from scratch: it comes from a retrofit (`isRetrofitOnly`).
 */
import type { ContentDB, FacilityDef } from "@aitower/content";
import type { SimState } from "../core/state";
import { techGate } from "../research/research";

/**
 * Why `d` cannot be built by this player now (Level, research), or null. Cash, floor and site rules are the plan's own business.
 * `ignoreTier` skips everything (scenario setup).
 */
export function placeBlock(state: SimState, content: ContentDB, d: FacilityDef): string | null {
	if (d.unlockTier > state.tier) return `requires tier ${d.unlockTier}`;
	return techGate(state, content, d.tech);
}
