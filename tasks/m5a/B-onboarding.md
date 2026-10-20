# M5a-B: coach-mark tutorial, Goals card, plain words, horizontal edge tabs
Owns `packages/ui/**`, `e2e/smoke.mjs`, and `apps/web/**` only if wiring is needed.

1. **Coach-mark tutorial:** replace the 9-step reading tutorial with about 5 doing-steps. Each step is one short sentence in a small bubble anchored next to its target element, with a pointer arrow and a soft pulse on the target. The step completes when the player does the action. No long boxes.
   - **Steps:**
     1. Accept the highlighted offer (the Contracts drawer opens itself to show it).
     2. Press play, 1× or 3×.
     3. Watch PER HOUR turn green: the step auto-advances once income is positive.
     4. Build a second rack (point at the build dock card, then the blueprint spot).
     5. Done: point at the Goals card ("Your goals live here").
   - **Clock:** keep "the clock is stopped while you read" behaviour only where needed.
   - **Exits:** keep Skip tutorial and Back, plus the existing "Restart tutorial" setting. Save and restore progress as today; keep the same localStorage key semantics, with a version bump if the step ids change.
   - **Heat and memos:** these become just-in-time hints instead of upfront steps. The first time a rack runs hot, a one-line coach mark points at it ("Too hot: add an air handler nearby"). The first time a memo arrives, one points at the inbox.
2. **Goals card:** a compact card, top-left under the top strip (or wherever it is calm and visible), showing 1 to 3 concrete goals with progress bars.
   - Derive the goals purely from the view: first contract, first $50k earned, second rack, reach Level 2 (120 PF), first research, and so on, as an ordered ladder.
   - When a goal completes: a small tick and a toast, and the next goal appears.
   - It replaces the NEXT pill as the main guide. Keep NEXT for problems (broken, too hot, no power) so it's not duplicated.
   - It can be collapsed.
   - Pure logic in a tested helper.
3. **Plain words:**
   - Player-facing "Clearance" → "Level", "Standing" → "Reputation". PFLOPS is shown as "PF" with "compute" wording, e.g. "80 / 120 PF compute".
   - Do this in the top strip, NEXT, toasts, drawers and the tutorial. Leave content names alone.
   - The red PER HOUR at the start gets a hint while no contract is running: "Upkeep. Accept a contract to earn."
4. **Edge tabs:** the right-edge drawer tabs (Contracts, Research, Automation, Finance, Gauges) read horizontally (icon plus short word, or a horizontal label), with no rotated text.
5. **Tests:** unit tests for the goal ladder and the coach-mark step logic. Update e2e and smoke for the new tutorial, then run the e2e.
6. **Screenshots:** walk a new game in Playwright and save screenshots of each coach-mark step to `/tmp/claude-0/-home-user-AITower/a7f75a3b-71cb-517d-a9c2-dde0cac086fa/scratchpad/m5a/`. Look at them yourself: each bubble must sit next to its target, be readable, and not cover the target.
