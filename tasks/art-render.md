# T5 — agent-render: Cassette-futurism art pass (world renderer)

**Owns:** `packages/render/**` only. **Must read first:** `docs/STYLE.md` (the art bible: rules, palette tokens, fonts), then
`packages/render/AGENTS.md` and the existing `src/pixi/*`.

## Goal
Re-skin everything the renderer draws to the *Brazil* / *Mind Scanners* cassette-futurism pixel-art direction in
`docs/STYLE.md` §1, §2 and §4. Keep the existing architecture, caching, layer order, interpolation, camera, input and the
`Renderer` contract unchanged. This is an art pass, not a rewrite.

## Checklist (each item must be visibly true in screenshots)
- **Palette:** all colours come from the STYLE.md tokens (put them in one `palette.ts`). Facility body and accent colours
  still come from `FacilityDef.color` / `accent`; they have been updated to brass, putty and olive values.
- **Mainframe racks:** enamel cabinet, riveted brass corners, nameplate, punch-card slot, a **flickering CRT telemetry
  panel** with scanlines and a scrolling bar-graph coloured by status, and round indicator lamps with glow.
  - DLC racks: side copper manifold with valves.
  - Storage racks: tape reels that spin while powered.
- **Cooling and logistics hardware**, per STYLE.md:
  - Air handler: zip-tied fans that spin.
  - Chiller: riveted tank, copper coils and a **steam vent** that puffs proportional to its `heatKw`.
  - CDU: brass valve wheels.
  - Grid intake: porcelain insulators and a knife switch.
  - Genset: green diesel with an exhaust stack that smokes when `running`.
  - Accumulator bank: glass jars with an analog charge needle (from `charge`).
  - Depot: wire cage with stamped crates showing the `stored` count.
  - Charger: brass dock.
- **Conduits:**
  - Power: cloth-wrapped cable bundle in a riveted tray on ceramic standoffs.
  - Coolant: exposed **copper supply plus verdigris return pipes** with flanges and small pressure dials at intervals.
  - Risers are drawn to match.
- **Pneumatic tubes:** a brass tube along each built floor's ceiling, with capsules that zip toward racks whose `jobId`
  changed or became non-null. Detect the change in the renderer; this is purely decorative.
- **Lifts:** open cage, accordion gate when the doors are closed, brass frame, and a dial floor indicator at the shaft top.
- **Bots:** squat dome-headed automatons with one eye and treads, a carried crate and welding sparks while `repairing`.
- **World:**
  - Institutional green-grey tiled walls with a dark wainscot and ceiling ducts; slabs drawn as riveted I-beams.
  - Smoggy sky: dirty teal day, sodium dusk, brown-black night with sweeping searchlights; brutalist skyline with
    aircraft lamps and a "MINISTRY" sign.
  - Dark soil with old pipes underground.
  - Optional faint scanline/vignette (≤ 8% opacity) that never hurts legibility.
- **Overlays:**
  - Heat uses the STYLE.md ramp.
  - Power and coolant overlays use amber and copper-verdigris highlights.
  - The ghost uses a blueprint/cyanotype look (valid) or red-stamped (invalid).
  - Selection is a pulsing brass bracket.
- **Text in the world** (ghost label, depot count, floor numbers): use `"VT323"`. Add floor numbers on the left wall,
  styled as stencilled plates ("F1", "B1"). The app loads the fonts before creating the renderer; in your dev harness,
  import `@fontsource/vt323` (installed at the repo root) and await `document.fonts.load` before init.

## Verify
- Dev harness: `npx vite packages/render/dev --port 5174`. Also check the **real game**: `npx vite apps/web --port 5176`,
  then `?new&seed=7&speed=10` and `&overlay=heat`.
- Screenshot with `node scripts/screenshot.mjs <url> <scratch>/art/<name>.png 1440 900 3000`, look at each one, and
  iterate until it is clearly on-style and still readable.
  Scratch dir: /tmp/claude-0/-home-user-AITower/a7f75a3b-71cb-517d-a9c2-dde0cac086fa/scratchpad/art/
- Capture day, dusk (`?minute=1150` in the harness), night, the heat overlay, a zoom-1 overview and a zoom-4 close-up of
  racks and bots.
- `npm run typecheck`, `npm run check:boundaries` and `npx vitest run packages/render` must pass.
- Kill your dev servers when done. Do not commit. Don't touch other packages; the HUD agent is restyling `packages/ui` in parallel.
- Update `packages/render/AGENTS.md`.

Report: what changed, screenshot paths, anything you couldn't do.
