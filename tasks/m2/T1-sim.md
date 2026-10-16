# M2-T1 — agent-sim: Ministry memos, standing, win/lose, economy retune

**Owns:** `packages/sim/**`, `packages/content/**` (not `schema.ts`), `tools/sim-cli/**`.

**Read first:**
- `tasks/m2/README.md`
- `packages/sim/AGENTS.md`
- `packages/content/AGENTS.md`
- The new contract parts in `packages/content/src/schema.ts` and `packages/sim/src/api.ts`
- `docs/review/game-design.md` §4–5

## 1. Memo/event system (sim)
- **Its own RNG stream.** Add it to `core/rng.ts`. It must not shift existing streams; existing determinism tests must stay valid.
- **When a memo is issued:**
  - Time between memos: about `balance.events.intervalTicks`, ±50% seeded jitter.
  - Not before `graceTicks`, and only while fewer than `maxOpen` memos are open.
  - Pick a weighted event, eligible by `minTier`, `maxTier`, `minDay` and `cooldownDays`.
  - Emit `memoIssued`.
- **`resolveMemo`:**
  - Validate it like the other commands, never throwing; an unknown memo or choice is rejected with a reason.
  - Apply the chosen `effects`, append to `memoHistory` (keep 20), and emit `memoResolved`.
  - At `expiresAt`, auto-resolve with `defaultChoice` (`auto: true`).
- **Effects:**
  - **Timed modifiers** go in a list with `endsAt`, are exposed as `ModifierView` with a short label, and are applied where they belong:
    - ambient → `ambientAt`
    - gridCap → grid import capacity
    - energyPrice → energy price
    - payout → new contract payouts
    - failureRate → reliability hazard
  - **Instant effects:** cash goes through the ledger (as revenue or penalties, so it shows in finance); `failRacks` is seeded; spareParts.
- **State:** memos, history and modifiers live in state. Bump the snapshot version and add a migration from v2 that sets defaults. Add validation for the new fields (see `snapshot/validate.ts`).

## 2. Standing and game over
- **Standing:** 0..100, starting at `balance.standing.start`.
  - Daily change: `dailyGood` if yesterday's uptime met the current tier's target, otherwise `dailyBad`.
  - Plus `jobFailed` and `jobCompleted` per job outcome, and `standing` effects from memos.
  - Emit `standingChanged` with the delta.
- **`gameOver`** is set once and emits `gameOver`:
  - `"bankrupt"` when the existing bankrupt flag trips;
  - `"shutdown"` when standing reaches 0;
  - `"victory"` on reaching the top tier.
- The sim keeps stepping after game over; the UI decides what to show.

## 3. Content: `packages/content/src/data/events.json` (about 30 events)
- **Mix:** about 12 ministry, 7 environmental, 7 operational and 4 client events, all fictional.
  - Environmental: heatwave, cold snap, brownout, blackout, flood, supply shortage.
  - Operational: GPU batch recall, firmware bug, ransomware scare, parts theft, fibre cut.
- **Ministry voice:** dry *Brazil*-style bureaucracy ("Form 27B/6", "Department of Misplaced Compute", audits, inspections, rebrands, census, subsidy).
  - Each memo has 2–3 choices: APPROVE / DENY / FILE IN TRIPLICATE, or similar.
  - Every choice is a real trade-off.
  - Each `hint` states the actual numbers in plain English (e.g. "+$150k now · standing −5").
- **No horror yet:** the `horror` category is reserved for M3.
- **Loading and validation:** load `events.json` in `load.ts`, replacing the placeholder. Extend `validateContent`: unique ids, `defaultChoice` exists, effect types and fields valid, durations > 0, weights > 0.

## 4. Economy retune (`docs/review/game-design.md` §5)
- **Tier rewards:** about 5× their current values.
- **DLC rack value:** widen the gap. DLC racks should be about 1.6× air PFLOPS per $ including cooling, or say why not.
- **Guaranteed offers:** at least one offer within 6 hours of the last offer expiring or being accepted, to remove the long zero-revenue streaks.
- **Validation:** keep `npm run sim -- starter 30` profitable but not runaway, and have the sim-cli auto-player resolve memos by picking the choice with the best cash outcome.
- **Report:** before/after 30-day tables (cash, standing, tier, memos).

## Tests
- Memo issue cadence and eligibility, resolve and auto-resolve, every effect type (incl. modifiers expiring), standing rules, each game-over kind, the snapshot migration, the validator, and a fuzz pass including `resolveMemo`.
- Determinism and existing tests stay green. A content test checks that every event in `events.json` validates.
