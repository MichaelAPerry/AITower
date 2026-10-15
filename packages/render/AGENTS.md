# @aitower/render — agent notes

PixiJS v8 renderer for a read-only `SimView`. Exports `createRenderer: CreateRenderer` (see
`packages/shared/src/index.ts`). Never mutates sim state; imports only `sim`/`content`/`shared` types and `pixi.js`.

## Files
| File | Purpose |
|---|---|
| `src/index.ts` | `createRenderer` + re-exports of pure camera/colour helpers |
| `src/constants.ts` | world geometry (TILE 16 px, FLOOR_H 48 px, in-floor layout), zoom steps, margins |
| `src/camera.ts` | **pure** camera math: screen↔world↔cell, clamp, zoom-at-cursor, pan |
| `src/color.ts` | **pure** colour helpers: heat ramp, rack temp ramp, satisfaction/load ramps, net palette, sky keyframes |
| `src/interp.ts` | **pure** `Interpolator` (last two samples per id), `effectiveAlpha`, FNV `hashArrays` |
| `src/status.ts` | **pure** status → LED colour/mode, badge, activity flicker |
| `src/pixi/renderer.ts` | composition root: Pixi `Application`, scene graph, caches, per-frame draw |
| `src/pixi/background.ts` | screen-space sky bands, stars, parallax city silhouette (shared `GraphicsContext`) |
| `src/pixi/structure.ts` | earth + building shell (back walls, raised floor, slab, roof, exterior walls) |
| `src/pixi/conduits.ts` | power cable tray / coolant pipe pair + risers; colour callbacks reused by overlays |
| `src/pixi/lifts.ts` | shafts (cached) and cars (per frame) |
| `src/pixi/facilityArt.ts` | per-kind facility bodies (static) and live details (LEDs, fans, bars, badges) |
| `src/pixi/bots.ts` | 10×10 rovers |
| `src/pixi/effects.ts` | rack heat shimmer, genset exhaust, repair sparks (particles) |
| `src/pixi/overlays.ts` | heat / power / coolant overlays |
| `src/pixi/markers.ts` | ghost preview + pulsing selection outline |
| `src/pixi/input.ts` | DOM input: right/middle drag, WASD/arrows, wheel zoom, left-button `CellPointerEvent`s |
| `src/dev/fixtureView.ts` | hand-built fake `SimView` + stub content for the harness/tests |
| `dev/index.html`, `dev/main.ts` | dev harness |

## Layer order (back → front)
Screen space: sky bands → stars → city silhouette (half-speed parallax).
World container (integer offset, integer zoom): earth → building shell/slabs → conduits → lift shafts →
lift cars → facility bodies (cached) → facility live details → bots → effects → overlay → ghost → selection.

## Invariants / perf
- 1 tile = 16 px, 1 floor = 48 px; floorMax's top is world y = 0. Zoom ∈ {1,2,3,4}; world offset is rounded
  to integer screen px and picking uses the same rounded offset, so clicks match pixels.
- The Pixi ticker is off (`autoStart: false`); `draw()` renders once via `app.render()`. The app loop calls it every frame.
- New tick detection: `view !== lastView || view.tick !== lastTick`. Only then: interpolator samples are pushed,
  slab / conduit arrays are hashed (FNV) and the shell / conduit Graphics rebuilt if the hash changed,
  lift shafts and facility bodies rebuilt if their id/position key string changed, overlay base rebuilt.
- Per frame: facility live details, lift cars, bots, effects, overlay shimmer, ghost pulse, selection.
- Interpolation: draw `lerp(prev, curr, alpha)` (one tick latency, no overshoot); jumps > 3 units snap.
  When no tick arrives for 250 ms (paused, alpha=0), alpha is treated as 1 so entities show the latest state.
- Pointer: `down`/`up` only for the left button (button 0); `move` always (button 0 while left held, else -1);
  `leave` with `cell: null`. Right/middle drag pans; wheel steps zoom toward the cursor.

## Testing
- `npx vitest run packages/render`: pure helpers (camera, colour, interpolation, status, fixture). No WebGL needed.
- Visual: `npx vite packages/render/dev --port 5174`, then
  `node scripts/screenshot.mjs "http://localhost:5174/?overlay=heat" out.png 1280 800 2000`.
  Query params: `overlay=heat|power|coolant`, `minute=1290` (night), `select=facility:12`, `ghost=1`, `mpt=N`
  (game minutes per tick), `real=1` (real content colours via `loadContent()`). Keys 1–4 switch overlay.
