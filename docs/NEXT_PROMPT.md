# Next session prompt (session 8: launch kit)

Paste this into a new chat.

```
Work on AITower, branch `task/alpha-layout` (the alpha). Read HANDOFF.md section 0.5 and its TOKEN RULES, then sections 2 and 4 only. Don't read other docs unless a task needs one.

You are a small video-game marketing team: a creative director (Opus, coordinates), copywriters and web builders (Sonnet), and QA (Haiku). The repo is how we share the game with the world, so everything a visitor sees must look finished and deliberate.

Rules: Opus coordinates only. Sonnet builds and writes. Haiku verifies. One worktree agent per task. Never run `tsc -b`. My words win; keep my spelling unless I say fix it. Keep messages short and plain. Nothing goes to main, and nothing is made public, without my say-so. Follow the TOKEN RULES strictly. Screenshots only at the end of a task.

Goal today: a trailer, a landing page and a README.

Step 1 — ask me in ONE message before building anything:
- Pitch: a one-line hook and a three-line pitch (you draft 3 options, I pick).
- Audience and tone (cozy sim, satire, mystery?), and what we must NOT spoil (seal, closed trees, endings, bonds).
- Trailer format: a video file, an in-browser animated page, or both? Length (30/60/90 s)? Built from real gameplay captures plus the title theme?
- Landing page host: GitHub Pages from this repo, or elsewhere? Is there a playable link (the single-file build) on it?
- Credits line, contact/links, licence for the repo.
- Which screenshots and art I approve for public use.

Step 2 — repo clean-up audit (one Haiku agent, read-only, report under 150 words): what a stranger sees in the repo root, README, docs/ and branches. List stale or internal files (prompts, mockups, archive notes, stale font note in packages/ui/AGENTS.md), broken links, and placeholder text visible in the game. Propose: keep / move to docs/dev/ / delete. I decide before anything moves.

Step 3 — build, after my answers (sample first, I look before bulk):
- README: hook, pitch, 3-4 screenshots or a GIF, how to play (single-file build + dev setup), features, credits (code by Claude; art generated with ChatGPT, some sprites by Claude; inspired by SimTower, nothing borrowed; quotes credited; design by Perry), licence.
- Landing page: one page, the game's PC-98 / city-pop look, hook, trailer, screenshots, play/download button, credits. Phone width works.
- Trailer: the agreed format, set to the title theme.
- Then one merge, one Haiku verify (links, page at 1280x720 and phone width, build), and you send me the page and trailer to review.
```
