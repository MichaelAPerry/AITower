# HANDOFF (short)

Older long notes: [docs/HANDOFF_ARCHIVE.md](docs/HANDOFF_ARCHIVE.md) (verbatim). Open it only when you need a detail.

## 0. What the game is, and the doc map

AI Tower is a browser datacenter-management game in a PC-98 style. You are the Operator of a tower. Four advisors (Luci, Mel, Bea, Cass) talk to you in visual-novel scenes.
You grow racks and power, and retrofit them toward one of three trees: Lattice (synthetic), Flesh (biotech), Garden (greentech). There is no commit step: a tree is chosen by retrofitting.
Endings: Lattice, Flesh, Garden, plus the failures Absorbed and Bankrupt. The sim is deterministic; the UI reads a view of it.

Docs: `docs/SOUL.md` (design core), `docs/STYLE_PC98.md` (look), `docs/TREES.md` (trees), `docs/VN_WRITING.md` (voices), `docs/ACHIEVEMENTS.md` (approved spec, not built), `docs/NEW_SCENES.md` (new scenes incl. `ach_*`), `docs/DIALOGUE.md` (every line, export), `docs/DIALOGUE_NEW.md` (lines the owner has not edited yet), `docs/ART_NEEDED.md` (art slots).

## 1. State on Oct 30 (end of session)

- Live main = `d8e2450` (Sim perf ... lone-command submit without deep clone).
- Branch `claude/youthful-ramanujan-msqcy9` (local branch `handoff` may be the same) holds, UNRELEASED:
  - sprites, endings, and four lessons (Build, Earn, Grow, The trees);
  - owner art: 5 endings and 12 locations (`LOCATION_ART`, `sceneBackdrop`);
  - owner dialogue import: the owner's words win; endings cut to the owner's 3 paragraphs; 43 approved typo fixes;
  - DONE: the owner's edited `DIALOGUE_NEW.md` is imported (21 changed, 13 typo-fix groups applied; DIALOGUE.md re-exported);
  - importer `tools/dialogue/import.ts` (+ `--truncate-paragraphs`), exporter `tools/dialogue/export.ts`;
  - new scenes: `cass_night_shift`, `seal_biotech` / `seal_greentech` (trigger `seal`), `bond50_*` (trigger `bond`), fallback epilogues;
  - epilogue bar 50 (`balance.json` `soul.bondEpilogue`).
- All checks pass. A playable single-file build was given to the owner.
- NOT pushed to main yet: waiting for the owner to play it.
- Branch `wip/gallery-art`: 8 off-duty portraits, unregistered (not shipped). Not on youthful.

## 2. Owner decisions on record

- The owner's words win over ours, in every dialogue file.
- Bed set unlocks at 100% (all 18 achievements); the four bed portraits unlock together.
- Month of Calm and Cass's portrait: streak of 20 days at 99% uptime with pflops > 0.
- Failure endings (Absorbed, Bankrupt) are achievements, hidden.
- Profile (achievements, gallery) goes into the save export/import file; import merges.
- `les_stars` replaced by `heard_out` "Heard Her Out".
- `end.flesh.title` and `heat_tariff_revision.vote.mel` are deliberately kept as the wip/endings wording. Ask the owner if unsure.
- The old OFF_DUTY.md art rule is dropped; `OFF_DUTY.md` is superseded by `docs/ACHIEVEMENTS.md`.

## 3. Next, in order

a. The owner plays the build. Fix the bugs they report. Push youthful to main only when check, build, e2e and budget all pass AND the owner says so.
b. DONE: owner's edited `DIALOGUE_NEW.md` imported (`--truncate-paragraphs --write`).
c. Build achievements and gallery per `docs/ACHIEVEMENTS.md`: snapshot v16 for `uptimeStreak`; art from `wip/gallery-art`; VN lines `ach_*` in `docs/NEW_SCENES.md`. Sample first: show one unlock in the game before doing the rest.
d. Lessons: four exist (Build, Earn, Grow, The trees). Lessons 2-4 give no stars and none teaches the retrofit loop. The owner wants lessons made. Plan the missing teaching, propose a lesson list to the owner first, then sample one.

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

- Target days differ: old notes say 25/38/44, `tools/sim-cli/src/soulRun.ts` says 25/40/38. Confirm which is current (the `fast_win` achievement uses them).
- Bond 50 is hard for Mel and Cass in headless runs (scripted player does not follow advice). Check with a human.
- Bankrupt ending text is still the 5 paragraphs from wip/endings; the owner edits it via `DIALOGUE_NEW.md`.
