# M2b-T1 — agent-sim: research, Contracts Clerk, loans and levy, audits, stats, scripted events, new bots

Read `tasks/m2b/README.md`, `packages/sim/AGENTS.md`, `src/api.ts` (the new contract) and `content/src/schema.ts` first.
Tests use `src/test/fixture.ts`. Extend it (it is yours) with a few tech nodes and gated facilities and bots, because the real `tech.json` is being written in parallel.

## 1. Research
- **Earning RP** (stored as a float in state):
  - Delivered PFLOP-hours of every job × `balance.research.pointsPerPflopHour` × the `researchRate` perk.
  - Plus `pointsPerJob` for every completed job.
- **`research {techId}`:** queue-aware like the other commands (use `plan`). Reject with a plain reason in each of these cases:
  - unknown id
  - already researched
  - a missing prerequisite (name it)
  - `tier < minTier` ("requires Clearance N")
  - not enough RP ("needs X RP, have Y")
  
  On success: deduct the RP, append the id to `techResearched` and emit `researched`.
- **Gating:** a facility or bot with `tech` set can't be placed or bought until that node is researched. Use the reason "requires research: <node name>".
- **Perks:** the product of the factors of every researched node. Each factor multiplies the named quantity:
  - `failureRate`: the failure hazard
  - `energyPrice`: what you pay, and the view's `energyPrice`
  - `payout`: newly generated offers
  - `coolingCapacity`: crah, chiller and cdu capacity
  - `upkeep`
  - `researchRate`
  - `botSpeed`
  - `repairSpeed` is the exception: repair ticks are *divided* by its factor.

  Keep these perks separate from memo `modifiers`; both apply.

## 2. Contracts Clerk
- **Unlocked** when any researched node has `{type:"feature", feature:"contractsClerk"}`.
- **`setClerk`:**
  - Reject while the clerk is locked.
  - Validate the policy: `kinds` is a non-empty subset of the job kinds; the numbers are finite and ≥ 0.
- **Default policy:** disabled, all kinds, min 0, maxPenalty 0 (= no limit), allowLiquid true.
- **Each tick, after offers are generated:** if the clerk is enabled, take the oldest offer that matches every rule (kind, `payPerPflopHour(spec) ≥ min`, penalty ≤ max when max > 0, liquid allowed) and passes the same acceptance check as `acceptContract`.
  - Accept it through the same code path as `acceptContract`.
  - Mark the job as a clerk job and emit `clerkAccepted`.
  - At most one per tick.
- **Fee:** every payment a clerk job earns withholds `feeShare`. Revenue stays gross; the fee goes to `cash` and `today.fees`. Expose `acceptedTotal`.

## 3. Loans and levy
- **Limit:** `max = loans.maxByTier[tier − 1]`.
- **`takeLoan`:** `amount > 0` and `principal + amount ≤ max`. Cash goes up; it is **not** revenue.
- **`repayLoan`:** pays `min(amount, principal)`. Reject when cash is below that or the amount is ≤ 0.
- **At midnight, before the day closes:**
  1. Interest = principal × `dailyRate`, charged to `interest`.
  2. Then the levy: `profit = revenue − (energy + upkeep + construction + penalties + interest + fees)`. If it is positive, charge `profit × tax.profitShare` to `taxes`.
- The levy and the interest land on the day being closed. Bankruptcy rules are unchanged.

## 4. Quarterly audit and lifetime stats
- **When:** every `audit.periodDays` days, at the midnight that closes day `k·periodDays − 1`. File a `QuarterReport` over those days.
- **What it uses:** track a per-day uptime and PUE (mean of samples) in state, and count the jobs that completed and failed in the period.
- **Grade:** start at 100 and subtract:
  - 30 if the mean uptime is below the current tier's target
  - 10 per failed job, capped at 40
  - 20 if penalties are more than 10 % of revenue
  - 10 if the mean PUE is above 1.6
  - 20 if profit is negative

  Then A ≥ 90, B ≥ 75, C ≥ 55, D ≥ 35, otherwise E.
- **Effects:** apply `standingByGrade[g]` (with a `standingChanged` event) and `cashShareByGrade[g] × revenue`. A grant counts as revenue; a fine counts as penalties.
- **Remark:** one dry Ministry sentence per grade, five in total.
- **Keep** the last 8 reports and emit `quarterReport`.
- **`LifetimeStats`:** maintain every field.

## 5. Scripted events, bots and snapshots
- **Scripted events:** an `EventDef.scriptedDay` is issued once at 09:00 on that day.
  - It ignores weight, cooldown, random timing and `maxOpen`, but tier limits still apply.
  - It is never picked randomly.
  - Remember which ones were issued, in state.
- **Flying bots:** a bot with `flying` moves straight between floors at its `speed` in floors per tick, with state `"flying"` and a fractional `floor`, and never uses lifts.
- **Carrying bots:** a bot with `carry: n` takes up to n parts per depot trip and repairs queued unassigned work orders one after another before going back. Keep work-order assignment deterministic.
- **Snapshot:** bump the snapshot version and add a migration from v3. It must set defaults, including the three new ledger fields on every stored day. Extend validation. Old saves must load.

## 6. sim-cli and tests
- **Auto-player:**
  - Research the clerk first, then the cheapest available node.
  - Enable the clerk with a permissive policy.
  - Never borrow.
- **New table columns:** RP, techs, taxes.
- **Tests:** every rule above, including the rejection reasons, the fee arithmetic, midnight ordering, a grade boundary, migrating a v3 snapshot, flying and carrying bots, and determinism (same seed ⇒ same hash).
- **Perf:** keep the existing budgets. Run `npm run sim -- starter 30` and report the table.
