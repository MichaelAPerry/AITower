# M4-T1 — agent-sim: automation, Greentech and Synthetic mechanics, scenarios, `earned` events
Owns `packages/sim/**` (not `api.ts`) and `tools/sim-cli/**`. Read `tasks/m4/README.md` and the M4 parts of `api.ts` and `schema.ts`.

## 1. Automation
Keep the policy in state (snapshot v6, with a migration from v5). Defaults: everything off; parts keep 4; bots one per 12 racks, max 8; Foreman reserve $1M, all three of its kinds on.

**`setAutomation`:** validate the shape. Reject enabling the Foreman until a researched node has the `foreman` feature (`view.automation.foremanUnlocked`).

**Once per game-hour, deterministically, through the same plan/validation as the player's commands:**
- **Research:** the next affordable node by branch priority, then cheapest, then id.
- **Parts:** buy `partsBatch` when stock < keep and cash allows.
- **Bots:** buy the best unlocked bot type when bots < min(maxBots, ceil(racks / racksPerBot)).
- **Foreman:** at most `foremanPerHour` placements, never dropping below `reserve`, and only on built slab whose cells have a power conduit (coolant and nutrient are needed only for defs that need them). Priority:
  1. **Power:** a grid tie or genset (best unlocked) when any power net has satisfaction < 1.
  2. **Cooling:** the best unlocked CRAH within reach of racks whose temperature > `okC`.
  3. **Racks:** the best unlocked air rack (or DLC, if a coolant loop with spare capacity is reachable) when no current offer fits idle capacity, or idle capacity < 20 %.
  
  Pick the leftmost valid spot nearest the existing racks. Emit `autoBuilt` / `autoBought`.

## 2. Greentech and Synthetic paths
- **Solar:** `power.capacityKw` × daylight (0 between 20:00 and 06:00, a sine peak at 13:00) × (drought ? `droughtFactor` : 1).
- **Wind:** capacity × a seeded hourly wind value in 0.2..1, using a new RNG stream (`drought` → `droughtFactor`).
- **Drought:** rolled daily with `droughtChancePerDay`, lasting `droughtHours`. Sets `view.drought` and emits the drought events.
- **heat_export:** removes up to `green.exportKw` of heat (scaled by satisfaction) from air cells within its radius and sells removed kWh × `heatPrice` as revenue.
- **carbon:** earns `creditsPerDay` × `creditPrice` as revenue at midnight while powered.
- **`greenScore`:** a 0..1 smoothed blend: 0.7 × the solar+wind share of energy over the last 24 h, plus 0.3 × min(1, heat exported ÷ IT energy).
- **`refinement`:** uptime × the share of delivered compute on racks with `unlockTier` ≥ 4.
- **`pathScore`:** by path (biotech = corruption, greentech = greenScore, synthetic = refinement); with no path chosen, corruption.
- **Endings:** `greenExemplar` and `millionMinds`, from `balance.endings` (optional fields, so skip one when it's absent), with the same "holds for N days" rule as M3, and `endingProgress` covering them.

## 3. Scenarios and `earned`
- **Scenarios:** apply `startingCash`, `startTier` and `sandbox`. In a sandbox there's no bankruptcy and no shutdown. `view.sandbox` follows the scenario.
- **`earned`:** emit for training checkpoints and the completion balance, and inference revenue summed per job per game-hour.

## 4. sim-cli and tests
- **sim-cli:** add an `--auto` flag that turns on every automation (Foreman unlocked via research when affordable) and reports facilities built. Show that a 30-day automated starter run grows and stays solvent.
- **Tests:** every rule above, plus a determinism test and the migration test. Report the perf numbers.
