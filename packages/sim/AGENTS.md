# @aitower/sim — agent notes

Deterministic, headless simulation core. Public surface = `src/api.ts` (frozen contract) +
`createSim` / `simFromSnapshot` from `src/sim.ts`. No DOM, timers, `Math.random`, `Date`.

## Files
| Path | Purpose |
|---|---|
| `sim.ts` | Façade `SimImpl` (submit/canBuild/step/view/snapshot/hash/canPlace), the queue-aware *projection*, and the tick pipeline |
| `core/state.ts` | `SimState` — the complete serialisable state (entities, typed-array grid layers, RNG, queued commands) |
| `core/constants.ts` | Spec-mandated literals with no `Balance` field (idle 15 %, genset 60-tick stop, bot 20 %/5×, …) |
| `core/rng.ts` | mulberry32 streams (`contracts`, `reliability`) stored in state |
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
| `view/*` | `SimView` builder and facility status precedence |
| `snapshot/*` | Typed-array-aware JSON codec; canonical FNV-1a hash; `load.ts` (decode ▸ migrate ▸ validate), `migrate.ts` (`SNAPSHOT_VERSION`, `migrations`), `validate.ts`, `clone.ts` (deep copy for the projection) |
| `test/fixture.ts` | Self-contained `ContentDB` + helpers for tests |
| `test/chain.ts`, `test/tower.ts` | Multi-lift test world (floors 0..6, chained lifts) and the 60×64 / ~1,000-rack / 30-bot scale tower |

## Tick order (`SimImpl.step`)
0. ambient for this tick
1. `applyCommands` — re-validate queued commands, charge cost, apply (`commandRejected` on failure)
2. `rebuildNetworks` — only when `netsDirty`
3. `powerSolve` — demand (uses last tick's thermal clock / chiller heat / charger use) → genset control → satisfaction → draws → dispatch grid ▸ genset ▸ UPS → UPS charging → energy cost
4. `coolingSolve` — loop capacity/load/supply temp, `noCoolant`, chiller heat for next tick's power
5. `airFieldStep` then `rackThermalStep` — air field, then die temps / throttle / trip / recover
6. `computeStep` — release down racks (+rollback), storage gating, clocks & delivered PFLOPS, allocation, progress/payouts/penalties
7. `reliabilityStep` — failure rolls (one RNG draw per enabled, non-failed rack, id order)
8. `stepLifts` then `stepBots`
9. `economyStep` — upkeep, energy bill, rolling 24 h PUE/uptime, bankruptcy, offers (expire/generate), history
10. `progressionStep` — tier on the last tick of each day
11. `advanceTime` — tick++, ledger roll + `newDay` at day change

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
malformed + valid commands), `snapshot.test.ts` (validation, migrations), perf (48×13 / 60 racks / 4 bots: 1440 ticks < 1.5 s; 60×64 tower,
~1,000 racks, 30 bots: best-window mean `step()` < 2 ms). Headless run with real content: `npm run sim -- starter 10`.
