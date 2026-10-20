# M4b: playtest fixes and a voice and story pass

**Owner playtest (sandbox):**
- A lift can't be extended once built. *Fixed by the orchestrator: a lift drag that touches an existing shaft extends it.*
- The spec cards float in odd places and are hard to read.
- The LOGIS tab doesn't show its items, and WETWARE "is on the bottom".
- The title panel is clipped on wide screens.
- The Foreman may not build on floors without lift access.
- The path should be **derived from choices**.
- Memo choices are obtuse and not tied to a path.
- The writing still reads as old steampunk humour; there should be fewer memos.

**Decisions:**
- **Voice:** dry corporate sci-fi (see below).
- **Memos:** fewer, and every choice matters.
- **Path:** affinity from what you build, research and choose; at Clearance 5 the leading path is pre-selected and you confirm it.

**Run order: one agent at a time, Sonnet, frugal:**
1. [T1 sim](T1-sim.md)
2. [T2 content](T2-content.md)
3. [T3 ui](T3-ui.md)

## Voice guide (binding for all copy)
- **The setting:** an AI-compute operator under a modern regulator, the **Compute Authority** (it replaces "the Ministry"). The copy reads like ops consoles, incident tickets and terse corporate notices.
- **Rules:**
  - Short, dry and precise, with deadpan humour at most once in a while (understatement, not whimsy).
  - None of: forms in triplicate, brass, steam, punch cards, stamps, Dymo, "superintendent", or *Brazil* jokes.
  - Units and numbers come first.
  - Names are product-like: "AC-1 Air-Cooled Rack", "LC-2 Liquid-Cooled Rack", "Grid Intake 1.5 MW", "Diesel Genset 800 kW", "Chiller CH-600", "Coolant Distribution Unit".
- **Horror** (taste rules in `tasks/m3/README.md`) stays euphemistic and corporate ("asset growth", "non-standard tissue load"), never gore.

## Contracts already in place
- **Effect:** `EventEffect` `{ type: "affinity", path, amount }`.
- **View:** `SimView.affinity` (shares summing to 1). Placeholders are marked "placeholder".
- **Lift extension:** already done in sim, with tests.

## Rules
Same as M4 (`tasks/m4/README.md`):
- Write only in your owned paths, don't edit contracts, and don't commit.
- Run `npm run check`.
- Keep your report under 250 words.
