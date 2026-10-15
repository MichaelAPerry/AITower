# @aitower/ui — HUD, telemetry panels, tool controller

React 19 HUD drawn over the world canvas, plus a pure tool controller. Imports only `sim`, `content`,
`shared`, `react`, `react-dom` (enforced by `scripts/check-boundaries.mjs`).

## Public API (`src/index.ts`)
- `Hud({ store, content })`: the whole HUD. Root `.aitower-hud` is `position:absolute; inset:0;
  pointer-events:none`, so mount it in a full-screen host over the canvas. Only the panels take pointer events.
- `createToolController(store, content, opts?) → { handle(e), cancel() }`: pure (no React, no DOM).
  Feed it every `CellPointerEvent` from the renderer.
- Helpers: `fmtMoney/fmtPower/fmtTemp/fmtPct/fmtPflops/fmtDuration/fmtPue`, `describeEvent`, `pickAt`,
  `slabSpan/lPath/liftSpan`, `keyAction`, `pushNotice/onNotice`.

## Files
- `Hud.tsx`: layout grid, HUD-local UI state (bottom tab, collapsed state, focused job), tool hint. Imports `ui.css`.
- `hooks.ts`: `useGameState` (useSyncExternalStore). View-only churn is throttled to 10 Hz; changes to
  speed, tool, overlay, selection or mute re-render at once.
- `keyboard.ts`: pure `keyAction` map plus the `useHudKeyboard` hook. It does not use WASD or the arrow
  keys, because the renderer uses them for the camera.
- `tools/controller.ts`, `tools/geometry.ts`, `tools/pick.ts`: tool logic, span/path geometry, selection picking.
- `events.ts`: SimEvent → text, severity, focus cell and whether to toast; plus coalescing keys.
- `notices.ts`: module-level bus. The controller and HUD buttons push rejection reasons here, and `<Toasts>` shows them.
- `components/`: TopBar (with PueGauge), BuildPalette, OverlaySwitcher (with legends), Inspector
  (with TempBar and net summaries), BottomPanel (Contracts/Jobs/Telemetry/Finance/Alerts), Sparkline,
  Toasts, common (Pill/Meter/Swatch/Icon/Row/Kbd).
- `dev/fakeStore.ts`: a fake GameStore with a hand-built SimView and local content fixture. It is for
  development and tests only and is not exported.
- `dev/` (package root): Vite harness. Run `npx vite packages/ui/dev --port 5175`, then
  `node scripts/screenshot.mjs http://localhost:5175 out.png 1440 900 1500`.
  Query params: `?tab=jobs|telemetry|finance|alerts`, `?overlay=heat`, `?sel=<facilityId>|bot|lift|none`,
  `?tool=<defId>`.

## Invariants
- The UI only emits `SimCommand`s through `store.dispatch`. It reads every number from `SimView` or `ContentDB`.
- `store.get()` must return the same object until something changes, and a new object on every change
  (useSyncExternalStore). The app must build a fresh `GameState` each frame that the view changes.
- Toasts read `state.log` through a cursor of (tick, count at that tick). Entries present at mount are never
  toasted, and a tick that goes backwards (load or new game) resets the cursor.
- Tools stay active after use. A left click or drag runs the tool. A right-button click (down and up on the
  same cell, not a pan) and Esc return to Select.
- Demolish ghosts are `valid:false` on purpose, so the renderer draws them red.
- Ghost validity for slab, conduit and lift is a client-side estimate (bounds, cash, slab below or under the
  shaft). The sim has the final word, and rejections are toasted.

## Test
`npx vitest run packages/ui`: controller (each tool, L-path, span normalisation, picking, rejections),
format helpers, keyboard map, and a Hud server-render smoke test.
