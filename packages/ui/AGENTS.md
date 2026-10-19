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
- Settings and menu helpers: `HEAT_RAMP_COLORBLIND` (the six plasma stops the renderer mirrors, at 18/24/30/36/42/50 °C via
  `HEAT_RAMP_TEMPS`), `heatRamp(colorBlind)`, `hudScale`, `settingsToCssVars`, `settingsToClasses`,
  `createMenuController`, `escapeStep`.

## Files
- `Hud.tsx`: layout grid, HUD-local UI state (bottom tab, collapsed state, focused job), tool hint, the menu controller,
  the settings classes/variables on the root, the save-error toast and the small-screen notice. Imports `ui.css`.
- `settings.ts`: pure Settings → HUD mappings (`--hud-scale`, root classes, heat ramps, density from the effective size,
  `isSmallScreen`).
- `menu/`: the system menu (`SystemMenu.tsx` shell, rail and focus trap; `panes.tsx` the five drawers; `parts.tsx`
  StampBtn/Slider/ConfirmBar; `menu.css`). Pure parts: `escape.ts` (Esc order), `menuController.ts` (open/close + pause/restore),
  `slots.ts` (slot rows, time/date text, save lamp, export file name, import error text), `controls.ts` (the key list),
  `focus.ts`, `fileIO.ts` (Blob download, FileReader import with try/catch), `useSaves.ts`.
- `title/`: the title screen (`TitleScreen.tsx`, `title.css`; pure `titleState.ts`: `showTitleAtBoot(search)`, `titleItems(saves)`, `startGame`).
  Shown at boot over a paused game unless the URL has `?new` (the e2e smoke test needs that). `<Hud title>` overrides it (the dev
  harness uses `?title=1`; SSR tests have no `location`, so no title). Only Continue, New game and Load leave it; Esc does nothing.
  The system menu opened from it has only Load, Settings and Controls (`SystemMenu fromTitle`) and calls `onReplaced` after a load.
- `memo/`: the Ministry memo desk. `memoDesk.ts` (pure: countdown, default stamp, standing tone, modifier chips, history rows),
  `MemoDesk.tsx` (`MemoCard`, `MemoPop` slip, `MemoDrawer` inbox + history, `InboxButton`, `StandingMeter`, `ModifierChips`), `memo.css`.
  `resolveMemo` is queued by the sim until the next tick, so a stamped memo is hidden at once (`ui.stamped`) and the player is told
  it is filed when the clock runs. Outcome toasts come from the `memoResolved` event (`events.ts` reads `memoHistory`).
- `gameover/`: `gameOver.ts` (pure: `gameOverToShow`/`keepDismissed` give once-only, stats, copy), `GameOverScreen.tsx`. Bankrupt and
  shutdown are final (Load game / New game); victory has Continue in sandbox. Pauses once when it appears.
- `tutorial/`: `steps.ts` (data + predicates), `Tutorial.tsx`, `clock.ts` (`applyClock`: pause on entry, run at 3x only for steps
  with `clock: "run"`, applied on mode change only), `placement.ts` (`pickCorner`: the memo moves away from the highlighted element).
  Highlights use `data-tut` hooks (`speed-3`, `tab-rack`, `card-<defId>`, `btab-contracts`, `accept`, `overlay-heat`, `inbox`, `standing`)
  and the attribute `data-tut-target` (never a class: React rewrites className). Closing the induction restarts a stopped clock at 1x.
- `research/`: the Department of Research. `tech.ts` (pure: `nodeState` researched/available/poor/locked with reason, `effectText` perks as "−10 % failure rate",
  `unlocksFor` scans `content.facilities`/`bots` for `tech`, `cheapestAvailable`, `techGate` = "Requires research: <name>" for the build palette and bot shop),
  `ResearchSheet.tsx` (full screen, five branch columns of index cards, RESEARCH dispatches `{type:"research"}`), `research.css` (also the top-bar button and palette gating styles).
  **R** toggles it; the Hud holds it in a `createMenuController` (pauses on open, restores the speed on close, like the menu). While open `runKey` ignores every key except Esc and R.
  The top-bar research button shares a column (`.ui-deskcol`) with the inbox so the bar keeps its width (measured at 1280 and 1280×1.5).
- `clerk/`: Contracts Clerk. `clerk.ts` (pure: `clerkVerdict` = would the clerk take this offer, with the reason; `toggleKind` never empties the list; `parseAmount`),
  `ClerkPanel.tsx` (top of the Contracts tab: hire-me slip while locked, standing-order form once unlocked; every change dispatches `setClerk`, built on the
  policy read from the store at that moment). Offer rows get a `$/PF·h` column and a "Clerk will take it / skips: why / is off" line.
- `finance/`: `finance.ts` (pure: `ledgerNet`/`ledgerCosts` include taxes, interest and fees; loan presets 25 %/50 %/ALL of the headroom or principal; audit copy;
  `lifetimeRows`), `FinanceTab.tsx` (sections Ledger, Credit Office, Audits, Record; `ui.financeTab`), `AuditSheet.tsx` (modal QUARTERLY AUDIT: figures, grade stamp,
  standing and cash change, remark; does NOT pause; button or Esc closes; game hotkeys still work), `auditTrigger.ts` (log cursor: a sheet pops once per
  `quarterReport` that arrives after mount, never for entries already in the log or after a load), `finance.css`.
- CSS for these three folders is imported by `Hud.tsx` after `ui.css`, so it can refine ui.css base rules at equal specificity.
- `hooks.ts`: `useGameState` (useSyncExternalStore). View-only churn is throttled to 10 Hz; changes to
  speed, tool, overlay, selection or mute re-render at once.
- `keyboard.ts`: pure `keyAction` map, `runKey` (the testable dispatcher) and the `useHudKeyboard` hook. It does not use
  WASD or the arrow keys, because the renderer uses them for the camera. While the menu is open `runKey` ignores every
  key except Esc. `R` opens/closes the research sheet (`KeyEnv.research`); `KeyEnv.audit` lets Esc close the audit sheet.
- `tools/controller.ts`, `tools/geometry.ts`, `tools/pick.ts`: tool logic, span/path geometry, selection picking.
- `events.ts`: SimEvent → text, severity, focus cell and whether to toast; plus coalescing keys.
- `notices.ts`: module-level bus. The controller and HUD buttons push rejection reasons here, and `<Toasts>` shows them.
- `components/`: TopBar (speed push-buttons, CRT readouts, PUE / IT-load / net-today gauges, MENU button + save lamp),
  BuildPalette (index cards), OverlaySwitcher (compact, foldable strip at the top of the world + CRT legends),
  DesktopNotice ("best on desktop" memo), Inspector (TempBar = temperature dial,
  net summaries, MAINS toggle), BottomPanel (Contracts form / Jobs CRT / Telemetry scopes / Finance
  printout / Alerts teletype), Sparkline (oscilloscope trace), Toasts (memo slips), PueGauge (also the
  generic `Gauge` = Dial + Dymo label + CRT readout), Dial (SVG needle gauge, `niceMax`), common
  (Pill/Meter/Swatch/Icon/Row/Kbd plus the hardware primitives Crt/Lamp/Toggle/Stamp/Counter/FormLabel).
- `dev/walk.ts`: test helpers (no DOM here): call hook-free function components directly, walk the returned element tree, find a control by text/title/`rest`
  and call its handler; `panelProps()` builds `PanelProps`. `m2b.test.tsx` uses them for the research, clerk, finance, audit and key tests.
- `dev/fakeStore.ts`: a fake GameStore with a hand-built SimView and local content fixture (11 tech nodes `FAKE_TECH`, a gated chiller and a gated drone bot, a loan,
  a filed audit, lifetime stats; it implements research / setClerk / takeLoan / repayLoan like the sim, plus `fileQuarterReport`, `unlockClerk`, `addResearchPoints`). It is for
  development and tests only and is not exported. `canBuild` mirrors the sim's structure rules and reason wording;
  `dev/fakeSaves.ts` gives it in-memory async save slots, export/import text and `newGame`.
- `dev/` (package root): Vite harness. Run `npx vite packages/ui/dev --port 5175`, then
  `node scripts/screenshot.mjs http://localhost:5175 out.png 1440 900 1500`.
  Extra params: `?title=1` (&`saves=0` for a first visit), `?memo=N` (&`hist=1`), `?standing=N`, `?mod=1`, `?over=bankrupt|shutdown|victory`,
  `?tut=<step id>|none`, `?toasts=0`. The fake store has `issueMemo`, `setStanding`, `addModifier`, `triggerGameOver`.
  M2b params: `?clerk=1|on` (clerk hired, or switched on with limits), `?rp=N` research points, `?research=1` opens the sheet, `?audit=A..E` files an audit
  after load, `?fin=credit|audits|record` (with `?tab=finance`).
  Query params: `?tab=jobs|telemetry|finance|alerts`, `?overlay=heat`, `?sel=<facilityId>|bot|lift|none`,
  `?tool=<defId>`, `?menu=save|load|settings|controls|new` (opens the menu on that drawer), `?scale=0.85..1.5`, `?cb=1`,
  `?crt=0`, `?motion=1`, `?notice=0`. `window.__store` exposes the fake store to probe scripts. The harness imports the
  three `@fontsource` fonts itself. A long-running vite may serve stale CSS; restart it (by the node PID) if edits do not show.

## Art direction (docs/STYLE.md §1–3)
Cassette-futurist control-room hardware. `ui.css` defines every STYLE.md §2 token as a custom property on
`.aitower-hud` (`--ink`, `--housing`, … `--smog`, plus `--heat-18…--heat-50`), and rules use only those
tokens or `color-mix()` of them, never raw hex. Fonts are `--f-crt` (VT323: numbers and readouts, ≥ 18 px
for primary numbers, ≥ 15 px for body), `--f-type` (Special Elite: labels, forms, memos) and `--f-stamp`
(Silkscreen at 8 px: Dymo tape, tags, buttons). `apps/web` loads the fonts and so does the dev harness.
- Housings: `.ui-panel` is bevelled bakelite with four slotted screws drawn by `::after`. Keep about 12 px
  of padding clear in the corners.
- Readouts sit in `.ui-crt` (`crt-amber` is the default for data, `crt-green` for OK, `crt-red` for alarms).
  Inside a CRT, `--ph`, `--ph-lo` and `--ph-grid` give the phosphor, its dim tone and the grid colour;
  `.ui-label`, `.ui-k` and `.ui-dim` pick them up. Scanlines and flicker come from `::after`.
- Paper surfaces (cards, forms, memos, spec sheets, the ledger) use `--paper` with ink text. Tone classes
  are remapped to ink colours inside `.ui-form`.
- Motion: CRT flicker, lamp blink, needle overshoot (`.ui-dial-needle` transition), lever flip and the
  teletype toast reveal are all switched off under `prefers-reduced-motion`.
- Layout budget: the top bar fits at 1280 px (and at 1280 with text scale 1.5) only because the brand plate and grid price hide below
  1800 px, the outside temperature below 1640 px, the clearance lamps and the audio toggle at the tight density, and the standing
  meter and inbox shrink with the density; `is-density-tight` also compacts gaps and dials, and the induction button lives in the menu.
  Measure `.ui-topbar` (scrollWidth vs clientWidth) after adding anything to it, at 1280 and at text scale 1.5.
- Settings the HUD honours (all driven from `state.settings` in `Hud.tsx`): `textScale` sets `--hud-scale` and the root uses
  `zoom: var(--hud-scale)`, so every px size scales; `vh` units inside the HUD must divide by `--hud-scale`, and fixed
  positions computed from `getBoundingClientRect` must divide by the scale (`tooltipTop`). `is-density-tight|cramped`
  (from effective size = viewport / scale) hide dials, the tier lamps and the audio toggle at about 850 px and fold the menu
  rail. `reducedMotion` = root class `is-reduced-motion` (same rules as `prefers-reduced-motion`). `crtEffects` off = root
  class `no-crt` (no scanlines or flicker on `.ui-crt`). `colorBlind` = `is-colorblind`: green becomes blue-cyan, status
  lamps get glyphs (✓ green, ▲ amber, ✕ red, ○ unlit; `Lamp plain` opts out, used for switch and progress lamps), pills
  with `status` get ✓ ▲ ✕ ○, and the heat legend uses `HEAT_RAMP_COLORBLIND`.
- The menu is modal inside `.aitower-hud`: opening pauses (`setSpeed(0)`, previous speed remembered), closing restores it
  only if the speed is still 0. Keys pressed inside it are stopped from bubbling, so game hotkeys and the renderer's
  WASD never see them. Focus is trapped (Tab wraps; stray focus is pulled back).

## Invariants
- The UI only emits `SimCommand`s through `store.dispatch`. It reads every number from `SimView` or `ContentDB`.
- `store.get()` must return the same object until something changes, and a new object on every change
  (useSyncExternalStore). The app must build a fresh `GameState` each frame that the view changes.
- Toasts read `state.log` through a cursor of (tick, count at that tick). Entries present at mount are never
  toasted, and a tick that goes backwards (load or new game) resets the cursor.
- Tools stay active after use. A left click or drag runs the tool. A right-button click (down and up on the
  same cell, not a pan) and Esc return to Select.
- Demolish ghosts are `valid:false` on purpose, so the renderer draws them red.
- Ghost validity for slab, conduit and lift comes from `store.canBuild(cmd)` (same command the click would dispatch);
  the label is the sim's reason (capitalised) when refused, or the cost label (computed locally for display only) when
  allowed. A lift hover without a drag is valid if the cell can pair with the floor above or below. Place ghosts use
  `store.canPlace`. Rejections are still toasted on dispatch.
- Esc order: close the menu, else the research sheet, else the audit sheet, else cancel the armed tool, else clear the selection, else open the menu (`menu/escape.ts`).
- Full-screen sheets are modal on purpose (research z 52, audit z 48, below the menu 60 and game over 55); the memo slip and CURRENT ORDERS are not covered by anything else.
- Build gating: a facility or bot whose `tech` is not researched is disabled with "Requires research: <name>" (decided from `content.tech` and `view.techResearched`).
- Import never throws: the file is read with FileReader and `store.load(text)` runs in try/catch; failures show
  "Invalid save: …" in the menu and the running game is kept.

## Test
`npx vitest run packages/ui`: research node states / effect text / unlocks, clerk verdicts, loan presets, `moneyToday`, audit trigger and copy,
R / Esc / pause behaviour, component dispatches (`m2b.test.tsx`), controller (each tool, L-path, span normalisation, picking, rejections, ghosts via
`canBuild`), format helpers, Esc state machine, menu pause/restore, hotkeys ignored while the menu is open, save-slot
formatting, import/export, settings → CSS variables/classes, heat ramps, density, the fake store's saves, throttled
subscribe, and Hud/SystemMenu server-render tests. There is no DOM test environment: DOM behaviour (focus trap, file
input, download) was verified in Chromium through the dev harness.

## Calm HUD and synthetic look (M3-T4b; supersedes the layout notes above where they differ)
Layout: a thin **top strip** (`calm/TopStrip.tsx`: day/clock, speed, TREASURY, PER HOUR, Clearance bar, STANDING, growth index, INBOX, MENU), the world, a **NEXT chip**
(top centre, from `currentObjective`; tooltip = detail; click opens the drawer or FORM A-5), a **ticker** (bottom, click = alert log), a **build dock** (bottom left, 3 picks +
More = the full `BuildPalette` as a popover, Wetware tab included) and **drawers on the right edge** (`calm/Parts.tsx`; one at a time; classes `ui-edge`, `data-drawer`):
C Contracts, R Research, F Finance, I Gauges (+ the alert log from the ticker). The bottom panel, TopBar and CURRENT ORDERS are gone.
- Keys: C/R/F/I drawers, B palette, N/H/P overlays, **O** coolant, **U** nutrient, **G** contamination ("growth"), M mute, X demolish. R no longer opens the research
  sheet (that is a button in the Research drawer; the sheet still pauses). Esc order: menu, research sheet, ascension sheet, audit sheet, open drawer/palette, tool, selection, menu.
- Pure helpers in `calm/calm.ts` (tested in `calm/calm.test.ts`): `perHour` (operating income over about 6 game-hours from the daily ledger; construction excluded),
  `clearanceProgress`, `dockPicks`, `effectChip`/`choiceChips` (memo stamps as "−$160k · ★−4", from `content.events[].choices[].effects`), `isUrgentMemo` (expires within 12 h, or its
  default choice fails racks / costs over 10 % of cash; only urgent memos pop up, the rest raise the inbox count), `isRoutine` (ticker filter).
- `calm/Panels.tsx`: Contracts drawer (clerk in one line + Edit, compact offers and running jobs), Research drawer (affordable or half-funded nodes + button to the full sheet), alert log, telemetry.
- Look: `calm/theme.css` holds every palette/font/size token (docs/STYLE_SYNTHETIC.md) and remaps the legacy cassette tokens, so a restyle is a token swap; `calm/calm.css` is the layout and uses tokens only.
  Fonts (Chakra Petch, IBM Plex) load from Google Fonts with system fallbacks. Older panels (inspector, finance, palette cards) follow through the remapped tokens only.
- Biotech: `bio/bio.ts` (wording per `horrorIntensity`, organoid band, trait text, growth gauge, memo stain), `objective/diagnose.ts` (noNutrient / tooCold reasons), `ascension/` (FORM A-5 sheet; the sim
  applies `choosePath` on the next tick, so `ui.pathFiled` hides the offer meanwhile), `gameover/gameOver.ts` (`overCopyFor`: ending text from `content.endings`, plain forms at off).
- Harness params added: `?bio=1 &corr=0..1 &asc=1 &over=living|clean|absorbed &drawer=contracts|research|finance|gauges &palette=wetw|rack|...`.
