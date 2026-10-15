# T6 — agent-ui: Cassette-futurism HUD pass

**Owns:** `packages/ui/**` only. **Must read first:** `docs/STYLE.md` (the art bible: rules, palette tokens, fonts), then
`packages/ui/AGENTS.md` and the existing components and `ui.css`.

## Goal
Re-skin the whole HUD as 1980s control-room hardware, following `docs/STYLE.md` §1 ("UI & HUD"), §2 and §3. Keep the
component structure, the store and tool-controller logic, the keyboard shortcuts and the exported API unchanged. This is
a visual pass, not a rewrite. The behaviour tests must keep passing.

## Checklist (each item must be visibly true in screenshots)
- **Palette and fonts:** all colours are CSS custom properties named after the STYLE.md tokens.
  - Fonts: `"VT323"` for numbers and readouts, `"Special Elite"` for typewritten labels, headings and memos,
    `"Silkscreen"` for tiny stamped labels and buttons, each with a monospace fallback.
  - The app loads the fonts. In your dev harness, import `@fontsource/vt323`, `@fontsource/special-elite` and
    `@fontsource/silkscreen` (installed at the repo root).
- **Panels** are bevelled bakelite/enamel housings (dark olive-brown/charcoal) with corner screws and Dymo-tape or
  typewritten title labels, e.g. "FORM AT-7 · CONTRACT REQUISITION" or "DEPT. OF PROVISIONING".
- **CRT screens:** readouts sit inside inset CRT screens with phosphor glow (`text-shadow`), faint scanlines
  (repeating-linear-gradient) and a curved inner shadow.
  - Amber phosphor is the default for data; green for OK/status; red for alarms.
  - A subtle flicker animation is allowed, but respect `prefers-reduced-motion`.
- **Analog needle gauges** (SVG): cream dial face, black ticks, red needle, brass bezel; the needle eases with a slight
  overshoot.
  - Required: **PUE** (replace the semicircle), **IT load kW** against total, and **cash flow** (today's net).
  - Small round dials or a needle meter for temperature in the inspector.
- **Mechanical toggle switches** (CSS/SVG lever with ON/OFF engraving) for the overlay selector (N/H/P/C), mute, panel
  collapse and the facility enable/disable control.
- **Speed control:** chunky lit push-buttons (⏸ 1× 3× 10× 30×) with a pressed state.
- **Build palette:** items as index cards or punch cards; the lock state is a "RESTRICTED" rubber stamp; cost is typed.
- **Contracts and jobs:**
  - Contract rows look like requisition forms; Accept/Decline are rubber stamps ("APPROVED"/"DENIED") on hover and click.
  - Job progress is a mechanical counter or segmented VU bar.
- **Toasts:** teletype or memo slips, typewritten, with a stamp ("URGENT", "NOTICE", "COMMENDATION").
- **Sparklines:** drawn as green-phosphor oscilloscope traces on a graticule.
- **Legibility:** it must stay readable at 1280×720. VT323 needs ≥ 18 px for primary numbers and ≥ 15 px for body text,
  and contrast stays high. Bureaucratic copy must not obscure the actual numbers.

## Verify
- Dev harness: `npx vite packages/ui/dev --port 5175`. Also check the **real game**: `npx vite apps/web --port 5177`,
  then `?new&seed=7&speed=10`.
- Screenshot with `node scripts/screenshot.mjs <url> <scratch>/hud/<name>.png 1440 900 3000` (and 1280×720), look at
  each one, and iterate until it is clearly on-style and readable.
  Scratch dir: /tmp/claude-0/-home-user-AITower/a7f75a3b-71cb-517d-a9c2-dde0cac086fa/scratchpad/hud/
- `npm run typecheck`, `npm run check:boundaries` and `npx vitest run packages/ui` must pass.
- Kill your dev servers when done. Do not commit. Don't touch other packages; the render agent is restyling
  `packages/render` in parallel.
- Update `packages/ui/AGENTS.md`.

Report: what changed, screenshot paths, anything you couldn't do.
