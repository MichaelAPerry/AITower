/**
 * The four after-hours easter eggs (docs/AFTER_HOURS.md): fixed, unbuildable spots with a clickable item each. This file holds the
 * data, the streak rule and the purchase; `click.ts` opens the dialogue.
 */
import { AFTER_HOURS_ITEM_IDS, type AdvisorId, type AfterHoursItemId } from "@aitower/content";
import type { SimState } from "../core/state";
import { cellIdx, inBounds } from "../core/grid";

export interface AfterHoursSpot {
	id: AfterHoursItemId;
	/** The character the item belongs to (and whose off-duty portrait the upgrade unlocks). */
	advisor: AdvisorId;
	/** Plain name of the item, and of its upgrade. */
	name: string;
	upgradeName: string;
	/** Sim floor (0 = G, 1 = F1, -1 = B1, 2 = F2) and the left tile; the spot is `width` tiles wide. */
	floor: number;
	x: number;
	width: number;
}

/**
 * Bea's fern and Cass's coffee machine stand on G (the lobby, on opposite sides); Luci's book and Mel's tank stand on B (the
 * basement). G and B have slab in every scenario, so no extra floor is needed. Positions fit the narrowest lot (48 wide; the
 * basement slab runs from x=4).
 */
export const AFTER_HOURS_SPOTS: readonly AfterHoursSpot[] = [
	{ id: "tank", advisor: "mel", name: "Fish tank", upgradeName: "Bio-enhanced tank", floor: -1, x: 31, width: 4 },
	{ id: "fern", advisor: "bea", name: "Fern", upgradeName: "Big pot with automatic watering", floor: 0, x: 4, width: 2 },
	{ id: "coffee", advisor: "cass", name: "Coffee machine", upgradeName: "Cappuccino machine", floor: 0, x: 42, width: 3 },
	{ id: "book", advisor: "luci", name: "Book", upgradeName: "Licence and certificate", floor: -1, x: 39, width: 4 },
];

export const spotOf = (id: string): AfterHoursSpot | undefined => AFTER_HOURS_SPOTS.find((s) => s.id === id);

/** Per-item progress, saved with the game. */
export interface AfterHoursItemState {
	/** Consecutive days with a click, as of `lastDay` (see `streakOf` for the value that counts today). */
	streak: number;
	/** The game day of the last counted click (-1 = never). */
	lastDay: number;
	/** The "third day" dialogue has been shown. */
	thirdSeen: boolean;
	/** The streak reached the tenth day once: from then on every click offers the upgrade. */
	tenthReached: boolean;
	/** How many times the upgrade was offered again after a No (picks the lead-in line). */
	offers: number;
	bought: boolean;
}

export type AfterHoursState = Record<AfterHoursItemId, AfterHoursItemState>;

export const emptyItemState = (): AfterHoursItemState => ({ streak: 0, lastDay: -1, thirdSeen: false, tenthReached: false, offers: 0, bought: false });

export function initialAfterHours(): AfterHoursState {
	return { fern: emptyItemState(), tank: emptyItemState(), coffee: emptyItemState(), book: emptyItemState() };
}

export const ITEM_IDS = AFTER_HOURS_ITEM_IDS;

/** The streak that counts on `day`: a day with no click in between has reset it to 0. */
export const streakOf = (s: AfterHoursItemState, day: number): number => (s.lastDay >= day - 1 ? s.streak : 0);

/** Is a tile of any spot at (floor, x)? Returns that spot. */
export function spotAt(floor: number, x: number): AfterHoursSpot | undefined {
	return AFTER_HOURS_SPOTS.find((s) => s.floor === floor && x >= s.x && x < s.x + s.width);
}

/** Every game mode has the four spots: the campaign lots, the sandbox and every lesson. Only the sim's own test worlds (`empty` and custom ids) have none. */
export const hasSpots = (state: Pick<SimState, "scenarioId">): boolean => state.scenarioId === "starter" || state.scenarioId === "brownfield" || state.scenarioId === "sandbox" || state.scenarioId.startsWith("lesson_");

/** The reason a facility or lift over tiles `x0..x1` of `floor` is refused, or null. The spots cannot be built over. */
export function afterHoursBlock(state: Pick<SimState, "scenarioId">, floor: number, x0: number, x1: number): string | null {
	if (!hasSpots(state)) return null;
	for (const s of AFTER_HOURS_SPOTS) if (s.floor === floor && x0 < s.x + s.width && x1 >= s.x) return `${s.name.toLowerCase()} corner is not for building`;
	return null;
}

/** Does the spot stand on slab (so it exists in the tower today)? G and B are slab in every scenario. */
export function spotVisible(state: SimState, spot: AfterHoursSpot): boolean {
	if (!hasSpots(state)) return false;
	for (let cx = spot.x; cx < spot.x + spot.width; cx++) {
		if (!inBounds(state, cx, spot.floor) || !state.slab[cellIdx(state, cx, spot.floor)]) return false;
	}
	return true;
}
