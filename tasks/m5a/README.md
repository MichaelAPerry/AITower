# M5a: onboarding and clarity ("it's confusing and hard to understand")

**What students said after playtesting:** the game is confusing and hard to understand, and it doesn't tell them what to do.

**What the orchestrator found playing the live opening:**
- The first action is waiting ("Waiting for contract offers") while PER HOUR shows red −$891.
- The tutorial is 9 reading boxes in the bottom-right corner that describe things far away on screen.
- The jargon arrives up front: PFLOPS, Clearance, Standing, checkpoints, inference, aux draw.
- Nothing in the tower is labelled.
- There is no concrete goal until the last tutorial box.
- The vertical edge tabs are hard to read.

**The owner approved this plan, plus a help tooltip and an encyclopedia.**

## Design rules (binding)
- **Show, don't tell.** Every instruction sits next to the thing to click, with a pointer, one sentence at a time, and is completed by doing it.
- **Plain words on the surface, real numbers on demand.**
  - Player-facing labels: "Compute" (PFLOPS stays as the unit, e.g. "80 PF compute"), "Level" (was Clearance), "Reputation" (was Standing).
  - Ids, sim fields and saves are unchanged.
  - Jargon lives in hover cards and the encyclopedia.
- **One goal at a time.** A small, always-visible Goals card shows 1 to 3 concrete next goals with progress (for example "Earn your first $50k: $12k / $50k").
- **Calm.** Don't add clutter. The coach marks replace the old tutorial box rather than adding to it. Help is one "?" affordance, not icons everywhere.
- **Voice:** dry corporate sci-fi (`tasks/m4b/README.md`), but beginner-friendly. Clarity beats flavour.

## Run order: one agent at a time, Sonnet, frugal
1. **[A: sim and content](A-sim.md):** the first offer is ready at t=0, and that first offer is easy.
2. **[B: ui onboarding](B-onboarding.md):** coach-mark tutorial, the Goals card, plain-word relabel, horizontal edge tabs.
3. **[C: help and encyclopedia](C-help.md):** a "?" help mode with tooltips on every HUD region, an Encyclopedia drawer, and name tags in the world (render).

## Rules
- Write only in your owned paths.
- Don't commit.
- `npm run check` must pass, and so must `npm run build` and `npm run e2e` for UI work.
