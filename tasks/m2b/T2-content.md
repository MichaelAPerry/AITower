# M2b-T2 — agent-content: tech tree, T2–T4 trunk, clients, bots, balance, first emergency

Read `tasks/m2b/README.md`, `packages/content/AGENTS.md`, `src/schema.ts`, the current `data/*.json` and `validate.ts`.
Keep every name and description in the existing cassette-futurist *Brazil* voice: brass, punch cards, CRTs, Ministry forms.
Every description must also state the real numbers. All of it is fictional; no real company names.

## 1. `data/tech.json`: about 36 nodes
- **Spread:** five branches (compute, cooling, power, logistics, administration) across `minTier` 1–4, with sensible `requires` chains and no cycles.
- **First node:** administration, tier 1, cheap: **"Contracts Clerk"** with `{type:"feature", feature:"contractsClerk"}`. It should be affordable after about one game day of full starter utilisation.
- **Perks:** use every `PerkKind` at least once, with modest factors (about 0.8–1.15 each).
- **Unlocks:** facility and bot unlocks are declared on the facility or bot (`tech: "<node id>"`). Every new facility and bot below is gated by a node.
- **RP economy:** the sim earns `research.pointsPerPflopHour × PF·h` plus `pointsPerJob` per completed job.
  - The starter delivers at most 80 PF × 24 h ≈ 1,920 PF·h a day.
  - Set `balance.research` and the node costs so that tier-1 nodes take about 1–3 days, tier 4 about 5–10 days at that tier's typical capacity (tiers need 120/400/1200 PF), and the whole tree takes roughly 60–90 days.
  - Show the arithmetic in your report.

## 2. T2–T4 trunk: about 20 new facilities
- **Kinds:** use only the existing `FacilityKind`s; the renderer draws by kind.
- **8 new hardware (rack) types:**
  - at least two air, two DLC and two `cooling: "immersion"` (immersion means `liquidFraction` about 0.95 and `needsCoolant`)
  - one inference-optimised high-PFLOPS-per-kW rack
  - one bigger storage array
- **Plus about 12 support facilities:** bigger grid tie, gas-turbine genset, flywheel or big UPS, rear-door CRAH, high-capacity CRAH, cooling-tower chiller, big CDU, depot, fast charger, and so on.
- **Values:** `unlockTier` 2–4 and realistic plausible numbers. Keep the DLC-vs-air value gap (DLC about 1.6× air PFLOPS per $ including cooling).
- **Bots** (`bots.json`): a **drone** (`flying: true`, fast, small battery) and a **lifter** (`carry: 3`, slower, sturdier). Both are tech-gated.

## 3. Clients
- **About 10 new clients** (`clients.json`) for tiers 2–4, some with `needsLiquid`, across all sectors.

## 4. Balance and events
- **New `balance.json` sections:** pick final values and justify them in the report:
  - `research`
  - `clerk.feeShare` (about 5–8 %)
  - `loans` (`maxByTier`, one per tier; a daily rate around 0.3–0.6 %)
  - `tax.profitShare` (about 10–15 %)
  - `audit` (periodDays 7, `standingByGrade` and `cashShareByGrade` for A..E)
- **Early heat pressure:** tune the starter (balance thermal values, the starter layout in `scenarios.json`, ambient) so that on a hot afternoon the four starter racks at full load run close to throttling with one CRAH, and a second CRAH or a heatwave visibly matters. Don't make the start unplayable.
  - Verify with `npm run sim -- starter 10`; the sim-cli and the sim are being changed in parallel, so if they break, measure with a small vitest instead.
  - Report the peak rack temperatures.
- **Scripted first emergency** (`events.json`): an operational heat event with `scriptedDay: 2` (an `ambient` spike for a few hours), whose choices trade cash against risk. The hints must state the numbers.
- **More events:** add about 6 non-horror events for tiers 2–4, mentioning loans, the levy, audits and research.

## 5. Validation (`validate.ts`) and tests
- **Tech nodes:** unique ids, valid branch, `requires` exist and have no cycle, cost > 0, `minTier` within 1..(number of tiers), and every effect valid.
- **References:** every facility and bot `tech` points at an existing node.
- **Fields:** `scriptedDay` is an integer ≥ 0; `carry` is an integer ≥ 1.
- **New balance sections:** valid, with `maxByTier.length === tiers.pflops.length` and both grade arrays of length 5.
- **Tests:** cover each validation rule and that the bundled content loads.
