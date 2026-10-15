# T1 — agent-sim: Simulation core

**Owns:** `packages/sim/**`, `tools/sim-cli/**`. **Reads:** `docs/ARCHITECTURE.md` (§2–§8), `packages/sim/src/api.ts`,
`packages/content/src/schema.ts`.

## Goal
Implement `createSim(content, scenarioId, seed)` and `simFromSnapshot(content, snap)` in `packages/sim/src/sim.ts`
(the signatures in that placeholder and everything in `api.ts` are the contract). Pure TypeScript, deterministic,
headless. `check:boundaries` forbids DOM, `Math.random`, `Date`, `performance.now` in this package.

## Required behaviour (MVP)
Tick pipeline order (ARCHITECTURE §3.3): commands → network rebuild (dirty only) → power → cooling → thermal →
compute/jobs → reliability → logistics (bots + lifts) → economy/contracts → progression (tier) → time.

1. **World/grid**: `width × (floorMax-floorMin+1)` cells; slab, power conduit, coolant conduit layers;
   facilities (single floor, `width` tiles, no overlap, need slab under every cell); lift shafts (one column,
   occupy that column on each floor they span; facilities can't overlap a shaft). Above-ground slab requires
   slab directly below (floor 0 and basements need no support, basements cost `basementSlabPerTile`).
   Placement rules from `FacilityDef.placement`; anything with `facilityKw>0` or a rack/power device needs
   a power conduit under one of its cells (`needsPower` default). Validate every command; charge costs; reject
   when cash insufficient. Demolish refunds 50%.
2. **Networks**: union-find over 4-neighbour conduit cells per layer (vertical adjacency = risers). A facility
   belongs to the net under any of its cells (lowest net id if several). Rebuild only when dirty.
3. **Power** per net: sources = grid_tie (capacity), genset (only when running; starts automatically when net
   would be short, after `startDelayTicks`; stops after 60 ticks of surplus), ups (discharge ≤ capacityKw while
   storedKwh>0; charge from surplus with `efficiency`). Demand = racks (powerKw × utilisation, idle racks draw
   15%) + facilityKw of enabled facilities + chiller power (Q/COP) + chargers when charging + lifts.
   satisfaction = min(1, supply/demand). Racks scale clocks by satisfaction; if satisfaction < 0.5 racks go
   `unpowered` (count as downtime). Energy cost: grid import kWh × `energyPrice × energyPriceByHour[hour]`;
   genset kWh × `costPerKwh`.
4. **Cooling**: coolant net capacity = Σ chiller capacityKw (chiller COP derates linearly −2% per °C ambient
   above 20) capped by Σ cdu capacityKw (if no cdu on the net, capacity 0). Load = Σ rack heat × liquidFraction.
   supplyTempC = coolantSupplyC when load ≤ capacity else rises proportionally (+10°C per 10% over).
   Liquid racks with no coolant net → status `noCoolant`, all their heat goes to air (they will overheat fast).
5. **Thermal** (ARCHITECTURE §4): air field per cell as in §4.1 using `balance.thermal` constants; unbuilt
   cells/edges couple to ambient (`ambientMeanC ± ambientSwingC` sinusoid peaking 15:00). CRAH removes up to
   capacityKw spread across built cells within `radius` tiles on its floor, pulling them toward 20°C (never
   below). Rack inlet = mean air temp of its cells (air racks) or coolant supply temp (liquid share) blended by
   liquidFraction. Die temp eases toward `inlet + rackDeltaC × utilisation` (+ extra if noCoolant). Throttle/
   trip/hysteresis/cooldown per §4.4. Keep the explicit step stable (clamp k·dt/C).
6. **Jobs/contracts**: every ~`offerIntervalTicks` (seeded jitter) generate a contract with
   `content.generateContract(rng, ctx, content)` up to `maxOffers`; offers expire. Accepting creates a job;
   an auto-scheduler allocates free, healthy, powered racks (respect `needsLiquid`; inference grabs racks
   until `sustainedPflops` met; training takes all free racks up to 8). Progress per tick =
   Σ rack.pflops × clock / 60 (PFLOP-hours). Storage constraint per `ContractSpec.storageTB`. Checkpoint
   rollback when an allocated rack fails/trips. Inference pays `payout / durationTicks` per tick while
   meeting sustainedPflops, else SLA penalty `slaPenaltyFactor × rate`. Training pays on completion, penalty on
   deadline miss. Jobs free their racks when done.
7. **Reliability**: per rack per tick hazard = failurePerDay/1440 × (1 + hazardPerDegree × max(0, T−okC)).
   Failure → status `failed`, health 0, creates a work order. Repaired by a bot consuming a spare part.
8. **Logistics**: bots walk on slab cells at `speed` tiles/tick; floor changes only via lifts. Bot loop:
   idle at charger → claim oldest unassigned work order → go to depot (needs spare part; if none, wait)
   → carry part → go to rack → repair for `repairTicks` → back to charger. Battery drains 1/batteryTicks per
   active tick, recharges at charger (5× rate); go charge below 20%. Lifts: one car, SCAN dispatch over
   floor calls, `speed` floors/tick, `dwellTicks`, `capacity` riders. Expose fractional positions.
9. **Economy/progression**: daily upkeep, ledger per day (keep last 30 + today), cash; bankrupt when cash < 0
   for a full day (`bankrupt` event, sim keeps running). PUE = total facility kWh / IT kWh over the rolling
   24h (1.0 if no IT). Uptime = rack-ticks running / rack-ticks that should be running (rolling 24h).
   Tier per `balance.tiers`, `tierUp` pays reward, evaluated at day change.
10. **View**: `view()` must be cheap — reuse typed arrays; build object arrays fresh but small.
    History sample every 10 ticks, keep 1440.
11. **Snapshot**: `snapshot()` → JSON-safe (typed arrays to plain arrays); `simFromSnapshot` restores
    exactly (including RNG state). `hash()` = stable FNV-1a over a canonical serialisation.

## Tests (vitest, `packages/sim/src/**/*.test.ts`)
Build your own `ContentDB` fixture in `packages/sim/src/test/fixture.ts` (do not depend on `@aitower/content`
data, which is being written in parallel — import only its types). At minimum:
- placement validation & costs; network union-find across risers;
- power shortfall → genset starts after delay, UPS bridges, satisfaction math;
- thermal: a rack with no cooling heats up and trips; with a CRAH stays below throttle; heat rises (upper floor
  warmer than lower with equal load);
- coolant: liquid rack without coolant net → noCoolant;
- job progress, completion payout, checkpoint rollback on failure;
- a bot repairs a failed rack across floors via a lift;
- **determinism**: two sims same seed + same commands → equal `hash()` every 100 ticks for 3 days;
  snapshot round-trip mid-run → identical hash after another 1000 ticks.
- perf: 48×13 grid, 60 racks, 4 bots: 1440 ticks run in < 1.5 s.

## sim-cli (`tools/sim-cli/src/main.ts`, run with `npm run sim -- [scenario] [days] [seed]`)
Load real content via `loadContent()` from `@aitower/content` (may be unimplemented when you start — guard
with a clear error), run headless, auto-accept all offers, print a per-day table: cash, revenue, energy cost,
PUE, uptime, PFLOPS, max rack temp, failures, tier; final state hash.

## Done when
typecheck + boundaries + your tests pass; `AGENTS.md` in `packages/sim` lists files, the tick order and
invariants. Report: what was built, any deviations, any contract change proposals, and known gaps.
