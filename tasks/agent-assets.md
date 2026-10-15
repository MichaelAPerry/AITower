# T4 — agent-assets: Content, balance, job generator & audio

**Owns:** `packages/content/**` (except `src/schema.ts`, which is a frozen contract) and `packages/audio/**`.
**Reads:** `docs/ARCHITECTURE.md` §5–§9 & §12, `docs/RESEARCH.md` §4, `packages/content/src/schema.ts`,
`packages/shared/src/index.ts` (`AudioEngine`), `packages/sim/src/api.ts` (`SimView`, `SimEvent`).

## Part A — Content data (`packages/content/src/data/*.json` + `load.ts`)
Implement `loadContent(): ContentDB` (statically `import` the JSON files; synchronous; call
`validateContent` and throw with all problems if invalid) and `validateContent(db): string[]` (hand-written
checks — no new deps: ids unique and match keys, required spec present for each `kind` (rack→rack,
grid_tie/genset/ups→power, crah/chiller/cdu→cooling, depot/charger→logistics), positive numbers,
`energyPriceByHour.length === 24`, tier arrays same length, scenario facilities reference real defs and fit
inside the lot, etc.). Also export `generateContract` (Part B) and attach it to the DB.

### Facilities for the MVP (ids are fixed — other agents and tests reference them)
| id | kind | category | width | notes (game-scaled, plausible) |
|---|---|---|---|---|
| `rack_air_gpu` | rack | rack | 2 | air, ~40 kW, ~20 PFLOPS, tier 1 |
| `rack_dlc_gpu` | rack | rack | 2 | dlc, ~120 kW, liquidFraction 0.8, ~90 PFLOPS, tier 2, placement.needsCoolant |
| `rack_storage` | rack | rack | 2 | air, ~12 kW, 0 PFLOPS, ~2000 TB, tier 1 |
| `crah_unit` | crah | cooling | 2 | ~150 kW capacity, radius ~8, facilityKw ~8 |
| `chiller` | chiller | cooling | 4 | ~600 kW, COP ~5, tier 2, needsCoolant, prefer basement/roof (no hard rule) |
| `cdu` | cdu | cooling | 2 | ~400 kW, tier 2, needsCoolant, facilityKw ~4 |
| `grid_tie` | grid_tie | power | 4 | ~1500 kW import cap, maxFloor 0 |
| `genset` | genset | power | 4 | ~800 kW, startDelayTicks ~10, costPerKwh ~0.35, maxFloor 0 |
| `ups_battery` | ups | power | 3 | ~500 kW, ~250 kWh, efficiency ~0.95 |
| `parts_depot` | depot | logistics | 3 | capacity 20 |
| `bot_charger` | charger | logistics | 2 | capacity 2, chargeKw ~5 |

Colours: readable on a dark sky/concrete background, distinct per kind (racks charcoal with cyan/green
accent, DLC racks with blue accent, storage with purple, cooling icy blue/white, power yellow/orange,
logistics teal). Descriptions: one or two flavourful but accurate sentences each (draw on RESEARCH §4).

Bots: `rover` (speed ~0.25 tiles/tick, batteryTicks ~600, repairTicks ~30, cost ~50k).
Structure costs, lift spec (speed ~0.2 floors/tick, capacity 2, dwell 4), and `Balance` with every field in
the schema. Starting thermal constants (sim agent may report needed retuning):
okC 80, throttleC 90, tripC 95, tripHysteresisC 8, rackDeltaC 40, minClock 0.6, coolantSupplyC 30.

### Economy targets (check with `npm run sim -- starter 20` once the sim lands; until then reason on paper)
- 1 tick = 1 game-minute; 1440 ticks/day. Starting cash ~3,000,000.
- An air GPU rack (~$400k) should pay back in ~8–12 game days at good utilisation; DLC racks pay better per
  kW but need ~$1.5M of chiller+CDU first. Energy should be a meaningful 15–30% of revenue at PUE ~1.5.
- Energy price ~0.08 $/kWh base with a day curve (cheap night, peak 17–20h).
- Tiers: 1..4 (`tiers.pflops` e.g. [0, 60, 300, 1000], `uptime` [0, 0.95, 0.98, 0.995], rewards).

### Starter scenario `starter` (ids/positions must satisfy sim placement rules)
Lot width 48, floors −2..10. Slabs: floor −1 x4..43, floor 0 x0..47, floor 1 x4..43. Power conduit runs on
floors −1, 0, 1 across x4..43 (vertically adjacent cells connect into one net). `grid_tie` at floor −1 x6.
Lift at x24 spanning −1..1. `bot_charger` at floor 0 x26, `parts_depot` floor 0 x29, one `rover` at the
charger. Floor 1: four `rack_air_gpu` at x6, x8, x10, x12 and a `crah_unit` at x14. spareParts 4.
Make sure no facility overlaps the lift column x24 or another facility.

## Part B — Contract generator (`packages/content/src/contracts.ts`)
`generateContract: ContractGenerator` — **deterministic**: randomness only via the `rng` argument; no
`Math.random`/`Date`. Pick a client from `clients.json` (weights, `minTier`), a kind from its `kinds`, then size
relative to `ctx.capacityPflops` (so jobs fit but stretch the player: training ≈ 0.5–3 days of current
capacity, inference ≈ 20–60% of capacity sustained for 0.5–2 days, finetune small & quick). Payout from a base
$/PFLOP-hour × client multiplier; penalty ≈ 25–50% of payout; `checkpointTicks` 60–240; `storageTB` 200–4000
for training/finetune, 0 for inference; `needsLiquid` from template. Generate ~12 flavourful fictional clients
across the sectors (no real company names), e.g. frontier labs, protein-folding startup, quant fund, climate
modeller, render farm, sovereign AI programme.
Unit tests: determinism (same seed sequence → same contracts), sizes scale with capacity, tier gating.

## Part C — Audio (`packages/audio/src/index.ts`)
Export `createAudio(): AudioEngine` — **synthesized with WebAudio, no audio files**:
- ambient datacenter hum: low drone + filtered noise; gain/pitch/filter cutoff follow `view.itKw`/`totalKw`
  (smoothly), extra fan whine when `max rack tempC` is high; quiet when paused or no load.
- one-shots on events: `rackTripped` (alarm chirp), `componentFailed` (zap/clunk), `repaired` (rising blip),
  `liftArrived` (soft ding), `jobCompleted` (cash register-ish arpeggio), `tierUp` (fanfare), `powerShortfall`
  (low warning tone), `gensetStarted` (engine rumble swell). Rate-limit repeats (≥300 ms per type).
- `resume()` creates/resumes the `AudioContext` lazily (autoplay policy); everything must be a no-op without
  an `AudioContext` (e.g. under Node tests). `setMuted`, `setVolume`, `destroy`.
- Keep pure mapping logic (view → hum params, event → sound spec, rate limiting) in separate pure modules with
  vitest tests.

## Done when
typecheck + boundaries + tests (`npx vitest run packages/content packages/audio`) pass; `AGENTS.md` in each
package. Report: tables of final numbers, rationale for economy, any schema change proposals.
