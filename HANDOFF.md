# HANDOFF (short)

Older long notes: [docs/HANDOFF_ARCHIVE.md](docs/HANDOFF_ARCHIVE.md) (verbatim). Open it only when you need a detail.

## 0. What the game is, and the doc map

AI Tower is a browser datacenter-management game in a PC-98 style. You are the Operator of a tower. Four advisors (Luci, Mel, Bea, Cass) talk to you in visual-novel scenes.
You grow racks and power, and retrofit them toward one of three trees: Lattice (synthetic), Flesh (biotech), Garden (greentech). There is no commit step: a tree is chosen by retrofitting.
Endings: Lattice, Flesh, Garden, plus the failures Absorbed and Bankrupt. The sim is deterministic; the UI reads a view of it.

Docs: `docs/SOUL.md` (design core), `docs/STYLE_PC98.md` (look), `docs/TREES.md` (trees), `docs/VN_WRITING.md` (voices), `docs/ACHIEVEMENTS.md` (spec, built), `docs/ACHIEVEMENTS_TEXT.md` (owner edit file), `docs/LESSON_PLAN.md`, `docs/OWNER_TEXT.md`, `docs/ICON_PROMPTS.md`, `docs/PLACEHOLDER_TEXT.md` (all Claude-written placeholder text), `docs/NEW_SCENES.md` (new scenes incl. `ach_*`), `docs/DIALOGUE.md` (every line, export), `docs/ART_NEEDED.md` (art slots).

## 1. State on Oct 31 (end of session 3)

- Live main = `2a99835` (unchanged). Branch `claude/youthful-ramanujan-msqcy9` head `422328d` (+ this handoff commit). UNRELEASED.
- All checks pass: `npm run check` (1677 tests), build, budget 1769/3000 kB, e2e, dialogue `--check`, `npm audit` 0.
- Done on the branch this session:
  - Per-lesson star rules (`stars2`/`stars3` + `star2Text`/`star3Text`) for lessons 1-6, lesson `failed` text, `nextLessonOf`, `lessonTotal`.
  - New lesson 5 Going Liquid (Cass, scenario `lesson_liquid`, coolant-pipe build step with "DRAG A PIPE HERE" ghost) and lesson 6 Lights Out (Bea, scenario `lesson_lights_out`, scripted grid trip). Lessons 1-6, no gap.
  - Lesson 4 outro = owner's new words. Lesson 3 outro and lesson 4 opening ("Bea again. Last lesson...") kept by owner's choice.
  - Handbook "More guides": two pages (Loans, penalties and the audit; Climbing a tree's ladder).
  - Credits screen (title menu + system drawers): owner lines incl. "Game design and direction: Perry", plus all 168 quotes read from content data. Both doubtful quotes now have primary sources (Weinberg, Science 177, 1972, p.33; Verne, The Mysterious Island Part 2 ch. 11). `docs/QUOTES_CHECK.md` updated.
  - Bankrupt note slot `ach.ui.end_bankrupt_note`, shown in the ending's service-record panel when `end_bankrupt` unlocks. The owner left it EMPTY in `docs/OWNER_TEXT.md`, so the placeholder "The lamp in the control room stays on." is still in the game.
  - Importer (`tools/dialogue/import.ts`): OWNER_ALIASES (end_bankrupt_note, credits.*) and `scenario.<id>.description` slots. Starter description imported.
  - Locked gallery portraits: dimmed head crop (per-advisor box `LOCKED_LOOK` in `packages/ui/src/achievements/gallery.ts`; "hide" gives a lock tile). Locked frames show the owner's hint lines.
  - vitest 3.2.7 -> 5.0.5; `npm audit` clean.
  - `fast_win`: the owner's new text says day 40 for all three trees. The owner's note read "not the 40 day change"; Opus took it as "note the 40 day change". So `FAST_WIN_DAYS` is now 40/40/40 (`packages/ui/src/achievements/achievements.ts`; also `tools/sim-cli` soulRun TARGET_DAYS and `tools/sim-cli/src/fastwin.test.ts`). CONFIRM WITH OWNER. Revert is commit 422328d. Headless check before the change (24 seeds, scripted player), best/median days: Lattice 23/28, Flesh 39/42, Garden 37/41. At 40, Lattice is easy, Flesh and Garden are fair. Opt-in test: `FASTWIN=1 npx vitest run tools/sim-cli/src/fastwin.test.ts`.
  - Owner imported their edits of `docs/ACHIEVEMENTS_TEXT.md`, `docs/OWNER_TEXT.md`, `docs/PLACEHOLDER_TEXT.md` (dry-run, then `--write`). Plain line `ch:books.p1` "The Bank lends" applied by hand.
  - Cleanup: `docs/DIALOGUE_NEW.md` deleted, stale docs and comments fixed, `docs/ROADMAP_1.0.md` marked historic, reputation notes fixed.

## 2. Owner decisions on record

- The owner's words win over ours, in every dialogue file. Keep the owner's spelling exactly; never fix typos without asking.
- All Claude-written text is placeholder. It is catalogued in `docs/PLACEHOLDER_TEXT.md`. The owner rewrites it later. Import it with the importer; plain `key (file)` lines are moved in by hand.
- Bed set unlocks at 100% (all 18 achievements); the four bed portraits unlock together.
- Month of Calm and Cass's portrait: streak of 20 days at 99% uptime with pflops > 0.
- Failure endings (Absorbed, Bankrupt) are achievements, hidden.
- Profile (achievements, gallery) goes into the save export/import file; import merges.
- `end.flesh.title` and `heat_tariff_revision.vote.mel` are deliberately kept as the wip/endings wording.
- Lessons must not spoil the plot: no seal, closed trees, bonds, epilogues or endings in lesson text.
- Icons and menu pictures: image sheets from ChatGPT. In-tower (world) sprites stay drawn in code; a one-rack image test (sheet 9 in `docs/ICON_PROMPTS.md`) is optional, later.
- Locked gallery portraits = head crop (done).
- Credits: code by Claude; all art generated with ChatGPT, some sprites by Claude; inspired by SimTower, nothing borrowed; quotes credited with sources. Design line = "Perry".
- `fast_win` days 40 / 40 / 40 (to confirm, see section 1).
- Nothing goes to main until the owner has play-tested and says so. Then a new README for players.

## 3. Next, in order

a. Ask the owner, in one short message:
   1. Confirm `fast_win` 40/40/40.
   2. The bankrupt note line (still placeholder).
   3. Possible typos in their lines. Fix only on a yes: "Water needs a plumping" (`liquid.pipe.say3`), "favortie" (`lights_out.battery.after1`), "when the grid runs fails" (`lights_out.genset.after1`), "doing it's job" (`lights_out.outage.say2`).
   4. The Handbook Level chapter line "Ignoring a tree's seal until it closes." (`packages/ui/src/handbook/chapters.ts`, `levelAdvice`) mentions the seal: keep or new words.
   5. Keep or drop branches `wip/gallery-art` and `wip/off-duty` (each 1 commit not in main) and `claude/serene-ramanujan-ojshkh` (six 2-3 MB concept PNGs).
b. The owner deletes these merged remote branches by hand on GitHub (agents get HTTP 403 on delete): `wip/dialogue-import`, `wip/endings`, `wip/lessons`, `wip/owner-art`, `wip/owner-dialogue`, `wip/tree-sprites`.
c. Give the owner a playable build to play-test. Fix what they report.
d. Optional, the owner sets priority:
   - Achievement balance in real play (`calm_month`, `open_hands`, `books_clean`, bond bars).
   - `docs/BALANCE_AUDIT.md` open items: L4 research wall now ~3.5x L3 per node; AC-3 `rack_air_gpu2` dominated by LC-2.
   - 17 support items and ML-1 use a tinted base sprite (list in `docs/ART_NEEDED.md` A2).
e. When the owner says yes: full verify (Haiku), push the branch to main, check the live Pages links, then write a new README for players and visitors (what it is, how to play in the browser, screenshots, controls, credits; dev notes to a short section or `docs/`).

## 4. How to work

- Opus coordinates only. Sonnet builds and writes. Haiku verifies. One worktree agent per task.
- NEVER run `tsc -b` or plain `npx tsc`. Use `npm run check`.
- Sample before bulk. The owner's words win. Keep messages to the owner short and plain.
- Never commit an original image over 1 MB without asking.
- Worktree agents must not check out a branch the main folder has checked out. Keep the main folder detached, or push with a `local:remote` refspec.
- Integrate parallel task branches with one merge agent, then a Haiku verify, then push with a `local:remote` refspec.
- A fresh clone needs `.claude/` in `.git/info/exclude` (agent worktrees live there).
- `perf.test.ts` is flaky under load: rerun it alone.
- e2e: when other agents run, use a private port: `E2E_PORT=<free port> npm run e2e`. Never kill other servers. "Port 4173 in use" means a server is already there; pick another port.
- Images: recipe is in `docs/HANDOFF_ARCHIVE.md`, section "How to drop in an image".
- Dialogue: `npx tsx tools/dialogue/export.ts` -> edit -> `npx tsx tools/dialogue/import.ts <file>` (dry-run is the default; `--write` to apply). `export.ts --check` verifies the grammar.

## 5. Known issues

- Bond 50 is hard for Mel and Cass in headless runs (scripted player does not follow advice). Check with a human.
- The full test run can fail on timing (perf, snapshot, economy, ministry, determinism) when several agents run at once. Rerun alone, or verify on a quiet machine.
