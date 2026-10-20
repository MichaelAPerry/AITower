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

## M3 (Biotech path)
- Clearance 5 (3,000 PF, uptime 0.992, reward $25M, loan cap $100M); `ascension.minTier` 5. `paths.json` (all three paths available since M4), `endings.json` (3), `balance.bio` / `balance.endings` tuned (see `biotech.test.ts` for the contamination model checks).
- 8 biotech facilities + 3 growths (`growth: true`, free, no tech), all other wetware facilities gated by a `wetware`-branch tech (`wetware_annex` T3, five T4 nodes, T5 `path: "biotech"` nodes). Organoid racks: `cooling: "bio"`, category `"bio"`, `rack.bio` required, liquidFraction 0, `needsNutrient`. Bioreactors need both `power` and `bio` specs. Nutrient is never pre-placed in scenarios.
- 4 `needsBio` clients (generator sizes them against <= 4 of the best bio racks and sets `needsBio` on the spec); events: 4 T1-T2 seeds, 8 biotech memos, 13 `horror` memos (`minCorruption` 0.1..0.9, required for horror).
- Tech tree totals: trunk 60-90 days, wetware branch 30-50 more.

## M4 (Greentech, Synthetic Mind, automation, scenarios)
- 13 new facilities (`src/m4ids.ts` lists them and the 18 new tech nodes so the older trunk/biotech tests can set them aside). Greentech (9): `solar_skin` (T3), `solar_canopy` (T5), `wind_mast` (T3, floor 3+), `heat_exchanger` (T3), `heat_pipeline` (T5), `algae_facade` (T3), `carbon_capture` (T5), racks `rack_neuromorphic` (T3, 1.8 PF/kW) and `rack_photonic` (T5, 8.3 PF/kW). Synthetic (4, all T5): `cryo_core` (chiller), `rack_mind_lattice` (DLC rack), `continuity_monitor` (ups), `backup_vault` (storage rack). The neuromorphic rack must stay below ~1.9 PF/kW or the biotech "organoids ~3x the best T4 rack" test breaks.
- Categories: solar/wind `power`, heat_export/carbon `cooling` (BuildCategory has no green tab). Native art widths: solar 2, wind 1, heat_export 2, carbon 2. Solar/wind must keep `needsPower`.
- Research: no new branches exist, so greentech nodes live in `power` (photonic in `compute`) and synthetic nodes in `compute`. T3 basics need no path; T5 nodes carry `path` (validator: a path node's minTier >= `ascension.minTier`). `works_foreman` (administration, minTier 1 so a fully automated run can reach Clearance 2; 2,200 RP) is the only `foreman` feature node; `FEATURES` in validate.ts now includes it.
- Events: 6 greentech memos (Dunkelflaute, two heat-tariff memos, soiling, wind noise, carbon audit) plus 4 fungal and 4 identity `horror` memos gated by `path` (greentech/synthetic), minTier 5, with no `minCorruption`: the sim's corruption does not move on those paths, so the validator exempts them from the corruption-gate rule.
- Scenarios: `brownfield` (startTier 2, $350k, six air cabinets on one CRAH, hot at ~81 C, six slab floors) and `sandbox` (`sandbox: true`, $500M, startTier 5). Both are exercised by `sim-cli`. Coolant nets are per floor: keep the chiller/CDU on the same floor as the liquid racks.
- Balance: `green` heatPrice 3 (40% of electricity), creditPrice 40, drought 6%/day, x0.1 for 16 h; `automation` partsBatch 5, foremanPerHour 1; `greenExemplar` 0.7 / 3,000 PF / 4 days; `millionMinds` 0.85 / 3,600 PF / 5 days. Reasons are asserted in `m4.test.ts`.
