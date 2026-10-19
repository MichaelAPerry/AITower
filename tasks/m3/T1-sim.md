# M3-T1 — agent-sim: nutrient network, organoids, contamination, mutations, growths, corruption, path and endings

Read `tasks/m3/README.md`, `packages/sim/AGENTS.md`, `src/api.ts` and `content/src/schema.ts` (the new M3 parts).
The real content (biotech facilities, tier 5, events) is being written in parallel, so extend `src/test/fixture.ts` with your own small biotech defs.
Keep determinism (one new RNG stream if you need randomness; existing streams untouched) and the perf budgets (the contamination field must stay cheap; reuse the air-field approach).

## 1. Nutrient network
- **Layer:** a third conduit layer, `"nutrient"`, built, demolished and labelled exactly like coolant, with its own cost: reuse `structure.coolantConduitPerTile` unless content adds a field. Report what you chose.
- **Supply and demand:** `nutrient` facilities supply `bio.nutrientCapacity` units per tick to their net. Organoid racks (`rack.bio.nutrientUse` × load) and bioreactors (`bio.nutrientUse`) draw from it.
- **Satisfaction** = min(1, supply / demand). Below 1 the bio consumers scale down; at 0 they get status `noNutrient`.
- **Cost:** each unit supplied costs `balance.bio.nutrientPrice`, charged as upkeep.
- **Placement:** `needsNutrient` checks the nutrient conduit, like `needsCoolant`.
- **View:** `FacilityView.nutrientNet` and `view.nutrientNets`.

## 2. Organoid racks (`cooling: "bio"`)
- **Temperature band:**
  - Full clock within `targetC ± toleranceC`.
  - Linear down to `thermal.minClock` at ±2× tolerance.
  - Beyond ±3× the tissue fails, like a component failure: a work order, and repairable.
- **Too cold is a fault too:** status `tooCold` when below the band (throttled or worse).
- **Thermal model:** reuse the rack thermal model. Organoids draw little power, so they need warm air, and neighbouring GPUs' waste heat helps (a deliberate synergy and trap).
- **Jobs:** `needsBio` contracts may only use bio racks. Bio racks may serve other jobs too. Mirror this in `acceptCheck`.
- **View:** `view.organoidPflops`.

## 3. Contamination field
- **The field:** `Float32Array` 0..1 per cell, exposed as `view.contamination` and `FacilityView.contamination` (the max over its cells).
- **Sources:**
  - organoid racks (`rack.bio.contamination` × load)
  - bioreactors and growths (`bio.contamination`)
  - fleshed bots where they repair
- **Spread:** diffuses to open neighbours with `bio.diffusion` (`slabFactor` across floors), decays with `decay`, and is clamped to 0..1.
- **Quarantine:** cells under a `quarantine` facility pass only `quarantineLeak` of normal diffusion.
- **Sterilizers:** remove `bio.cleanRate` × power satisfaction from cells within `bio.radius` on their floor. `cullsGrowths` also kills growths in reach, once a day at a deterministic time.
- **Effects:**
  - rack failure hazard ×(1 + `hazardPerContamination` × c)
  - bot speed ×(1 − `botSlowPerContamination` × c), floored at 0.3
- **Shares:** `contaminatedShare` = cells with c ≥ 0.5 among built (slab) cells. Crossing `irreversibleShare` sets `irreversible`, which is sticky and emits `contaminationIrreversible` once. After that:
  - sterilizers are scaled by `irreversibleCleanFactor`
  - **quarterly audits are no longer filed** (the Ministry quietly stops sending inspectors)

## 4. Mutations, growths and corruption
- **Mutation:** a bot accumulating `mutationExposureTicks` on cells ≥ `mutationThreshold` mutates once (`botMutated`):
  - `fleshed`: repair ticks ×0.6, and +0.2 contamination where it repairs.
  - `tendriled`: carry +2, never rides lifts, so it only takes work on its own floor.
  
  Choose deterministically between the two.
- **Growths:** empty slab cells (no facility, no lift) with c ≥ `growthThreshold` may sprout one of the content's `growth` defs. The roll is hourly, with probability per hour = `growthChancePerDay` / 24, using the new RNG stream.
  - **Behaviour:** a growth works without any conduits, is free, and self-heals (no work orders). After a failure it returns by itself after a few hours. It emits contamination.
  - **Records:** marked `grown: true`, with an event `growthSprouted`. It can be demolished with no refund.
- **Corruption** (`view.corruption`, 0..1):
  - target = min(1, 0.5 × contaminatedShare/irreversibleShare + 0.3 × (organoid PFLOPS ÷ total delivered PFLOPS) + 0.2 × min(1, growths/20))
  - It moves toward the target at up to +0.1 a day and −0.02 a day, applied per tick.

## 5. Ascension, endings, events and other rules
- **`choosePath`:** reject unless tier ≥ `ascension.minTier`, the path exists in `content.paths` and is `available`, and none was chosen before. On success emit `pathChosen`.
- **Path gates:** a `TechNode.path` can't be researched before that path is chosen; an `EventDef.path` isn't issued before it either.
- **Victory changes:** reaching the top tier no longer sets `victory`.
- **Endings:** each must hold continuously at the daily check.
  - **livingTower:** path biotech, corruption ≥ `minCorruption`, organoid PFLOPS ≥ `pflops`, for `days` days ⇒ `gameOver {kind:"victory", ending:"livingTower"}`.
  - **cleanTower:** path biotech, corruption ≤ `maxCorruption`, organoid PFLOPS ≥ `pflops`, for `days` days ⇒ victory with ending `cleanTower`.
  - **absorbed:** tier ≥ `ascension.minTier` and corruption ≥ `absorbed.corruption` ⇒ `gameOver {kind:"absorbed", ending:"absorbed"}`, which is final.
  - `view.endingProgress` shows the closest one.
- **Events:** `EventDef.minCorruption` filters the event pool.
- **Snapshot:** v5 with a migration from v4 and validation; old saves load.

## 6. Tests and sim-cli
- **Tests** cover every rule above: diffusion conservation and decay, quarantine, sterilizer, irreversibility and the audit stop, the band in both directions, mutation, growth sprouting and self-healing, corruption rates, `choosePath` rejections, each ending, the migration and determinism.
- **sim-cli:** keep it working. Add a `corruption` column.
- **Report:** the perf numbers.
