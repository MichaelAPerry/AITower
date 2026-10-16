# M1-T4 — agent-render: presentation options (`Renderer.setOptions`)

**Owns:** `packages/render/**`.

**Read first:**
- `tasks/m1/README.md`
- `packages/render/AGENTS.md`
- `packages/shared/src/index.ts` (`RenderOptions`, `Renderer.setOptions`)
- `packages/render/src/palette.ts`, `color.ts` and `pixi/renderer.ts` (there is a placeholder `setOptions` marked "M1-T4").

## Implement `setOptions(o: RenderOptions)`
It must be cheap and idempotent: calling it every frame with the same values does nothing expensive.

- **`reducedMotion`:**
  - Freeze or stop non-essential animation: CRT flicker, heat shimmer, smog drift, searchlight sweep, steam and smoke puffs, drips, fan spin and pneumatic capsules.
  - Keep essential state readable: bots and lift cars still move (they are game state), and status lamps show a steady colour instead of blinking.
- **`crtEffects`:** when false, hide the scanline and vignette screen overlay and stop the rack CRT flicker.
- **`colorBlind`:**
  - Switch the heat ramp (heat overlay and rack temperature tint) to plasma: `#0d0887 → #6a00a8 → #b12a90 → #e16462 → #fca636 → #f0f921`, at the same °C stops as the current ramp.
  - Rack status LEDs and CRTs use a blue/orange scheme instead of green/red, plus a 3×3-pixel glyph on each CRT: ✓ ok, ▲ throttled, ✕ tripped/failed, ○ idle.
  - Power and coolant overlays use blue/orange for satisfaction and load.
- **`horrorIntensity`:** store it and expose a getter for future use (M3). No visual change yet.

## Requirements
- **Purity and tests:** keep ramps and status colours as pure functions in `color.ts` / `palette.ts`, taking the colour-blind flag. Unit-test them: stops, endpoints, the colour-blind mapping, and that glyph selection matches status.
- **No rebuild on repeat calls:** cached layers that depend on options must invalidate only when an option actually changes.
- **Dev harness:** add `?cb=1&rm=1&crt=0` query flags to the harness. Take screenshots with
  `node scripts/screenshot.mjs "http://localhost:5174/?overlay=heat&cb=1" <png> 1440 900 2500` (serve the harness with `npx vite packages/render/dev --port 5174`).
  - Capture normal and heat overlay, each with colour-blind on and off, and one shot with CRT effects off.
  - Save them to `/tmp/claude-0/-home-user-AITower/a7f75a3b-71cb-517d-a9c2-dde0cac086fa/scratchpad/m1-render/` and look at each one.
- **Before finishing:** `npm run typecheck`, `npm run check:boundaries` and the whole `npx vitest run` must pass. Update `packages/render/AGENTS.md`.
