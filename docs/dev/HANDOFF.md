# HANDOFF (short)

Older long notes: [HANDOFF_ARCHIVE.md](HANDOFF_ARCHIVE.md) (verbatim). Open it only when you need a detail.

## 0. What the game is, and the doc map

AI Tower is a browser datacenter-management game in a PC-98 style. You are the Operator of a tower. Four advisors (Luci, Mel, Bea, Cass) talk to you in visual-novel scenes.
You grow racks and power, and retrofit them toward one of three trees: Lattice (synthetic), Flesh (biotech), Garden (greentech). There is no commit step: a tree is chosen by retrofitting.
Endings: Lattice, Flesh, Garden, plus the failures Absorbed and Bankrupt. The sim is deterministic; the UI reads a view of it.

Docs: `docs/SOUL.md` (design core), `docs/STYLE_PC98.md` (look), `docs/TREES.md` (trees), `docs/VN_WRITING.md` (voices), `docs/ACHIEVEMENTS.md` (spec, built), `docs/ACHIEVEMENTS_TEXT.md` (owner edit file), `docs/LESSON_PLAN.md`, `docs/OWNER_TEXT.md`, `docs/dev/ICON_PROMPTS.md`, `docs/dev/PLACEHOLDER_TEXT.md` (all Claude-written placeholder text), `docs/NEW_SCENES.md` (new scenes incl. `ach_*`), `docs/DIALOGUE.md` (every line, export), `docs/ART_NEEDED.md` (art slots), `docs/AFTER_HOURS.md` (easter eggs, owner text), `docs/MUSIC_MAP.md`, `docs/dev/SUNO_PROMPTS.md`, `docs/RESEARCH_UI_PROPOSAL.md`.

## 0.4 Session 8 (Nov 3) — marketing shipped. READ FIRST

Main = alpha = `21ab64f`, LIVE: https://michaelaperry.github.io/AITower/ (landing page at root, game at /play/, single file at /play/AItower.html). Repo is public. Pages workflow builds `npm run build:site` from main; every push to main deploys.
Done: internal docs moved to docs/dev/ (this file now lives here); README rewritten; site/ (landing page, 4 VN-style advisor bios, Ko-fi https://ko-fi.com/50866 = only external link); trailer/ (`npm run trailer`, 30 s, title.mp3 from 182.787 s, ~143 BPM; videos in site/assets/). Owner art in site/assets/art/. Marketing copy: pitch B (owner's pick). Never use title-end-*.webp in marketing (spoilers).
Open: (1) fix/lesson-camera — lessons start with the camera far above the tower (owner: "a big one"); verify + merge + main on owner's word. (2) Owner to delete 7 old branches on GitHub (auto mode blocks remote deletes): wip/dialogue-import, wip/endings, wip/lessons, wip/owner-art, wip/owner-dialogue, wip/tree-sprites, task/inspect-restyle. (3) Tab title says "AI Tower" — owner hasn't chosen AITower/AItower spelling.

## 0.5 Session 7 start (Nov 2) — READ FIRST, then sections 2 and 4 only

Alpha = `task/alpha-layout` @ b06dddc (Haiku verified: check, build, e2e, e2e:layout, afterhours e2e, credits Skip, build:single). NOT on main. Main = `61dc193`.

Done in session 6: old procedural music off (`LEGACY_MUSIC=false` in packages/audio); credits Skip (pointer-events) + quotes cut from roll; switches widened; Automation overlaps; dismiss buttons; research orb always shows all globes and lines (no clusters); QUARTERLY INSPECTION popup (`finance/AuditSheet.tsx`) restyled with Luci face + quips; after-hours easter eggs built, bonds and attitude choices removed (snapshot v17). Session-5 note moved to docs/dev/HANDOFF_ARCHIVE.md.

Order (session 7):
1. After-hours fixes (one small agent): spots move to G (Bea fern, Cass coffee, opposite sides) and B (Luci book, Mel tank); spots in EVERY game mode; epilogue speaker = by the tree/ending built, revert the "upgrade bought" change. See docs/AFTER_HOURS.md "Owner answers".
2. Ending balance: endings too easy (Garden in <50 days). Look at orb costs + win thresholds for all three trees; PROPOSE numbers to the owner first (no agent needed to propose if a quick read does it).
3. Retrofit buttons -> Lattice / Flesh / Garden (owner: yes). In-world Pixi labels bigger (owner: yes; `packages/render/src/pixi/markers.ts`, `structure.ts`).
4. When the owner sends the ChatGPT sheet (docs/dev/ICON_PROMPTS.md sheet 10): swap the code-drawn easter-egg items for it.
5. Merge, one Haiku verify, build:single to the owner. Main only on the owner's word. Then trailer, landing page, README.

Owner (Nov 2): 2 bond achievements removed, 4 added (one per off-duty portrait) = 20. Bed portraits need ALL achievements incl. fast_win (option a: "the bed portraits should be hard"). Lattice spWeight 2.5 -> 0.4 (scripted player: Lattice 24 -> ~41 days; Flesh/Garden ~42 unchanged). Easter-egg items drawn at 1/3 PNG size.
Owner rejected: Luci's face on machine/room inspection cards (`task/inspect-restyle` is dead; do not merge).

TOKEN RULES (owner, session 6 — strict):
- No agent for anything a one-line note or a short git command can do. Opus may do docs notes and clean (conflict-free) merges itself; a merge agent only when there are conflicts.
- Builders: base on origin/task/alpha-layout, `npm ci`, then run ONLY the vitest files they touch + `npm run check` once at the end. NO e2e, NO e2e:layout, NO repeated full checks. One screenshot at 1280x720, only if the change is visual.
- Full check + e2e + e2e:layout run ONCE, in the single Haiku verify after the merge.
- Big tasks: split into small steps, sample first, owner looks before bulk.
- Brief tightly: files, done-when, reply under 80 words. Confirm WHICH screen/popup with the owner if a name is ambiguous ("inspection" = the quarterly audit).
- Ask the owner every open question BEFORE building; never let an agent guess on design (e.g. which modes, which floors).
- Opus does not re-read docs it already read; short status messages; screenshots only at the end of a task.

## 1. State on Oct 31 (end of session 4)

- `main` = branch `claude/youthful-ramanujan-msqcy9` = `61dc193` (plus this docs commit). Merged to main on the owner's word, FOR PLAY-TEST. GitHub Pages deploys on push to main (`.github/workflows/pages.yml`).
- Checks at `61dc193`: `npm run check` (1686 tests pass), build, budget 1773.7/3000 kB, e2e pass.
- Done this session:
  - Owner answers applied: bankrupt note "The world moves on without you."; typo fixes (plumbing, favorite, "when the grid fails", "its job"); `fast_win` 40/40/40 confirmed; Handbook seal line kept by owner's choice.
  - Title screen ending pictures: after a tree's success ending (`end_lattice`, `end_flesh`, `end_garden`) the title shows that tree's picture (owner concept art, 64-colour lossless WebP, each under 1 MB, `packages/ui/src/art/title-end-*.webp`). Most recent first (profile earned entries now carry an optional `at` timestamp). A small "◀ ▶ ENDING n/N" button bottom-right cycles when there are 2 or more. Failure endings do not change it.
  - "AI TOWER" logo cut from the original title art (`packages/ui/src/art/title-logo.webp`), shown over the ending pictures.
  - Title music (owner's Suno songs, mono 32 kbps MP3, about 1 MB each, `packages/ui/src/music/`): title まだ見ぬ世界へ, Garden 君の明日が晴れますように, Lattice 銀のホーム, Flesh 雨のしずく. Plays per picture, starts on first click, fades on leaving the title, uses the existing Master/Music/Mute settings.
  - Credits: "Music: Perry, made with Suno." plus song lines (in `packages/ui/src/title/titleMusic.ts`).

## 2. Owner decisions on record

- The owner's words win over ours, in every dialogue file. Keep the owner's spelling exactly; never fix typos without asking.
- All Claude-written text is placeholder. It is catalogued in `docs/dev/PLACEHOLDER_TEXT.md`. The owner rewrites it later. Import it with the importer; plain `key (file)` lines are moved in by hand.
- Bed set unlocks at 100% (all 18 achievements); the four bed portraits unlock together.
- Month of Calm and Cass's portrait: streak of 20 days at 99% uptime with pflops > 0.
- Failure endings (Absorbed, Bankrupt) are achievements, hidden.
- Profile (achievements, gallery) goes into the save export/import file; import merges.
- `end.flesh.title` and `heat_tariff_revision.vote.mel` are deliberately kept as the wip/endings wording.
- Lessons must not spoil the plot: no seal, closed trees, bonds, epilogues or endings in lesson text.
- Lessons run on the full game UI (same HUD, drawers, build bar, speed controls) with a scenario and guidance on top; nothing is hidden or locked by a lesson. The advisor never starts or stops the clock: Lesson 1 asks the player to press Play, Pause and a faster speed and waits (`wait` on a step, reported by the UI as a `les:<step>` tip). Controls are pointed at with `data-tut` selectors (outline plus arrow); the camera is never moved by a lesson.
- Icons and menu pictures: image sheets from ChatGPT. In-tower (world) sprites stay drawn in code; a one-rack image test (sheet 9 in `docs/dev/ICON_PROMPTS.md`) is optional, later.
- Locked gallery portraits = head crop (done).
- Credits: code by Claude; all art generated with ChatGPT, some sprites by Claude; inspired by SimTower, nothing borrowed; quotes credited with sources. Design line = "Perry".
- `fast_win` days 40 / 40 / 40 (confirmed by owner Oct 31).
- Ending title pictures and per-picture songs as in section 1. The owner approved songs near 1 MB: "small as possible, quality doesn't have to be too high".
- Main was merged for the final play-test on the owner's word. Future pushes to main still need the owner's say-so.

## 3. Next, in order

a. The owner play-tests the live game. Fix what they report.
b. Known fix: the logo cutout has a small gap in the ring at about 7 o'clock (visible on the Flesh picture). Re-cut `title-logo.webp`.
c. Ask the owner:
   - (Resolved) Song titles stay as tagged in the files; in-game music added (tower loop, warm and quiet scene songs): see `docs/MUSIC_MAP.md`.
   - Do the 32 kbps songs sound OK?
   - The single-file build (`build-single.mjs`, `AItower.html`) would inline the songs (about 5 MB base64). Exclude music there?
d. Branches: the owner deletes the merged `wip/*` branches by hand (agents get 403). `claude/serene-ramanujan-ojshkh` (concept art; the three ending pictures are now in the game): the owner has not decided keep or delete.
e. Then the presentation work (the new window's job):
   - A dynamic trailer video using the game's sprites. The owner wants more than plain gameplay footage: animated sprites, the ending pictures, the owner's songs. Plan the video with the owner first.
   - A GitHub Pages landing page. It must not break the current game URL.
   - A new README for players and visitors: what it is, how to play in the browser, video, screenshots, controls, credits incl. music. Dev notes go to a short section or `docs/`.

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
- HUD layout: `npm run build && npm run e2e:layout` checks that the strip, build bar, drawer tabs, lesson dock, goals, advisor strip, ticker and open drawers stay on screen and never overlap, at 1280x720, 1920x1080, 1920x1080 at 150% and 2560x1440 Auto. Placement rules live in `packages/ui/src/calm/layout.css`. Text is never shrunk to fit: reflow, fold or scroll.
- Images: recipe is in `docs/dev/HANDOFF_ARCHIVE.md`, section "How to drop in an image".
- Dialogue: `npx tsx tools/dialogue/export.ts` -> edit -> `npx tsx tools/dialogue/import.ts <file>` (dry-run is the default; `--write` to apply). `export.ts --check` verifies the grammar.
- A fresh clone may be single-branch. Run `git config remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*'` and fetch main before creating worktree agents. Worktrees base on origin/main, so worktree agents should `git reset --hard origin/<branch>` first.
- Agents' screenshots go in /tmp. To show the owner, copy them into the repo's `.claude/` (gitignored via `.git/info/exclude`).

## 5. Known issues

- Bond 50 is hard for Mel and Cass in headless runs (scripted player does not follow advice). Check with a human.
- The full test run can fail on timing (perf, snapshot, economy, ministry, determinism) when several agents run at once. Rerun alone, or verify on a quiet machine.
- iOS Safari ignores audio volume (mute works).
