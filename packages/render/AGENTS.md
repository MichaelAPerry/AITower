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
| `src/palette.ts` | **pure** STYLE.md tokens, heat ramp, colour-blind plasma ramp (`HEAT_RAMP_CB`) and blue/orange tokens (`CB`), `mix`/`dk`/`lt`, material ramps (BRASS, COPPER, VERDI, STEEL, PAPER…) |
| `src/color.ts` | **pure** colour helpers: heat ramp, rack temp ramp, satisfaction/load ramps, alert colour, net palette, sky keyframes (top/horizon/night/city/cityFar/haze). Heat, rack temp, satisfaction and load take `colorBlind` (default false) |
| `src/presentation.ts` | **pure** `Presentation` store for `RenderOptions`: `set()` returns the keys that changed (empty = no-op); `horrorIntensity` getter (stored for M3, no visual yet) |
| `src/interp.ts` | **pure** `Interpolator` (last two samples per id), `effectiveAlpha`, FNV `hashArrays` |
| `src/alerts.ts` | **pure** off-screen alert arrows: `alertSeverity` (failed/tripped 3, unpowered 2, noCoolant 1), `alertArrowColor`, `isOffscreen`, `edgePoint` (clamped to the inset viewport), `computeArrows` (greedy grouping within `mergeDist`, worst + nearest is the representative), `hitArrow`, `arrowPixels` |
| `src/feedback.ts` | **pure** failure-effect rules: `facilityFx` (status + tempC + net satisfaction → steam/strobe/wrench/sparks/fire/smoke/blackout/brownout; fire when failed and `tempC >= tripC - 3`), `lightRuns` (floor runs on nets with satisfaction < 1), `leakDrips` (conduit cells of coolant nets with `loadKw > capacityKw`, via `coolantNetOf`) |
| `src/art.ts` | **pure** art selection: `rackVariant` (air/dlc/immersion/storage), `artTier` (unlockTier → 1..4), `cabinetDetail` (cornice/gauge/hopper/pilasters/crest per cabinet by tier and width), `trimDetail` (edge trim of non-racks), `NATIVE_WIDTH`/`bodyWidth`/`annexTiles` (non-rack bodies keep native width; extra tiles get an enamel annex bay) |
| `src/botArt.ts` | **pure** bot art: `botKind` (flying -> drone, carry > 1 -> lifter), `botDims`, `crateCount`, `rotorSpeed`, `hoverOffset` |
| `src/status.ts` | **pure** status → lamp cue (`color`, `mode`, health `tone`, `accent`; `colorBlind` aware), `phosphorFor(tone)`, CRT glyph (`crtGlyph`, `CRT_GLYPHS` 3×3 bitmaps), badge, activity flicker |
| `src/pixi/renderer.ts` | composition root: Pixi `Application`, scene graph, caches, per-frame draw |
| `src/pixi/draw.ts` | pixel primitives (see Art direction); `crt(..., steady)` and `glyph3` |
| `src/pixi/labels.ts` | `WORLD_FONT` (VT323) and `TextPool` (reused Pixi `Text`s per frame) |
| `src/pixi/background.ts` | screen-space dithered smog sky, smog streaks, searchlights, 2 parallax brutalist skyline layers (body/shade/lights/sign `GraphicsContext`s), aircraft lamps, haze |
| `src/pixi/structure.ts` | earth (soil strata, old pipes, cable runs), shell (green-grey tile, wainscot, duct, pneumatic tube, pendant lamps, I-beam slabs, parapet, concrete ends) + floor plates |
| `src/pixi/conduits.ts` | cloth cable bundle in riveted tray / copper+verdigris pipes with flanges & dials + risers; colour callbacks draw the overlay highlight; `dripCells` |
| `src/pixi/lifts.ts` | shafts (cached: brass posts, bracing, head house + dial) and cars (per frame: cage, accordion gate, dial needle, drum) |
| `src/pixi/facilityArt.ts` | per-kind facility bodies (static) and live details (CRTs, lamps, reels, fans, needles, knife switch, crates, badges) |
| `src/pixi/pneumatics.ts` | per-tick `jobId` change detection → brass capsules along the floor's tube (decorative) |
| `src/pixi/bots.ts` | 12×12 dome-headed rover, 12×12 rotor drone (`BotDef.flying`, hovers, drawn at a fractional floor while `"flying"`), 14×12 lifter with crate stack (`BotDef.carry > 1`); exposes welding `torches` for effects |
| `src/pixi/feedback.ts` | failure feedback per frame: red strobe + beacon + steam bursts (tripped), wrench + sparks (failed), flames + smoke (failed and hot), dark floors with emergency lamps (net satisfaction 0), flicker (brownout), coolant-leak drips + wet streaks + puddles |
| `src/pixi/arrows.ts` | screen-space edge arrows (2×2 px per arrow pixel) for off-screen alert facilities; `at(sx, sy)` for hover/click |
| `src/pixi/effects.ts` | rack heat shimmer, chiller steam, genset smoke, welding sparks, coolant drips (shimmer/steam/smoke/drips stop under reduced motion) |
| `src/pixi/overlays.ts` | heat / power (amber nets) / coolant (copper-verdigris) overlays; colour-blind satisfaction/load/heat ramps |
| `src/pixi/markers.ts` | cyanotype ghost (valid) / red-stamped "DENIED" ghost (invalid), VT323 price tag, pulsing brass selection brackets |
| `src/pixi/input.ts` | DOM input: right/middle drag, WASD/arrows, wheel zoom, left-button `CellPointerEvent`s; `InputHost.press/over` let screen-space widgets (the alert arrows) consume a left press (and its release) and set a pointer cursor |
| `src/dev/fixtureView.ts` | hand-built fake `SimView` + stub content for the harness/tests |
| `src/dev/varietyScene.ts` | `?scene=variety`: every kind (racks by cooling flavour) × tier 1-4 × widths, one row per floor, plus a failure row, blackout floor, brownout floor, overloaded coolant floor and rover/lifter/drone bots; synthetic defs layered over any base content |
| `dev/index.html`, `dev/main.ts` | dev harness |

## Failure feedback, alert arrows, new bots, rack variety (M2b-T4)
- **Feedback** (`pixi/feedback.ts`, rules in `src/feedback.ts`): tripped = steam burst every ~2.4 s + red strobe/beacon; failed =
  brass wrench + sparks, plus flames and smoke when `tempC >= balance.thermal.tripC - 3` (95 if the content has none);
  floors whose power net has satisfaction 0 are darkened with blinking red emergency lamps, 0 < satisfaction < 1 flickers;
  overloaded coolant nets drip from every conduit cell (drops land on the facility top where one stands below).
  Reduced motion: steady strobe tint, frozen steam cloud, fixed sparks/flames/smoke, steady lamps and dim, hanging drop + puddle.
- **Arrows** (`pixi/arrows.ts`): one per facility with status failed/tripped/unpowered/noCoolant whose rect is fully outside the
  viewport, clamped to the viewport inset by 22 px; arrows within 26 px merge into the worst/nearest (shows `xN`). Colour by severity
  (red / sodium / verdigris; vermilion / orange / blue when colour-blind). Click focuses the camera on the representative facility
  (the press never reaches the tool listeners). Critical arrows pulse; steady under reduced motion.
- **Rack variety**: `unlockTier` 2 = brass cornice + a gauge, 3 = hopper (first and, for width >= 3, last cabinet) + gauges, 4 = pilasters,
  gauges everywhere, hopper(s) and a crest on the second cabinet. Immersion racks draw a glass tank (fluid tinted from `def.accent`)
  with bubbles (fixed under reduced motion). Non-rack kinds get edge trim by tier (rail, plinth, pilasters, finials).
  A non-rack def wider than its native width (`NATIVE_WIDTH`) gets an annex bay; narrower than native is NOT supported (the art would overflow).
- Frame budget: arrows and feedback iterate facilities/alert lists only; particles capped at 400; leaks/lights culled to the viewport.

## Presentation options (`Renderer.setOptions`, M1-T4)
- `renderer.ts` keeps one `Presentation`; `setOptions` is a four-field diff. Only a real change does work: `colorBlind`
  marks the overlay base dirty and `crtEffects` toggles the screen-space overlay. Repeat calls every frame are free.
  Nothing else is cached by option, so per-frame layers read `pres.options` each draw.
- **`reducedMotion`:** decorative motion stops. Frozen: smog drift, star twinkle and searchlight sweep (time held at 0),
  fan blades and ribbon, reels, genset flywheel and flap, UPS bubbles, charger pantograph, CRT flicker, shimmer,
  steam, smoke, drips, badge blink. Hidden: pneumatic capsules (queued, resume when off). Status lamps (rack LEDs,
  lift direction lamp, aircraft lamps, grid-tie lamp) hold lit instead of blinking. Bots, lift cars, welding sparks and
  the selection/ghost pulse still move (game state or not on the list).
- **`crtEffects`:** false hides the scanline + vignette layer and stops the rack CRT flicker (`crt(..., steady)`).
- **`colorBlind`:** heat overlay and rack temperature tint use `HEAT_RAMP_CB` (plasma, same °C stops). Rack LEDs and CRT
  phosphor use blue (ok) / orange (warn) / vermilion (fault) / dim blue (idle). Each CRT carries a 3×3 glyph:
  ✓ ok, ▲ throttled (also brownout and noCoolant), ✕ tripped/failed, ○ idle; nothing for unpowered/disabled.
  Power and coolant overlays use blue (satisfied / light load) to vermilion (unsatisfied / overloaded).
  Other facility lamps (chiller, genset, UPS, grid-tie) keep green/red; only rack status and overlays are remapped.
- **`horrorIntensity`:** stored in `Presentation`, no visual effect until M3.
- Dev harness: `?cb=1&rm=1&crt=0` (any combination) calls `setOptions` once at start.

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
- `npx vitest run packages/render`: pure helpers (alerts, feedback rules, art selection, bot art, camera, colour, colour-blind mapping, interpolation, status cues and
  glyph selection, presentation diff/idempotence, fixture). No WebGL needed.
- Visual: `npx vite packages/render/dev --port 5174`, then
  `node scripts/screenshot.mjs "http://localhost:5174/?overlay=heat" out.png 1280 800 2000`.
  Query params: `overlay=heat|power|coolant`, `minute=1150` (dusk) / `1300` (night), `mpt=0` (freeze the clock),
  `zoom=1..4`, `focus=x,floor`, `select=facility:12`, `ghost=1|bad`, `cb=1` (colour-blind), `rm=1` (reduced motion),
  `crt=0` (CRT effects off), `scene=variety` (art/feedback/bot test scene; combine with `focus=x,floor`, floors 12-15 are failure rows), `real=1` (real content via `loadContent()`;
  the fixture already uses the real colours). Keys 1–4 switch overlay. The fixture cycles rack jobs every 25 ticks
  so capsules fly. Real game: `npx vite apps/web --port 5176`, `?new&seed=7&speed=10[&overlay=heat]`.
