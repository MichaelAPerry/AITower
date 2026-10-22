# AItower: handoff for Monday

Read this first. It replaces scattered notes. Older notes are in `tasks/m6/STATUS.md`, `tasks/m5b/README.md` and the docs below.

## 1. What the game is
AItower is a browser tycoon game for students. You build and run an AI datacenter tower: build racks, power and cooling, take contracts, research, level up, and choose one of three paths (Biotech/Wetware, Greentech, Synthetic). It is a "clicker with lots of automation, but still a challenge". The tone is dry corporate sci-fi. It should teach real datacenter concepts.

- **Live:** https://michaelaperry.github.io/AITower/ (GitHub Pages; CI runs check → build → deploy on main)
- **Repo:** `MichaelAPerry/AITower`. Work happens on branch `claude/serene-ramanujan-ojshkh`, merged to main by PR.

## 2. Architecture (monorepo, TypeScript, npm workspaces)
| Package | What it does |
|--|--|
| `packages/sim` | Deterministic fixed-tick sim (1 tick = 1 game-minute). Commands in, view out. Snapshot v9 with migrations. |
| `packages/content` | All game data (`src/data/*.json`): facilities, tech (68 nodes with lanes), lanes, bots, events (now advisor decisions), scenarios, balance. Schema and validation. |
| `packages/ui` | React HUD: build catalog and inspector, panels (contracts, research tree, insights, automation), advisors, Handbook, lessons. |
| `packages/render` | PixiJS world: tower, bots, skyline, status pills. |
| `apps/web` | Vite app, store, saves. |
| `tools/sim-cli` | Headless runs, `--auto` player, balance stats. |

- **Checks:** `npm run check` (typecheck, lint, about 1,400 tests), `npm run build`, `npm run budget` (a tripwire at 3 MB), `npm run e2e`.
- **Never run `tsc -b` or a plain `npx tsc`:** it writes `.js` files next to the sources, and vitest then picks up those stale files first.
- `packages/sim/src/perf.test.ts` is timing-sensitive when the machine is loaded. Re-run it on its own before treating a failure as real.

## 3. Key docs
- `docs/mockups/m6-redesign.html`: the **approved M6 design**. It covers the research tree, tiers, advisors, lessons, maintenance view, graphics and build order. Published at https://claude.ai/artifact/YBoKgwG1Uw6cDVekeZUUer
- `docs/BALANCE_AUDIT.md`: the tech and economy audit. Its restructure is shipped.
- `docs/UI_RESEARCH.md`: the UI friction audit.
- `docs/QUOTES.md`: verified flavor quotes with sources.

## 4. Shipped (live)
- Bigger lots and fair reputation.
- Build catalog with inspector.
- Panels: Contracts, Insights, a Research **tree**, and the Handbook (formerly the Primer).
- Real-quote flavor text and the jargon glossary.
- Tech restructure: research gates each Level.
- M6 bug fixes: lift power and routing, Foreman reach, conduit gating, heat tips, tool bar, maintenance chips and pills.
- **Tier ladder** (Standard/Advanced/Frontier/Path) and Foreman line and tier rules.
- **Advisors:** Cass Parr (facilities and cooling), Bea Altasar (power), Dr. Mel Kiorre (compute and wetware), Lucien Ferro (CFO). They replace UNIT-7 and the memos; decisions pause the game; MAGI votes.
- **Lesson engine and Lesson 1 "First Watt".**

## 5. Owner's latest playtest: open problems, by priority
**Bugs and logic (fix first):**
1. **Foreman stops working after a while.** Reproduce with sim-cli `--auto` over 30+ days, then read the status lines.
2. **Foreman builds air handlers next to liquid racks.** Liquid racks have `liquidFraction < 1`, so some residual air heat is real. The Foreman should use existing air capacity or explain it, and should never place air support that a liquid rack doesn't need. File: `packages/sim/src/automation/foreman.ts`.
3. **Bots only deploy from the starting area.** Other docks and chargers are never used. Check dispatch and charger assignment in `packages/sim/src/logistics`.
4. **Bots can exist with no racks or no place for them.** Buying bots should require a dock or charger, and auto-buy should scale with racks.
5. **The advisor strip sometimes covers the build catalog and inspector.**

**Design (needs owner input before building):**
6. **Paths are lopsided:**
   - Greentech items don't do much.
   - Synthetic shows as only one thing.
   - Everyone gets the Wetware building, so Biotech never feels like a choice.
   - Each path needs a clear, exclusive identity, payoff and visible play. Revisit the BALANCE_AUDIT path section and lanes.json.
7. **Lesson writing and instructions were "really bad".** The owner stopped Lesson 1. Rewrite it with the owner before building Lessons 2–6:
   - short, concrete steps;
   - one idea per step;
   - say *why* before *what*;
   - test it on a first-time player.

**Later (from the M6 doc):**
- M6.5: Lessons 2–6 and the Ops/maintenance view.
- M6.6: graphics pass (approved: direction A, clean cutaway, plus B's lighting).

## 6. Owner decisions on record
- Advisors are named after NGE's MAGI plus Lucifer for the CFO. Memos are folded into advisors.
- Teaching is a lesson campaign plus the Handbook. Power is the first lesson.
- Cooling has Air, Liquid and Immersion as sub-lanes.
- Graphics: A plus B lighting.
- Voice: dry corporate sci-fi, plain, real numbers.
- The owner dislikes clutter, hand-holding and "steampunk".

## 7. How to work (cost lessons from this week)
- **Start a fresh session per work block.** Long sessions re-read their whole history every turn, and that was most of the cost.
- **Run one agent at a time**, with `isolation: "worktree"`, so the main checkout stays clean and the stop hook doesn't fire. Use Sonnet for building and Haiku for verification and CI.
- **One PR per playtest round.** Don't subscribe to PR notifications; check CI once at the end.
- **Fix what the owner reports first, then ask before redesigning.** Show a small mockup before any large UI change.
- **Verify like a player:** one browser pass at the end, read as a confused first-timer.

## 8. Suggested Monday plan
1. Fix bugs 1–5 in one agent run, with regression tests. Ship, then the owner playtests.
2. Walk through paths and lessons with the owner (item 6 and item 7). Agree a short spec.
3. Rewrite Lesson 1, then build Lessons 2–6 and the Ops view.
4. Graphics pass.
