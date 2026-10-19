# @aitower/content

Game data, validation and the contract generator. Depends on nothing.

## Files
| File | Purpose |
|---|---|
| `src/schema.ts` | **Frozen contract** (orchestrator-owned). Do not edit. |
| `src/data/*.json` | Facilities, bots, clients, structure costs, lift, balance, scenarios. Records are keyed by `id`. |
| `src/load.ts` | `loadContent()` — statically imports the JSON, deep-copies it, attaches `generateContract`, validates, throws listing every problem. |
| `src/validate.ts` | `validateContent(db): string[]` — hand-written checks (ids/keys, kind→category→spec, numbers, 24-hour price curve, tier arrays, thermal stability, scenario placement: lot bounds, slab support, overlaps, lift shafts, power/coolant conduits, min/max floor). `facilityNeedsPower(def)` mirrors the sim default. |
| `src/data/events.json` | 37 Ministry memos (16 ministry, 8 environmental, 9 operational, 4 client; incl. the day-2 scripted `first_heat_alarm`; `horror` reserved for M3). Each choice's `hint` states its real numbers in a fixed format (`+$150k now · standing -5 · ambient +8°C for 12h`); `events.test.ts` checks hints against effects and that no cash/standing-only choice is strictly dominated. |
| `src/data/tech.json` | M2b research tree: 36 nodes, 5 branches, tiers 1-4 (8/10/12/6). Unlocks are declared on the facility/bot (`tech: "<node id>"`), never on the node; perks stay within x0.8-1.15. Generated descriptions state the real numbers, so re-check them if a value changes. |
| `src/data/facilities.json` | 31 facilities (11 original, ungated; 20 M2b ones, all `tech`-gated, `unlockTier` 2-4). `bots.json`: rover + tech-gated `drone` (flying) and `lifter` (carry 3). |
| `src/contracts.ts` | `generateContract` (deterministic; randomness only via `rng`), `pickClient`, `CONTRACT_TUNING` ($/PFLOP-h rates and size ranges). |
| `src/*.test.ts` | Loader/validator and generator tests. |

## Invariants
- Event ids are `[a-z0-9_]+` and unique; `defaultChoice` must exist; effect durations are positive integers; weights > 0; `gridCap` factor 0..1 (0 = blackout). `validateContent` also checks `balance.standing` / `balance.events`.
- M2 economy: tier rewards are 5x the M1 values; `rack_dlc_gpu` is 130 PFLOPS so it computes ~1.6x the air PFLOPS per dollar once CDU/chiller/CRAH shares are counted (test in `events.test.ts`).
- Facility ids are fixed (other packages and tests reference them): `rack_air_gpu`, `rack_dlc_gpu`, `rack_storage`,
  `crah_unit`, `chiller`, `cdu`, `grid_tie`, `genset`, `ups_battery`, `parts_depot`, `bot_charger`; bot `rover`;
  scenario `starter`.
- `loadContent()` is synchronous and returns a fresh copy on every call (callers may mutate their copy).
- `generateContract` must never call `Math.random`/`Date`; same rng sequence ⇒ same contracts.
- Training/finetune size is capped at what `maxRacksPerTrainingJob` (8, matching the sim scheduler) of the best
  unlocked rack can deliver, so deadlines are achievable.
- Money is game-scaled: 1 game-day compresses months of real cash flow, so `energyPrice` (7.5 $/kWh) is ~90× a real
  tariff to keep energy at 15–30 % of revenue. See the economy notes in the agent-assets report / BUILD_LOG.

- M2b research economy: RP = `pointsPerPflopHour` (0.1) x PF-h + `pointsPerJob` (8) per job. Typical RP/day (6 jobs/day): tier 1 (80 PF) 240, tier 2 (240 PF) 624, tier 3 (800 PF) 1968, tier 4 (1500 PF) 3648. `tech.test.ts` asserts tier-1 nodes take 1-3 days, tier-4 nodes 4.5-10 and the whole tree 60-90 days; change costs and rates together.
- Heat tuning (starter): `ambientMeanC` 22 (+-8), `envelopeConductance` 0.4 and `rackDeltaC` 48 put 4 full-load Mk.I racks with one CRAH at ~75-79 C on a hot afternoon (okC 80); a heatwave (+9 C) throttles them (~83 C) and a second CRAH brings them back to ~69 C. Liquid racks sit at ~76-78 C at full load (test: inlet + rackDeltaC < okC) so do not raise `rackDeltaC` further.
- `validateContent` also checks tech nodes (unique ids, branch, requires exist/no self/no cycles, cost > 0, tier in range, valid perks/features), `tech` references on facilities and bots, `carry`/`flying`, `scriptedDay`, and the `research`/`clerk`/`loans`/`tax`/`audit` balance sections (`maxByTier` one per tier; audit arrays length 5, best grade first).

## Test
`npx vitest run packages/content` · `npm run typecheck` · `npm run check:boundaries`
