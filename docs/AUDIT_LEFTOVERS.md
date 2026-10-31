# Audit: leftovers after the redesign

Scope: reputation removed; commit and bond gates, after-hours, texts, gifts, confession and FORM A-5 removed; retrofit added. The audit was read-only; the cleanup pass below changed code (see Status). Each finding has a recommendation: **remove**, **fix** or **keep**.

## Status (cleanup pass)

Done:
- **2** Lessons: five lessons now exist in `lessons.json` and each outro points to the next one that exists (fixed, verified Oct 30).
- **3** Absorbed ending: has `bg-end-absorbed` art and epilogues for all four advisors (fixed, verified Oct 30).
- **8** Stale comments in `Inspector.tsx`, `advisors/suggest.ts` and `packages/sim/src/api.ts` reworded.
- **9** Reputation mentions removed from the AGENTS.md files (kept only as a history note).
- **1** Singularity help text rewritten to the current rules (`packages/ui/src/help/helpText.ts`). Click now names the Trees panel.
- **4** `PathGauge.tsx`, `PueGauge.tsx` and `pathGauge()` removed, with their test case in `m4.test.tsx` and their CSS (`.ui-pathgauge`, `.ui-gauge*`). `paths/paths.ts` stays: `droughtChip` and `SANDBOX_TITLE` are still used by `TopStrip.tsx`. `Dial.tsx` stays (Inspector uses it).
- **5** `tools/sim-cli/src/run.test.ts` real-content test has an explicit 120 s timeout (it runs about 50 s alone).
- **6** FORM A-5 state and menu controller removed from `Hud.tsx`; the `ascension.ts` header no longer describes the commit sheet.
- **14** Mel's line in `events.json` (and `docs/DIALOGUE.md`) now reads "The contract limits…".
- Stale mentions of PueGauge and PathGauge removed from `packages/ui/AGENTS.md`.

Not done (out of this pass):
- **7** `balance.ascension.minTier` rename: not renamed (key is used by validate.ts, tests and the schema); the schema comment and test title now say it is the Absorbed threshold.
- **11, 12** Scenario description and `m4ids.ts`: low priority.
- Commit wording in `docs/SOUL.md`, `docs/VN_WRITING.md` and `docs/TREES.md` was left as design history.
- `events.json` "gift basket" (Form 9B outcome) is a flavour line, not the removed gift mechanic; left as is.

## Baseline

- `npm run typecheck`: passes.
- `npm run check:boundaries`: passes.
- `npm run lint`: passes with 5 warnings: `packages/content/src/tier.ts:78` (noNonNullAssertion) and `packages/sim/src/bio.test.ts:834, 858, 874, 875` (noExplicitAny). The tools script was clean after its own fixes.
- `npx vitest run`: 1477 pass, 1 fails. `tools/sim-cli/src/run.test.ts` "starter run stays profitable" timed out at 5000 ms in the full run. It passes alone (about 50 s). See finding 5.
- Headless scenario check (2 game days each, seed 1): `starter`, `brownfield`, `sandbox` and `lesson_first_watt` all start and run with no error.

## Top 5 by player impact

1. **The Singularity help text describes a commit that no longer exists.** Players reading help are told the Flesh and the Garden "grow only once you commit at Level 3". Retrofit replaced commit (`docs/REFRAME.md`). See finding 1.
2. **The lesson path dead-ends after Lesson 1.** Lesson 1 closes by sending the player to Cass for "Where the Heat Goes", which can't be played. Five of six roadmap rows say "Coming soon". See finding 2.
3. **The Absorbed ending looks unfinished.** It is the only ending with no backdrop and no epilogues. See finding 3.
4. **Two gauge components are never rendered.** Players see no PUE or path gauge, and the code is dead. See finding 4.
5. **A sim-cli test is flaky under the full suite.** It times out at the default 5 s limit, so `npm test` fails for everyone. Players are not affected. See finding 5.

## Findings

| # | Area | What | Where | Why it hangs | Recommendation |
|--|--|--|--|--|--|
| 1 | Help | Singularity help says the Flesh and the Garden "grow only once you commit at Level 3". It also says "Click: dossier", but the click opens the Trees panel. | `packages/ui/src/help/helpText.ts:18`; the click target is `packages/ui/src/soul/SoulGauge.tsx:5` | The commit gate was removed. The sim has no commit command (`soul.test.ts:205`). The encyclopedia's Singularity entry (`encyclopedia/entries.ts:83`) already has the correct rule. | **Fix** the help text to match the encyclopedia: each tree fills from its own racks, click for the Trees panel. |
| 2 | Lessons | Lesson 1 is complete and loads (`lesson.test.ts:93`), and its numbers match the balance (40 kW per rack, 53 kW hall, 120 kW feeder). But its `outro` and `next` send the player to "Where the Heat Goes", which is not in `lessons.json`. Lessons 2 to 6 are "Coming soon" rows. | `packages/content/src/data/lessons.json` (`first_watt.outro`, `first_watt.next`); `packages/ui/src/lessons/lessons.ts` (`ROADMAP`); `packages/ui/src/lessons/LessonList.tsx`; `packages/ui/src/lessons/LessonLayer.tsx:322` | Lesson 2 was never built. The result screen labels it "(coming soon)", which is honest, but the outro is a promise the game does not keep. | **Fix** (owner decision): either build Lesson 2, or reword the outro to drop the Cass pointer. Keep the roadmap rows until Lesson 2 exists. |
| 3 | Endings | Absorbed has no `backdrop` and no `epilogue`, so its screen is text only. The other three endings have art and one epilogue per advisor. | `packages/content/src/data/endings.json` (`absorbed`); `packages/ui/src/gameover/EndingScene.tsx:53` | Art and epilogues were never written for it. | **Keep** as a deliberate secret ending, or **fix** by adding a backdrop (ART_NEEDED B2) and epilogues. |
| 4 | UI | `PathGauge.tsx` and `PueGauge.tsx` are not imported anywhere. `pathGauge()` in `paths.ts` only feeds `PathGauge`. No screen renders any of the three now. | `packages/ui/src/paths/PathGauge.tsx`, `packages/ui/src/paths/paths.ts`, `packages/ui/src/components/PueGauge.tsx` | No render path. | **Remove** all three (or move to a dev fixture if the owner wants them back). |
| 5 | Tests | `tools/sim-cli/src/run.test.ts` "starter run stays profitable" timed out at 5000 ms in the full suite run. Alone it passes, in about 50 s. | `tools/sim-cli/src/run.test.ts:22` | The test runs 15 real game days with no per-test timeout. | **Fix**: give that test an explicit timeout (60 s) or cut it to fewer days. |
| 6 | Dead code | `FORM A-5` pause is still wired in the HUD: `_ascensionOpen` state and an `ascension` menu controller. Nothing ever opens it. The comments still mention the commit sheet. | `packages/ui/src/Hud.tsx:67-70`, `:172`; `packages/ui/src/ascension/ascension.ts:2` (header comment) | Left over from the commit sheet. | **Remove** the controller and state; keep the header comment's history line or cut it. |
| 7 | Config and tests | `balance.ascension.minTier` is 3. Its only use now is the Absorbed threshold (`packages/sim/src/bio/path.ts:9`). The name and a test still say "opens the tree commitment at Level 3". | `packages/content/src/data/balance.json`; `packages/content/src/biotech.test.ts:98`; schema comment `packages/content/src/schema.ts:368` | The key outlived the commit it was named for. | **Fix**: rename the key (e.g. `absorbed.minTier`) and the test title. Coordinate with whoever owns `balance.json`. |
| 8 | Comments | Stale mentions of commit or path choice: `Inspector.tsx:147` ("commit, bond"), `advisors/suggest.ts:207` ("the committed tree"), `packages/sim/src/api.ts:624` ("the UI pre-selects the leading path for the player to confirm", and there is no confirm UI). | as listed | Leftovers from the commit design. | **Fix** the comments. No player impact. |
| 9 | Dev docs | `packages/content/AGENTS.md` and `packages/sim/AGENTS.md` still mention reputation. | as listed | Stale developer docs. | **Fix** the wording. |
| 10 | Dev fixtures | `packages/ui/src/dev/fakeStore.ts:40` has a "Form A-9" memo. The "Form 9B" event in `events.json` is a live ministry memo and stays. | as listed | Dev-only fixture. | **Keep**. |
| 11 | Scenarios | The `starter` scenario has no `description`. The other three do. | `packages/content/src/data/scenarios.json` | Missing copy. | **Fix** (owner copy), low priority. |
| 12 | Content | `packages/content/src/m4ids.ts` is imported only by tests. | `packages/content/src/m4ids.ts` | Test-only id lists. | **Keep**, or move it under test helpers. |
| 13 | Sim migration | Migration still handles the dating, commit and reputation fields (`snapshot/migrate.ts` v10 to v15, the `standing` deletion, the removed `route`, `flags`, `afterHoursDay`, `inbox`, `messageDay`). Tests confirm they are dropped from loaded state. | `packages/sim/src/snapshot/migrate.ts`; `soul.test.ts:209`; `catalogue.test.ts:269` | Needed to load old saves. | **Keep**. |
| 14 | Content text | Mel's vote on `heat_tariff_revision` says "The commitment limits how hard I can push the racks." It means a feeder contract term, not the removed tree commit. | `packages/content/src/data/events.json` (`heat_tariff_revision`) | Wording collision only. | **Keep**, or reword to "The contract limits…" to avoid confusion. |

## Checked and clean

- **Lessons:** only `first_watt` exists in `lessons.json`. Its `allow` and `slot` items exist in `facilities.json`, and its metrics (`racks`, `racksBusy`, `headroomPct`, `shortKw`) are computed in `packages/sim/src/lesson/lesson.ts`. I did not check each handbook anchor by hand; `handbook/links.test.ts` covers those.
- **Glossary:** every `{{term}}` marker in the data (`kw`, `capacity`, `headroom`, `genset`) exists in `glossary/terms.ts`.
- **Help and encyclopedia targets:** every `basics:*` and `ch:*` link in `help/helpText.ts` and `encyclopedia/entries.ts` has a matching entry or chapter.
- **Settings:** all 11 keys in `Settings` (`packages/shared/src/index.ts`) are read by the UI, the render or the store.
- **Scenarios:** all four run headless. The brownfield and sandbox descriptions match the data (Level 2 and $350k; Level 5 and $500M).
- **Content files:** all 15 JSON files are loaded by `packages/content/src/load.ts`.
- **UI modules:** every module except the two gauges in finding 4 and the test helper `ui/src/dev/walk.ts` is imported by something rendered.
- **Sim state:** every field in `SimState` (`core/state.ts`) is referenced outside snapshot code and tests. The removed fields survive only in migration code.
- **Tests:** no `.skip`, `.todo` or `.only`. The "no commit, no bond" tests assert that the removed systems stay removed.
- **Story:** all 15 scenes in `story.json` are grouped in `docs/DIALOGUE.md`. Every `rung` and `objection` trigger has a matching tree or facility.
