# AItower

A SimTower-style tycoon about building a vertical **AI datacenter** at the end of the world, wrapped in a
PC-98 visual novel. Stack floors, route power, coolant and service lifts, keep repair bots swapping failed GPUs,
and sell compute, while four advisors argue over which way the world should end: the **Lattice** (the
Singularity, the default), the **Flesh** (bio) or the **Garden** (green). Every machine you build quietly closes
some of those doors. Design: [`docs/SOUL.md`](docs/SOUL.md). Look: [`docs/STYLE_PC98.md`](docs/STYLE_PC98.md).
2D side-cut pixel art · TypeScript · PixiJS · React.

## Play
- **In the browser:** https://michaelaperry.github.io/AITower/
- **Offline, one file:** download [**AItower.html**](https://michaelaperry.github.io/AITower/AItower.html)
  (right-click → *Save link as…*) and double-click it. Everything (code, art, fonts, music) is inside that one file:
  no install and no server. Saves live in that browser. Build it yourself with `npm run build:single`.

**From source:**
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
npx tsx tools/sim-cli/src/soulRun.ts starter 80   # automated run: Singularity points, seals, bonds per day
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

Docs: [`HANDOFF.md`](HANDOFF.md) (start here) · [`docs/SOUL.md`](docs/SOUL.md) · [`docs/RESEARCH.md`](docs/RESEARCH.md) · [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) ·
[`tasks/`](tasks/) · [`BUILD_LOG.md`](BUILD_LOG.md).
