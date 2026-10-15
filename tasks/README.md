# Sub-agent tasks — MVP "Lean Vertical Slice"

Decisions (Phase 3, confirmed by user 2026-10-15):
- **Stack:** TypeScript monorepo (npm workspaces), PixiJS v8 renderer, React 19 HUD, Vite 7, Vitest 3.
- **View:** 2D side-cut cross-section, pixel-art (programmer art drawn with Pixi `Graphics` for MVP — no image files needed).
- **Sim fidelity:** plausible physics — real units, simplified equations, constants in `content/balance`.
- **MVP scope:** ~10 floors; 3 rack types (air GPU, DLC GPU, storage); CRAH air cooling + 1 liquid loop (chiller + CDU);
  grid tie + genset + UPS; 1 bot type + service lift; contracts, money, PUE, heat overlay.

| Task | Agent | Owns (write access) | Spec |
|---|---|---|---|
| T1 | `agent-sim` | `packages/sim/**`, `tools/sim-cli/**` | [agent-sim.md](agent-sim.md) |
| T2 | `agent-render` | `packages/render/**` | [agent-render.md](agent-render.md) |
| T3 | `agent-ui` | `packages/ui/**` | [agent-ui.md](agent-ui.md) |
| T4 | `agent-assets` | `packages/content/**` (except `schema.ts`), `packages/audio/**` | [agent-assets.md](agent-assets.md) |
| — | orchestrator | `apps/web/**`, contracts (`sim/src/api.ts`, `content/src/schema.ts`, `shared/**`), root config, docs | — |

## Rules for every agent
1. **Contracts are frozen:** `packages/sim/src/api.ts`, `packages/content/src/schema.ts`, `packages/shared/src/index.ts`.
   If you believe a contract must change, do NOT edit it — write the proposal in your final report.
2. Write only inside the paths you own. Do not run `npm install` for new packages; the needed deps are installed.
   If you truly need a dependency, say so in your report.
3. Before finishing, run from repo root and make them pass:
   `npm run typecheck`, `npm run check:boundaries`, `npx vitest run packages/<yours>`.
   (Other agents work in parallel; if a failure is clearly in someone else's package, note it and move on.)
4. Do **not** commit or push — the orchestrator integrates and commits.
5. Add a short `AGENTS.md` in your package root describing its files, invariants and how to test.
6. Code style: tabs, double quotes, strict TS, no `any` unless justified, small focused files.
