# T3 — agent-ui: HUD, tools & telemetry (React)

**Owns:** `packages/ui/**`. **Reads:** `docs/ARCHITECTURE.md` §11, `packages/shared/src/index.ts`
(`GameStore`, `GameState`, `Tool`, `Selection`, `Ghost`, `CellPointerEvent`, `OverlayMode`, `Speed`),
`packages/sim/src/api.ts` (`SimView`, `SimCommand`, `SimEvent`), `packages/content/src/schema.ts`.

## Goal
Replace the placeholder `packages/ui/src/index.ts` with real exports (keep these names; `Hud` becomes a React
component):
- `Hud(props: { store: GameStore; content: ContentDB })` — the whole HUD, absolutely positioned over a canvas
  the app renders underneath (`pointer-events: none` on empty areas so the canvas still receives input).
- `createToolController(store, content): ToolController` — pure logic (no React, no DOM) turning
  `CellPointerEvent`s into ghosts (`store.setGhost`) and `SimCommand`s (`store.dispatch`).
- Keep `HudProps`, `ToolController` exported. Use `useSyncExternalStore` against `store.subscribe/get`.
Styling: plain CSS in a single `ui.css` (imported by the Hud module) or CSS-in-TS; dark "datacenter ops"
look — near-black panels, thin cyan/green accents, monospace numerals, pixel-ish font fallback
(`ui-monospace`). No external UI libraries or fonts.

## Tool controller behaviour
- `select`: click a cell → select facility at that cell, else bot nearest (≤1 tile), else lift, else none.
- `place {defId}`: ghost = def footprint at hovered cell, `valid` from `store.canPlace`; click places.
  Shift-click keeps the tool active (default: also stays active — like SimTower; Esc/right-click returns to
  select, handled by Hud keyboard).
- `slab`: drag horizontally on one floor → ghost span → `buildSlab` on release.
- `conduit {layer}`: drag → L-shaped path (horizontal first, then vertical) → `buildConduit` with all cells.
- `lift`: drag vertically on a column → `buildLift`.
- `demolish`: click → `demolish`; drag = multiple.
- Show reasons: when `dispatch` returns `{ok:false}` or a `commandRejected` event arrives, surface a toast.

## HUD layout
- **Top bar**: day + clock (`clock()` helper), speed buttons (⏸ 1× 3× 10× 30×, keys Space/1–5), cash
  (red when negative), **PUE gauge** (semicircle, 1.0 green → 2.0 red), IT kW / total kW, PFLOPS, uptime %,
  Tier ★, ambient °C, mute toggle.
- **Left build palette**: tabs Structure (Slab, Power conduit, Coolant conduit, Lift, Demolish), Racks,
  Power, Cooling, Logistics — listing `content.facilities` by `category`, showing name, cost, kW, PFLOPS,
  lock icon if `unlockTier > view.tier`, disabled if cash < cost. Hover tooltip with description and specs.
  Buttons: buy spare part ×5, buy bot.
- **Overlay switcher**: Normal / Heat / Power / Coolant (keys H, P, C, N) — with a legend for heat ramp.
- **Right inspector** for the selection: facility (name, status pill, temp with mini bar vs ok/throttle/trip,
  clock %, health, power, heat, job link, net ids, enable/disable toggle, demolish button); bot (state,
  battery, work order); lift (floors, riders). Power net & coolant net summaries for the facility's nets.
- **Bottom panel** (collapsible) with tabs:
  - *Contracts*: offers (client, kind, size, deadline, payout, needs liquid, storage) with Accept/Decline,
    countdown to expiry.
  - *Jobs*: progress bars, PFLOPS, racks, deadline, status; cancel.
  - *Telemetry*: sparklines from `view.history` (PUE, IT kW, PFLOPS, cash, max rack °C) — hand-rolled SVG.
  - *Finance*: ledger table of last days + today.
  - *Alerts*: recent `store.get().log` events in human words, coloured by severity; click focuses the cell
    (`store.focus`) when the event refers to a facility.
- Toasts for important events (rackTripped, componentFailed, powerShortfall, jobCompleted, tierUp, bankrupt).

## Dev harness (required)
`packages/ui/dev/index.html` + `main.tsx`: a **fake GameStore** backed by a hand-built `SimView` fixture
(`packages/ui/src/dev/fakeStore.ts`; import content types only and craft a small local facility list —
real content data is being written in parallel). Animate a few numbers on a timer so the HUD looks alive;
draw a dark placeholder rectangle where the canvas would be. Serve with
`npx vite packages/ui/dev --port 5175` (create a tiny `vite.config.ts` in `packages/ui/dev` using
`@vitejs/plugin-react` and aliases to `packages/*/src/index.ts` like the root `vitest.config.ts`), and capture
`node scripts/screenshot.mjs http://localhost:5175 <scratch>/ui.png 1440 900 1500`. Iterate on the screenshots
until it is clean and readable. Kill the dev server when done.

## Tests (vitest, node)
Tool controller: ghosts and emitted commands for each tool (L-path cells, slab span normalisation when
dragging right→left, lift span), selection picking. Formatting helpers ($ with k/M suffix, kW/MW, °C).

## Done when
typecheck + boundaries + tests pass; screenshots look good; `packages/ui/AGENTS.md` written. Report what you
built, screenshot paths, deviations and contract proposals.
