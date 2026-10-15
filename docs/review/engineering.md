# AItower engineering review: gap analysis to 1.0

Baseline at HEAD (b50f9a8): `npm run check` passes (21 files, 123 tests, about 7 s). `npm run build` passes, with a 710 kB (229 kB gzip) main chunk. `sim starter 30` runs 30 days in 1.2 s (hash `23d9ca04a1306946`). The architecture is sound: a pure sim, a frozen contract and a boundary checker. The gaps are robustness, scale and persistence.

I benchmarked the sim with scratch scripts (not committed): 100 floors × 64 wide (6,656 cells), 1,800 racks, 50 bots, real content, contracts accepted.

## 1. Correctness risks and bugs

**Crash and recovery**
- **The loop dies silently on any throw.** `apps/web/src/loop.ts:28-33` has no try/catch, and `requestAnimationFrame` is re-armed on the last line. One exception freezes the game for good. There is no `window.onerror` or React error boundary, and `main.tsx:104` guards boot only.
- **A stale save causes a crash loop.** `getDef` throws on an unknown def id (`sim/src/world/defs.ts:5`). I confirmed that a snapshot naming a removed def loads, then throws in `step()`.
- **Snapshots are not validated.** `sim.ts:91` checks `version` equality only, and `snapshot/codec.ts:127-139` never checks array lengths or fields. I confirmed that a slab truncated to 10 entries loads and steps with silent garbage.
- **Malformed commands throw.** `buildConduit` with `cells:[null]` raises a TypeError at `commands/structure.ts:204`. Pending commands are saved, so this can recur on every load.

**Command validation**
- **Same-tick dependencies fail** (backlog #3). I confirmed `buildSlab` then `place` in one tick is rejected at `submit` (`sim.ts:43-47`), because validation ignores the queue.
- **Slab demolish skips the support check below ground.** `commands/demolish.ts:292` has `floor + 1 > 0`, and `structure.ts:181` skips it for building. Conduit support is also order-dependent (`structure.ts:207-212`).

**Logistics livelocks**
- **Work orders never time out.** `logistics/bots.ts:59` returns "stuck until topology changes" while the order stays claimed. Demolishing a lift or slab, or an unpowered lift (`lifts.ts:89`, which freezes riders and doors), leaves the rack unrepaired forever. Walk legs are validated only at claim time (`bots.ts:66-68`).
- **Routes allow one lift only** (`routing.ts:244`, backlog #6). A 100-floor tower then needs a full-height express shaft. This is a 1.0 blocker.

**Determinism and numerics**
- **Not cross-engine deterministic.** `core/time.ts:540` uses `Math.cos`, and `airTemp` is unquantised Float32, contrary to ARCHITECTURE §3.4 ("1/64 °C"). This matters for replays, daily-seed leaderboards and verification. Use an ambient lookup table and quantised storage.
- **RNG streams are a fixed pair** (`core/rng.ts:271-276`). Adding events or contamination needs a migration. Failure rolls also depend on build history, since each rack takes one draw in facility order (`reliabilityStep.ts:36`).
- **Economy gaps.** `economyStep.ts:422-425` sums four 1,440-element rings every tick (use running sums). Bankruptcy is a self-clearing flag (`:433-436`) with no game-over or bailout. The ledger keeps 30 days only, so there are no lifetime stats for achievements. Sim literals in `core/constants.ts` are not in `Balance` (backlog #2).

**Store and loop (`apps/web/src`)**
- `store.ts:40` builds a full `sim.view()` just to read the tick. `load` (`:83-85`) lets `JSON.parse` throw and does not pause or reset tool and ghost.
- `loadAutosave` swallows every error, so a corrupt or old save is silently replaced at the next `newDay` (`:101`). `?new` (`main.tsx:70`) clobbers it the same way.
- **No frame time budget.** `loop.ts:8` caps ticks (120), not milliseconds. At 2.6 ms/tick, 120 ticks is over 300 ms, and a 250 ms stall drives the frame rate toward 5 fps at 30×.
- Minor: seed 0 is unreachable, `?speed=` is unvalidated, and `window.aitower` exposes the store in production.

## 2. Scalability (measured)

Per-tick cost at 100 floors, 1,800 racks, 50 bots was 2.6 ms: bots 0.67, power 0.61, compute 0.33, air field 0.26, cooling 0.19, reliability 0.15, rack thermal 0.14, economy 0.14. A network rebuild adds about 1.4 ms. `view()` costs 0.27 ms and is built two to three times per frame. A snapshot costs 24 ms and 1.18 MB, and `hash()` 31 ms.

- **The thermal field is not the bottleneck.** It costs about 40 ns per cell, and a contamination field would add about 0.25 ms.
- **30× speed breaks.** It needs 13 ms of sim per 16 ms frame, before render. 10× needs about 4.5 ms.
- **Power solve allocates every tick.** `powerSolve.ts:172, 257` build a `Map<Facility,Def>` of about 2,000 entries plus bucket arrays. Cache the def on the facility and reuse buffers.
- **Bot planning scales badly.** `tryClaim` calls `chooseDepot`, which scans every facility with `getDef` (`bots.ts:30-43, 80-95`), per idle bot per tick. Index depots and chargers, keep a claimable list, and stride the scan.
- **Compute also scans per tick.** `allocateRacks` re-filters all facilities every tick. Move to a typed facility table (struct-of-arrays) with cached kind.
- **Move the sim to a Web Worker** behind a `SimClient` that posts view deltas. This fixes 30× and the autosave hitch. It conflicts with the live typed arrays in `SimView`, and SharedArrayBuffer needs COOP/COEP headers that GitHub Pages cannot set.
- **Render costs (estimates, not measured).**
  - Overlays rebuild about 8k per-cell `Graphics` rects every new tick (`render/src/pixi/overlays.ts:34-50`). Replace with a data-texture sprite and shader ramp.
  - Any slab change rebuilds all structure, and any facility change redraws all bodies (`renderer.ts:218`).
  - `facilityKey` string-joins every facility every tick (`renderer.ts:68`). Chunk the static layers.
- **React re-renders everything** at about 10 Hz (`ui/src/hooks.ts`), and no panel uses `memo`. Add per-panel selectors, an id→index map for the `facilities.find` calls, and virtualised lists.
- **The lot is fixed** by the scenario (`world/init.ts:20`; starter is 48 wide, floors -2 to 10). Growing upward (appending to arrays) keeps indices stable. Growing in width needs a remap and a migration.

## 3. Save/load, settings, crash handling

- **Format size.** Typed arrays are written as `number[]` (`codec.ts:120`), including four 1,440-entry rings. A day-2 starter save is 98 kB and a 100-floor tower 1.2 MB, against a localStorage quota of about 5 MB. Quota errors are swallowed (`store.ts:123`).
- **Autosave coverage.** The only autosave is a single synchronous `localStorage` write on `newDay`, with no slots, no rotation and no save on `visibilitychange`. There is no Save, Load, Export or Import UI (`GameStore.save/load` are unreachable from `packages/ui`).
- **ARCHITECTURE §13 is unbuilt.** It specifies versioned gzip IndexedDB saves and migrations. Saves also carry no content version, so a balance or def change can invalidate them.
- **Settings.** Mute, volume, overlay and speed are not persisted, and there is no settings screen. Only tutorial progress persists, in its own try/catch.

**Proposed design:**
- A save envelope `{magic, snapshotVersion, contentVersion, meta{day,cash,tier,seed}, payload}`.
- A migration chain with a golden snapshot per version.
- Schema validation on decode.
- Three slots plus the last two autosaves kept as backups.
- Gzip via `CompressionStream` into IndexedDB, written off the render path.
- `.aitower` file export and import.
- On a failed load, keep the old bytes and offer a download.

## 4. Build and release

- **CI.** Checks run only inside the deploy workflow (`.github/workflows/pages.yml`), with no `pull_request` trigger. The workflow still triggers on the stale branch `claude/serene-ramanujan-ojshkh` (line 5). `npm run check` is tsc, the boundary script and vitest only: ARCHITECTURE §14 promises Biome lint, but there is no config, formatter or lint step. Add `ci.yml` for PRs (typecheck, lint, test, build, bundle budget, golden sim-cli trace diff).
- **Bundle.** One 710 kB chunk holds Pixi, React, sim and content, with warnings silenced (`chunkSizeWarningLimit: 2000`). Set `manualChunks` for pixi and react, lazy-load render and audio, and subset fonts (latin-ext and vietnamese files ship unused). Target: under 250 kB gzip initial.
- **Tests.** The sim is strong (123 tests, determinism). Render has only camera, interp and colour tests, UI has two HUD tests plus the controller, and audio is mock-only. Missing: persistence and migration tests, `apps/web` store tests, command fuzzing and invariants, a 365-day NaN soak, and loop failure injection.
- **E2E.** There are none. `scripts/screenshot.mjs` hardcodes `/opt/node22/lib/node_modules` and is not in `package.json`. Add `@playwright/test` with a smoke path (boot, place a rack, accept a contract, save, reload, assert no console errors) and screenshot diffs.
- **Desktop and Steam.** Tauri gives a small binary on the system WebView, but WebGL and WebAudio vary by platform, so test Windows and Linux. Electron bundles Chromium (about 100 MB), is predictable and has the mature `steamworks.js`. Steam needs cloud saves mapped to slot files, achievements from lifetime stats, gamepad support, a Steam Deck pass, localisation, crash reporting and a font and licence audit.
- **Telemetry.** There is none. Build an opt-in layer behind a first-run consent dialog: off by default, no PII, crash reports first, a swappable endpoint, and a no-network desktop mode.

## 5. Architecture changes for the 1.0 feature set

- **Tech tree.** Add `content/techtree/*.json` and `state.research`. Replace the `unlockTier` gate (`commands/placement.ts:134`) with `isUnlocked(defId)`, with tiers as one prerequisite type. Add a `research` command, a `techUnlocked` event and a UI screen.
- **Events (heatwaves, outages, market shocks).** Add `state.events`, a seeded scheduler stage between 7 and 9, and event templates in content. Effects go through one per-tick `Modifiers` struct (ambient offset, grid cap, price, hazard), replacing ad-hoc lookups such as `ambientAt`. Derive named RNG streams lazily as `hash(seed, name)`, storing only counters.
- **Ascension paths** (ARCHITECTURE §9). The `FacilityKind` union in `content/src/schema.ts` and the `getDef` switches are closed. Move behaviour to a kind-handler registry (`demand`, `step`, `status`) so a path is a content-plus-handler module. Add `state.resources` (nutrient medium, carbon credits, continuity), a goal evaluator over lifetime stats, and a `state.path` choice.
- **Contamination field.** Add a `Float32Array` beside `airTemp` with diffusion and decay in a new stage after 5a, plus bot cleanup. This touches state, the snapshot (v2 migration), `SimView` (an `api.ts` change needing sign-off), `OverlayMode` and the renderer. Generalise to `state.fields: Record<FieldId, Float32Array>` with per-field specs (diffusion, decay, ambient coupling). The data-texture overlay in §2 then serves heat and contamination.
- **Music.** The audio package is a procedural synth with no assets (`audio/src/engine.ts`). Add adaptive stems (driven by tier, alert level and time of day), music/SFX/ambience buses, a volume UI with persistence, and lazy asset loading. Feed audio a small derived `AudioState`, not the whole view.
- **Modding.** Content is statically imported and validated at boot (`content/src/load.ts`), which is a good base. Add `mods/<id>/manifest.json` with overlay merge by id, a `contentVersion` hash recorded in saves, and `balance.sim` for the literals. Generate a JSON Schema from `schema.ts`. `generateContract` is code, not data, so make contract templates declarative. Allow no executable mod code in 1.0.
- **Localisation.** Strings are hard-coded in `packages/ui` and `ui/src/events.ts` (`describeEvent`), and names are inline in JSON. Add key-based ids (`facility.rack_air_gpu.name`), an i18n layer and a locale picker. The three fonts are Latin-only, so CJK and Cyrillic need fallbacks. Pixi text is rasterised once (`main.tsx:53`), so locale switches must redraw label pools.
- **API evolution.** Version `SimView` and `SimCommand` semver-style. Add `canBuild(cmd)` (backlog #1) and a view-delta API for the worker.

## 6. Prioritised list

**MUST (blocks 1.0)**
1. Crash safety: loop try/catch with a recover screen, error boundary and global handlers. S
2. Save system: envelope, migrations, validation, slots, backups, export/import UI, gzip and IndexedDB. M-L
3. Frame time budget and Web Worker sim (30× speed). L
4. Bot and lift robustness: multi-lift routing, order timeout and reassignment, re-validated walk paths. M
5. Queue-aware `submit`, `canBuild`, null-safe commands. M
6. Scale fixes: power-solve allocation, bot indices, running sums, texture overlays. M
7. CI: PR workflow, Biome, bundle budget, Playwright smoke test, remove the stale branch trigger. M
8. Persisted settings and a settings screen. S
9. Bankruptcy and game-over flow, plus lifetime stats. M
10. Tech tree, events and quarterly report (the core 1.0 content loop). L

**SHOULD**
1. Code-split and subset fonts. S
2. Table-driven or quantised determinism with cross-engine hash tests. M
3. Generic field layer and ascension handler registry. L
4. Localisation infrastructure. M
5. Opt-in telemetry and crash reporting. M
6. Selector-based React state and virtualised lists. M
7. Soak, fuzz and invariant tests. M
8. Tauri or Electron packaging with file-based saves. L
9. Lot expansion (grow upward). M

**COULD**
1. Mod loader and manifest. M
2. Adaptive music stems. M
3. Steamworks, gamepad and Steam Deck pass. L
4. Replay and command-log export. S
5. PWA offline shell. S
6. Declarative contract templates. S

## Top risks

1. A single exception in `sim.step()` permanently freezes the game, with no recovery UI.
2. Saves are one unvalidated, version-locked localStorage slot, silently overwritten, with no UI.
3. The sim handles 100 floors only at 10× or below (2.6 ms/tick, so 30× is 13 ms/frame), with no frame budget or worker.
4. Bots cross floors through a single shared lift and orders never time out, so large towers livelock.
5. Command validation ignores queued commands, and malformed commands can throw.
6. The sim is not cross-engine deterministic (`Math.cos`, unquantised Float32).
7. CI gates only the deploy: no PR checks, no lint, no e2e, and a single 710 kB chunk.
8. The 1.0 features need closed-set changes: fixed RNG streams, a closed `FacilityKind`, a fixed lot size and a gated `unlockTier`.
