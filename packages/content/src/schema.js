/**
 * CONTRACT — owned by the orchestrator. Changes need orchestrator sign-off
 * because `sim`, `render`, `ui` and `audio` all depend on these shapes.
 *
 * Everything the player can place (except slabs, conduits and lifts) is a
 * FacilityDef. Facilities sit on a single floor and span `width` tiles.
 * Units: kW, kWh, °C, $, ticks (1 tick = 1 game-minute).
 */
export {};
