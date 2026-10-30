# Achievements and off-duty gallery

Status: **approved by the owner (Oct 30). Not built yet.** This is the build spec. Read against branch `claude/youthful-ramanujan-msqcy9`. It supersedes `docs/OFF_DUTY.md` (that file lived only on `wip/off-duty` and its art rule is dropped). The gallery scene lines are written: they are the `ach_*` scenes in `docs/NEW_SCENES.md` (typo fixes applied). Portrait art is saved, unregistered, on branch `wip/gallery-art`.

Decisions in force: 18 achievements; failure endings kept and hidden; bed set = all 18 earned; Month of Calm = 20 days; the profile travels in the save export/import file; the epilogue bar is 50 (already in code); `les_stars` is replaced by `heard_out`.

## 0. What I found in the code that changes the plan

1. **No commit step exists.** `HANDOFF.md` section 0 still talks about "commit to a tree". The code does not: `soul.ts` (header, lines 1-12) says "There is no commit and no bond gate". There is no `commitPath` field anywhere. Trees are chosen by retrofitting racks. So no achievement may use `commitPath`.
2. **Snapshot version is 15** (`packages/sim/src/snapshot/migrate.ts:44`). The streak field makes it 16.
3. **Uptime is 0..1.** `economyStep.ts:52`: `m.uptime = should > 0 ? sum(ringRunning) / should : 1`. A day's mean is stored in `AuditDay.uptime` (`audit.ts:89`), also 0..1. Careful: with no racks wanted to run, uptime is exactly `1`. A streak must also require `metrics.pflops > 0`.
4. **Corruption is 0..1** (`corruption.ts`, clamped `Math.min(1, ...)`). Absorbed fires at `>= 0.99` once `tier >= 3` (`path.ts:9`, `balance.json:131-136`).
5. **Seal numbers** are 0..`sealMax` (100) in `view.soul.seal`, but can exceed 100 once a tree is closed. A headless Lattice run ended at bio 100.6 and green 161.
6. **Bond 60 was hard, so the epilogue bar is now 50** (`balance.json` `soul.bondEpilogue`, done in code). Scripted runs ended with Luci 61, Bea 54, Mel 38, Cass about 30; the best scene answers add at most Luci 22, Bea 16, Mel 15, Cass 13 on top of `bondStart` (Luci 30, others 20). A followed memo adds +3 (`balance.json` `bondFollow`), plus +1 once `openDoor` is unlocked (`decisions.ts:264`). Achievements use 50 for "close" and 40 for "all four". Read bonds from `view.soul.bonds` (there is no `view.bonds`). The scripted player picks the best cash answer, not the advisor's, so a human who follows one advisor will do better; re-check after the owner plays.
7. **Endings and ids** (`packages/content/src/data/endings.json`):

| Ending | `endings.json` id | How `state.gameOver` records it |
|--|--|--|
| The Lattice | `singularity` (NOT `lattice`) | `{kind:"victory", ending:"singularity"}` (`soul.ts:139` maps it, `setGameOver` at `soul.ts:148`) |
| The Flesh | `flesh` | `{kind:"victory", ending:"flesh"}` |
| The Garden | `garden` | `{kind:"victory", ending:"garden"}` |
| Absorbed | `absorbed` | `{kind:"absorbed", ending:"absorbed"}` (`path.ts:9`) |
| Bankrupt | on youthful: no ending row; on `wip/endings`: row `bankrupt` | `{kind:"bankrupt"}` with **no** `ending` (`economyStep.ts:71`, `gameOver.ts`). `wip/endings` only adds `bankrupt` to `EndingId` and maps it in the UI helper `endingOf`. The sim does not change. |

The Lattice is `singularity`. Rule of thumb for code: win = `gameOver.kind === "victory"` and read `gameOver.ending`; failures read `gameOver.kind`.

## 1. How achievements scale

**Lifetime, not per run.** One browser profile, key `aitower.profile`, version 1: `{ v:1, earned: { [id]: { day, ending } }, epilogues: { luci, mel, bea, cass } }`. This follows the existing pattern: `aitower.lessons.v1` and its helpers live in `packages/shared/src/index.ts` (key at line 238, helpers 241-290). Put the profile helpers there too (best effort, try/catch, game works without storage). Once earned, always earned. A save load never removes one.

**Checks run in the UI, not the sim.** The sim stays deterministic and knows nothing about achievements. The app reads the view on three moments: (a) day close (the `newDay` event, `api.ts:176`), (b) the `gameOver` event, (c) the `decisionResolved` and `quarterReport` events. This needs no sim change except one field (section 2).

**Where they count.** Only normal runs (not lessons, not sandbox: `state.sandbox`, not `window.__aitower` pokes in dev builds). Lessons count only through `les_done`.

**Count: 18.** 100% means all 18, hidden ones included.

**Profile also travels with the save file.** The profile (achievements and gallery) is included in the existing save export/import file (`packages/ui/src/menu/fileIO.ts`, menu "Export to file" / "Import from file..."). Import merges: earned achievements are the union, nothing is ever removed.

**Difficulty spread.** By difficulty: 3 at 1, 4 at 2, 7 at 3, 4 at 4. None is 5. A skilled player needs about 3 winning runs (one per tree), 1 deliberate Absorbed run, 1 quick Bankrupt run, and 2-4 runs to land the hard ones (fast win, clean hands, open hands, whole crew, month of calm). That is **7-10 runs**. Most achievements overlap in a single run: the Lattice run can also give Level Five, Deep Pockets, Clean Books, a Perfect Quarter and Luci close. Headless runs for reference (`soulRun.ts starter`, scripted player): Lattice 28 days, Flesh 43, Garden 42; targets 25/40/38; Level 5 on day 25 in the Lattice run only.

**Hidden.** Two only: the two failure endings, kept in the 18. Their line in the list reads "???  There is another way this ends." They reveal when earned. Everything else is visible, with a plain hint.

## 2. New state needed

| Field | Why | Cost |
|--|--|--|
| `SimState.uptimeStreak: number` (days) | "Month of Calm" and Cass's portrait. Cannot be derived: `audit.days` is cleared every period and wiped when `irreversible` (`audit.ts:77-86`); `view.reports` keeps only 8 quarters. | Snapshot **v16**: migration default 0 in `migrate.ts`, accept in `snapshot/validate.ts`, add to `SimView`/`view.ts`. |

Update rule, in `closeAuditDay` (`audit.ts:72`) **before** the `irreversible` early return: `dayMean = a.samples>0 ? a.uptimeSum/a.samples : metrics.uptime; streak = (dayMean >= 0.99 && state.metrics.pflops > 0) ? streak+1 : 0`. Use the day mean, 0..1. Reset to 0 on a miss.

Everything else is read from fields that already exist. Nothing else needs a new field.

## 3. The achievements

Legend: **Run** = the achievement can be earned in one run (the profile latches it for life). "Check" names the fields. View names are `SimView`; state names are `SimState` (`core/state.ts`).

| id | Name | Player-facing text | Exact check | When | Hidden | New field | Diff |
|--|--|--|--|--|--|--|--|
| `end_lattice` | Sensible Option | Finish the game on The Lattice. | `gameOver.kind==="victory" && ending==="singularity"` | game over | no | no | 1 |
| `end_flesh` | The Flesh Remembers | Finish the game on The Flesh. | `ending==="flesh"` | game over | no | no | 3 |
| `end_garden` | Roots Check | Finish the game on The Garden. | `ending==="garden"` | game over | no | no | 3 |
| `end_absorbed` | Merged | Let the inspectors take you. | `gameOver.kind==="absorbed"` (state `corruption>=0.99`, `tier>=3`) | game over | **yes** | no | 3 |
| `end_bankrupt` | Notice of Termination | Run out of money for a full day. | `gameOver.kind==="bankrupt"` (cash below 0 for 1440 ticks) | game over | **yes** | no | 1 |
| `lvl_five` | Level Five | Reach Level 5. | `state.tier>=5` (PFLOPS 3000, `balance.tiers.pflops`) | day close | no | no | 3 |
| `rung_top` | Top Rung | Hold a top-rung rack of any tree. | `view.soul.trees[t].rung===4` for any t | day close | no | no | 2 |
| `fast_win` | Ahead of the Plan | Win with days to spare: Lattice by day 25, Flesh by day 40, Garden by day 38. | at game over: `floor(gameOver.tick/1440)+1 <= {singularity:25, flesh:40, garden:38}` | game over | no | no | 4 |
| `clean_hands` | Clean Hands | Win the Flesh or the Garden with that tree's secret meter under 30 (of 100). | `ending flesh/garden` and `soul.seal[biotech\|greentech] < 30` | game over | no | no | 3 |
| `open_hands` | Open Hands | Win the Lattice without closing either other tree. | `ending==="singularity"` and `soul.seal.biotech<100` and `soul.seal.greentech<100` (`sealMax`) | game over | no | no | 4 |
| `cash_deep` | Deep Pockets | Have $10M in the bank at day end. | `state.cash>=10_000_000` | day close | no | no | 3 |
| `books_clean` | Clean Books | Win with no loan and at least your starting cash. | any win and `loan.principal===0` and `cash>=balance.startingCash` (3M) | game over | no | no | 2 |
| `perfect_qtr` | Perfect Quarter | File an audit with grade A and uptime of 99% or better. | `quarterReport` event: `view.reports.at(-1).grade==="A" && .uptime>=0.99` | quarter report | no | no | 2 |
| `calm_month` | Month of Calm | Keep uptime at 99% or better for 20 days in a row. | `state.uptimeStreak>=20` | day close | no | **yes** | 4 |
| `bond_close` | Someone You Trust | Get any advisor to 50 trust. | `max(view.soul.bonds)>=50` | day close | no | no | 2 |
| `bond_crew` | The Whole Crew | Get all four advisors to 40 trust in one run. | `min(view.soul.bonds)>=40` | day close | no | no | 4 |
| `les_done` | Student | Finish every lesson. | `loadLessonProgress().done` has every `content.lessons` id | lesson end | no | no | 1 |
| `heard_out` | Heard Her Out | See an ending epilogue from each of the four advisors, across any runs. | profile `epilogues` has luci, mel, bea and cass; on game over the profile records the epilogue advisor actually shown (not the fallback) | game over | no | no | 3 |

Notes on the harder ones:
- `calm_month`: headless weekly uptime means were 98.3 to 99.3% even for a scripted player, so a 99% daily mean for 20 straight days (with `pflops > 0`) is a real task. The owner set 20 (30 is almost a whole run).
- `fast_win` targets come from `tools/sim-cli/src/soulRun.ts` (`TARGET_DAYS` 25/40/38). The old `HANDOFF.md` quoted 25/38/44: confirm which is current before building. The scripted player is 10-13% over target, so a skilled human should beat it.
- `open_hands` is the least certain: the scripted Lattice run closed both other trees. Verify with a purpose-built run before shipping. If it proves too hard, drop to "one tree closed at most".
- `clean_hands`: scripted Flesh run ended with bio seal 0, scripted Garden run with green seal 40 (so the Garden is where this bites).
- `books_clean`: the scripted Lattice run ended with $3.01M, right at the bar. Adjust once a human plays.
- Story choices: `decisionHistory` keeps only 20 (`state.ts:363`), so no achievement counts choices. If you want story-choice achievements later, count `decisionResolved` events (`api.ts`, has `eventId` and `choiceId`) in the profile.

## 4. Off-duty portraits (revamped)

The old `OFF_DUTY.md` rules (superseded) used `bondStage()` "Devoted" and a 30-day streak. Bond stages are gone. These rules use only bond number, ending, corruption, seal, loan, and the one streak field. Each check is made at the moment named. Once met, the profile latches it (`aitower.profile.offDuty.<advisor>.casual = true`).

### Casual set (one per advisor, each from her own story)

| Advisor | Portrait | Rule in plain words | Exact check | Fires | Caption (her voice) |
|--|--|--|--|--|--|
| Luci | Red dress, whisky, lounge | "Close the books on the Lattice, with her on your side." | `ending==="singularity"` and `loan.principal===0` and `view.soul.bonds.luci>=50` | game over, on the ending screen after her epilogue | "Off the clock. Don't enter the whisky, Operator." |
| Mel | Lab coat, feet up at her desk | "Finish the Flesh and stay mostly yourself, with her trusting you." | `ending==="flesh"` and `corruption<0.5` and `view.soul.bonds.mel>=40` | game over | "Hm. Feet up. I read that helps. It does, a little, if you like." |
| Bea | Barefoot, fishing at the river | "Win the Garden honestly, with her trusting you." | `ending==="garden"` and `soul.seal.greentech<50` and `view.soul.bonds.bea>=50` | game over | "Okay. Okay. Nothing's biting. Best day I've had." |
| Cass | Hot tub | "Keep the tower steady for a long stretch." (same as `calm_month`) | `state.uptimeStreak>=20` | day close, the day it reaches 20, mid-run | "It's holding. Don't say anything. Just sit." |

Why each fits: Luci is money and the Lattice (the clean ledger is her win). Mel is the Flesh and "someone willing to be next to her": the corruption cap keeps you human and her bond means you stayed. Bea is the Garden and her fear that green is "a paint job": the low green seal is the proof it was not. Cass is the one who fixes the compressor at night: steady uptime is her work. Luci and Bea use bond 50 (Luci reached 61 and Bea 54 headless; both need to follow her on purpose). Mel's bond bar is 40 (she reached 38 headless). Re-tune after a human check (section 0, point 6).

Each portrait is also an unlock for the gallery only. Casual portraits are NOT part of the 18.

### Bed set (the easter egg)

**Rule: all 18 achievements earned. All four bed portraits unlock together.** Check: `Object.keys(profile.earned).length === 18`, fired the moment the 18th lands (toast, then a one-time gallery scene `ach_bed_intro`). It needs every ending including both failures, `heard_out`, and the skill ones: about 7-10 runs, with no grind counters.

Art: the owner's portraits stand as delivered. The old OFF_DUTY.md art rule is dropped. Files are on `wip/gallery-art`: `{luci,mel,bea,cass}-offduty.webp` (casual) and `{...}-offduty-night.webp` (bed set).

## 5. Gallery and notification UX

- **Where.** A new ACHIEVEMENTS entry on the title screen (beside Lessons, `packages/ui/src/title/TitleScreen.tsx`) and the pause menu. It has two pages: LIST and OFF DUTY. The ending screen (`gameover/GameOverScreen.tsx`) adds one line if the run earned something new: "New: Clean Hands".
- **List page.** One row per achievement: name, text, a check mark if earned, the date (game day) and the ending it came with. A counter at the top: "11 / 18". Locked rows show name and text greyed. Hidden rows show "???  There is another way this ends."
- **Off duty page.** Four frames. Locked frame: the advisor's base bust, dimmed, plus her old-style hint line (use these four: Luci "Close the books. All of them. Then we'll see.", Mel "Come all the way. Keep something of yourself. Then I'll show you.", Bea "Show me the Garden. Not a certificate.", Cass "Hold it up for a month. I'll tell you when I'm asleep."). The plain rule is shown only when her bond reached 30, so the player can aim. Unlocked: click to see the portrait with the caption. The bed set is a second row, locked as four blank frames labelled "???" until the 18th.
- **Toast on unlock.** A small PC-98 strip, top centre, 4 seconds, game keeps running: "ACHIEVEMENT  Clean Hands". For a portrait unlock: "OFF DUTY  Mel has a new portrait" (this one waits until the pause menu or ending screen if it fires mid-run, so it never covers a decision). Hidden ones toast with their name.
- **Sound.** Reuse an existing UI chime. No new audio.

## 6. Build cost

**Medium.** About 6 new files, 5 edited, 1 snapshot bump.

| Area | Files | Size |
|--|--|--|
| Sim (only for the streak) | `core/state.ts` (field), `economy/audit.ts` (update), `view/view.ts` + `api.ts` (expose), `snapshot/migrate.ts` (v16 default 0), `snapshot/validate.ts`, `snapshot.test.ts`, one new test | small |
| Shared | `packages/shared/src/index.ts`: profile load/save/record (beside lesson progress); `packages/ui/src/menu/fileIO.ts`: write the profile into the export file, merge it on import | small |
| UI logic | new `packages/ui/src/achievements/achievements.ts` (the 18 defs and pure `evaluate(view, event, profile)`), `achievements.test.ts` | medium |
| UI screens | new `AchievementsPage.tsx`, `Toast.tsx`, css; edits to `TitleScreen.tsx`, `GameOverScreen.tsx`, `Hud.tsx` hook | medium |
| Content | 18 text rows in `packages/content/src/data/achievements.json` (+ schema/validate), the 4+4 captions | small |
| Art | 8 portraits, webp, saved on `wip/gallery-art`; register in `packages/ui/src/art/` when building | done |

Risks:
- **Determinism.** Keep checks out of the sim. Only the streak is in the sim, and it is a pure function of existing metrics, so `determinism.test.ts` still passes; re-run it.
- **Save migration.** v16 must default the streak to 0 on old saves; a loaded save mid-streak just restarts the count. Check `validate.ts` rejects nothing valid.
- **Load/reload.** Checks must only fire on events or day close, not on load, so loading an ending-state save does not re-grant. Idempotent latch handles repeats.
- **Cheating by dev tools.** `window.__aitower` (dev builds) can give anything. Block awards when `import.meta.env.DEV` or when the run used it.
- **Storage.** Private windows or cleared data lose the profile unless it was exported in a save file. Say so on the page ("Saved in this browser; Export to file keeps it").
- **Merge.** The endings and lessons work is already on youthful (4 lessons, Bankrupt ending), so no merge conflict is expected from `wip/endings` or `wip/lessons`.
- **e2e.** `e2e/smoke.mjs` should get one step: open the page, expect "0 / 18".
- **Balance numbers are from scripted bots.** The scripted player does not follow advisors, so bond and fast-win numbers need one human check.

## 7. Scenes this needs 

Written already: see `ach_*` in `docs/NEW_SCENES.md` (typo fixes applied). Short VN moments, 2-4 lines each.

| id | Where | Purpose |
|--|--|--|
| `ach_unlock_luci`, `ach_unlock_mel`, `ach_unlock_bea`, `ach_unlock_cass` | After the toast for her casual portrait | Her reaction when you open the frame (the caption in section 4 is the last line). |
| `ach_bed_intro` | Gallery, on the 18th achievement | Short narrator beat: the four doors, one after the other. No dialogue from a single advisor. |
| `ach_bed_luci`, `ach_bed_mel`, `ach_bed_bea`, `ach_bed_cass` | Opening each bed portrait | One line each, at rest. Quiet, no pose aimed at the viewer. |
| `ach_hint_*` (four) | Locked-frame hint | Reuse the four hint lines above; they may need a line-edit pass for the VN bar. |
| `ach_gallery_empty` | First visit | One narrator line. Optional. |
| `end_bankrupt_note` | Ending screen | Matches the achievement text "Notice of Termination". |

Total: about 12 short scenes or lines.

## 8. Fixes folded in from verification

All applied above: bonds from `view.soul.bonds`; `bondFollow` +3 (+1 with `openDoor`); lesson key at `shared/src/index.ts:238`; Lattice victory `soul.ts:139` and `:148`; difficulty spread 3/4/7/4; `les_stars` replaced by `heard_out`.

## 9. Build order

1. Sim: `uptimeStreak` and snapshot v16 (tests first). 2. Profile helpers and the file-export merge. 3. `achievements.ts` with pure `evaluate`, plus tests. 4. Sample first: wire one unlock (for example `end_lattice`) and show it in game, toast and list row. 5. The page, toast, ending-screen line. 6. Register the portraits from `wip/gallery-art`; add the `ach_*` scenes.
