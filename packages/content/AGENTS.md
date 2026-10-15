# @aitower/content

Game data, validation and the contract generator. Depends on nothing.

## Files
| File | Purpose |
|---|---|
| `src/schema.ts` | **Frozen contract** (orchestrator-owned). Do not edit. |
| `src/data/*.json` | Facilities, bots, clients, structure costs, lift, balance, scenarios. Records are keyed by `id`. |
| `src/load.ts` | `loadContent()` — statically imports the JSON, deep-copies it, attaches `generateContract`, validates, throws listing every problem. |
| `src/validate.ts` | `validateContent(db): string[]` — hand-written checks (ids/keys, kind→category→spec, numbers, 24-hour price curve, tier arrays, thermal stability, scenario placement: lot bounds, slab support, overlaps, lift shafts, power/coolant conduits, min/max floor). `facilityNeedsPower(def)` mirrors the sim default. |
| `src/contracts.ts` | `generateContract` (deterministic; randomness only via `rng`), `pickClient`, `CONTRACT_TUNING` ($/PFLOP-h rates and size ranges). |
| `src/*.test.ts` | Loader/validator and generator tests. |

## Invariants
- Facility ids are fixed (other packages and tests reference them): `rack_air_gpu`, `rack_dlc_gpu`, `rack_storage`,
  `crah_unit`, `chiller`, `cdu`, `grid_tie`, `genset`, `ups_battery`, `parts_depot`, `bot_charger`; bot `rover`;
  scenario `starter`.
- `loadContent()` is synchronous and returns a fresh copy on every call (callers may mutate their copy).
- `generateContract` must never call `Math.random`/`Date`; same rng sequence ⇒ same contracts.
- Training/finetune size is capped at what `maxRacksPerTrainingJob` (8, matching the sim scheduler) of the best
  unlocked rack can deliver, so deadlines are achievable.
- Money is game-scaled: 1 game-day compresses months of real cash flow, so `energyPrice` (7.5 $/kWh) is ~90× a real
  tariff to keep energy at 15–30 % of revenue. See the economy notes in the agent-assets report / BUILD_LOG.

## Test
`npx vitest run packages/content` · `npm run typecheck` · `npm run check:boundaries`
