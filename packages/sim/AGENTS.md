# @aitower/sim — agent notes

Deterministic, headless simulation core. Public surface = `src/api.ts` (frozen contract) +
`createSim` / `simFromSnapshot` from `src/sim.ts`. No DOM, timers, `Math.random`, `Date`.

## Files
| Path | Purpose |
|---|---|
| `sim.ts` | Façade `SimImpl` (submit/canBuild/step/view/snapshot/hash/canPlace), the queue-aware *projection*, and the tick pipeline |
| `core/state.ts` | `SimState` — the complete serialisable state (entities, typed-array grid layers, RNG, queued commands) |
| `core/constants.ts` | Spec-mandated literals with no `Balance` field (idle 15 %, genset 60-tick stop, bot 20 %/5×, …) |
| `core/rng.ts` | mulberry32 streams (`contracts`, `reliability`, `events`) stored in state; adding a stream never shifts the others |
| `core/grid.ts`, `core/time.ts`, `core/context.ts` | Index helpers / id lookup, clock + ambient + energy price, tick context & scratch buffers |
| `world/defs.ts`, `world/entities.ts`, `world/init.ts` | Def helpers (`needsPower`, `serviceTile`…), add/remove entities, scenario → state |
| `commands/*` | Each command = pure `plan*` (validate + cost) returning an `apply` closure; `apply.ts` dispatches; `shape.ts` = `normalizeCommand` (structural validation of untrusted input, never throws) |
| `networks/*` | Union-find labelling of power/coolant layers; facility/lift → net attachment |
| `power/*` | Demand model; per-net solve (gensets, UPS, satisfaction, dispatch, energy cost) |
| `cooling/*` | Coolant loops (capacity, load, supply temp), chiller COP derate |
| `thermal/*` | Air field (diffusion, envelope, buoyancy, rack heat, CRAH sinks); rack die temp/throttle/trip |
| `compute/*` | Rack allocation & rollback, storage gating, job progress/payouts, contract offers |
| `reliability/*` | Failure hazard rolls, `failRack` (work orders) |
| `logistics/*` | Routing (Dijkstra over walk + multi-lift transfers, cached in `Scratch.nav`), lift SCAN dispatch, bot state machine with timeouts/backoff |
| `economy/*`, `progression/*` | Ledger, upkeep/energy/PUE/uptime/bankruptcy/history; tier at day end; time advance |
| `research/research.ts` | Tech perks (`perk()`, product of researched factors, cached per list), `techGate` ("requires research: <name>"), `planResearch`, `clerkUnlocked`, RP earning |
| `economy/clerk.ts`, `credit.ts`, `audit.ts`, `stats.ts` | Contracts Clerk (`planSetClerk`, `clerkStep`), loans + midnight interest/levy, quarterly audit + grading, lifetime stats helpers |
| `ministry/*` | `memos.ts` (seeded issue cadence/eligibility, `resolveMemo` plan, effects, timeout auto-resolve), `modifiers.ts` (timed modifiers: `modFactor`, `ambientOffset`, labels, expiry), `standing.ts` (standing 0..100, one-shot `gameOver`) |
| `bio/*` | M3: `index.ts` (facility index cache keyed by `topologyRev`, rack load, contamination lookups), `nutrient.ts` (stage 3b), `contamination.ts` (field, stage 8c), `growth.ts` (hourly sprouting, daily cull), `corruption.ts`, `path.ts` (`choosePath`, daily endings, `leadingEnding`) |
| `automation/*` | M4: `policy.ts` (defaults, `shapeAutomation`, `planSetAutomation`), `automationStep.ts` (stage 9d: research, parts, bots), `foreman.ts`, `run.ts` (`runCommand` = plan ▸ pay ▸ apply, `buildable`) |
| `green/weather.ts` | M4: `daylight`, hourly wind and daily drought rolls (`weatherStep`, stage 2b), `renewableFactors` |
| `view/*` | `SimView` builder and facility status precedence |
| `snapshot/*` | Typed-array-aware JSON codec; canonical FNV-1a hash; `load.ts` (decode ▸ migrate ▸ validate), `migrate.ts` (`SNAPSHOT_VERSION`, `migrations`), `validate.ts`, `clone.ts` (deep copy for the projection) |
| `test/fixture.ts` | Self-contained `ContentDB` + helpers for tests |
| `test/chain.ts`, `test/tower.ts` | Multi-lift test world (floors 0..6, chained lifts) and the 60×64 / ~1,000-rack / 30-bot scale tower |

## Tick order (`SimImpl.step`)
0. ambient for this tick
1. `applyCommands` — re-validate queued commands, charge cost, apply (`commandRejected` on failure)
2. `rebuildNetworks` — only when `netsDirty`
2b. `weatherStep` — wind redrawn each game-hour, drought rolled at the start of each game-day (own `weather` RNG stream)
3. `powerSolve` — demand (uses last tick's thermal clock / chiller heat / charger use) → genset control → satisfaction → draws → dispatch grid ▸ genset ▸ UPS → UPS charging → energy cost
3b. `nutrientSolve` — nutrient nets (supply, demand, satisfaction, billing as upkeep)
4. `coolingSolve` — loop capacity/load/supply temp, `noCoolant`, chiller heat for next tick's power
5. `airFieldStep` then `rackThermalStep` — air field, then die temps / throttle / trip / recover
6. `computeStep` — release down racks (+rollback), storage gating, clocks & delivered PFLOPS, allocation, progress/payouts/penalties
7. `reliabilityStep` — failure rolls (one RNG draw per enabled, non-failed rack, id order)
8. `stepLifts` then `stepBots`
8c. `contaminationStep` (diffuse ▸ decay ▸ emit ▸ sterilize ▸ clamp; share, `irreversible`), 8d. `growthStep` (03:00 cull, hourly sprout), 8e. `corruptionStep`
9. `economyStep` — upkeep, energy bill, rolling 24 h PUE/uptime, bankruptcy, offers (expire/generate), history
9b. `memoStep` — expire modifiers, auto-resolve timed-out memos, roll for a new memo (own `events` RNG stream); 9c. `jobStanding` — one standing change from this tick's `jobCompleted`/`jobFailed`
9d. `automationStep` — once per game-hour (`minuteOfDay % 60 == 0`): research ▸ parts ▸ bots ▸ Foreman
10. `progressionStep` — on the last tick of each day: daily standing (uptime vs the *current* tier's target), then tier-up (no victory any more), then `endingsStep` (absorbed ▸ livingTower / cleanTower day counters)
11. `advanceTime` — tick++, ledger roll + `newDay` at day change

## Ministry (M2)
- **Memos**: first no earlier than `graceTicks` (+ jitter), then every `intervalTicks` ±50 % (one `events` draw for the delay, one for the weighted pick); at most `maxOpen` open, never two of the same event, eligibility = `minTier/maxTier/minDay/cooldownDays` (`lastIssuedDay`). Memo text lives in `ContentDB.events`; state holds only `{id,eventId,issuedAt,expiresAt}`, so a save whose memo names an event missing from the content is rejected.
- **Effects** (`resolveMemo`, or the `defaultChoice` at `expiresAt` with `auto: true`): cash via the ledger (gain = revenue, loss = penalties, may go negative), `standing`, `failRacks` (seeded, healthy racks only), `spareParts` (± , depot capacity), and timed `Modifier`s (active while `tick < endsAt`): ambient (added in `sim.step`, visible from the *next* tick), gridCap (`powerSolve`), energyPrice (`powerSolve` + view), payout (offers generated while active), failureRate (`rackHazard`). Same-kind multipliers stack.
- **Standing**: clamped 0..100; every change emits `standingChanged` with the applied delta; 0 ⇒ `gameOver` "shutdown". `gameOver` is set once ("bankrupt" | "shutdown" | "victory"); the sim keeps stepping and memos keep coming.
- **Offers**: with no open offer the next one is forced within `GUARANTEED_OFFER_TICKS` (6 h).

## M2b (research, clerk, credit, audits)
- **Stage 9** also runs `clerkStep` right after offers (one acceptance per tick, same path as `acceptContract`, job marked `clerk`) and samples uptime/PUE for the audit.
- **Midnight** (`progressionStep`, last tick of the day): daily standing ▸ tier-up (reward = revenue) ▸ `midnightCredit` (interest, then levy = `profitShare` × positive profit incl. interest/fees) ▸ `closeAuditDay` (records the day; files the `QuarterReport` when `(day+1) % periodDays == 0`, graded against the tier held during the day; grant = revenue, fine = penalties).
- **RP**: delivered PF-hours × `pointsPerPflopHour` × `researchRate` perk (+ `pointsPerJob` unmultiplied) in `computeStep`. **Perks** (failureRate, energyPrice, payout, coolingCapacity, upkeep, botSpeed, repairSpeed as divisor) are applied beside memo modifiers.
- **Clerk fee**: `earnJob` in computeStep; revenue stays gross, fee → cash and `today.fees`.
- **Scripted events** (`scriptedDay`): `issueScripted` in `memoStep`, at `minuteOfDay == 540` (tick `day*1440 + 180`, day 0 starts 06:00); never in the random pool; `state.scriptedIssued`.
- **Bots**: `def.flying` flies a straight line (x and floor, `speed` per axis per tick, no nav/lifts, view state `flying` while `floor != goalFloor`); `def.carry` = parts per trip (`bot.parts`, `carrying = parts > 0`), chains onto the oldest claimable orders (`tryClaim(..., chain)`).
- Snapshot v4 (`migrateV3`); new state fields are validated in `validateManagement`. Test helpers: `test/m2b.ts`; fixture has a small tech tree, gated rack/bot, drone and hauler.

## Biotech (M3, snapshot v5, `migrateV4`)
- **Nutrient layer** `state.nutrient` (build/demolish/label like coolant; cost = `coolantConduitPerTile`). Plants supply `bio.nutrientCapacity × powerFactor`; consumers = organoid racks (`rack.bio.nutrientUse × load`, load = busy 1 / idle 0.15 / down 0) and bioreactors (flat `bio.nutrientUse`). Satisfaction scales rack clock (`f.nutrientSat`); 0 ⇒ `noNutrient` (not allocatable). Supply is billed at `nutrientPrice` as upkeep.
- **Organoid racks** (`cooling: "bio"` + `rack.bio`): own band in `rackThermalStep` (full ±tol, linear to `minClock` at ±2×, fail via `failRack` beyond ±3×, `tooCold` / `throttled`; never trips). `needsBio` jobs need `cooling: "bio"` (`rackSuits`); `needsLiquid` jobs now also exclude bio racks. `metrics.organoidPflops`.
- **Bioreactors** are power sources dispatched before the grid (capacity × last tick's nutrient satisfaction), included in `totalKw`.
- **Contamination** `state.contamination` (Float32, slab cells only, unbuilt = 0, no leak outdoors). Hazard ×(1 + k·c) in `rackHazard`; bot speed ×max(0.3, 1 − k·c). Quarantine = enabled facility; link leak applies if either end is a quarantine cell. `irreversible` is sticky: sterilizers × `irreversibleCleanFactor`, `closeAuditDay` records/files nothing.
- **Bots**: exposure accumulates on cells ≥ `mutationThreshold`; trait = `(id + seed) % 2 == 0 ? fleshed : tendriled`. Fleshed: repair ×0.6, +0.2 contamination at the repair tile on completion. Tendriled: carry +2, `route` returns null for any other floor (no lifts, no flying).
- **Growths** (`def.growth`, `f.grown`): own `growth` RNG stream (draw per qualifying cell on each hour, +1 for the def pick, none without growth defs); need no power/nutrient/coolant, no upkeep, no refund; failure (reliability roll) = `failed` + `recoverAt` (+180 ticks), no work order, `rackRecovered` on return; culling rooms remove them at 03:00 (`demolished` events).
- **Corruption / endings / path**: see `bio/corruption.ts`, `bio/path.ts`. `gameOver.ending`; `absorbed` is a game over kind. Path gates: `TechNode.path` (`planResearch`), `EventDef.path` / `minCorruption` (pool and scripted).
- Tests: `bio.test.ts`; fixture has small biotech defs (`nutrient_plant`, `sterile_bay`, `culling_room`, `quarantine_lock`, `bioreactor`, `organoid_rack`, `growth_mass`, `needy_depot`).

## Automation, Greentech, Synthetic, scenarios (M4, snapshot v6, `migrateV5`)
- **Policy** `state.automation` (`setAutomation` replaces it whole; enabling the Foreman needs a researched `foreman` feature node, `foremanUnlocked`). Orders run through `runCommand` = the same `plan*` + payment as a player's command. Research: first affordable node by `branches` order (non-empty list also restricts) ▸ cost ▸ id, one per hour. Parts: `min(partsBatch, depot room)` when stock < keep. Bots: priciest unlocked type when `bots < min(maxBots, ceil(racks / racksPerBot))`, one per hour.
- **Foreman** (`automation/foreman.ts`): ≤ `foremanPerHour` placements per hour, cash − cost ≥ `reserve`, footprint fully on slab **and** power conduit, never builds slab/conduit. Order per placement: power (grid tie / genset, largest capacity first, on a net with satisfaction < 1, footprint inside that net) ▸ cooling (largest CRAH within reach of the hottest rack above `okC`; racks in reach are then covered) ▸ racks (DLC when a coolant net with spare capacity ≥ its liquid heat is reachable, else best air rack; wanted when installed compute is < 20 % idle, or offers exist and none passes `acceptCheck` ignoring storage — at most one rack per run for the offer reason). Spot = floor nearest the racks (floor 0 when none), leftmost cell run that `place` accepts. Nets are rebuilt after each placement. **Maintenance first** (rides on the `racks` toggle): between cooling and racks it adds the best charger when `bots` wants more bots than the docks hold, and a depot when parts stock < keep and every depot is full (parts order on). Racks wait while: open work orders > bots; uptime < the tier's target; standing < `FOREMAN_MIN_STANDING` (40); the last closed day lost money; any rack is within `FOREMAN_HEAT_MARGIN_C` of `okC` (cooling on); a power net is short (power on). A rack spot must leave a free powered run as wide as the best CRAH within its reach to the left (`leavesRoom`), else floors fill solid and hot racks can never get a CRAH.
- **Green power**: solar/wind are free sources dispatched first (`PowerBucket.greens`), counted in `metrics.totalKw`/`greenKw` (so PUE includes them); `needsPower` is true for them (they attach to a power net). Daylight sine 06:00-20:00, wind 0.2..1 hourly, drought = `tick < droughtUntil` × `droughtFactor`.
- **heat_export** acts in `airFieldStep` after the CRAHs (pulls cells in reach down to 20 °C at most, `exportKw` × power satisfaction, `earn`s `heatPrice` per kWh, `f.heatKw` = heat removed). **carbon** pays at day end (`progressionStep`) when enabled and powered.
- **Scores** (`economyStep`): `greenScore` smoothed 1/60 per tick toward 0.7 × solar+wind share of 24 h energy + 0.3 × min(1, 24 h exported heat ÷ IT energy); `refinement` = uptime × share of delivered PFLOPS on racks with `unlockTier ≥ 4`. `pathScore` in the view picks by path. Endings `greenExemplar` / `millionMinds` in `endingsStep` (skipped when absent from balance); `leadingEnding` covers all three paths.
- **Scenarios**: `startingCash`, `startTier` (clamped to the tier table), `sandbox` (`state.sandbox`, re-derived from the scenario on every load): no bankruptcy and no shutdown (standing still moves).
- **`earned`**: training checkpoint/completion payments at once; inference revenue accumulates in `job.unreported` and is flushed hourly, at completion and on `cancelJob`.
- Tests: `automation.test.ts`, `green.test.ts` (weather, exporters, scores, endings, scenarios, earned, v5 ▸ v6, determinism), perf test with every order on. The fixture has `solar_array`, `wind_turbine`, `heat_exchanger`, `carbon_facade`, `rack_top` (tier 4) and the `t_foreman` node.

## Invariants
- Everything that affects the future is in `SimState`; scratch buffers are overwritten every tick.
- Entity arrays are sorted by id; ids are monotonic and never reused. Iterate arrays, never `Map`s keyed by objects.
- Grid index = `(floor - floorMin) * width + x`. Bot/lift `x` is a tile index (3.0 = centred on tile 3).
- Net ids are assigned by ascending lowest cell index ⇒ deterministic labels.
- Air field is flux-form (pairwise exchange) ⇒ energy-conserving; each link's k·dt/C ≤ 0.2 ⇒ stable.
- **Command validation is queue-aware.** `submit()`/`canBuild()` first run `normalizeCommand` (types, finite numbers, no throw), then validate
  against a lazily created *projected* state: a deep clone of the state with every queued command already applied (created on the first
  `submit` after a step, or on `canBuild` when a restored save has a queue; dropped by `step()`). `canBuild` never queues and never clones when
  nothing is queued. `canPlace` = `canBuild({type:"place"})`. `applyCommands` re-validates and stays authoritative. Code that edits `state`
  directly between submits must call `SimImpl.invalidateProjection()` (tests only). Lookups by user-supplied id use `Object.hasOwn` (no `constructor`/`__proto__` hits).
- **Saves**: `simFromSnapshot` = `loadSnapshot`: decode (rejects non-numeric typed-array data and `__proto__` keys) ▸ `migrateState`
  (`migrations[v]`: v ▸ v+1) ▸ `validateState` (grid/array lengths, known def ids, bounds, id order, references, finite numbers, net ranges) and throws
  `Error("Invalid save: <reason>")`. Queued commands that no longer parse are dropped, not fatal. When you add a field to a state interface,
  add it to the field tables in `validate.ts` (they are `Record<keyof …>`, so the compiler tells you) and bump `SNAPSHOT_VERSION` with a migration.
  `bot.goalId`/`bot.liftId` may dangle (the sim repairs them); work-order/job/home references may not.
- **Topology**: `state.topologyRev` is bumped when slab, a lift or a facility is added/removed. Bots re-plan their path (and drop backoffs) when
  it changes; the routing/depot-index cache (`Scratch.nav`) is rebuilt on a change. Conduits do not affect it.
- **Bot robustness**: a bot with no progress for `BOT_STUCK_TICKS`, or whose goal becomes unreachable, releases its order (`attempts++`,
  `retryAt = tick + backoff`, lifted by any topology change) and walks home; a bot with no reachable depot / no way home backs off itself
  (`retryAt`, `fails`). Idle bots plan at most `BOT_MAX_CLAIM_PLANS_PER_TICK` orders per tick. Lift cars ignore hall calls while full.
- Slab support rule (intentional, not a bug): slab above ground (floor > 0) needs slab below; basements and floor 0 do not. Demolishing refuses only
  when a supported slab sits directly above (`floor + 1 > 0`). Conduit support is resolved to a fixed point, so cell order does not matter.
- Content numbers come from `ContentDB`; the few spec literals without a `Balance` field live in `core/constants.ts`.

## Test
`npx vitest run packages/sim tools/sim-cli` — placement/costs, networks, power, thermal, coolant, jobs,
offers, logistics (`logistics.test.ts` single lift, `bots.test.ts` multi-lift/timeouts/topology changes, `routing.test.ts`), economy/progression,
determinism (3 days, hash every 100 ticks; snapshot round-trip), `commands.test.ts` (queue-aware validation), `fuzz.test.ts` (seeded, 2,000
malformed + valid commands, incl. `resolveMemo` against expiring memos), `snapshot.test.ts` (validation, migrations; v2 → v3 is tested in `ministry.test.ts`, v3 → v4 in `m2bSave.test.ts`), `research.test.ts`, `management.test.ts` (clerk, loans, levy, audits, stats), `m2bBots.test.ts`, `scripted.test.ts`, `m2bSave.test.ts`, `ministry.test.ts` (memos, effects, standing, game over, determinism, v3 validation), perf (48×13 / 60 racks / 4 bots: 1440 ticks < 1.5 s; 60×64 tower,
~1,000 racks, 30 bots: best-window mean `step()` < 2 ms). Headless run with real content: `npm run sim -- starter 10` (`--auto` accepts only work that fits half the deadline and turns every standing order on and researches the Foreman first; real content has no Foreman node until T2).
