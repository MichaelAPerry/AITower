# M1-T2 — agent-ui: system menu, saves UI, settings, controls help, UX fixes

**Owns:** `packages/ui/**`.

**Read first:**
- `tasks/m1/README.md`
- `packages/ui/AGENTS.md`
- `docs/STYLE.md` (the art bible: everything new must look like the existing control-room HUD)
- `packages/shared/src/index.ts` (the new `Settings`, `SaveSlotInfo`, `SaveStatus` and `GameStore` methods)
- `docs/review/ux-art.md` §1–2.

The real store (`apps/web/src/store.ts`) is being completed in parallel by agent-platform. Build against the contract and
your fake store; make `src/dev/fakeStore.ts` implement the new methods realistically (in-memory slots, async delays).

## 1. System menu (Esc and a MENU button in the top bar)
- **Esc order:** first cancel the armed tool; else clear the selection; else open or close the menu. Keep the existing behaviour for the first two.
- **Pausing:** opening the menu pauses the game (`setSpeed(0)`) and closing it restores the previous speed.
  - While the menu is open, game hotkeys (speed, overlays, demolish) are ignored.
  - Focus is trapped inside the menu, and Esc closes it.
- **Look:** a central bakelite cabinet styled like a Ministry filing drawer, with these sections:
  - **Resume.**
  - **Save game:** the three manual slots plus the read-only autosave. Each shows name, day, cash, tier and when it was saved. You type a name; overwriting asks for confirmation inside the page (no `confirm()`).
  - **Load game:** slots, plus **Import from file** (an `<input type=file>` read with FileReader, then `store.load(text)` inside try/catch, showing the "Invalid save: …" message on failure).
    - **Export to file:** `store.save()` turned into a Blob and an `<a download>` with a dated file name.
  - **Settings:** every field of `Settings`, using the existing Toggle and slider styles. Changes apply live through `store.setSettings`.
  - **Controls:** a list of every key and mouse action, including camera keys (WASD/arrows, right- or middle-drag, wheel).
  - **New game:** with an in-page confirmation.
  - **Restart induction.**
- **Status:** show `saveStatus` with a small "SAVED 12:04" lamp in the top bar and an error toast when `saveStatus.error` changes.

## 2. Settings that the HUD itself must honour
- **`textScale`:** scale the HUD with a CSS variable on `.aitower-hud`. Every panel must stay usable at 0.85 and at 1.5, at 1280×720; fix any overflow.
- **`reducedMotion`:** the same effect as `prefers-reduced-motion`, as a root class.
- **`colorBlind`:** status lamps and pills gain shape or glyph encoding (✓ ok, ▲ throttled, ✕ tripped/failed, ○ idle). The heat legend switches to the colour-blind ramp. Export the ramp as a constant; the renderer agent implements the same stops:
  `#0d0887 → #6a00a8 → #b12a90 → #e16462 → #fca636 → #f0f921` (plasma).
- **`crtEffects` off:** removes scanlines and flicker from HUD CRTs.

## 3. Ghost validation
Use `store.canBuild(cmd)` in the tool controller for slab, conduit and lift ghosts, replacing the client-side estimates. Keep the cost label. Update the controller tests.

## 4. UX fixes from the review
- **Palette cards:** descriptions are truncated ("drag vertic"). Fix them at 1280 and 1440 widths without hiding information; the spec sheet can stay for full detail.
- **Overlay switcher:** it covers the lowest floors. Make it compact and collapsible, or move it so it doesn't cover the world's bottom rows.
- **Small screens:** under 1024 px wide or 640 px tall, show a dismissible "best on desktop" memo when `settings.showDesktopNotice`. Its checkbox sets the setting to false.

## Tests
- Pure-logic tests: Esc state machine, menu pause and restore, save-slot list formatting, settings to CSS variables.
- Controller tests now use `canBuild`.
- Keep the Hud SSR smoke test passing.
- Screenshot the dev harness: menu open on each section, a settings change at text scale 1.5, colour-blind on, and the small-screen notice. Save them to `/tmp/claude-0/-home-user-AITower/a7f75a3b-71cb-517d-a9c2-dde0cac086fa/scratchpad/m1-ui/` using `node scripts/screenshot.mjs <url> <png> <w> <h> <waitMs>`, and look at every screenshot.
