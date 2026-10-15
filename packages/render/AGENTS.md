# @aitower/render — agent notes

PixiJS v8 renderer for a read-only `SimView`. Exports `createRenderer: CreateRenderer` (see
`packages/shared/src/index.ts`). Never mutates sim state; imports only `sim`/`content`/`shared` types and `pixi.js`.

## Art direction
Cassette-futurism / dystopian bureaucracy (docs/STYLE.md): 1980s mainframes in putty/beige/olive enamel with
brass fittings, exposed copper (supply) + verdigris (return) pipes, cloth-wrapped cables, pneumatic tubes, smoggy
sky with a brutalist skyline and a giant "MINISTRY" sign. Rules the code follows:
- **Every colour comes from `src/palette.ts`**: the exact STYLE tokens (`T.*`), the heat ramp (`HEAT_RAMP`), or a
  shade derived from them (`dk` → toward ink, `lt` → toward paper, `mat(c)` = hi/mid/lo/dk/line ramp). Facility
  body/accent colours come from `FacilityDef.color`/`accent`. Silhouette contexts are drawn white and tinted.
  `palette.test.ts` checks the tokens against STYLE.md.
- Pixel discipline: integer zoom, nearest sampling, only axis-aligned rects (`draw.ts`: `px`, `box`, `disc`, `ring`,
  `bevel`, `cornerBracket`, `lamp`, `crt`, `dialFace`/`needle`, `panelMeter`/`meterNeedle`, `valveWheel`, `dither`).
  1-px dark outline, light rim top-left, shadow bottom-right. Searchlight beams are the only polygons.
- Animation stays subtle: CRT flicker ~2 Hz, lamp blink, reel/fan/drum spin, steam ∝ chiller `heatKw`, genset smoke
  while `running`, pipe drips, welding sparks while `repairing`, pneumatic capsules on `jobId` changes.
- World text is VT323 (`labels.ts` `WORLD_FONT`, `TextPool`): floor plates (G / F1 / B1), depot counts, ghost tag and
  the "DENIED" stamp. The app loads the font first; the dev harness imports `@fontsource/vt323` and awaits it.

## Floor-cell layout (rows within a 48-px floor, see `constants.ts`)
0 slab shadow · 1–3 copper supply · 4–6 verdigris return (duct behind both) · 8–9 brass pneumatic tube (`TUBE_Y`)
· 10–40 facility body (`FAC_TOP`..`FAC_BOTTOM`) over tiled wall (wainscot from `WAINSCOT_Y` 27) · 41–43 cable tray
(`CABLE_Y`) · 44–47 riveted I-beam slab. Racks are one 15-px mainframe cabinet per tile (CRT at local 3,7 7×5,
lamps at row 14, louvres 17–24, card slot 26, kick plate 27–29); storage swaps lamps+louvres for a reel window.

## Files
| File | Purpose |
|---|---|
| `src/index.ts` | `createRenderer` + re-exports of pure camera/colour helpers |
| `src/constants.ts` | world geometry (TILE 16 px, FLOOR_H 48 px, in-floor layout), zoom steps, margins |
| `src/camera.ts` | **pure** camera math: screen↔world↔cell, clamp, zoom-at-cursor, pan |
| `src/palette.ts` | **pure** STYLE.md tokens, heat ramp, `mix`/`dk`/`lt`, material ramps (BRASS, COPPER, VERDI, STEEL, PAPER…) |
| `src/color.ts` | **pure** colour helpers: heat ramp, rack temp ramp, satisfaction/load ramps, net palette, sky keyframes (top/horizon/night/city/cityFar/haze) |
| `src/interp.ts` | **pure** `Interpolator` (last two samples per id), `effectiveAlpha`, FNV `hashArrays` |
| `src/status.ts` | **pure** status → lamp/phosphor colour + mode, badge, activity flicker |
| `src/pixi/renderer.ts` | composition root: Pixi `Application`, scene graph, caches, per-frame draw |
| `src/pixi/draw.ts` | pixel primitives (see Art direction) |
| `src/pixi/labels.ts` | `WORLD_FONT` (VT323) and `TextPool` (reused Pixi `Text`s per frame) |
| `src/pixi/background.ts` | screen-space dithered smog sky, smog streaks, searchlights, 2 parallax brutalist skyline layers (body/shade/lights/sign `GraphicsContext`s), aircraft lamps, haze |
| `src/pixi/structure.ts` | earth (soil strata, old pipes, cable runs), shell (green-grey tile, wainscot, duct, pneumatic tube, pendant lamps, I-beam slabs, parapet, concrete ends) + floor plates |
| `src/pixi/conduits.ts` | cloth cable bundle in riveted tray / copper+verdigris pipes with flanges & dials + risers; colour callbacks draw the overlay highlight; `dripCells` |
| `src/pixi/lifts.ts` | shafts (cached: brass posts, bracing, head house + dial) and cars (per frame: cage, accordion gate, dial needle, drum) |
| `src/pixi/facilityArt.ts` | per-kind facility bodies (static) and live details (CRTs, lamps, reels, fans, needles, knife switch, crates, badges) |
| `src/pixi/pneumatics.ts` | per-tick `jobId` change detection → brass capsules along the floor's tube (decorative) |
| `src/pixi/bots.ts` | 12×12 dome-headed automatons; exposes welding `torches` for effects |
| `src/pixi/effects.ts` | rack heat shimmer, chiller steam, genset smoke, welding sparks, coolant drips |
| `src/pixi/overlays.ts` | heat / power (amber nets) / coolant (copper-verdigris) overlays |
| `src/pixi/markers.ts` | cyanotype ghost (valid) / red-stamped "DENIED" ghost (invalid), VT323 price tag, pulsing brass selection brackets |
| `src/pixi/input.ts` | DOM input: right/middle drag, WASD/arrows, wheel zoom, left-button `CellPointerEvent`s |
| `src/dev/fixtureView.ts` | hand-built fake `SimView` + stub content for the harness/tests |
| `dev/index.html`, `dev/main.ts` | dev harness |

## Layer order (back → front)
Screen space: sky bands → stars → city silhouette (half-speed parallax).
World container (integer offset, integer zoom): earth → building shell/slabs → conduits → floor plates → lift shafts →
lift cars → facility bodies (cached) → facility live details → facility labels → pneumatic capsules → bots → effects →
overlay → ghost → selection. Screen space on top: CRT scanlines (6 %) + vignette (8 %).

## Invariants / perf
- 1 tile = 16 px, 1 floor = 48 px; floorMax's top is world y = 0. Zoom ∈ {1,2,3,4}; world offset is rounded
  to integer screen px and picking uses the same rounded offset, so clicks match pixels.
- The Pixi ticker is off (`autoStart: false`); `draw()` renders once via `app.render()`. The app loop calls it every frame.
- New tick detection: `view !== lastView || view.tick !== lastTick`. Only then: interpolator samples are pushed,
  slab / conduit arrays are hashed (FNV) and the shell / conduit Graphics rebuilt if the hash changed,
  lift shafts and facility bodies rebuilt if their id/position key string changed, overlay base rebuilt.
- Per frame: facility live details (culled to the viewport), lift cars, capsules, bots, effects, overlay shimmer,
  ghost pulse, selection. Drip cells are recomputed when conduits or facilities change.
- Interpolation: draw `lerp(prev, curr, alpha)` (one tick latency, no overshoot); jumps > 3 units snap.
  When no tick arrives for 250 ms (paused, alpha=0), alpha is treated as 1 so entities show the latest state.
- Pointer: `down`/`up` only for the left button (button 0); `move` always (button 0 while left held, else -1);
  `leave` with `cell: null`. Right/middle drag pans; wheel steps zoom toward the cursor.

## Testing
- `npx vitest run packages/render`: pure helpers (camera, colour, interpolation, status, fixture). No WebGL needed.
- Visual: `npx vite packages/render/dev --port 5174`, then
  `node scripts/screenshot.mjs "http://localhost:5174/?overlay=heat" out.png 1280 800 2000`.
  Query params: `overlay=heat|power|coolant`, `minute=1150` (dusk) / `1300` (night), `mpt=0` (freeze the clock),
  `zoom=1..4`, `focus=x,floor`, `select=facility:12`, `ghost=1|bad`, `real=1` (real content via `loadContent()`;
  the fixture already uses the real colours). Keys 1–4 switch overlay. The fixture cycles rack jobs every 25 ticks
  so capsules fly. Real game: `npx vite apps/web --port 5176`, `?new&seed=7&speed=10[&overlay=heat]`.
