# AItower

A SimTower-style tycoon about building and running a vertical **AI datacenter**. Stack floors, route power,
coolant and service lifts, keep repair bots swapping failed GPUs, and sell compute to AI labs.
2D side-cut pixel art · TypeScript · PixiJS · React.

## Play
```sh
npm install
npm run dev          # open the printed URL
```
URL options: `?new` (fresh game, ignores autosave), `&seed=N`, `&speed=0|1|3|10|30`, `&overlay=heat|power|coolant`.

**Controls:**
- Left-drag with a build tool.
- Right- or middle-drag, or WASD, to pan; mouse wheel to zoom.
- Space pauses; 1–5 set the speed.
- N/H/P/C switch overlays; X selects demolish; Esc goes back to select; `` ` `` toggles the bottom panel.

## Develop
```sh
npm run check                      # typecheck + module boundaries + all tests
npm run sim -- starter 15 [seed]   # headless balance run (per-day economy table)
npm run build                      # production bundle in apps/web/dist
```

| Path | Contents |
|---|---|
| `packages/sim` | Pure, deterministic simulation |
| `packages/content` | JSON balance data and the contract generator |
| `packages/render` | PixiJS renderer |
| `packages/ui` | React HUD |
| `packages/audio` | WebAudio synth |
| `packages/shared` | Client-side contracts |
| `apps/web` | Composition root |
| `tools/sim-cli` | Headless balance runner |

Each package has an `AGENTS.md`.

Docs: [`docs/RESEARCH.md`](docs/RESEARCH.md) · [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) ·
[`tasks/`](tasks/) · [`BUILD_LOG.md`](BUILD_LOG.md).
