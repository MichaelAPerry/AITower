# M5a-A: first contract ready at once
Owns `packages/sim/**` (not `api.ts`) and `packages/content/**` (not `schema.ts`).

1. **Offers on a new game:** a new game (every scenario) starts with at least one contract offer already in `state.offers` at tick 0.
   - On the default scenario, the opening offer must fit the starting idle racks: the job's compute need is at most the idle installed PFLOPS, it runs on air cooling, and it starts paying within the first game hour.
   - Use the existing offer generator with the seeded rng, so the game stays deterministic. Don't hardcode one magic contract unless that is clearly the cleanest option.
   - Keep the normal cadence after that.
   - Snapshot shape is unchanged (no version bump) unless that is unavoidable.
2. **Tests:**
   - Every scenario has ≥1 offer at tick 0.
   - On the default scenario, accepting the first offer gives positive income within 60 ticks.
   - Determinism still holds.
   - Update any golden or fixture tests that this legitimately shifts, and say which ones.
