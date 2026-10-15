# T2 — agent-render: Renderer & visual system

**Owns:** `packages/render/**`. **Reads:** `docs/ARCHITECTURE.md` §10, `packages/shared/src/index.ts`
(`Renderer`, `CreateRenderer`, `Ghost`, `OverlayMode`, `Selection`, `CellPointerEvent`), `packages/sim/src/api.ts`
(`SimView` & friends), `packages/content/src/schema.ts` (`FacilityDef.color/accent/width/kind`).

## Goal
Export `createRenderer: CreateRenderer` from `packages/render/src/index.ts` using **PixiJS v8**
(`pixi.js` is installed). It renders a read-only `SimView`; it never mutates sim state and never imports ui/app.

## Visual spec — 2D side-cut pixel art (SimTower cross-section)
- World units: 1 tile = 16 px wide, 1 floor = 48 px tall (3 tiles). Floor 0 is ground level; basements below
  draw on earth background. Camera zoom in integer steps (1×,2×,3×,4×) with nearest-neighbour scaling
  (`roundPixels`, `antialias: false`) so it stays crisp pixel art.
- Programmer pixel art drawn with Pixi `Graphics` (no image files). Cache static geometry; rebuild only
  what changed (hash slab/conduit arrays or compare by reference + facility list length/ids).
- Layers (back→front): sky gradient tied to `minuteOfDay` (dawn/day/dusk/night + a few stars at night) and
  a distant city silhouette → earth below ground → slabs (concrete floor line + faint wall panels where a
  floor exists) → conduits (power = yellow/orange cable along floor bottom, coolant = blue/red pipe pair
  along ceiling; vertical runs drawn as risers) → lift shafts & cars → facilities → bots → effects → ghost →
  selection outline.
- **Facilities** drawn from `def.color` / `def.accent`, width `def.width` tiles, height ~ floor minus slab:
  - racks: cabinet with a column of tiny **status LEDs** that blink (green ok, amber throttled, red tripped/
    failed, blue idle, off when unpowered); DLC racks show pipe stubs; storage racks show drive bays;
    a small fan/heat shimmer above racks proportional to `heatKw`.
  - crah: louvred unit with spinning fan when it is removing heat; chiller: big unit with fan + pipes;
    cdu: pump box; grid_tie: transformer with HV insulators; genset: engine box, exhaust puff when `running`;
    ups: battery bank with charge bar (`charge`); depot: shelves with `stored` parts; charger: dock pad.
  - status badges: small icon above facility for failed (wrench), noCoolant (blue drop crossed), unpowered
    (bolt crossed).
- **Lifts**: shaft column for its span, car rectangle at `carFloor` (interpolate between view frames using
  `alpha` — keep last two views per lift/bot id), doors drawn open when `doorsOpen`.
- **Bots**: 10×10 px rovers in `BotDef.color`, wheel animation when moving, carry box when `carrying`, spark
  particles while `repairing`, battery pip. Interpolate positions with `alpha`.
- **Overlays** (`setOverlay`):
  - `heat`: per-cell colour ramp over `airTemp` (≤18 °C blue → 27 green/yellow → 35+ red → 45+ white-hot),
    semi-transparent, plus each rack tinted by `tempC`; add legend-free subtle animated shimmer on hot cells.
  - `power`: dim world, highlight power conduits coloured per `powerNetOf` net; tint facilities by their
    net's `satisfaction` (green 1 → red 0).
  - `coolant`: highlight coolant conduits per net; tint by `loadKw/capacityKw`.
- **Ghost** (`setGhost`): translucent cells (green valid / red invalid); if `defId` given, draw that
  facility's silhouette at `cells[0]`. **Selection**: pulsing outline around the selected facility/bot/lift.
- **Camera**: pan with right- or middle-mouse drag and WASD/arrow keys; wheel = zoom toward cursor; clamp to
  world bounds + margin; `focus(cell)` centres. Start centred on floor 0.
- **Pointer** (`onPointer`): convert screen → world cell (`{x, floor}` or `null` outside the grid) and emit
  `down/move/up/leave` with `button` and `shift` (left button only for tools; right/middle are camera).
- `resize(w,h)`; `destroy()` cleans up the Pixi app and listeners. `createRenderer(host, content)` appends its
  canvas to `host` and resolves once Pixi's async `init` finishes.

## Dev harness (required)
`packages/render/dev/index.html` + `packages/render/dev/main.ts` that renders a hand-built fake `SimView`
(`packages/render/src/dev/fixtureView.ts`: ~48×13 grid, a few floors of slab, conduits, 8 racks in mixed states,
crah, chiller, cdu, grid tie, genset, ups, depot, charger, a lift moving, 2 bots moving) and animates it
(advance minuteOfDay, move bots/lift car). Keyboard `1–4` switch overlays. Serve with
`npx vite packages/render/dev --port 5174` and capture with
`node scripts/screenshot.mjs http://localhost:5174 <scratch>/render.png 1280 800 2000`.
Look at the screenshots (normal + heat overlay) and iterate until it looks like a clean, readable pixel-art
cross-section. Keep the dev server process in the background and kill it when done.

The fixture should import facility defs only as type; build a tiny local `ContentDB`-shaped object for the
facilities it uses (content data is being written in parallel).

## Tests
Unit-test the pure parts (vitest, node env): screen↔cell math for several zooms/pans, colour ramps, and
interpolation helpers. Keep Pixi-dependent code separated from pure helpers so tests don't need WebGL.

## Done when
typecheck + boundaries + tests pass; screenshots look good; `packages/render/AGENTS.md` documents files,
layer order and perf notes. Report what you built, screenshot paths, deviations and contract proposals.
