# M1 — Foundations (safe to play for hours)

Source: `docs/ROADMAP_1.0.md` (M1) and the evidence in `docs/review/engineering.md` and `docs/review/ux-art.md`.

| Task | Agent (model) | Owns (write access) | Spec |
|---|---|---|---|
| M1-T1 | agent-sim (Sonnet) | `packages/sim/**`, `tools/sim-cli/**` | [T1-sim.md](T1-sim.md) |
| M1-T2 | agent-ui (Sonnet) | `packages/ui/**` | [T2-ui.md](T2-ui.md) |
| M1-T3 | agent-platform (Sonnet) | `apps/web/**` | [T3-platform.md](T3-platform.md) |
| M1-T4 | agent-render (Haiku) | `packages/render/**` | [T4-render.md](T4-render.md) |
| M1-T5 | agent-ci (Sonnet), runs **after** T1–T4 | `.github/**`, root config, `e2e/**`, lint fixes anywhere | [T5-ci.md](T5-ci.md) |

## Contract changes already made by the orchestrator (frozen; do not edit)
- **`packages/sim/src/api.ts`:**
  - New `Sim.canBuild(cmd)`.
  - `submit()` is now queue-aware and never throws.
  - `fromSnapshot` must validate and throw `Error("Invalid save: …")`.
- **`packages/shared/src/index.ts`:**
  - New types and helpers: `Settings`, `DEFAULT_SETTINGS`, `normalizeSettings`, `SaveSlotId`, `SAVE_SLOTS`, `SaveSlotInfo`, `SaveStatus` and `RenderOptions`.
  - New `Renderer.setOptions`.
  - `GameState.settings` and `GameState.saveStatus`.
  - New `GameStore` methods: `setSettings`, `canBuild`, `listSaves`, `saveTo`, `loadFrom` and `deleteSave`.
- **Placeholder implementations:** each one is marked with a comment naming the task that replaces it. The tree typechecks and all 130 tests pass at the start.

If you believe a contract must change, do not edit it; explain why in your report.

## Rules for every agent
1. Write only inside the paths you own. Do not install packages (say so in your report if you need one).
2. **Quality bar: no mistakes.**
   - Read the code you change before changing it.
   - Add tests for every behaviour you add or fix.
   - Run the whole suite, not just yours.
   - Re-read your own diff adversarially before reporting.
3. Before finishing, run from the repo root and make all of these pass: `npm run typecheck`, `npm run check:boundaries`, `npx vitest run` (whole suite).
   If a failure is clearly in another agent's in-progress package, say so in your report rather than touching it.
4. Do not commit or push. The orchestrator reviews, integrates and commits.
5. Update the `AGENTS.md` of the package you own.
6. Style: tabs, double quotes, strict TS, no `any` without a comment, small focused files, match the surrounding code.
7. Dev servers: run them in the background and stop them by PID. Never `pkill -f` a pattern that matches your own shell command.
