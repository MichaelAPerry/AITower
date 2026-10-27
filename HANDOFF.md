# AItower: handoff (read first)

## 0. The Soul (latest owner direction; it overrides everything below)
The game is the player's journey down **three Singularity trees**, wrapped in a **PC-98 visual-novel dating sim at the end of the world**.

The full spec is in `docs/SOUL.md`, the look is in `docs/STYLE_PC98.md`, and the portrait prompts are in `docs/ART_BRIEFS.md`.

### Done (on `main`)
- **The three trees, each scored in Singularity points (SP) toward a target of 1000:**
  - **Synthetic, "The Lattice":** the default and easiest. It accrues from almost any running rack, even while you build another tree.
  - **Bio, "The Flesh":** accrues only after you commit to it, and needs Mel's trust.
  - **Green, "The Garden":** accrues only after you commit to it, and needs Bea's trust.
  - The first tree to reach its target ends the game. Failure is bankruptcy or Absorbed.
  - Code: `packages/sim/src/progression/soul.ts`.
- **Secret numbers (seal):** every facility has a hidden `seal` for Bio and Green (`facilities.json`). The seal is a permanent scar plus a cleanable residue.
  - At 100 the tree is sealed: you can't commit to it.
  - If it seals after you commit, the tree rejects you (a scene plays) and you are thrown back onto Synthetic.
- **Bonds:** each advisor has a 0–100 bond. Taking her advice raises it, and overruling her lowers it.
  - At 40 she reveals her tree's numbers on build cards; at 50 you may commit to her tree; the highest bond (60+) gets the ending's epilogue.
- **Advisors redesigned:** Luci (CFO, Synthetic), Mel (Bio), Bea (Green), Cass (Cooling, the human voice who never lies). Art in `packages/ui/src/art/`.
- **Story scenes:** 27 scenes in `packages/content/src/data/story.json` (intro, resolve tests, Bea's greenwash test, Luci's diesel deal, seal warnings, lock-outs, objections, SP milestones, Luci's reveal, Mel's shortcut). They reuse the decision system: category `story`, with `trigger`, `lines`, per-choice `reply`; hidden effects `seal`, `bond`, `sp`, `commitPath`.
- **PC-98 look:** DotGothic16 font, indigo panels, sunset/indigo sky, title on the concept painting, VN scenes (`packages/ui/src/vn/`), endings with epilogues, Singularity bars in the top strip (click opens the dossier), FORM A-5 per tree.
- **Reputation removed:** no standing, no shutdown. Uptime only feeds audit grades (cash). Levels gate on PFLOPS and research only. The Insights reputation section is now a Singularity section.
- **Playtest bugs fixed:** Foreman no longer stalls (expands up, digs basements, counts operating costs only); no air handlers beside liquid racks; bots use every dock; dockless bots are sold back; the advisor strip no longer covers the build catalog.
- **Lesson 1** rewritten in Bea's voice.
- **Saves:** snapshot v12. Older saves gain scars and bonds rebuilt from their facilities; old path endings map onto the new trees.

### Playtest focus (owner)
1. Does the opening scene and Lesson 1 make the three trees clear?
2. Is the Lattice too easy, and are the Flesh and the Garden reachable? Watch the seal notes and bonds.
3. Do the advisors feel distinct? Do the objections and the wrong-advice scenes land?
4. Any Foreman, bot or layout trouble.

Balance knobs: `balance.soul` (SP rate, residue rate, bond gates) and the `seal` numbers in `facilities.json`. Headless trace: `npx tsx tools/sim-cli/src/soulRun.ts starter 80`. In dev builds, `window.__aitower` exposes the sim for poking.

### Done since (Oct 27)
- **Catalogue rebuilt per tree** (`docs/TREES.md`): Shared, Starter (anyone), Specialist (commit only), Synthetic lines; upgrades in place; advisor signature builds; snapshot v13. Balance verified with `soulRun.ts` (Synthetic 27.5 / Bio 37 / Green 48 days, targets 25 / 38 / 44).
- **Dialogue rewritten** to `docs/VN_SAMPLE.md` (the bar) and `docs/VN_WRITING.md` (voice sheets).
- **Dating systems** (all nine): after-hours visits, bond stages, milestone scenes, gifts, rivalry, confession and route lock, texts, memories. Snapshot v14.
- Ending paintings appear only on ending screens. Quotes checked in `docs/QUOTES_CHECK.md`.

### Next, in order
1. Owner playtest; fix bugs first.
2. **Art from the owner** (requested only after scenes exist): rack sprites (`docs/TREES.md` section 7), mid-game scene backgrounds and "tender" expressions (`docs/VN_WRITING.md`, "Dating systems as built"). Placeholders are tinted existing sprites and the plain indigo stage.
3. Simplified items to finish: Bea's microgrid has no storage; Cass's ice store doesn't time-shift.
4. Lessons 2+ for the new loop.

**How to work:** Opus coordinates only. Sonnet builds and writes, Haiku verifies. One worktree agent per task.

The concept art originals (PNG) are on branch `claude/serene-ramanujan-ojshkh`, at the root and in `docs/`.

## 0b. Earlier direction (kept for context; implemented as section 0)
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
- Repo `MichaelAPerry/AITower`. Work on a branch, then merge to main (a push to main deploys).

## 2. Architecture (TypeScript monorepo, npm workspaces)
| Package | What it does |
|--|--|
| `packages/sim` | Deterministic fixed tick (1 tick = 1 game minute). Commands in, view out. Snapshot v12 with migrations. The Soul (SP, seals, bonds) lives in `progression/soul.ts`; decisions and story scenes in `ministry/decisions.ts`; the Foreman in `automation/foreman.ts`; Level gates in `progression/tier.ts`; affinity and green score in `progression/`. |
| `packages/content` | Data in `src/data/*.json` (facilities, tech with lanes, lanes, bots, events/decisions, scenarios, balance), plus schema and validation. Tiers are derived in `tier.ts`. |
| `packages/ui` | React HUD (PC-98 theme in `pc98/`, VN scenes in `vn/`, Soul gauge and dossier in `soul/`): build catalog and inspector, contracts, research tree, insights, automation, advisors, Handbook, lessons. |
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

## 4. Known bugs
- Bugs 1–5 and 7 from the last playtest are fixed (see section 0). Bug 6 (thin per-tree catalogue) is "Next" item 3.
- `perf.test.ts` can fail under machine load; re-run alone.

## 5. Docs
- `docs/mockups/m6-redesign.html`: the M6 design. Superseded by `docs/SOUL.md`; kept for history. It is also published at https://claude.ai/artifact/YBoKgwG1Uw6cDVekeZUUer
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
- Ask the owner before any redesign, and show a small mockup first.
- Fix reported bugs first.

## 8. Next session
1. Read the owner's playtest notes; fix bugs first.
2. Tune `balance.soul` and the seal numbers.
3. Then the "Next" list in section 0.

### Dating systems (snapshot v14)
After hours, bond stages, route milestones, gifts, rivals, confession and route, earned options, texts and memory flags are in. Spec and art wishes: `docs/VN_WRITING.md` ("Dating systems as built"). Code: `ministry/dating.ts`, `ministry/decisions.ts` (`conditionsHold`, `quiet`), UI `soul/DatingDock.tsx`, `soul/Dossier.tsx`, `gameover/EndingScene.tsx`. Data: `story.json`, `gifts.json`, `messages.json`, `memories.json`.

### Catalogue redesign (docs/TREES.md)
Shared access rules live in packages/content/src/catalogue.ts (`access`, `upgradeCost`); sim placement goes through progression/access.ts, `upgradeFacility` in commands/upgrade.ts, snapshot v13 (migrateV12, `bondGiven`). UI reads the same `access()` for tags and lock reasons. Balance: `tools/sim-cli/src/soulRun.ts [scenario] [days] [seeds] [synthetic|biotech|greentech|all]` with the scripted player in player.ts.
