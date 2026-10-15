# AItower engineering review: gap analysis to 1.0

Baseline at HEAD (b50f9a8): `npm run check` passes (21 files, 123 tests, about 7 s). `npm run build` passes, with a 710 kB (229 kB gzip) main chunk. `sim starter 30` runs 30 days in 1.2 s, final hash `23d9ca04a1306946`. The architecture is sound: a pure sim, a frozen contract and a boundary checker. The gaps are in robustness, scale and persistence rather than design.

I benchmarked the sim myself (scratch scripts, not committed). A synthetic tower had 100 floors × 64 wide (6,656 cells), 1,800 racks, 50 bots and one full-height lift. It ran with real content, with contracts accepted.

## 1. Correctness risks and bugs

**Crash and recovery**
- **The game loop dies silently on any throw.** `apps/web/src/loop.ts:28-33` has no try/catch, and `requestAnimationFrame` is re-armed on the last line. One exception from `sim.step()` freezes the game for good. There is no `window.onerror`, no React error boundary, and `main.tsx:104` only guards boot.
- **A stale save crashes on load.** `getDef` throws on an unknown def id (`sim/src/world/defs.ts:5`). I confirmed that a snapshot naming a removed facility def loads fine, then throws in `step()`. That puts the loop above into a crash loop.
- **Snapshots are not validated.** `sim.ts:91` checks `version` for equality only. `snapshot/codec.ts:127-139` never checks array lengths or required fields. I confirmed that a slab array truncated to 10 entries loads and steps, with silent garbage.
- **Malformed commands can throw.** `submit({type:"buildConduit", cells:[null]})` throws a TypeError from `commands/structure.ts:204`. Pending commands are saved in the snapshot, so the same throw can recur on every load.

**Command validation**
- **Same-tick dependencies fail** (BUILD_LOG backlog #3). I confirmed that `buildSlab` followed by `place` in one tick is rejected at `submit`, because validation sees only current state (`sim.ts:43-47`). Bulk build-outs need the plan layer to run against a shadow of the queue.
- **Slab demolish only guards the floor above for floors ≥ 0.** At `commands/demolish.ts:292`, `floor + 1 > 0` skips the guard for basements. `planSlab` also skips the support check below ground (`structure.ts:181`).
- **Conduit support is order-dependent.** At `structure.ts:207-212`, a cell supported only by a later cell in the same drag is rejected.

**Logistics livelocks**
- **Work orders have no timeout or reassignment.** `logistics/bots.ts:59` says "stuck until topology changes", and the order stays claimed. If a lift is demolished, a slab is removed or the lift loses power, a bot holds its order forever and the rack is never repaired. `lifts.ts:89` freezes an unpowered lift with its riders and doors open.
- **Walk legs are checked only at claim time.** `walkable` is not re-checked while walking (`bots.ts:66-68`).
- **Only one lift per route** (`routing.ts:244`, backlog #6). In a 100-floor tower this forces a full-height express shaft. It is a 1.0 blocker, because every bot-based repair depends on it.

**Determinism and numerics**
- **Cross-engine determinism is not guaranteed.** `core/time.ts:540` uses `Math.cos`, which is not bit-exact across engines. `airTemp` is stored as Float32 and is not quantised, contrary to ARCHITECTURE §3.4's "1/64 °C". It affects replays, daily-seed leaderboards and any server verification. The fix is an ambient lookup table plus quantised storage.
- **Rolling sums are recomputed every tick.** `economy/economyStep.ts:422-425` sums four 1,440-element rings (5,760 adds per tick) when running sums would do.
- **Balance literals are not in the content data.** The literals in `core/constants.ts` (idle draw, refund, bot thresholds) are not in `Balance` (backlog #2). That blocks modding and tuning.
- **RNG stream count is fixed.** `core/rng.ts:271-276` has two fixed streams, so adding events or contamination needs a snapshot migration. Derive named streams lazily (see §5).
- **Failure rolls depend on build history.** Racks consume one RNG draw each, in facility order (`reliabilityStep.ts:36`), so build order shifts failures elsewhere.
- **Bankruptcy has no consequence.** `bankrupt` is a flag that clears itself when cash recovers (`economyStep.ts:433-436`). There is no game-over, loan or bailout flow.
- **Lifetime stats are lost.** The ledger keeps 30 days and history keeps 1,440 samples. Achievements, ascension and a quarterly report need lifetime counters.

**Store and loop (`apps/web/src`)**
- **The save/load paths have gaps.**
  - `store.ts:40` calls the full `sim.view()` just to read the tick.
  - `load` (`:83-85`) lets `JSON.parse` throw to the caller, and does not pause or reset tool and ghost.
  - `loadAutosave` swallows every error, so a corrupt or old save is silently replaced at the next `newDay` (`:101`). `?new` (`main.tsx:70`) clobbers it the same way.
- **The loop has no time budget.** `loop.ts:8` caps ticks per frame at 120, not milliseconds. At 2.6 ms/tick, 30× speed is 5 ticks per frame (13 ms). A 250 ms stall means 75 ticks, about 195 ms, which drives the frame rate toward 5 fps.
- **Smaller issues.** `main.tsx:70` makes seed 0 unreachable, `?speed=` is unvalidated, and `window.aitower` exposes the store in production.

## 2. Scalability (measured)

Per-tick cost at 100 floors, 1,800 racks and 50 bots was 2.6 ms.

| Stage | ms/tick |
|---|---|
| Bots | 0.67 |
| Power solve | 0.61 |
| Compute | 0.33 |
| Air field | 0.26 |
| Cooling solve | 0.19 |
| Reliability | 0.15 |
| Rack thermal | 0.14 |
| Economy | 0.14 |
| Lifts | 0.00 |

Other measurements:
- A network rebuild adds about 1.4 ms on a dirty tick.
- `view()` costs 0.27 ms, and loop and store build it two to three times per frame.
- A snapshot costs 24 ms and 1.18 MB.
- `hash()` costs 31 ms.

**Findings**
- **The thermal field is not the problem.** It costs about 40 ns per cell, so a contamination field (see §5) adds only about 0.25 ms.
- **The budget breaks at 30×.** That is 13 ms of sim per 16 ms frame, before render. At 10× it is about 4.5 ms.
- **The power solver allocates every tick.**
  - It builds a `Map<Facility,Def>` of about 2,000 entries plus `gensetOut` Maps and bucket arrays (`powerSolve.ts:172, 257`).
  - Fix: cache the def on the facility, or keep an index-parallel array.
  - Fix: reuse the buckets.
- **Bot planning is O(idle bots × orders × facilities).** `tryClaim` calls `chooseDepot`, which scans all facilities and calls `getDef` (`bots.ts:30-43, 80-95`). Fix: pre-index depots and chargers, keep a claimable-orders list, and run the claim scan on a stride.
- **Scheduling scans every tick.**
  - `allocateRacks` re-filters all facilities and sorts every tick.
  - `updateRackClocks` calls `getDef` for every facility.
  - Fix: a typed facility table with cached kind and def, in struct-of-arrays form.
- **Move the sim to a Web Worker.** Run it behind a `SimClient` that applies commands and posts a view delta every frame. This removes the 30× problem and the autosave hitch. It conflicts with the live `Uint8Array` fields in `SimView` (`api.ts`), so transfer or share buffers (SharedArrayBuffer needs COOP/COEP, which GitHub Pages cannot set).
- **Render costs (estimates, not measured).**
  - The heat, power and coolant overlays rebuild a per-cell `Graphics` (about 8k rects) every new tick (`render/src/pixi/overlays.ts:34-50`, `renderer.ts:224`). Replace with one data-texture sprite and a shader ramp.
  - Any slab change rebuilds all structure.
  - Any facility change redraws all bodies (`renderer.ts:218`).
  - `facilityKey` string-joins every facility every tick (`renderer.ts:68`).
  - Fix: cull static layers per chunk (for example 16×16 tiles) and use dirty rects.
- **React re-renders everything.** The HUD re-renders at about 10 Hz from `useSyncExternalStore` (`ui/src/hooks.ts`), and none of the panels use `memo`. Selector hooks per panel should replace passing the whole `GameState`. Inspector and tutorial `view.facilities.find` calls are O(n); add an id→index map. The alerts and facility lists need virtualisation.
- **Fixed lot size.** `world/init.ts:20` takes the grid size from the scenario. The starter lot is 48 × 13 floors. 100 floors needs either a bigger lot or growth. Growing upward (appending to the arrays) keeps indices stable. Growing in width requires remapping every array and each saved index.

## 3. Save/load, settings and crash handling

- **Format size.** Typed arrays are written as `number[]` (`codec.ts:120`). Float32 values print as long decimals, and the four 1,440-entry rings are always written. A day-2 starter save is 98 kB. A 100-floor tower is 1.2 MB, against a localStorage quota of about 5 MB. Quota failures are swallowed (`store.ts:123`).
- **Autosave coverage.**
  - The only autosave is a single synchronous `localStorage` write on `newDay`, with no slots and no rotation.
  - There is no save on `visibilitychange` or `pagehide`.
  - There is no Save, Load, Export or Import UI at all (no references in `packages/ui`). `GameStore.save/load` exist but are unreachable.
- **Planned storage is not built.** ARCHITECTURE §13 specifies versioned, gzip, IndexedDB saves with migrations keyed by `version`. Only `version` equality exists.
- **No content version in saves.** Saves carry no content hash or content-version field, so a balance or def change can invalidate them.
- **Settings.** Mute, volume, tutorial progress (the only item that persists, in its own try/catch), last overlay, speed and zoom are not persisted. There is no settings screen. Audio volume has an engine API but no UI.

**Proposed design**
- A save envelope `{magic, snapshotVersion, contentVersion, createdAt, meta{day,cash,tier,seed}, payload}`.
- A chain of migrations `v1→v2→…`, with a golden-snapshot test per version.
- Validation by zod or valibot on decode.
- Three save slots, plus a rolling backup of the last two autosaves.
- Gzip via `CompressionStream` in IndexedDB.
- Export and import as `.aitower` files with a version check.
- Writes made off the render path.
- When a load fails, keep the old bytes and offer a download.

## 4. Build and release

- **CI gaps.**
  - Checks run only inside the deploy workflow (`.github/workflows/pages.yml`).
  - `check` runs `tsc`, the boundary script and vitest only.
  - There is no `pull_request` trigger, so PRs are not gated.
  - The workflow still triggers on the stale branch `claude/serene-ramanujan-ojshkh` (line 5).
  - ARCHITECTURE §14 promises Biome lint, but there is no config, no formatter and no lint step. Dependency audit is also missing.
  - Fix: add a `ci.yml` for PRs with typecheck, lint, test, build and the bundle-size budget.
  - Fix: add a golden sim-cli trace diff.
- **Bundle.**
  - One 710 kB chunk (backlog #7) holds Pixi, React, sim and content. Vite warnings are silenced (`chunkSizeWarningLimit: 2000`, `vite.config.ts`).
  - Set `manualChunks` for pixi and react. Lazy-load the render and audio chunks.
  - Subset fonts, since latin-ext and vietnamese files are shipped unneeded (about 150 kB of woff2).
  - The sim worker (§2) gives a natural boundary.
  - Budget: under 250 kB gzip initial.
- **Test gaps.**
  - Strong in sim: 123 tests, determinism, thermal and logistics. Weak elsewhere.
  - Render has only camera, interp, colour and palette tests.
  - UI has two HUD tests and a controller test.
  - Audio is tested against mocks.
  - Missing: persistence tests (migration, corrupt save), `apps/web` store tests, command fuzzing and invariants (cash conservation, grid and entity consistency), a long-run soak (365 days with no NaN), and cross-engine hash checks.
  - There are no e2e tests. `scripts/screenshot.mjs` hardcodes a global Playwright path (`/opt/node22/...`) and is not in `package.json`. Add `@playwright/test` with a smoke test: boot, place a rack, accept a contract, save, reload, and assert no console errors. Add screenshot diffs of the world art.
  - Add a failure-injection test that throws inside `step` to prove the loop survives.
- **Deploy.** Pages works, with a relative `base: "./"`. Add a `?debug` flag to gate `window.aitower`, a cache-busting strategy, an offline PWA shell and a version stamp in the HUD.
- **Desktop and Steam.**
  - Tauri is the better fit. It ships a small binary on the system WebView (WebView2 or WebKitGTK), but WebGL and WebAudio behaviour varies by platform, so test on Windows and Linux.
  - Electron bundles a known Chromium (about 100 MB), is predictable, and has the mature `steamworks.js` binding.
  - Steam readiness needs:
    - Steamworks init, cloud saves mapped to the slot files, and achievements from lifetime stats.
    - Controller and gamepad support, resolution and fullscreen settings, and a Steam Deck pass.
    - Localisation, crash reporting, and a licence audit of fonts, the Pixi MIT licence and any audio.
    - A decision on save location (file system, not localStorage, on desktop).
- **Telemetry.** There is none. Add an opt-in layer behind a first-run consent dialog: anonymous event counts (session length, tier reached, crash stack), a privacy statement, off by default, no PII, and a plain-HTTP endpoint that is easy to swap. In the desktop build, support a no-network mode. Crash reports are the first priority.

## 5. Architecture changes for the 1.0 feature set

- **Tech tree.**
  - Add `content/techtree/*.json` (nodes, prerequisites, cost, effects) and `state.research: {points, unlocked: string[]}`.
  - Replace the `unlockTier` gate in `commands/placement.ts:134` with `isUnlocked(defId)`, with tiers as one prerequisite type.
  - Add a `research` command, a `techUnlocked` event and a UI screen.
- **Events (heatwaves, grid outages, fires, market shocks).**
  - Add `state.events: ActiveEvent[]`, a seeded scheduler stage between 7 and 9, and a data file of event templates (trigger, duration, effects as modifiers).
  - Effects (ambient offset, grid cap, price multiplier, hazard multiplier) apply through one `Modifiers` struct recomputed per tick. This replaces ad-hoc balance lookups such as `ambientAt` and `energyPriceAt`.
  - Derive named RNG streams lazily as `hash(seed, name)` and store only counters in the state. This avoids the migration noted in §1.
- **Ascension paths** (ARCHITECTURE §9).
  - The paths need new facility kinds, resources and win conditions. The `FacilityKind` union in `content/src/schema.ts` and `getDef`-based switches are closed.
  - Move behaviour to a registry of kind handlers (`KindHandler {demand, step, status}`), so a path is a content-plus-handler module.
  - Add `state.resources: Record<string, number>` (nutrient medium, carbon credits, continuity) and a `Goal` evaluator reading lifetime stats.
  - Mutually exclusive paths mean a `state.path` choice and a path-gated unlock check.
- **Body-horror contamination as a field.**
  - Add a `Float32Array contamination` layer beside `airTemp`, with diffusion and decay in a new stage after 5a (about +0.25 ms at scale), sources and sinks from facilities, and a bot-cleanup interaction.
  - The change touches the state, snapshot (new array, so a v2 migration), `SimView` (a new field, which needs sign-off on `api.ts`), the overlay system (add a mode to `OverlayMode`) and the renderer shader (a data-texture path would serve heat too).
  - Make fields generic: `state.fields: Record<FieldId, Float32Array>` with a per-field spec in content (diffusion, decay, couples-to-ambient).
- **Music system.** The audio package is a procedural synth with no files (`audio/src/engine.ts`). Add a stem-based adaptive layer (tier, alert level and time of day as intensity inputs), a mixer with music, SFX and ambience buses, a volume UI and persistence, and an asset loader with lazy fetch. Audio decisions should consume a small `AudioState` derived from the view, not the whole view.
- **Modding content JSON.**
  - Content is statically imported (`content/src/load.ts`) and validated at boot, which is good. Add a mod loader: a `mods/<id>/manifest.json` (id, version, `requires`), overlay merge by id, and a `contentVersion` hash recorded in saves.
  - Replace hard-coded sim literals (§1) with `balance.sim`.
  - Provide a JSON Schema generated from `schema.ts` for editor support.
  - Contract generator code (`generateContract`) is currently a function, not data, so it cannot be modded. Make the templates declarative.
  - Cap the work a mod can do (no executable code in 1.0).
- **Localisation.** There are no string tables; names and descriptions live in JSON and text is hard-coded in `packages/ui` and `ui/src/events.ts` (`describeEvent`). Add an i18n layer (ICU message format or a small key-value approach), keyed ids in content (`facility.rack_air_gpu.name`), a locale picker, and font coverage. VT323, Special Elite and Silkscreen cover Latin only, so CJK, Cyrillic and similar scripts need fallback fonts. Pixi text is rasterised once (`main.tsx:53`), so locale switches must redraw label pools.
- **Sim API evolution.** Version `SimView` and `SimCommand` and treat `api.ts` as semver. Add `canBuild(cmd)` (backlog #1) and a `Sim.diff` API for the worker.

## 6. Prioritised list

**MUST (blocks 1.0)**
1. Crash safety: loop try/catch with a "recover" screen, a React error boundary and global handlers. S
2. Save system: envelope, migration chain, decode validation, slots, rolling backups, export/import UI, gzip and IndexedDB. M-L
3. Frame time budget plus move sim to a Web Worker (30× speed). L
4. Bot and lift robustness: multi-lift routing, order timeout and reassignment, re-validate walk paths. M
5. Command validation: queue-aware `submit`, `canBuild`, null-safe cells. M
6. Scale optimisations: power-solve allocation, bot planning indices, running sums, overlay rendering as a texture. M
7. CI: PR workflow, lint (Biome), bundle budget, Playwright smoke test, fix the stale branch trigger. M
8. Persist settings and add a settings screen. S
9. Bankruptcy and game-over flow, lifetime stats. M
10. Tech tree, events and the quarterly report (core 1.0 content loop). L

**SHOULD**
1. Code-split the bundle and subset fonts. S
2. Quantised or table-driven determinism across engines, with cross-engine hash tests. M
3. Generic field layer (heat plus contamination) and ascension handler registry. L
4. Localisation infrastructure. M
5. Opt-in telemetry and crash reporting. M
6. Selector-based React state with memoisation and virtualised lists. M
7. Soak, fuzz and invariant tests. M
8. Tauri or Electron packaging with file-based saves. L
9. Land expansion (grow the lot upward). M

**COULD**
1. Mod loader and manifest. M
2. Adaptive music stems. M
3. Steamworks (cloud, achievements), controller support, Steam Deck pass. L
4. Replay and command-log export. S
5. PWA offline shell. S
6. Move literals into `balance.sim` and make contract templates declarative. S

## Top risks

1. A single exception in `sim.step()` permanently freezes the game, with no recovery UI.
2. Saves are one unvalidated, version-locked localStorage slot that is silently overwritten and has no UI.
3. The sim is only fast enough for 100 floors at 10× or below (2.6 ms/tick, so 30× is 13 ms/frame), with no frame budget or worker.
4. Bots only cross floors through one shared lift, and orders never time out, so large towers livelock.
5. Command validation ignores queued commands, and malformed commands can throw.
6. The sim is not cross-engine deterministic (`Math.cos`, unquantised Float32).
7. CI gates only the deploy: no PR checks, no lint, no e2e, and a single 710 kB chunk.
8. The 1.0 features need closed-set changes: fixed RNG streams, a closed `FacilityKind`, a fixed lot size and a gated `unlockTier`.
