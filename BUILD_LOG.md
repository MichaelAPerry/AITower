# AItower Build Log

| Date | Phase | Item | Status |
|---|---|---|---|
| 2026-10-15 | 1 | Research & competitive analysis → `docs/RESEARCH.md` | ✅ |
| 2026-10-15 | 2 | Architecture spec → `docs/ARCHITECTURE.md` | ✅ v0.2 |
| 2026-10-15 | 3 | Briefing answered: TS + Pixi + React, 2D side-cut pixel art, plausible physics, lean vertical slice | ✅ |
| 2026-10-15 | 4 | Scaffold, frozen contracts, boundary checker, task specs | ✅ |
| 2026-10-15 | 4 | T1–T4 sub-agent work integrated; MVP playable in the browser | ✅ |
| 2026-10-15 | 5 | Cassette-futurism art direction (`docs/STYLE.md`), retro fonts, restyled content | ✅ |
| 2026-10-15 | 5 | T5 world-art pass (agent-render) + T6 HUD pass (agent-ui) integrated | ✅ |
| 2026-10-15 | 5 | Publishing: GitHub Pages workflow + claude.ai artifact build (`scripts/build-artifact.mjs`) | ✅ |

## Sub-agent assignments
| Task | Agent | Scope | Status | Tests |
|---|---|---|---|---|
| T1 | agent-sim | `packages/sim`, `tools/sim-cli` | ✅ integrated | 39 |
| T2 | agent-render | `packages/render` | ✅ integrated | 32 |
| T3 | agent-ui | `packages/ui` | ✅ integrated | 19 |
| T4 | agent-assets | `packages/content`, `packages/audio` | ✅ integrated | 30 |
| T5 | agent-render | art pass, `packages/render` | ✅ integrated | 35 |
| T6 | agent-ui | HUD art pass, `packages/ui` | ✅ integrated | 19 |

All four agents hit an API usage limit once and were resumed from their saved work.

## Orchestrator integration notes
- **Boundary checker:** `scripts/check-boundaries.mjs` now allows `vitest` imports in test files (reported by agent-assets).
- **Contract clarification:** `api.ts` documents `BotView.x` as a fractional tile index (raised by agent-render).
- **Thermal fix:** `balance.json` `envelopeConductance` changed from 0.3 to 0.05. At 0.3 the building leaked too much heat outdoors (agent-sim).
- **sim-cli auto-player:** it now accepts only offers its idle capacity can serve.
  - Before: accepting everything over-committed the starter and lost about $5.8M to SLA penalties in 10 days.
  - After: cash goes from $3.0M to $4.85M over 15 days, PUE stays at 1.33–1.59, and energy is about 20% of revenue.
- **`apps/web`:** the opening camera now centres on the starter row; the build palette was hiding it.
- **Browser check (headless Chromium):** boot, day/night, overlays, accepting a contract (the job runs) and placing a rack all work, with no page errors.

## Accepted deviations (from the agent reports)
- **Energy price is in game dollars:** 7.5 $/kWh base, about 90× a real tariff, so energy cost matters against compressed revenue.
- **The CRAH draws 40 kW:** it stands for the whole air-cooling chain, so air-cooled PUE comes out worse than liquid, as in reality.
- **The starter includes a storage rack:** training jobs need dataset storage.
- **Tier 2 needs 120 PFLOPS:** the starter has 80, so the player must expand to progress.

## Backlog (candidates for the next milestone)
1. `canBuild(cmd)` on `Sim` and `GameStore`, so slab, conduit and lift ghosts use the sim's real validation (agent-ui proposal).
2. Move sim literals (idle draw 15%, 8-rack training cap, refund %, bot battery thresholds) into `Balance.sim` (agent-sim proposal).
3. `submit()` validation that accounts for queued commands, so "build slab" then "place" works within one paused tick.
4. Fiber fabric and network factor, grid outages and heatwaves, tech-tree screen, quarterly report.
5. Ascension paths: Biotech, Greentech and Synthetic Mind (ARCHITECTURE §9).
6. Bot routes through more than one lift; quantised temperatures for lockstep determinism across JS engines.
7. Code-split the Pixi bundle (the main chunk is 656 kB).

## Publishing
- **GitHub Pages:** `.github/workflows/pages.yml` runs check, build and deploy on pushes to `main` and this branch.
  The deploy needs the `github-pages` environment to allow this branch, or a merge to `main`.
- **claude.ai artifact:** run `node scripts/build-artifact.mjs`, then publish
  `apps/web/dist-artifact/artifact.html` with `assets/app.js` and `assets/app.css`.
