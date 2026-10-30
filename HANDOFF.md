# HANDOFF (short)

Older long notes: [docs/HANDOFF_ARCHIVE.md](docs/HANDOFF_ARCHIVE.md) (verbatim). Open it only when you need a detail.

## 0. What the game is, and the doc map

AI Tower is a browser datacenter-management game in a PC-98 style. You are the Operator of a tower. Four advisors (Luci, Mel, Bea, Cass) talk to you in visual-novel scenes.
You grow racks and power, and retrofit them toward one of three trees: Lattice (synthetic), Flesh (biotech), Garden (greentech). There is no commit step: a tree is chosen by retrofitting.
Endings: Lattice, Flesh, Garden, plus the failures Absorbed and Bankrupt. The sim is deterministic; the UI reads a view of it.

Docs: `docs/SOUL.md` (design core), `docs/STYLE_PC98.md` (look), `docs/TREES.md` (trees), `docs/VN_WRITING.md` (voices), `docs/ACHIEVEMENTS.md` (spec, built), `docs/ACHIEVEMENTS_TEXT.md` (owner edit file), `docs/LESSON_PLAN.md`, `docs/OWNER_TEXT.md`, `docs/ICON_PROMPTS.md`, `docs/NEW_SCENES.md` (new scenes incl. `ach_*`), `docs/DIALOGUE.md` (every line, export), `docs/DIALOGUE_NEW.md` (imported; see 3g), `docs/ART_NEEDED.md` (art slots).

## 1. State on Oct 30 (end of session 2)

- Live main = `2a99835` (the build the owner played; no bugs found).
- Branch `claude/youthful-ramanujan-msqcy9` head `4ea4bef` (+ this handoff commit), UNRELEASED, all checks pass (check 1655 tests, build, e2e, budget 1752/3000 kB, dialogue `--check`):
  - owner's `DIALOGUE_NEW.md` imported with approved typo fixes;
  - lesson 4 trimmed: no seal or bond talk (owner: it gave away the plot);
  - one-time tips `tip_seal` (Bea, trigger `sealRise` above 10.5) and `tip_bond` (Luci, trigger `bondMoved`), owner's wording;
  - 18 achievements, list + gallery ("Achievements - Gallery", tabs ACHIEVEMENTS / GALLERY), snapshot v16 `uptimeStreak`, profile in the save file;
  - portrait captions = last line of each `ach_unlock_*` scene (derived at load, `captionOf`);
  - all achievement/gallery words are in `docs/ACHIEVEMENTS_TEXT.md` (owner is editing it; import with `import.ts`, dry-run first);
  - owner icon sheets (ChatGPT) sliced with `tools/sprites/slice-sheet.mjs` into 64px atlases in `packages/ui/src/art/`: achievements (18), build menu (76 items, 4 sheets), research (77 ideas, 4 sheets). Shared `components/SheetIcon.tsx`. Prompts used: `docs/ICON_PROMPTS.md`;
  - camera pans the tower ends clear of open overlays (`clampCamera` + `apps/web/src/insets.ts`).
- Main folder is detached; old agent worktrees sit under `.claude/worktrees/` (ignored via `.git/info/exclude`).

## 2. Owner decisions on record

- The owner's words win over ours, in every dialogue file.
- Bed set unlocks at 100% (all 18 achievements); the four bed portraits unlock together.
- Month of Calm and Cass's portrait: streak of 20 days at 99% uptime with pflops > 0.
- Failure endings (Absorbed, Bankrupt) are achievements, hidden.
- Profile (achievements, gallery) goes into the save export/import file; import merges.
- `end.flesh.title` and `heat_tariff_revision.vote.mel` are deliberately kept as the wip/endings wording.
- Lessons must not spoil the plot: no seal, closed trees, bonds, epilogues or endings in lesson text.
- Icons and menu pictures: image sheets from ChatGPT. In-tower (world) sprites stay drawn in code; a one-rack image test (sheet 9 in `docs/ICON_PROMPTS.md`) is optional, later.
- Locked gallery portraits: crop to the head (cut just below the neck) or hide completely. Not the full greyscale picture.
- Credits: code by Claude; all art generated with ChatGPT, some sprites by Claude; inspired by SimTower, nothing borrowed; quotes credited with sources.
- Win-by days for `fast_win`: keep 25 / 40 / 38 (Lattice / Flesh / Garden) for now; verify with a separate test.
- Nothing goes to main until every item in section 3 is done, the owner has play-tested, and the owner says so. Then a new README for players.

## 3. Next, in order

a. Lessons: see `docs/LESSON_PLAN.md` and the chosen version in `docs/NEXT_PROMPT.md` (A = 4 new lessons, B = 2). Fix stars on lessons 1-4 (all are `starred:false`; add per-lesson star rules). Sample one lesson first. Lesson 4 says "Last lesson" / "That's everything I've got" and lesson 3 ends "Where it goes is up to you": ask the owner for new words, do not rewrite them.
b. Owner text: `docs/OWNER_TEXT.md` (starter description, `end_bankrupt_note`, credits lines). Import when the owner sends it back; build `end_bankrupt_note` on the Bankrupt ending screen.
c. Credits screen (title menu): the lines in `docs/OWNER_TEXT.md` plus every quote with author and source. Two quotes are only confirmed on secondary sites (`reactor_licence` / Weinberg, `fuel_cell` / Verne, see `docs/QUOTES_CHECK.md`): find a primary source or mark them "attributed".
d. Locked gallery portraits: crop to the head or hide (section 2). Sample one.
e. Security: `npm audit` flags `vitest`, `tinypool`, `@vitest/mocker` (test tool only, never shipped to players). Upgrade vitest to the fixed major version, fix any test breakage, rerun everything.
f. `fast_win` days: headless runs (`tools/sim-cli`) to confirm 25 / 40 / 38 are reachable but tight; report to the owner.
g. Do without asking:
   - strip the `the_three_trees.*` lines from `docs/DIALOGUE_NEW.md` (re-importing them would undo the lesson 4 trim), or delete the file since everything in it is imported;
   - add `starter` description from `docs/OWNER_TEXT.md` once approved;
   - stale docs: ART_NEEDED (backdrops are wired; ending art `bg-end-absorbed` / `bg-end-bankrupt` exist), AUDIT_LEFTOVERS #2 and #3 (fixed), ROADMAP_1.0 (mark historic), stale code comments (`Inspector.tsx:147`, `suggest.ts:207`, `sim/api.ts:624`, `balance.ascension.minTier` naming), reputation mentions in AGENTS.md files;
   - add the e2e step for the achievements screen if missing;
   - delete merged remote branches (0 ahead of main): wip/dialogue-import, wip/endings, wip/lessons, wip/owner-art, wip/owner-dialogue, wip/tree-sprites, wip/gallery-art, wip/off-duty, claude/vibrant-albattani-dv9g0z. Ask before deleting `claude/serene-ramanujan-ojshkh` (holds six 2-3 MB concept PNGs; owner has not said keep or drop).
h. Later (still to do before sharing if time allows): achievement balance in real play (`calm_month`, `open_hands`, `books_clean`, bond bars); BALANCE_AUDIT items (L4 research wall, dominated L3 techs, wetware prerequisites) check against current data; ~17 support items and ML-1 reuse a tinted base sprite (owner sets priority).
i. Owner play-tests. Then full verify (Haiku), push youthful to main, check the live Pages links, and write a new player-facing README (for people who come to look at and play the game: what it is, how to play in the browser, screenshots, controls, credits; dev notes move to a short section or `docs/`).

## 4. How to work

- Opus coordinates only. Sonnet builds and writes. Haiku verifies. One worktree agent per task.
- NEVER run `tsc -b` or plain `npx tsc`. Use `npm run check`.
- Sample before bulk. Keep messages to the owner short and plain.
- Never commit an original image over 1 MB without asking.
- Worktree agents must not check out a branch the main folder has checked out. Keep the main folder detached, or push with a `local:remote` refspec.
- `perf.test.ts` is flaky under load: rerun it alone.
- e2e "port 4173 in use" means a stale server: kill it and rerun.
- Images: recipe is in `docs/HANDOFF_ARCHIVE.md`, section "How to drop in an image".
- Dialogue: `npx tsx tools/dialogue/export.ts` -> edit -> `npx tsx tools/dialogue/import.ts <file>` (dry-run is the default; `--write` to apply). `export.ts --check` verifies the grammar.

## 5. Known issues

- Bond 50 is hard for Mel and Cass in headless runs (scripted player does not follow advice). Check with a human.
- `docs/DIALOGUE_NEW.md` still holds removed lesson-4 lines (see 3g). Do not import it as is.
- The full test run can fail on timing (perf, snapshot, economy, ministry, determinism) when several agents run at once. Rerun alone, or verify on a quiet machine.
