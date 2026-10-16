# M1-T1 — agent-sim: command validation, save validation, bot/lift robustness, scale fixes

**Owns:** `packages/sim/**`, `tools/sim-cli/**`.

**Read first:**
- `tasks/m1/README.md`
- `packages/sim/AGENTS.md`
- `packages/sim/src/api.ts` (note the new `canBuild` and `submit` / `fromSnapshot` docs)
- `docs/review/engineering.md`. It cites exact file:line problems; verify each one before fixing.

## 1. Queue-aware validation (`submit` and `canBuild`)
- **Problem:** `submit()` validates only against the current state. So "buildSlab on F2, then place on F2" in the same paused tick is rejected, and two purchases that together exceed cash are both accepted.
- **Requirement:** validation must account for commands already queued this tick. The applied result must stay identical to applying them in order at the next `step()`; `applyCommands` re-validates and stays authoritative.
- **Suggested design:** keep a lazily created *projected* state. Deep-clone the state on the first `submit` after a step, then apply each accepted plan to the clone. Clear it in `step()`.
  - `canBuild(cmd)` validates against the projected state when one exists, else against the real state, and never queues.
  - Do not clone on every `canBuild` call: the UI calls it on every pointer move.
- **Never throws:** `submit` and `canBuild` must never throw for any input. That includes `null`, a missing or unknown `type`, `cells: [null]`, NaN or Infinity coordinates, huge arrays and wrong field types.
  - Add a seeded **fuzz test**: about 2,000 random malformed and valid commands, asserting no throw, a sane result, and that `step()` still runs.
- `canPlace` must stay consistent with `canBuild({type:"place",…})`.

## 2. Snapshot validation and migrations
- **Validation:** `simFromSnapshot` must validate before constructing a sim, then throw `Error("Invalid save: <reason>")` on failure. Check:
  - version
  - scenario exists
  - every typed-array length matches the grid
  - every facility, bot and lift references a known def id and lies in bounds
  - job/rack/work-order references resolve
  - numbers are finite
- **Migrations:** add a migration pipeline keyed by version (`migrations: Record<number, (state) => state>`). It is a no-op today, with one test that a fake v0 is migrated or rejected cleanly.
- **Tests:**
  - truncated arrays, unknown def id, NaN cash and wrong version are all rejected with a clear reason;
  - the existing snapshot round-trip and determinism tests still pass.

## 3. Bot and lift robustness
- **Multi-lift routing:** bots must route across more than one lift (A → lift 1 → transfer floor → lift 2 → B), choosing the cheapest route by walk distance plus estimated waits.
  - Test: a tower where no single lift spans both floors.
- **Work-order timeout and reassignment:** a bot that cannot reach its target, or makes no progress for N ticks (a constant in `core/constants.ts`), releases the order. The order returns to the queue and is retried later; no livelock.
  - Re-validate a bot's path when topology changes (slab, lift or facility demolished) and re-plan it.
  - Tests: demolish the lift mid-route; demolish the target rack; unreachable target.
- **Empty or unreachable depot:** bots must never get stuck forever. They return to their charger and retry with backoff.

## 4. Scale fixes (from the engineering review benchmark)
- **Allocations:** remove per-tick allocations in `power/powerSolve.ts` (the Map each tick) and any similar hot path you find.
- **Bot planning:** stop scanning every facility per idle bot each tick (`logistics/bots.ts`). Use an index or work-order queue, rebuilt when dirty.
- **Benchmark:** add a perf test (or extend `perf.test.ts`) with a large synthetic tower: 60 floors × 64 wide, about 1,000 racks, 30 bots.
  - Assert a mean `step()` under 2 ms in vitest on this machine.
  - Report the before and after numbers.

## Must keep
- Determinism: same seed + same commands ⇒ same hash.
- Snapshot round-trip.
- The pipeline order in `sim.ts`.
- The "no DOM / no `Math.random` / no `Date`" boundary.
- `npm run sim -- starter 15` must still print a profitable run. Report its output.
