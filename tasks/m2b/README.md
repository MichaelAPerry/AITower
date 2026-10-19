# M2b — Research, T2–T4 trunk, cash sinks, audits, Contracts Clerk, failure feedback

Source: `docs/ROADMAP_1.0.md` M2 (the items not done in M2a) plus owner feedback: "automate accepting contracts, but keep a challenge".
Design: the **Contracts Clerk** is the first research unlock (manual accepting early, automation earned), it takes a fee, and
pressure moves to decisions the clerk can't make: research choices, loans and the levy, quarterly audits, a scripted first
emergency, heat.

| Task | Agent (model) | Owns (write access) |
|---|---|---|
| [M2b-T1](T1-sim.md) | agent-sim (Sonnet) | `packages/sim/**` (except `api.ts`), `tools/sim-cli/**` |
| [M2b-T2](T2-content.md) | agent-content (Sonnet) | `packages/content/**` (except `schema.ts`) |
| [M2b-T3](T3-ui.md) | agent-ui (Sonnet) | `packages/ui/**` |
| [M2b-T4](T4-render.md) | agent-render (Sonnet) | `packages/render/**` |

## Contract changes already made by the orchestrator (frozen; do not edit)
- **`content/schema.ts`:**
  - `TechNode`, `TechEffect`, `TechBranch`, `PerkKind`, `FeatureId` and `ContentDB.tech`.
  - New optional fields: `FacilityDef.tech`, `BotDef.tech`, `BotDef.flying`, `BotDef.carry`, `EventDef.scriptedDay`.
  - `Balance` sections `research`, `clerk`, `loans`, `tax` and `audit`.
- **`sim/api.ts`:**
  - Commands: `research`, `setClerk`, `takeLoan`, `repayLoan`.
  - `ClerkPolicy` and the helper `payPerPflopHour()`.
  - Events: `researched`, `clerkAccepted`, `loanTaken`, `loanRepaid`, `quarterReport`.
  - `BotState` gains `"flying"`; `LedgerDay` gains `taxes`, `interest` and `fees`.
  - `SimView` fields: `researchPoints`, `techResearched`, `clerk`, `loan`, `reports` (`QuarterReport`, `AuditGrade`) and `stats` (`LifetimeStats`).
- **Placeholders**, each marked "M2b": an empty `data/tech.json`, starter values in `balance.json`, constant view values, and the four new commands rejected with "not available yet".
  The tree is green at the start: typecheck, boundaries, lint and 476 tests.

## Rules (same as M1/M2a, see `tasks/m1/README.md`)
- **Scope:** write only in your owned paths. No installs. Don't edit contracts; if you think one must change, say so in your report. Don't commit. **Never run `git stash`, `git checkout`, `git reset` or `git clean`**: four agents share this working tree.
- **No mistakes:** read before you change, test every behaviour, and re-read your own diff adversarially.
- **Before finishing:** `npm run check` must pass. If it fails only in another agent's in-progress package, say so. Update your package's `AGENTS.md`.
- **Keep it tight:** be efficient. Don't over-explore, and keep your final report under 300 words, listing any contract concerns.
