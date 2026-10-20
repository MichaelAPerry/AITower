# M5b: a UI that feels like a Sims game, a bigger lot, a fair reputation

**Owner playtest:**
- Every menu feels clunky: build (arrow → hover → click), research cards, contracts.
- The encyclopedia doesn't "explain like I'm five". Players need a datacenter primer and a lot of handholding.
- The lot is 11 floors plus 1 basement, which feels ridiculous.
- In later levels, reputation (uptime) went into freefall, and nobody could tell why.

**Research:** `docs/UI_RESEARCH.md` (friction audit, reference-game patterns, 4 chunks with acceptance criteria). Mockup: `docs/mockups/ui-v2.html`.

## Run order: one agent at a time, Sonnet
0. **[S: sim and content](S-sim.md):** bigger lot; fair, explained reputation.
1. **Chunk 1, Build catalog and Inspector:** UI_RESEARCH.md chunk 1.
2. **Chunk 2, Unified panel shell, Contracts, Insights:** chunk 2.
3. **Chunk 3, Research tree:** chunk 3.
4. **Chunk 4, Datacenter Primer:** chunk 4.

## Rules
- Write only in the owned paths.
- Don't commit.
- `npm run check`, `npm run build` (budget) and `npm run e2e` must pass.
- Take screenshots and look at them as a confused first-time student would.
- **Voice:** plain and friendly first; the dry corporate flavour is only seasoning.

## Owner additions (approved)
5. **Helper bot "Assistant"** (toggle in Settings and on its own close button; on by default for new players).
   - A small robot character in a corner that speaks one suggestion at a time, derived from the view: hot racks → Air Handler, uptime dipping or no backup → Battery/Genset, idle racks → take a job, reputation falling → why, broken racks with no parts → buy parts, and so on.
   - Every suggestion comes with a one-click action ("Show me" picks the item in the Build catalog, or opens the right panel).
   - The Build catalog also gets a "Recommended" row from the same logic.
   - Calm: it never nags, has a cooldown, and can be dismissed per suggestion.
   - Pure tested suggestion logic, shared with NEXT.
6. **Dynamic opening menu:** the title screen shows a live, slowly panning cityscape with the player's latest saved tower (or a demo tower), with day/night and the path look. It is animated but calm, with reduced-motion respected.
7. **Cityscape evolves:** the background skyline changes with Level (more and taller buildings, lit windows, cranes at the upper levels) and with the path at 25/50/75/100%:
   - Biotech: organic, fleshy growths on the skyline.
   - Greentech: green roofs, wind turbines and vines.
   - Synthetic: sleek glass and light.
   
   Deterministic, cheap, within the bundle budget.
8. **Level and path primers:** each Level-up and path milestone unlocks a Primer chapter, "How to make the most of Level N / the X path". It covers what's new, what to build next, the common mistakes, and how to maximise score down that path (using real content numbers). A small "New chapter" prompt appears on unlock.

**Order after S:** chunk 1 → 5 (the helper reuses the Build catalog) → 2 → 3 → 4 + 8 (the Primer) → 6 + 7 (render).
