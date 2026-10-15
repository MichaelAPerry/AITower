# AItower — System Architecture & Design Specification

_Status: v0.2. Phase 3 decisions (2026-10-15): **TypeScript + PixiJS v8 + React 19 (Vite)**,
**2D side-cut pixel art**, **plausible physics**, **lean vertical slice MVP** — see `tasks/README.md`.
Items marked **[DECIDE]** below are now resolved by those choices. Code samples are TypeScript-flavoured pseudocode, but the
design is language-agnostic._

---

## 0. Pitch & core loop

> SimTower, but the tenants are GPUs. Build a vertical AI datacenter in cross-section,
> route power, coolant and fiber through it, keep bots fixing the hardware that keeps
> breaking, and sell compute to ever-more-demanding AI labs, until your tower becomes a
> living bio-computer, a carbon-negative power plant, or a home for uploaded minds.

```
 ┌────────────── contracts (AI labs) ──────────────┐
 │                                                 ▼
 build floors → place racks → connect power/cooling/fiber → run jobs → earn $ & reputation
      ▲                │                                   │
      │                ▼                                   ▼
      │        heat ↑, load ↑, wear ↑  ───────────►  failures, throttling, SLA penalties
      │                                                    │
      └──── research tech tiers ◄── bots repair / swap ◄───┘
```

Win/progression: **Tier rating** (T1 → T4 classic, then T5 "Frontier") gates tech; at
T5 the player commits to one of three **Ascension Paths** (§9).

---

## 1. Module layout & dependency rules

```
packages/
  sim/        pure simulation: zero DOM, zero rendering, zero timers. Deterministic.
  content/    JSON data (hardware, rooms, tech tree, clients) + schemas + loaders.
  render/     draws a read-only SimView; camera, tiles, overlays, animation.
  ui/         HUD, menus, telemetry, build tools; emits SimCommands.
  audio/      reacts to SimEvents; ambient hum mixed from aggregate load.
  app/        composition root: game loop, save/load, wiring.
tools/
  sim-cli/    headless runner: load scenario, run N ticks, dump metrics/state hash.
```

Allowed imports (enforced by lint rule / tsconfig project references):

| from ↓ / to → | sim | content | render | ui | audio | app |
|---|---|---|---|---|---|---|
| sim     | – | types only | ✗ | ✗ | ✗ | ✗ |
| content | ✗ | – | ✗ | ✗ | ✗ | ✗ |
| render  | `SimView` types | ✓ | – | ✗ | ✗ | ✗ |
| ui      | `SimView`, `SimCommand` types | ✓ | ✗ | – | ✗ | ✗ |
| audio   | `SimEvent` types | ✓ | ✗ | ✗ | – | ✗ |
| app     | ✓ | ✓ | ✓ | ✓ | ✓ | – |

The **only** contract between sim and the outside world is `packages/sim/src/api.ts`:

```ts
interface Sim {
  static create(scenario: Scenario, content: ContentDB, seed: number): Sim;
  static fromSnapshot(snap: SimSnapshot, content: ContentDB): Sim;
  submit(cmd: SimCommand): CommandResult;   // queued, applied at start of next tick
  step(): SimEvent[];                         // advance exactly one tick
  view(): SimView;                            // read-only, structurally shared
  snapshot(): SimSnapshot;                    // JSON-serialisable
  hash(): string;                             // determinism checks
}
```

---

## 2. Grid system

### 2.1 Coordinates
- Side-cut cross-section (SimTower-style) **[DECIDE: perspective]**. The sim is 2D
  regardless; isometric would only be a rendering change.
- World = `W × H` cells. `x` = horizontal tile (1 tile ≈ 1 m), `y` = floor
  (`y=0` ground, negatives = basements). MVP: `W=64`, floors `-3..+20`.
- Each floor has **layers** stacked in the same cell (Factorio-style overlays):

| Layer | Contents | Notes |
|---|---|---|
| `structure` | floor slab, wall, empty, sky, ground | must exist before anything else |
| `room` | multi-tile facilities (rack bays, CDU room, transformer room, bot dock…) | span `x0..x1` on one floor (some 2-floor rooms) |
| `power` | busway / cable segments, rated in kW | per-cell edges, risers via shafts |
| `coolant` | supply+return pipe pair, rated in kW of heat & L/min | |
| `fiber` | fiber trays; links have a bandwidth tier | |
| `air` | derived: open air volume, containment flags | not player-placed directly |

### 2.2 Vertical transport & risers
- **Shafts** are vertical columns spanning floors. Types: `riser` (carries power/
  coolant/fiber vertically), `service_lift` (bots, local stops), `freight_lift`
  (bots + hardware crates, express, stops at "logistics floors" every N floors, like
  SimTower sky lobbies), `stairs` (bots, slow, short hops).
- Shaft cells block room placement but count as a layer connection between floors.

### 2.3 Placement rules
- Rooms need a floor slab, a free span, and (per content def) required adjacencies, e.g.
  `liquid_rack_bay` requires a coolant connection; `transformer_room` must be at ground
  or basement; `quantum_vault` forbids vibrating neighbours within 3 tiles.
- Validation lives in sim (`commands/place.ts`); UI only previews using the same pure
  `canPlace()` function exported for read-only use.

### 2.4 Storage
- `Grid` holds struct-of-arrays: `Uint16Array structure`, `Int32Array roomId`, bitmask
  `Uint8Array` per network layer (edge connectivity N/E/S/W/Up/Down), and continuous
  fields `Float32Array airTemp`, `Float32Array airflow`. Index = `(y - yMin) * W + x`.
- Discrete entities (rooms, racks, bots, jobs, shafts) live in arrays of plain records
  with stable integer IDs (free-list reuse, never iterate a `Map` keyed by object).

---

## 3. Time & the simulation loop

### 3.1 Tick model
- 1 tick = 1 game-minute. 1440 ticks = 1 game-day. Billing daily, contracts weekly,
  quarterly reports at day 90k.
- Sim runs at a fixed **10 ticks/s** at 1× speed; speeds 0 (pause), 1×, 3×, 10×, 30×
  (multiple `step()`s per frame). Heavy-but-slow systems (network rebuild, contract
  generation) run on **strides** (`tick % N == phase`) to spread cost.

### 3.2 Frame loop (in `app/`)
```ts
let acc = 0, last = now();
function frame() {
  const dt = Math.min(now() - last, 250); last = now();
  acc += dt * speed;
  while (acc >= TICK_MS) { events.push(...sim.step()); acc -= TICK_MS; }
  render.draw(sim.view(), acc / TICK_MS);   // alpha for interpolation (bots, lifts)
  ui.update(sim.view(), events.drain());
  audio.update(events);
  requestAnimationFrame(frame);
}
```

### 3.3 Tick pipeline (inside `sim.step()`) — **order is part of the spec**
1. `applyCommands` — validate & apply queued commands; mark dirty networks.
2. `rebuildNetworks` — only if dirty: union-find over power/coolant/fiber layers → network IDs.
3. `powerSolve` — per network: generation vs demand, battery charge/discharge, satisfaction ratio.
4. `coolingSolve` — per coolant loop: chiller/CDU capacity vs heat to remove; loop supply temp.
5. `thermalStep` — air-field diffusion + advection, rack heat in, cooling out.
6. `computeStep` — job scheduling, FLOPS delivered (× power satisfaction × thermal throttle × network factor).
7. `reliabilityStep` — wear accumulation, failure rolls (seeded RNG), trips.
8. `logisticsStep` — task queue, bot AI, lift dispatch, part inventory.
9. `economyStep` — revenue, SLA penalties, energy bill, maintenance, stride-based contracts.
10. `progressionStep` — research points, tier evaluation, unlock events.
11. `time.advance()`; emit `SimEvent[]`.

### 3.4 Determinism rules
Seeded PRNG stored in state (one stream per system); no `Math.random`/`Date`; iterate
arrays by ID; floats are fine **within** a tick but continuous fields are quantised
(e.g. temps to 1/64 °C) when stored, so client/server agree across JS engines.
`determinism.test.ts`: two sims, same seed + command log → equal `hash()` every 100 ticks.

---

## 4. Thermal engine

**[DECIDE: complexity]** — the model below is "plausible physics": real units (kW,
°C, L/min), simplified equations, tunable constants.

### 4.1 Air field
Per cell `T` (°C), heat capacity `C_cell` (air volume × ρc_p, boosted for game feel),
conductance `k` between neighbours (open air high, wall low, insulated wall ~0).

Each tick (explicit, stable since `k·dt/C ≤ 0.2` by construction):
```
Q_in   = Σ rack heat into its cell(s)         (kW → kJ per tick)
Q_out  = Σ air cooling (CRAH/CRAC) pulled from cells in its zone
Q_diff = Σ_n k(c,n) · (T_n − T_c)             (conduction/mixing)
Q_up   = buoyancy: if T_c > T_above: β·(T_c − T_above) moves up       ← heat rises
T_c'   = T_c + (Q_in − Q_out + Q_diff + Q_up) · dt / C_cell
```
Outdoor boundary = ambient (seasonal/day sinusoid; site/climate modifier).

### 4.2 Containment
A rack bay with **hot-aisle containment** routes its exhaust directly to the CRAH
return instead of the room air: removes the mixing penalty (cooling efficiency × 1.0
instead of 0.7). Upgrade, not a separate system.

### 4.3 Liquid loops
A coolant network = set of connected pipe cells + attached devices:
- **Sources of cold:** chiller (uses power: `P = Q / COP`, COP falls as outdoor
  temperature rises), dry cooler / cooling tower (free cooling when ambient < loop
  temp), CDU (heat exchanger between facility loop and rack loop, `approach` ≈ 4 °C).
- **Loads:** liquid-cooled racks, immersion tanks.
- Lumped per loop each tick: `Q_load = Σ rack liquid heat`, `Q_cap = Σ device capacity`;
  `T_supply` rises when `Q_load > Q_cap`; pipe throughput cap per segment class.
  Rack inlet = `T_supply`; if the pipe segment feeding a rack is undersized, that rack
  sees a partial supply.
- Each rack splits heat into `liquidFraction` (0 for air racks, ~0.8 for DLC, ~1.0 for
  immersion) and the remainder dumped to air.

### 4.4 Rack temperature, throttling, shutdown
```
T_rack = T_inlet + heat / (airflow or coolant flow) ;  eased: T += (T_target − T) · 0.1
band:   ≤ T_ok           → 100 % clocks
        T_ok..T_throttle → linear down to 60 %
        ≥ T_trip         → emergency shutdown, cooldown, overheat counter++
recovery requires T < T_trip − hysteresis
```
Each tick above `T_ok` adds `thermalStress` → raises failure hazard (§7).
Heat-vision overlay renders `airTemp` and per-rack `T_rack`.

---

## 5. Power & infrastructure engine

### 5.1 Chain
`Grid tie / Generator / Solar / Storage` → **Substation** (HV) → **Transformer room**
(step-down, η 98–99 %, capacity MVA) → **Switchgear/busway** → **UPS** (battery,
η 94–97 %, bridges outages) → **PDU** (per floor) → racks & facility loads (chillers,
lifts, bots charging, lighting).

### 5.2 Solve (per power network, per tick)
```
demand   = Σ IT load + Σ facility load (cooling, lifts, docks)
supply   = Σ available generation (grid import cap, genset if running, solar(t), wind(t))
if supply ≥ demand: charge storage with surplus (rate-limited), export/curtail rest
else:               discharge storage; if still short → satisfaction s = supply/demand
s < 1  → priority shedding: low-priority loads first (configurable), then uniform brownout
losses = Σ conversion losses at transformer/UPS/PDU  → counts toward PUE
```
- Each conversion device has a **capacity**; overloading for > N ticks trips it (fire risk tier 2).
- **Outages:** random grid events (seeded) and scripted heatwave storms. Genset has a
  start delay (e.g. 10 ticks); UPS must bridge or racks hard-crash (jobs lose progress
  since last checkpoint).
- Cables/busway have kW ratings per tier; overloaded segment = bottleneck shown in
  power-view overlay.

### 5.3 PUE
`PUE = total facility energy / IT energy`, rolling 24h window. Feeds: energy bill,
reputation for green clients, carbon score, Greentech path progress.

### 5.4 Energy sources (progression)
Grid tie → diesel genset → gas turbine → rooftop solar + Li-ion → wind PPA →
**molten-salt thermal storage** (charges from surplus *or waste heat*) → small modular
reactor → fusion (Greentech capstone).

---

## 6. Compute & workload engine

### 6.1 Hardware
`RackDef`: `{ id, tier, slots, cooling: 'air'|'dlc'|'immersion'|'cryo'|'bio', powerKw,
liquidFraction, pflops, memoryTB, failureBase, footprint, cost }`.
MVP-scale examples (content JSON): Air GPU rack (40 kW), DLC GPU rack (120 kW),
Inference ASIC rack (25 kW, efficient but inference-only), Storage rack,
Network spine rack. Later: TPU-style torus pod, photonic, quantum (cryo), organoid (bio).

### 6.2 Clusters & fabric
- Fiber network is a graph of racks ↔ leaf ↔ spine switch rooms with link bandwidth.
- A **cluster** = racks reachable via fabric. `networkFactor` for a job =
  `min(1, bisectionBW(allocated racks) / jobRequiredBW)`; spanning floors or crossing a
  congested spine lowers it. Topology upgrades: leaf/spine → rail-optimised fat-tree →
  optical circuit switch / 3D torus.

### 6.3 Jobs & clients
```ts
Job { id, client, kind: 'train'|'finetune'|'inference'|'sim'|'quantum'|..., 
      size: PFLOP-days, minRacks, needs: {cooling?, bw, latencyMs?, greenPct?},
      deadline, payPerPFLOP, slaUptime, checkpointEvery }
```
- Clients (procedurally generated from templates) post contracts; the player accepts
  into a queue. Scheduler (auto, with player priorities) allocates racks.
- Per tick: `progress += Σ rack.pflops × powerSat × thermalClock × networkFactor × health`.
- **Checkpointing:** on a rack failure, training jobs roll back to last checkpoint;
  inference jobs incur SLA penalty per minute down. (Llama-3-style: failures are routine.)
- Revenue on completion/streaming; penalties for missed deadlines and SLA breaches;
  reputation per client sector unlocks bigger contracts.

---

## 7. Reliability, logistics & bot engine

### 7.1 Failures
Per component (GPU tray, PSU, pump, fan, switch, pipe joint): hazard per tick
`h = base × f(age) × g(thermalStress) × k(powerEvents)`. Failure → component state
`degraded` or `dead`, rack capacity reduced, a **work order** is created.

### 7.2 Work orders & inventory
`WorkOrder { id, kind: 'swap'|'repair'|'inspect'|'clean'|'install', target, part, priority }`.
Spare parts are physical items stocked in a **Parts Depot** room; deliveries arrive at a
loading dock on the ground floor and must be carried in by bots.

### 7.3 Bots
- Types (progression): **Rover** (swaps trays, slow), **Lifter** (carries racks/crates),
  **Drone** (inspection, flies within a floor, can't carry heavy parts), later
  **Swarm** micro-bots and **Synthetic technicians**.
- State machine: `idle → claim order → path to depot → pick part → path to target →
  work (n ticks) → return part to recycling → charge if low → idle`.
- Pathfinding: on-floor A* over walkable cells; inter-floor via a **transit graph**
  of lifts/stairs (like SimTower route scoring: cost = walk distance + expected lift wait
  + ride time). Path cache invalidated by topology changes.
- Lifts: car state machine (`idle/moving/doors/loading`), call queue per floor,
  capacity in bot-slots, express vs local. Dispatch = SCAN/look-ahead ("elevator
  algorithm") — simple first, tunable later.
- Bots draw power from **Charging Docks**; battery % is visible.

---

## 8. Economy & progression

- Money: contracts revenue − energy bill (time-of-day price) − water − maintenance −
  part purchases − loans interest. Daily ledger, quarterly report.
- Reputation per sector (Frontier Labs, Biotech, Finance, Gov, Climate, Entertainment).
- **Tier rating** (evaluated nightly): uptime %, PUE, redundancy (N+1 power/cooling
  present), size → T1..T4, T5 Frontier. Each tier unlocks build menu items (SimTower
  stars).
- Research: earned by running "internal R&D" jobs or completing contracts; spent on a
  tech tree (content JSON) with shared trunk + three branches.

---

## 9. Future tech & the three Ascension Paths

All three share the T1–T4 trunk (air → liquid → immersion; grid → storage; rovers →
drones). At T5 the player picks one path (respec is expensive). Each path adds unique
rooms, a new resource, a new hazard and a distinct victory condition.

| | 🧬 **Biotech Tower** | 🌱 **Greentech Tower** | 🤖 **Synthetic Mind Tower** |
|---|---|---|---|
| Fantasy | The building becomes a living computer | Carbon-negative compute that powers the city | Fully robotic tower that hosts uploaded human consciousness |
| New compute | Organoid/wetware racks (brain-organoid cores), DNA storage vaults | Photonic & neuromorphic racks (ultra-low W/FLOP) | Neuromorphic "mind lattices", quantum-coherent memory |
| New resource | **Nutrient medium** (piped like coolant, spoils over time) | **Carbon credits** & exportable **heat** | **Continuity** (stability of hosted minds) |
| Cooling twist | Organoids need 37 °C ± 1 — *too cold is also failure*; heat from GPUs can warm bio-bays | District-heating export pays you for waste heat; algae façade panels absorb CO₂ and shade | Cryogenic cores; vacuum halls with no air (bots only) |
| Logistics | Sterile-bot class; contamination spreads like heat | Weather-dependent power; drones clean solar skin | No humans at all; self-replicating bot fabs, bots maintain bots |
| Hazard | Infection / culture collapse | Dunkelflaute (no wind + no sun) energy droughts | Identity drift, cascade crash; ethics events |
| Win | Achieve "Living Tower" — self-healing hardware | Net-negative carbon tower powering N city blocks | Host 1M stable minds with 99.999 % continuity |

Path selection is data-driven (`content/techtree/*.json`), so additional paths can be
added later without engine changes.

---

## 10. Rendering pipeline (`render/`)
- Consumes `SimView` only; never mutates. Interpolates bots/lift cars with `alpha`.
- Layers: sky/parallax → structure → rooms (sprite atlas) → networks overlay →
  entities (bots, lifts, crates) → effects (heat shimmer, sparks, LEDs) → selection.
- **Overlays / views:** normal, heat-vision (colour ramp over `airTemp`), power (load %
  per segment), coolant (supply temp), fiber (utilisation), reliability (hazard).
- Camera: pan, zoom (discrete steps for pixel-art crispness), follow-bot.
- Candidate libraries **[DECIDE: stack]**: PixiJS v8 (pure renderer, fine-grained
  control, best for SimTower-style sprites + overlays) or Phaser 4 (batteries included;
  used by tower-together).

## 11. UI / HUD (`ui/`)
- Top bar: date/time, speed, cash, PUE gauge, power headroom, Tier rating.
- Left: build palette by category (Structure, Racks, Power, Cooling, Network, Logistics).
- Right: inspector (selected rack: temp, clocks %, health, current job; room; bot).
- Bottom: job queue & contracts board; alerts feed (failures, trips, outages).
- Telemetry charts (sparklines): PUE, load, revenue, failures/day.
- Tech tree screen; quarterly report screen.
- UI emits `SimCommand`s only; all numbers come from `SimView`.

## 12. Content & assets (`content/`, `audio/`)
- JSON files with JSON-Schema (or zod) validation at load; hot-reload in dev.
  `hardware/*.json`, `rooms/*.json`, `bots/*.json`, `techtree/*.json`,
  `clients/*.json` (procedural templates + name generators), `scenarios/*.json`.
- Procedural job generator: seeded, picks client template × job kind × size
  distribution scaled by the player's tier and reputation.
- Audio: layered ambient hum whose loudness/pitch tracks aggregate kW and fan RPM;
  one-shots for failures, trips, lift dings, bot chirps. WebAudio.
- Art: pixel-art sprite atlas (placeholder programmer art for MVP).

## 13. Save / load
`SimSnapshot` (versioned JSON, gzip) + optional command log for replays. Migrations
keyed by `version`. Autosave daily in the browser (IndexedDB); export/import file.

## 14. Testing & tooling
- Unit tests per system (vitest): thermal convergence, energy conservation within
  tolerance, power shedding order, job progress math, lift dispatch.
- Determinism test (hash equality across runs and across snapshot round-trip).
- Golden scenario traces (`tools/sim-cli` writes per-day metrics; diff in CI).
- Perf budget: 64×24 grid, 200 racks, 50 bots → `step()` < 1 ms on a laptop.
- CI: typecheck, lint (Biome), test, build.

## 15. Sub-agent work breakdown (Phase 4 preview)

| Agent | Owns | Consumes | Produces |
|---|---|---|---|
| `agent-sim` | `packages/sim`, `tools/sim-cli` | `content` types | `Sim`, `SimView`, `SimCommand`, `SimEvent` |
| `agent-render` | `packages/render` | `SimView`, content sprites | `Renderer.draw(view, alpha)`, overlays, camera |
| `agent-ui` | `packages/ui` | `SimView`, `SimEvent` | HUD, build tools emitting `SimCommand` |
| `agent-assets` | `packages/content`, `packages/audio` | schemas | JSON balance data, job generator, audio engine |
| Orchestrator (me) | `packages/app`, `api.ts` contracts, `tasks/`, `BUILD_LOG.md` | all | integration, CI, reviews |

Contract-first: the orchestrator writes `packages/sim/src/api.ts` and
`packages/content/src/schema.ts` **before** spawning agents, so all four can work in
parallel against fixed interfaces.
