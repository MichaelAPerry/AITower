# M2a — The game loop: Ministry memos, standing, win/lose, economy, title screen, tutorial, music

Source: `docs/ROADMAP_1.0.md` (M2) plus owner feedback on the tutorial (see T2). The tech tree and T2–T4 content are
deferred to M2b.

| Task | Agent (model) | Owns (write access) |
|---|---|---|
| [M2-T1](T1-sim.md) | agent-sim (Sonnet) | `packages/sim/**`, `packages/content/**` (except `schema.ts`), `tools/sim-cli/**` |
| [M2-T2](T2-ui.md) | agent-ui (Sonnet) | `packages/ui/**` |
| [M2-T3](T3-audio.md) | agent-audio (Sonnet) | `packages/audio/**` |

## Contract changes already made by the orchestrator (frozen; do not edit)
- **`content/schema.ts`:** `EventDef`, `EventChoice`, `EventEffect`, `EventCategory`, `ContentDB.events`, `Balance.standing`, `Balance.events`.
- **`sim/api.ts`:**
  - The `resolveMemo` command.
  - Events: `memoIssued`, `memoResolved`, `standingChanged` and `gameOver`.
  - `SimView` fields: `memos`, `memoHistory`, `modifiers`, `standing` and `gameOver` (`MemoView`, `ModifierView`, `GameOverKind`).
- **`shared`:** `Settings.musicVolume` and `AudioEngine.setMusicVolume`. The app already calls it from `setSettings`.
- **Placeholders:** each one is marked "M2-T1/T2/T3". The tree is green at the start: typecheck, lint, and 315 tests.

## Rules (same as M1, see `tasks/m1/README.md`)
- **Scope:** write only in your owned paths. No installs. Don't edit contracts; if you think one must change, say so in your report. Don't commit. **Never run `git stash`, `git checkout` or `git reset`**: other agents share this working tree.
- **No mistakes:** read before you change, test every behaviour, and re-read your own diff adversarially.
- **Before finishing:** `npm run check` (typecheck, boundaries, lint, all tests) and `npm run build` must pass. Update your package's `AGENTS.md`.
- **Keep it tight:** the owner is close to a token limit, so be efficient. Don't over-explore, and keep your final report under 300 words.
