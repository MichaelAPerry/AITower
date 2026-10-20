# M4-T3 — agent-ui: Automation drawer, scenario picker and title crawl, Greentech/Synthetic UI, juice text
Owns `packages/ui/**` and `e2e/smoke.mjs`. Read `tasks/m4/README.md`, `docs/STYLE_SYNTHETIC.md`, and the Calm HUD code (`src/calm/*`).
- **Automation drawer (key A), one more drawer on the right edge:**
  - one row per order (Research, Parts, Bots, Foreman), each with an ON/OFF toggle and its 1–2 settings
  - the Foreman shows "Research: Works Foreman" until it is unlocked
  - the existing Contracts Clerk is listed here too, as a one-line toggle; its full form stays in Contracts
  - each order dispatches `setAutomation`
  - a small "AUTO" lamp in the top strip when any order is on
- **Title screen:**
  - a scenario picker (cards from `content.scenarios`, with each description) that calls `store.newGame(seed, scenarioId)`
  - a short *Brazil*-style **opening crawl** (about 6 lines, skippable, shown once per new game, respecting reduced motion)
- **Paths in the UI:**
  - **Greentech:** a green-score gauge (shown like the growth index), a drought chip in the strip, and endings copy.
  - **Synthetic:** a refinement gauge.
  - **Ascension sheet:** both paths are now available.
- **Ticker:** route `earned` events to it, coalesced per hour (no toasts; render draws the floaters). `autoBuilt` and `autoBought` lines are coalesced. Polish the event wording.
- **Sandbox:** a SANDBOX badge in the strip, and no bankruptcy warnings.
- **Tests:** the pure helpers and key interactions. Keep e2e green, adding an automation toggle step.
