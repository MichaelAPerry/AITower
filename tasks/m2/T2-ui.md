# M2-T2 — agent-ui: title screen, tutorial rework, Ministry memo desk, game-over screens

**Owns:** `packages/ui/**`.

**Read first:**
- `tasks/m2/README.md`
- `packages/ui/AGENTS.md`
- `docs/STYLE.md`
- The new contract parts in `packages/sim/src/api.ts` (`MemoView`, `ModifierView`, `gameOver`, `standing`, `resolveMemo`) and `packages/shared/src/index.ts` (`Settings.musicVolume`)
- The existing `src/tutorial/*` and `src/menu/*`

The sim side is being written in parallel. Build against the contract, and extend `src/dev/fakeStore.ts` to issue fake memos, resolve them, change standing and trigger each game-over kind.

## 1. Title screen (dynamic): new, owner-requested
- **When:** shown at boot over a paused game, unless the URL has `?new` (the e2e smoke test relies on `?new` skipping it). Styled as the Ministry front office: a bakelite cabinet, a brass "AITOWER" plate and a CRT.
- **Dynamic content:** read `store.listSaves()` and show what applies:
  - **CONTINUE** (shows the autosave's day, cash, tier and how long ago).
  - **NEW GAME**, with a checked "Ministry induction (tutorial)" checkbox. It calls `store.newGame()` and starts the tutorial when checked.
  - **LOAD** (opens the existing load pane).
  - **SETTINGS.**
  - **CONTROLS.**
- **On a first visit with no saves:** show only NEW GAME, SETTINGS and CONTROLS, with induction on by default.
- **Keyboard:** fully operable (Enter and arrows). Esc does nothing on the title screen.
- **Speed:** the game stays paused until the player picks; Continue and New resume at 1×.

## 2. Tutorial rework: owner feedback, "unsure what to do" and "the game kept running"
- **Pause behaviour:**
  - Reading memos pause the clock (speed 0), and the clock stays paused until the step's task needs time.
  - Steps that need time (waiting for an offer, waiting for compute) run at 3× automatically and say so ("The clock is running at 3× so offers arrive").
  - Tasks the player does themselves (click, build) keep the clock paused, so nothing happens behind the memo.
- **Explicit instructions:** every task says exactly what to click and where, e.g. "Click the RACKS tab in the left panel, then the first card (Mk.I Air-Cooled Compute Cabinet), then click on F1 just right of the tape archive". Highlight the exact element (tab, card, button), not just the panel. Where the action is in the world, also set a ghost or focus the camera on the target cell.
- **Controls:**
  - A visible **✕ CLOSE** button on every memo, which closes the tutorial for good.
  - "Restart induction" in the menu and on the title screen.
  - "Skip task" remains.
- **Placement:** the memo must not cover the thing it asks you to click. Position it away from the highlighted target (pick a corner).
- **Memo steps:** when a Ministry memo (below) arrives during the tutorial, the tutorial explains it with an extra step the first time.
- **Tests:** keep the tests for step predicates, and add tests for the pause and run-clock behaviour.

## 3. Ministry memo desk
- **Inbox:** a memo-inbox lamp and count in the top bar. New memos slide in as a paper memo with the title, body, and one stamp button per choice. Each button shows the choice `hint` underneath.
- **Expiry:** show a countdown to auto-filing, and name the default choice ("Unanswered memos are filed as: FILE IN TRIPLICATE").
- **Pausing:** memos don't pause the game, but the memo shows how long is left. There is an inbox drawer listing all open memos, plus a history list (`memoHistory`) with outcomes.
- **Answering:** `store.dispatch({type:"resolveMemo", memoId, choiceId})`. After resolving, show the outcome text as a toast/memo.
- **Top bar:** show standing as a needle gauge or "MINISTRY STANDING" meter (0–100, red below 25). Show active `modifiers` as small chips with time left (e.g. "HEATWAVE +8 °C · 14h").
- **Alerts:** replace the placeholder memo/standing/gameOver wording in `src/events.ts` with proper Ministry wording.

## 4. Game-over screens
- **`bankrupt` / `shutdown`:** a full-screen "NOTICE OF TERMINATION" memo with the reason and lifetime stats (days, peak PFLOPS, contracts completed if available), plus LOAD GAME and NEW GAME.
- **`victory`:** a "COMMENDATION" memo with CONTINUE IN SANDBOX and NEW GAME.
- **Shown once:** each kind appears once per game, so dismissing it doesn't loop.

## 5. Settings
Add a Music volume slider (`musicVolume`) to the settings pane.

## Verify
- **Tests:** title-screen state logic, tutorial clock control, memo desk (resolve, expiry display, history), game-over once-only.
- **Screenshots:** of the dev harness for the title screen (with and without saves), a tutorial step with the precise highlight, a memo with choices, the inbox, and each game-over screen.
  - Save them to `/tmp/claude-0/-home-user-AITower/a7f75a3b-71cb-517d-a9c2-dde0cac086fa/scratchpad/m2-ui/` and look at them.
  - Stop your dev server by PID.
