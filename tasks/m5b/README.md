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
