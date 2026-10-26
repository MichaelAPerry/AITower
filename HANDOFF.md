# AItower: handoff (read first)

## 0. The Soul (latest owner direction; it overrides everything below)
The game is the player's journey down **three Singularity trees**, wrapped in a **PC-98 visual-novel dating sim at the end of the world**.

The full spec is in `docs/SOUL.md`, the look is in `docs/STYLE_PC98.md`, and the portrait prompts are in `docs/ART_BRIEFS.md`.

### Done on branch `claude/youthful-ramanujan-msqcy9`
- **The three trees, each scored in Singularity points (SP) toward a target of 1000:**
  - **Synthetic, "The Lattice":** the default and easiest. It accrues from almost any running rack, even while you build another tree.
  - **Bio, "The Flesh":** accrues only after you commit to it, and needs Mel's trust.
  - **Green, "The Garden":** accrues only after you commit to it, and needs Bea's trust.
  - The first tree to reach its target ends the game. Failure is bankruptcy, shutdown or Absorbed.
  - Code: `packages/sim/src/progression/soul.ts`.
- **Secret numbers (seal):** every facility has a hidden `seal` for Bio and Green (`facilities.json`). The seal is a permanent scar plus a cleanable residue.
  - At 100 the tree is sealed: you can't commit to it.
  - If it seals after you commit, the tree rejects you (a scene plays) and you are thrown back onto Synthetic.
- **Bonds:** each advisor has a 0–100 bond. Taking her advice raises it, and overruling her lowers it.
  - At bond 40 she reveals her tree's numbers on build cards.
  - At bond 50 you may commit to her tree.
  - The highest bond, if at least 60, gets the ending's epilogue.
- **Advisors redesigned:** Luci (formerly Lucien, CFO, Synthetic), Mel (Bio), Bea (Green) and Cass (Cooling, the human voice who never lies). The new art is in `packages/ui/src/art/`.
- **Story scenes:** 27 scenes in `packages/content/src/data/story.json`:
  - an intro,
  - resolve tests,
  - Bea's greenwash test (she recommends the wrong answer on purpose),
  - Luci's diesel deal,
  - seal warnings at 25, 50, 75 and 100,
  - lock-outs,
  - objections when you build a heavy polluter,
  - SP milestones at 50% and 90%,
  - Luci's reveal,
  - Mel's shortcut.
  - They reuse the decision system: category `story`, with `trigger`, `lines` and per-choice `reply`.
  - Hidden effects are `seal`, `bond`, `sp` and `commitPath`.
- **PC-98 look:**
  - the DotGothic16 pixel font,
  - indigo panels with white double rules and dither,
  - a sunset or indigo world sky,
  - the title screen on the concept painting,
  - visual-novel scenes (`packages/ui/src/vn/`),
  - endings over the tree paintings with epilogues,
  - three Singularity bars in the top strip; a click opens the advisor dossier,
  - FORM A-5 showing each tree's art and its champion's verdict.
- **Saves:** snapshot v11.
  - Old saves gain scars rebuilt from their facilities.
  - Old path endings map onto the new trees.

### Next, in order
1. **Owner playtest of the Soul.** Tune `balance.soul`:
   - SP rate,
   - residue rate,
   - the bond gates,
   - the seal numbers in `facilities.json`.
   Run `npx tsx tools/sim-cli/src/soulRun.ts starter 80` for a headless per-day trace.
2. **Remove reputation.** This was planned in section 0b below and has not been done. The top strip still shows it, and shutdown still exists.
3. **More expressions and scenes:**
   - Bea has no "unsettling" face; her displeased face with goggles is reused.
   - Write more mid-game scenes per advisor, the dating-sim arcs.
4. **Catalogue identity:** add per-tree racks and coolers so each line feels distinct. Synthetic and Green still have few items of their own.
5. **Lessons:** rewrite them for the new loop. The handoff below already says so.

The concept art originals (PNG) are on branch `claude/serene-ramanujan-ojshkh`, at the root and in `docs/`.

## 0b. Earlier direction (kept for context)
**The goal of the game is the Singularity.** Reputation is scrapped.

- **Win and lose:**
  - There is one failure ending (bankruptcy or shutdown, to be defined) and **three Singularity wins**, one per tree, each with its own end screen.
  - **Green:** the Singularity merges with nature.
  - **Bio:** a cyborg world.
  - **Synthetic:** a fully computer-run virtual world.
- **Singularity points (SP)** replace reputation as the score and goal.
  - Each tree banks SP when the player hits that tree's milestones.
  - The existing Green Score is the model for this.
  - Reaching a tree's SP target triggers that tree's ending.
- **Each tree gives a distinct advantage toward the Singularity:**
  - Each has its **own power, cooling and compute line**.
  - Racks are **upgraded down the tree**, not replaced by unrelated racks.
- **Consequences:**
  - Retool racks, cooling and power around the three trees.
  - Remove or repurpose tech that becomes useless without reputation.
  - The reputation mechanics go: standing, the daily uptime check and its log, audits' standing effects, decision standing effects, and the Level gate's uptime part. Reconsider each.
- **Order:**
  1. Design this first (spec plus small mockups, approved by the owner).
  2. Then the sim/content rework.
  3. Lessons come **after** this, since they must teach the new loop.
- **Open questions for the owner:**
  - What does the shared early game look like before you pick a tree?
  - Can you mix trees, or must you commit?
  - What exactly is the failure condition?
  - What are the SP milestones per tree?
  - How do Levels relate to SP?

## 1. What the game is
- A browser tycoon game for students: build and run an AI datacenter tower, with lots of automation but still a challenge.
- Dry corporate sci-fi tone. It teaches real datacenter concepts.
- Live at https://michaelaperry.github.io/AITower/. CI on main runs check, then build, then deploy.
- Repo `MichaelAPerry/AITower`. Work on branch `claude/serene-ramanujan-ojshkh` and merge to main by PR.

## 2. Architecture (TypeScript monorepo, npm workspaces)
| Package | What it does |
|--|--|
| `packages/sim` | Deterministic fixed tick (1 tick = 1 game minute). Commands in, view out. Snapshot v9 with migrations. Standing/reputation lives in `ministry/standing.ts`; decisions in `ministry/decisions.ts`; the Foreman in `automation/foreman.ts`; Level gates in `progression/tier.ts`; affinity and green score in `progression/`. |
| `packages/content` | Data in `src/data/*.json` (facilities, tech with lanes, lanes, bots, events/decisions, scenarios, balance), plus schema and validation. Tiers are derived in `tier.ts`. |
| `packages/ui` | React HUD: build catalog and inspector, contracts, research tree, insights, automation, advisors, Handbook, lessons. |
| `packages/render` | PixiJS world and skyline. |
| `apps/web` | The app and saves. |
| `tools/sim-cli` | Headless and auto runs, plus balance stats. |

- Checks: `npm run check`, `npm run build`, `npm run budget` (a 3 MB tripwire), `npm run e2e`.
- **Never run `tsc -b` or plain `npx tsc`.** They write stale `.js` files next to the sources.
- `perf.test.ts` is flaky under load. Re-run it alone before trusting a failure.

## 3. Shipped and live
- Build catalog and inspector.
- Contracts, Insights, a Research tree, and the Handbook.
- Tier badges, with Foreman line and tier rules.
- Four advisors that replace memos: Cass Parr (cooling), Bea Altasar (power), Dr. Mel Kiorre (compute/wetware), Luci Ferro (CFO; was Lucien).
- Paused decisions and MAGI votes.
- Lesson engine with Lesson 1.
- Real-quote flavor text and the jargon glossary.
- Fixes to lifts and bots.

## 4. Known bugs from the latest playtest (fix alongside or before the rework)
1. The Foreman stops working after a while.
2. The Foreman puts air handlers next to liquid racks.
3. Bots only deploy from the starting area, and other docks are unused.
4. Bots can exist with no racks or dock.
5. The advisor strip covers the build catalog.
6. Greentech items do little, Synthetic is basically one item, and everyone gets the Wetware building. The new direction in section 0 resolves this.
7. The Lesson 1 writing was poor. Rewrite it after the rework.

## 5. Docs
- `docs/mockups/m6-redesign.html`: the M6 design. Its tree, advisors and graphics parts still apply; its progression and lessons parts need revising for section 0. It is also published at https://claude.ai/artifact/YBoKgwG1Uw6cDVekeZUUer
- `docs/BALANCE_AUDIT.md`
- `docs/UI_RESEARCH.md`
- `docs/QUOTES.md`

## 6. Owner decisions on record
- Advisor names: NGE MAGI plus Lucifer (Lucien became Luci, to match the new portrait).
- Graphics: superseded by the PC-98 look (`docs/STYLE_PC98.md`).
- Voice: dry, plain, real numbers.
- No clutter, no hand-holding, no steampunk.

## 7. How to work (cost lessons)
- Start a fresh session per work block. Long sessions re-read their whole history every turn, and that was most of the cost.
- Run one agent at a time with `isolation: "worktree"`. Use Sonnet to build and Haiku to verify.
- Open one PR per playtest round. Don't subscribe to PR notifications.
- Ask the owner before any redesign, and show a small mockup first.
- Fix reported bugs first.

## 8. Monday plan
1. With the owner, answer the section 0 open questions. Then write a Singularity design spec with a small mockup, covering the three trees, their unique power, cooling and rack lines, the upgrade paths, the SP milestones and the end screens.
2. Fix bugs 1 to 5.
3. Implement the rework (sim, content, then UI).
4. Rewrite the lessons for the new loop.
5. Graphics pass.
