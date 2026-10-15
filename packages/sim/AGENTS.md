# @aitower/sim — agent notes

Deterministic, headless simulation core. Public surface = `src/api.ts` (frozen contract) +
`createSim` / `simFromSnapshot` from `src/sim.ts`. No DOM, timers, `Math.random`, `Date`.

## Files
| Path | Purpose |
|---|---|
| `sim.ts` | Façade `SimImpl` (submit/step/view/snapshot/hash/canPlace) and the tick pipeline |
| `core/state.ts` | `SimState` — the complete serialisable state (entities, typed-array grid layers, RNG, queued commands) |
| `core/constants.ts` | Spec-mandated literals with no `Balance` field (idle 15 %, genset 60-tick stop, bot 20 %/5×, …) |
| `core/rng.ts` | mulberry32 streams (`contracts`, `reliability`) stored in state |
| `core/grid.ts`, `core/time.ts`, `core/context.ts` | Index helpers / id lookup, clock + ambient + energy price, tick context & scratch buffers |
| `world/defs.ts`, `world/entities.ts`, `world/init.ts` | Def helpers (`needsPower`, `serviceTile`…), add/remove entities, scenario → state |
| `commands/*` | Each command = pure `plan*` (validate + cost) returning an `apply` closure; `apply.ts` dispatches |
| `networks/*` | Union-find labelling of power/coolant layers; facility/lift → net attachment |
| `power/*` | Demand model; per-net solve (gensets, UPS, satisfaction, dispatch, energy cost) |
| `cooling/*` | Coolant loops (capacity, load, supply temp), chiller COP derate |
| `thermal/*` | Air field (diffusion, envelope, buoyancy, rack heat, CRAH sinks); rack die temp/throttle/trip |
| `compute/*` | Rack allocation & rollback, storage gating, job progress/payouts, contract offers |
| `reliability/*` | Failure hazard rolls, `failRack` (work orders) |
| `logistics/*` | Routing (walk + single-lift transfers), lift SCAN dispatch, bot state machine |
| `economy/*`, `progression/*` | Ledger, upkeep/energy/PUE/uptime/bankruptcy/history; tier at day end; time advance |
| `view/*` | `SimView` builder and facility status precedence |
| `snapshot/*` | Typed-array-aware JSON codec; canonical FNV-1a hash |
| `test/fixture.ts` | Self-contained `ContentDB` + helpers for tests |

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
- `submit()` validates against the *current* state (not including other queued commands); `step()` re-validates.
- Content numbers come from `ContentDB`; the few spec literals without a `Balance` field live in `core/constants.ts`.

## Test
`npx vitest run packages/sim tools/sim-cli` — placement/costs, networks, power, thermal, coolant, jobs,
offers, logistics, economy/progression, determinism (3 days, hash every 100 ticks; snapshot round-trip),
perf (48×13, 60 racks, 4 bots: 1440 ticks < 1.5 s). Headless run with real content: `npm run sim -- starter 10`.
