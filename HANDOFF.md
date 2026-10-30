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

### Playtest focus (owner; still open)
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

### State on Oct 30 (read this first)
- **Live main = `d8e2450`** (retrofit reframe). Branch `claude/youthful-ramanujan-msqcy9` (`9883f4b`) holds unreleased work: build-menu fixes, audit cleanups, docs. Not live.
- **Four finished branches, all built on youthful, NOT merged, awaiting owner approval:**
  - `wip/tree-sprites` (`6425adb`): Green, Bio and Synthetic sprites redrawn, plus the Consciousness Transfer Unit (CT-1) walk-in/upload animation. Previews in `docs/preview/` (`green-`, `bio-`, `synthetic-sprites.png`, `transfer-unit.png`, `green-ingame.png`). Check, build, e2e, budget pass. Owner will likely say: the pod looks like a vending machine; Bio is uniformly pink; 7 support items are still base art (nutrient plant/works, bioreactor, digester, sterile bay, gensets, SMR, PV wall). Direction: `docs/ART_DIRECTION.md` on that branch.
  - `wip/lessons` (`3a8be69`): four lessons (Build, Earn, Grow, The trees), each scripted to completion in tests; e2e plays the new Lesson 1. All checks pass. Lessons 2-4 give no stars; lesson 4 does not wait for a seal. Owner has not read the lesson text yet.
  - `wip/endings` (`005fd38`): five ending screens (Lattice, Flesh, Garden, Absorbed, Bankrupt), 20 epilogues (4 advisors x 5), `docs/ENDING_PROMPTS.md`. All checks pass (`perf.test.ts` is flaky under load; passes alone). It adds `art` to `endings.json`, `ENDING_ART` in `packages/ui/src/art/index.ts`, and edits `tools/dialogue/export.ts` (new `Art:` line; epilogues for all five endings). `docs/DIALOGUE.md` was NOT regenerated there.
  - `wip/off-duty` (`f622354`): `docs/OFF_DUTY.md` only, no code. Unlocks: Luci = Lattice win, no debt, bond >= 70; Mel = Flesh win, corruption < 0.5 (a guess); Bea = Garden win; Cass = 30 days in a row at 99% uptime (needs new `uptimeStreak` field + snapshot v16; whether uptime is 0-1 or 0-100 is unconfirmed). Gallery in localStorage `aitower.gallery`.
- A pairwise merge-tree of the three code branches shows no conflicts, but they were never tested combined.
- **Pending owner approvals:** sprite previews, `ENDING_PROMPTS.md`, `OFF_DUTY.md`, and optionally a lesson text sample.

### Next, in order
1. Owner playtest; fix bugs first.
2. **Art from the owner** (requested only after scenes exist): rack sprites (`docs/TREES.md` section 7), mid-game scene backgrounds and "tender" expressions (`docs/VN_WRITING.md`, "Dating systems as built"). Placeholders are tinted existing sprites and the plain indigo stage.
3. Simplified items to finish: Bea's microgrid has no storage; Cass's ice store doesn't time-shift.
4. ~~Lessons 2+ for the new loop~~ done on `wip/lessons`: Build, Earn, Grow, The trees (scripted in `sim/src/lessons.test.ts`).

## Next session: owner art and dialogue
The owner will attach new images and a rewritten `docs/DIALOGUE.md`. Opening message: `docs/NEXT_PROMPT.md`.

### Order of work
**(a) Approvals and merges.**
1. Ask the owner for a verdict on the pending approvals above.
2. Merge each approved branch into `claude/youthful-ramanujan-msqcy9`, one at a time (sprites, lessons, endings). After each merge run `npm run check`, `npm run build`, `npm run e2e`, `npm run budget`. Fix before the next merge.
3. Push to main only when all four pass on the combined branch. The owner plays the build first.
4. A rejected branch is redone, not polished.

**(b) Owner art.** Use the recipe and table below. Merge `wip/endings` first so `ENDING_ART` exists. Show the owner one screenshot per kind of slot before wiring the rest.

**(c) Owner's DIALOGUE.md.** Build `tools/dialogue/import.ts` against the grammar below.
1. Write the importer. Round-trip test first: `export` -> `import` -> `git diff packages/` must be empty.
2. Import the owner's file. Report ids that are missing, extra or empty; do not guess.
3. Show the owner ONE imported scene in the game (screenshot) before importing the rest.
4. Then `npm run check`, build, e2e. Regenerate `docs/DIALOGUE.md` from the data and confirm it matches the owner's file.

**(d) Then** the off-duty unlock and gallery code, from `docs/OFF_DUTY.md` (on `wip/off-duty`; bring the doc over first).

### How uploaded files reach the repo
- The owner attaches images/files in chat. The session copies each to the right path in the repo, converts to `.webp` if needed, and never commits an original over 1 MB without asking.
- Keep the owner's originals outside the repo (scratchpad) unless asked.

### How to drop in an image
- Format: **lossless WebP**, quantised (48 colours for backdrops, 32 for portraits). Pillow: `Image.open(p).convert("RGB").quantize(48).convert("RGB").save(out, lossless=True)`. If the size is wrong, resize with `Image.NEAREST` first (art drawn at 2x halves cleanly).
- Sizes in the repo today: backdrops 640x420 (`bg-title` 640x480), busts 256x256, full figures 280x420. `docs/ART_BRIEFS.md` says `art/portraits/*.png` at about 480x600; the repo actually keeps `.webp` directly in `packages/ui/src/art/`. The briefs are a source-art spec, not the repo layout.
- Put the file in `packages/ui/src/art/<name>.webp`. `assets.d.ts` declares `*.webp`.
- Register it in `packages/ui/src/art/index.ts` with a static import (`import x from "./x.webp"`):
  - Portraits: `PORTRAITS[advisor][expression]` (`neutral|pleased|displeased|unsettling`) or `FULL[advisor]`. Names `<advisor>-<expression>.webp`, `<advisor>-full.webp`; advisors `luci mel bea cass`.
  - Tree floors and title: `BACKDROP` (`title`, `biotech`, `greentech`, `synthetic`).
  - Endings (after merging `wip/endings`): `ENDING_ART`, keyed by name without extension (`"bg-end-absorbed"`). `endings.json` already names each in its `art` field.
  - Story locations: not wired. `packages/ui/src/vn/StoryScene.tsx` takes the backdrop from the scene's `backdrop` field (a tree id). Add a location-to-file map for the 12 `bg-loc-*` files (keys: scene `location` text or scene id).
  - Off-duty: `<advisor>-offduty.webp`, registered with the gallery code (d).
  - Rack and support sprites are drawn in code, not images: `packages/render/src/art.ts` (`bodyArt`, `rackVariant`) and `packages/render/src/pixi/facilityArt.ts` (on `wip/tree-sprites`, the `*Sprites.ts` files). There is no image loader for them; an owner image there is a new feature, so ask first.
- After any art change: `npm run build` and `npm run budget` (3 MB tripwire; backdrops are 150-170 KB each). Screenshot the screen that shows it.

### Art slots
| Slot | File | Registry | Status |
|--|--|--|--|
| Advisor busts, 4 x 4 expressions | `{luci,mel,bea,cass}-{neutral,pleased,displeased,unsettling}.webp` | `PORTRAITS` | done; owner may replace |
| Advisor full figures | `{advisor}-full.webp` | `FULL` | done |
| Title | `bg-title.webp` | `BACKDROP.title` | done |
| Tree floors | `bg-synth`, `bg-bio`, `bg-green` | `BACKDROP` | done; also the Lattice/Flesh/Garden ending placeholders |
| Ending: Lattice | `bg-end-lattice.webp` | `ENDING_ART` | empty (shows `bg-synth`) |
| Ending: Flesh | `bg-end-flesh.webp` | `ENDING_ART` | empty (shows `bg-bio`) |
| Ending: Garden | `bg-end-garden.webp` | `ENDING_ART` | empty (shows `bg-green`) |
| Ending: Absorbed | `bg-end-absorbed.webp` | `ENDING_ART` | empty (plain stage) |
| Ending: Bankrupt | `bg-end-bankrupt.webp` | `ENDING_ART` | empty (plain stage) |
| Location: lot (`st_intro`) | `bg-loc-f1-lot.webp` | to build | empty |
| Location: site install (`obj_greentech`, `obj_biotech`) | `bg-loc-site-install.webp` | to build | empty |
| Location: control room (`rung_syn_1`) | `bg-loc-control-room.webp` | to build | empty |
| Location: finance office (`rung_syn_2`) | `bg-loc-finance-office.webp` | to build | empty |
| Location: plant room (`rung_syn_3`, `rung_green_2`) | `bg-loc-plant-room.webp` | to build | empty |
| Location: floor F2 (`rung_syn_4`) | `bg-loc-floor-f2.webp` | to build | empty |
| Location: wetware annex (`rung_bio_1`, `rung_bio_2`) | `bg-loc-wetware-annex.webp` | to build | empty |
| Location: nutrient line (`rung_bio_3`) | `bg-loc-nutrient-line.webp` | to build | empty |
| Location: neural pit (`rung_bio_4`) | `bg-loc-neural-pit.webp` | to build | empty |
| Location: panel deck (`rung_green_1`) | `bg-loc-panel-deck.webp` | to build | empty |
| Location: stairwell (`rung_green_3`) | `bg-loc-stairwell.webp` | to build | empty |
| Location: sunrise (`rung_green_4`) | `bg-loc-sunrise.webp` | to build | empty |
| Off duty: Luci, Mel, Bea, Cass | `{advisor}-offduty.webp` (match the base set's size) | gallery (d) | empty |

Prompts: `docs/ART_NEEDED.md` (locations), `docs/ENDING_PROMPTS.md` (endings, on `wip/endings`), `docs/OFF_DUTY.md` (on `wip/off-duty`), `docs/ART_BRIEFS.md` (portraits). Layout rule for every backdrop: keep the upper-left third quiet (caption box) and the subject in the upper two thirds (the dialogue box covers the bottom third). Rack and support sprites are Part A of `docs/ART_NEEDED.md` and `wip/tree-sprites`; they are code, not owner art.

### DIALOGUE.md grammar (what the importer must read)
Generated by `tools/dialogue/export.ts`; `npx tsx tools/dialogue/export.ts --check` validates it. Sections `## N. Title` in order: crawl, advisors, four story groups, endings, memos (Cass, Bea, Mel, Luci), lessons.
- **Editable line:** `- [ID] TAG: TEXT`, regex `^- \[([a-z0-9_.]+)( mood=[a-z]+)?\] ([A-Za-z][A-Za-z ]*): (\S.*)$`. IDs are unique. TAG is a speaker id (`narrator luci mel bea cass`) or a capitalised field label (`Title Label Hint Outcome Caption Location Objective Concept Goal Learned Name ...`). Import only TEXT; warn if the owner changed a TAG or `mood=`.
- `> ...` metadata, headings, "Choice ..." lines and blanks are ignored.
- Multi-paragraph values were split on blank lines into `ID.p1`, `ID.p2`...; join in order with a blank line (`"\n\n"`). Export collapses inner newlines to spaces.
- Keep `{item}`, `{{term}}`, `{{term|label}}` markers. Fail if the markers or a term id differ from the current text.
- ID to data (files in `packages/content/src/data/` unless noted):

| ID | Field |
|--|--|
| `crawl.N` | `CRAWL_LINES[N-1]` in `packages/ui/src/title/crawl.ts` (TS array: rewrite the string in place) |
| `adv.<id>.{name,first,role,areas,motto}` | `ADVISORS[id]` in `packages/ui/src/advisors/advisors.ts` (TS object literals) |
| `<scene>.title`, `.location`, `.caption` | `story.json` scene `title`, `location`, `body` |
| `<scene>.lN` (`mood=`) | `story.json` scene `lines[N-1].text` (`who`, `mood` stay) |
| `<scene>.<choice>.{label,hint,outcome}` | `story.json` choice fields |
| `<scene>.<choice>.rN` | `story.json` choice `reply[N-1].text` |
| `end.<id>.{title,body}`, `end.<id>.epilogue.<adv>` | `endings.json` `title`, `body`, `epilogue[adv]` |
| `<event>.title`, `.body` | `events.json` `title`, `body` |
| `<event>.vote.<adv>` | `events.json` `votes[advisor].line` |
| `<event>.<choice>.{label,hint,outcome}` | `events.json` choice fields |
| `<lesson>.{title,concept,goal,learned,outro,next}` | `lessons.json` lesson fields |
| `<lesson>.<step>.objective`, `.sayN`, `.afterN` | `lessons.json` step `text`, `say[N-1]`, `after[N-1]` |

- Scene, event and choice ids contain underscores and may contain dots only as separators, so resolve an ID by matching known scene/event/lesson ids from the data (longest prefix), not by splitting on `.`.
- Write JSON back in the file's existing formatting so the round-trip diff is empty. Touch only the text fields above, never effects, triggers or `recommended`.
- The export on `wip/endings` covers all five endings, and `wip/lessons` has four lessons. Merge both, regenerate `docs/DIALOGUE.md`, and compare: ids in the data but not in the owner's file keep their current text and are listed for the owner.

### Rules for the next session
- Opus coordinates only. Sonnet builds and writes, Haiku verifies. One worktree agent per task.
- Never run `tsc -b` or plain `npx tsc`.
- Sample approval before bulk for sprites and writing (one scene, one image, shown to the owner first).
- Short, plain messages to the owner.
- Push to main only when check, build, e2e and budget all pass and the owner has played the build.

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
| `packages/sim` | Deterministic fixed tick (1 tick = 1 game minute). Commands in, view out. Snapshot v14 with migrations. The Soul (SP, seals, bonds) lives in `progression/soul.ts`; decisions and story scenes in `ministry/decisions.ts`; the Foreman in `automation/foreman.ts`; Level gates in `progression/tier.ts`; affinity and green score in `progression/`. |
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
- One worktree agent per task. Sonnet builds, Haiku verifies.
- Ask the owner before any redesign, and show a small mockup first.
- Fix reported bugs first.

## 8. Next session
See "Next session: owner art and dialogue" in section 0. Fix reported bugs first; tune `balance.soul` and the seal numbers after the owner plays.

### Dating systems (snapshot v14)
After hours, bond stages, route milestones, gifts, rivals, confession and route, earned options, texts and memory flags are in. Spec and art wishes: `docs/VN_WRITING.md` ("Dating systems as built"). Code: `ministry/dating.ts`, `ministry/decisions.ts` (`conditionsHold`, `quiet`), UI `soul/DatingDock.tsx`, `soul/Dossier.tsx`, `gameover/EndingScene.tsx`. Data: `story.json`, `gifts.json`, `messages.json`, `memories.json`.

### Catalogue redesign (docs/TREES.md)
Shared access rules live in packages/content/src/catalogue.ts (`access`, `upgradeCost`); sim placement goes through progression/access.ts, `upgradeFacility` in commands/upgrade.ts, snapshot v13 (migrateV12, `bondGiven`). UI reads the same `access()` for tags and lock reasons. Balance: `tools/sim-cli/src/soulRun.ts [scenario] [days] [seeds] [synthetic|biotech|greentech|all]` with the scripted player in player.ts.
