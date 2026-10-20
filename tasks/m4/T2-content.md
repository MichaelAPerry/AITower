# M4-T2 — agent-content: Greentech and Synthetic content, automation research, scenarios
Owns `packages/content/**` (not `schema.ts`). Read `tasks/m4/README.md` and the M4 schema parts. Ministry voice; fictional.

## Greentech
- **About 8 facilities:**
  - **Solar:** a solar skin and a solar canopy (kind `solar`).
  - **Wind:** a wind mast (`wind`).
  - **Heat export:** a district-heat exchanger and a heat pipeline (`heat_export`).
  - **Carbon:** an algae façade and carbon capture (`carbon`).
  - **Racks:** 1–2 green racks, either photonic (very low power) or neuromorphic.
- **Research:** a `"greentech"` path branch of about 8 nodes (T3 basics, T5 `path: "greentech"`).
- **Clients and events:** 2 climate clients; 6 events, including a Dunkelflaute warning and heat-export tariff memos. The quieter fungal horror runs through 4 events with `path: "greentech"` and rising `minCorruption`/flavour, for example mycelium in the ducts.

## Synthetic Mind
- **Facilities:** about 4 (a cryo core, a mind lattice rack, a continuity monitor, a backup vault). Reuse kinds; the mind lattice is a rack.
- **Research:** about 6 nodes with `path: "synthetic"`.
- **Events:** 4 identity-horror events (bots filing forms about themselves, a continuity audit).
- **Paths:** both are now `available: true`, with strong descriptions.

## Automation, scenarios and endings
- **Automation research:** an administration node "Works Foreman" with the `foreman` feature (tier 2, about 3–4 days of RP), plus optional perks.
- **Scenarios:**
  - **`brownfield`:** an old half-built tower bought at auction: more floors, broken racks, debt-like low cash, `startTier` 2, a description.
  - **`sandbox`:** `sandbox: true`, large cash, `startTier` 5, a description.
  
  Validate both.
- **Endings:** real text for `greenExemplar` and `millionMinds` (2–3 paragraphs, dry, no gore).
- **Balance:** tune `balance.green`, `balance.automation`, and the endings `greenExemplar` / `millionMinds`. Justify the values in your report.

## Validation and tests
- **Rules:** cover the new kinds' specs (`green`, `power` for solar and wind), the scenario fields, the paths, and native art widths (solar ≥ 2, wind ≥ 1, heat_export ≥ 2, carbon ≥ 2).
- **Tests:** keep the content tests green and add tests for the new rules.
