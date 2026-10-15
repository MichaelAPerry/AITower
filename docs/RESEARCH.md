# AItower — Phase 1 Research & Competitive Analysis

_Status: complete (2026-10-15). Feeds `docs/ARCHITECTURE.md`._

This document records what we learned from existing open-source tower sims, datacenter
tycoons, systems-heavy games, and real-world AI datacenter engineering, and turns each
finding into a concrete takeaway for AItower.

---

## 1. Open-source tower simulations

### 1.1 `phulin/tower-together` (TypeScript, MIT, ~77★) — the most relevant reference
A tick-for-tick clone of SimTower (1993) running as a multiplayer browser game.

| Aspect | What they did | Takeaway for AItower |
|---|---|---|
| **Sim/render split** | `apps/worker/src/sim/` is pure TS — "No I/O, no Cloudflare dependencies, no Phaser. Fully unit-testable in Node." A `TowerSim` façade exposes `create()`, `fromSnapshot()`, `step()`, `submitCommand()`, `saveState()`. | Copy this façade shape exactly. The sim package must import nothing from the renderer or DOM. |
| **Commands, not mutation** | All player actions are `SimCommand`s (`handlePlaceTile`, `handleRemoveTile`, elevator config…) validated then applied inside the tick. | Every UI action becomes a serialisable command → replays, undo, multiplayer and tests come for free. |
| **Determinism as a test** | `trace.test.ts` replays `(tick, input, expected_state)` JSONL fixtures; `determinism.test.ts` checks hydrate/idempotence and server-vs-client lockstep. | Ship a determinism test from day one: same seed + same command log ⇒ identical state hash. |
| **Time model** | Integer `day_tick` 0..2599 split into 7 dayparts; daily checkpoints fire at fixed ticks (e.g. expenses at 2533, day advance at 2300). Clock display uses a non-linear mapping so busy hours get more ticks. | Use integer ticks and named checkpoint ticks for daily/quarterly events (billing, job arrivals). Non-linear "game clock" is a legit pacing tool. |
| **Lockstep multiplayer** | A Cloudflare Durable Object sequences inputs; every client steps the same sim on the same input stream. | Not MVP, but our command architecture should keep this door open (co-op datacenter later). |
| **Code organisation** | Subsystem folders (`carriers/`, `queue/`, `route-scoring/`, `tick/`, `daily/`), one function per file, and an `AGENTS.md` in each folder describing it. | Great fit for multi-agent dev: per-module `AGENTS.md` makes ownership boundaries explicit. |
| **Stack** | React 19 + Vite + Phaser 4, npm workspaces + turbo, Biome lint, Vitest. | Proven, modern browser stack for exactly this genre. |
| **Data model** | Objects addressed by `(floor, floor_local_id)` with horizontal span `left..right`; separate `object_type` vs runtime `family` namespaces; actor state codes with bit flags (in-transit = `0x40`). | Floors-with-spans is the natural SimTower grid. Keep "what is placed" separate from "how it behaves". |

### 1.2 `fabianschuiki/OpenSkyscraper` (C++, ~590★)
Long-running SimTower-inspired engine (SFML). Classic OOP layout: `Game`, `GameObject`,
`Item/`, `Person`, `Route`, `PathFinder/`, `Time`, `Sky`, plus manager singletons
(`BitmapManager`, `SoundManager`, `DataManager`). Loads art straight from the original
`SIMTOWER.EXE`.
**Takeaways:** (a) separating *Route*/*PathFinder* from *Person* is right — our bots
should request routes from a routing service, not compute their own; (b) the
manager-singleton pattern couples sim to platform — avoid it; (c) a decade of slow
progress shows the danger of rendering-first development without a spec and tests.

### 1.3 `0x9090/OpenTower` (Rust, 2026)
Cargo workspace split into `simtower-core` (sim), `simtower-formats` (asset parsing),
`simtower-desktop` (app), `simtower-inspect` (debug CLI). Gameplay notes in README: sky
lobbies every 15 floors; express vs local elevators; speed keys `1–4`; shift-click fill.
**Takeaways:** a headless *inspect* tool is valuable (dump state, run N ticks, print
metrics) — we will build a `sim-cli`. Express/local + sky-lobby transfer maps nicely
onto **express freight lifts + local service lifts** for bots.

### 1.4 `adam4813/towerforge` (C++20, flecs ECS + Raylib)
SimTower-like built on a real ECS. Folders `core/`, `rendering/`, `ui/`, `audio/`, and
mod test harness.
**Takeaway:** ECS is workable, but tower games are dominated by *grid* and *network*
data, not huge numbers of heterogeneous entities. We prefer typed arrays for fields
(heat, power) and plain records for entities (racks, bots) — ECS-lite.

### 1.5 Other tower clones surveyed
`AzemOcram/OcramTower` (JS, Yoot Tower successor), `Rkozik/kowloon-walled-city`
(vanilla JS), `willc/skyline-coop` (SimTower with political/co-op twist — shows the
genre welcomes thematic reframing), `dfloer/tower-docs` (SimTower file-format docs),
`basicallydan/elevator-lift` (stand-alone JS elevator sim).

---

## 2. Datacenter tycoon references

### 2.1 `nzin/dctycoon` (Go + SDL2, archived)
Isometric datacenter tycoon inspired by the unfinished *Server Tycoon*.
Thermal model (`datacentermap.go`): a 2D `heatmap[][]float64` initialised to the
location's outdoor temperature; each recompute runs **60 relaxation passes** where each
cell blends toward neighbours with a `spreadfactor` (0.2 for indoor air, 0.005 for
walls/outdoors); AC units remove heat per airflow cell; an `overheating[][]` counter
escalates warnings (>0, >8, >16) before damage.
**Takeaways:** (a) per-tile spread factors = cheap "conductivity"; (b) an *overheat
counter* (time-above-threshold) is better gameplay than instant failure; (c) running 60
passes per recompute is wasteful — we'll do one diffusion step per tick and let it
converge over time (also looks nicer animated).

### 2.2 `pankrator/uptime-game` (TypeScript, Canvas, hand-rolled ECS, 2026)
Top-down datacenter tycoon. Systems: `resource`, `capacity`, `thermal`, `workload-spawn`,
`workload-run`, `wear`, `maintenance`, `path-follow`, `build`, `render`, `camera`, with an
`event-bus` and tests per system.
Thermal: each rack gets `BASELINE_COOLING_KW` + Σ CRAC output × `coolingFalloff(distance)`;
temperature eases toward a target (`approachTemperature`), yields a `throttleFactor`
applied to job pay/progress, and trips offline at `TRIP_C` with hysteresis
(`TRIP_RECOVER_C`) and a cooldown.
**Takeaways:** (a) **explicit system ordering** (resource → capacity → thermal →
workload) documented in one place; (b) *throttle band → trip → recover with hysteresis*
is exactly the right gameplay curve; (c) wear → maintenance → bot pathing loop is
validated as fun; (d) one test file per system is a good norm.

### 2.3 Commercial landscape (Steam, 2025–2026)
*Data Center* (Waseku), *Server-Admin Simulator*, *Hosting Simulator*, *Datacenter
Simulator*, *Uptime: A Cloud Provider Sim*, *COLD AISLE: Data Center Tycoon*.
Almost all are **first-person "rack and cable by hand"** sims or flat floor-plan tycoons.
**Gap we fill:** nobody combines the *SimTower vertical cross-section* with
*Factorio/ONI-style infrastructure networks* and a *sci-fi tech-tree with divergent
endgames*. Vertical stacking matters thematically: heat rises, chilled water must be
pumped up, power and fiber run in risers, and bots ride lifts.

---

## 3. Systems-game mechanics

### 3.1 Oxygen Not Included — heat
- Every cell has mass, temperature, element; heat flow between neighbours depends on
  ΔT, both materials' **thermal conductivity**, and **specific heat capacity**
  (water 4.179 DTU/g/°C). Insulated tiles cut conductivity by orders of magnitude.
- ONI does *not* strictly conserve energy and uses many hard-coded shortcuts — and is
  still beloved. **Lesson:** "plausible and readable" beats "physically exact".
- Heat-deletion devices (Aquatuner, steam turbine) form a mid-game puzzle: you can't
  destroy heat, only move it somewhere useful. → our **heat reuse** mechanic.

### 3.2 Factorio — networks & determinism
- Deterministic lockstep: every client must advance each tick identically; any
  divergence = desync (FFF #76, #188). Wube invested heavily in desync reports.
- Electric networks are graph-solved per tick: producers vs consumers, satisfaction
  ratio throttles every consumer uniformly; accumulators buffer.
- Fluids flow through pipe segments with throughput limits.
- **Lessons:** solve power as a *graph* per connected network (not per tile); expose a
  single satisfaction % per network; integer/fixed-point maths and seeded RNG.

### 3.3 Project Highrise — tenant needs & utilities
- Tenants require utilities (electricity, water early; phone, cable, gas later) routed
  through the building; needs rise with tier (couriers, copy services, file storage).
- Satisfaction penalties from adjacency (noise next to apartments) and distance.
- **Lessons:** clients (AI labs) should have **tiered service requirements** (latency,
  uptime SLA, security, green-energy %) that unlock with reputation; **adjacency
  effects** (e.g. a quantum lab next to a vibration-heavy chiller loses fidelity).

### 3.4 SimTower — core loop
Build floors → place facilities → connect with elevators → occupants generate traffic &
money → star ratings unlock facilities. Elevator dispatch *is* the game's hardest system.
**AItower mapping:** racks = tenants; power/cooling/fiber risers = utilities; lifts carry
bots and hardware instead of people; star rating → **Tier rating** (Uptime-Institute-like
Tier I–IV + futuristic tiers).

---

## 4. Real-world AI datacenter engineering (gameplay-relevant facts)

| Topic | Fact | Game hook |
|---|---|---|
| **PUE** | Total facility power ÷ IT power. Industry average 1.56, flat for five years (Uptime Institute 2024). Hyperscale/liquid sites ~1.1; two-phase immersion claims <1.1. | Headline HUD gauge. Cooling & conversion losses add to the power bill and carbon score. |
| **Rack density** | Air-cooled H100 racks top out ~40 kW. GB200 NVL72 ≈ 120–132 kW per rack, requires direct-to-chip liquid cooling. | Natural tech gate: high-tier racks *cannot* be placed without a liquid loop. |
| **Liquid cooling** | Cold plates on GPU/CPU/switch, fed by in-rack or in-row **CDU** (e.g. 200 kW in-rack, 1.35 MW in-row, ~4 °C approach). Networking/storage stay on air. | CDU is a placeable room with capacity; racks connect to it via coolant pipes; still need some air cooling. |
| **Air cooling** | Hot-aisle/cold-aisle containment; ASHRAE recommended inlet 18–27 °C. CRAC/CRAH units. | Containment upgrades boost CRAC efficiency; inlet temp above band → throttling. |
| **Immersion** | Single-phase (simple, open bath) vs two-phase (boiling fluorocarbon, sealed tanks, highest density). Waste heat reusable for district heating/hot water. | Late-game cooling options; heat-reuse revenue in Greentech path. |
| **Thermal throttling** | GPUs down-clock when hot; sustained over-temp → shutdown & accelerated failure. | Throttle band → trip → damage (as in uptime-game). |
| **Hardware failure** | Llama 3 405B: 16,384 H100s, 54 days, 466 interruptions (419 unexpected), 58.7% GPU-related (incl. HBM3); ~one failure every 3 h; >90% effective training time via automated recovery. | Failures are *normal*, not exceptional. Bots + checkpointing are core loop, not a disaster mode. Failure rate rises with temperature and age. |
| **Network topology** | Rail-optimised non-blocking fat-tree (NVIDIA recommended); DGX SuperPOD three-tier fat-tree, 400 Gb/s per port; super-spine for cross-pod; TPU pods use 3D torus. | Fiber backbone as a graph; job throughput depends on bisection bandwidth between allocated racks; topology upgrades (fat-tree → rail-optimised → optical torus). |
| **Power chain** | Utility HV → substation transformer → MV switchgear → UPS → PDU → rack. Backup diesel/gas gensets; battery UPS bridges the gap. | Transformer room & substation as multi-tile facilities; outages test UPS + genset start time. |

---

## 5. Engineering patterns adopted

1. **Fixed-timestep sim, variable-rate render** (Gaffer On Games "Fix Your Timestep"):
   accumulator loop; render interpolates between last two sim states.
2. **Pure, headless sim package** with façade API (`create / step / submit / snapshot`).
3. **Command pattern** for every player input; command log + seed = full replay.
4. **Determinism:** seeded PRNG (e.g. xoshiro128**/mulberry32), no `Math.random`, no
   `Date.now`, stable iteration order (arrays, not `Map` keyed by object), integer or
   quantised fixed-point for anything that feeds back across ticks.
5. **Explicit system order** documented once (power → cooling → thermal → compute →
   failures → logistics → economy).
6. **Struct-of-arrays fields** (`Float32Array` heat, coolant temp) over the grid; plain
   records for discrete entities.
7. **Graph solvers per connected network** (power, coolant, fiber), rebuilt only when
   the topology changes (dirty flag), solved every tick.
8. **Data-driven content:** hardware, rooms, tech tree and clients in JSON with schema
   validation; balance changes without code changes.
9. **Per-module `AGENTS.md`** + interface files as contracts between sub-agents.
10. **Headless CLI + trace tests** for regression and balancing.

---

## 6. Sources

- tower-together — https://github.com/phulin/tower-together
- OpenSkyscraper — https://github.com/fabianschuiki/OpenSkyscraper
- OpenTower — https://github.com/0x9090/OpenTower
- TowerForge — https://github.com/adam4813/towerforge
- dctycoon — https://github.com/nzin/dctycoon
- uptime-game — https://github.com/pankrator/uptime-game
- OcramTower — https://github.com/AzemOcram/OcramTower ; skyline-coop — https://github.com/willc/skyline-coop
- Factorio FFF #76 (MP inside out) — https://factorio.com/blog/post/fff-76 ; FFF #188 (desyncs) — https://factorio.com/blog/post/fff-188
- ONI heat transfer — https://oxygennotincluded.wiki.gg/wiki/Guide/Heat_Transfer ; thermal conductivity — https://oxygennotincluded.wiki.gg/wiki/Thermal_Conductivity ; specific heat — https://oxygennotincluded.wiki.gg/wiki/Specific_Heat_Capacity
- Project Highrise review — https://gamingtrend.com/reviews/towering-above-project-highrise-review ; IGF — https://igf.com/project-highrise
- Uptime Institute 2024 survey — https://datacenter.uptimeinstitute.com/rs/711-RIA-145/images/2024.GlobalDataCenterSurvey.Report.pdf ; summary — https://www.upsite.com/blog/data-center-trends-rack-density-rises-while-pue-and-outage-frequency-remain-flat/
- GB200 NVL72 — https://newsletter.semianalysis.com/p/gb200-hardware-architecture-and-component ; https://www.gigabyte.com/Enterprise/GIGAPOD-Pod-Scale/AI-DLC-POD_NVIDIA-GB200-NVL72 ; https://supermicro.com/datasheet/datasheet_SuperCluster_GB200_NVL72.pdf
- Llama 3 reliability — https://mlops.substack.com/p/scaling-and-reliability-challenges ; https://www.club386.com/nvidia-h100-caused-problems-during-metas-llama-ai-training/
- GPU network topology — https://docs.nvidia.com/networking/display/ibclusterbringupprocedure/setting+the+infiniband+cluster+topology ; IBM infra paper — https://arxiv.org/pdf/2407.05467 ; RailX — https://arxiv.org/pdf/2507.18889
- Immersion cooling — https://www.trane.com/commercial/north-america/us/en/about-us/newsroom/glossary/immersion-cooling.html ; https://naddod.com/blog/single-phase-vs-two-phase-immersion-cooling-in-data-centers
- Steam landscape — https://store.steampowered.com/app/4170200/Data_Center/ ; https://itsfoss.com/data-center-game/
