# M3 — Into the flesh: the Biotech path and the body-horror arc

Source: `docs/ROADMAP_1.0.md` (M3, "The body-horror arc", taste rules) and `docs/review/game-design.md` §2–3.
**Taste rules, binding for every agent:**
- Never show a human body, and no gore. Horror is *administrative, organic and wrong*: forms, euphemism, texture and sound.
- The Ministry never acknowledges it. Growths are "assets"; a mutated bot is "reclassified".
- `settings.horrorIntensity`:
  - **full:** everything.
  - **mild:** about half the intensity, no eyes or face motifs.
  - **off:** no horror visuals or sounds. The mechanics stay, with plain wording.

## Arc
- **T1–T2:** seeds only (odd memos, a damp stain, lamps slightly out of sync).
- **T3:** the Wetware Annex research unlocks organoid racks, nutrient pipes and the 37 °C band.
- **T4:** contamination spreads, bots mutate, growths sprout, quarantine and sterile bays appear.
- **T5 (new Clearance):** commit to an Ascension path. Biotech is available; Greentech and Synthetic Mind are "coming soon".
- **Endings:**
  - Living Tower (embrace)
  - Clean Tower (resist)
  - secret: Absorbed

| Task | Agent (model) | Owns (write access) |
|---|---|---|
| [M3-T1](T1-sim.md) | agent-sim (Sonnet) | `packages/sim/**` (except `api.ts`), `tools/sim-cli/**` |
| [M3-T2](T2-content.md) | agent-content (Sonnet) | `packages/content/**` (except `schema.ts`) |
| [M3-T3](T3-render.md) | agent-render (Sonnet) | `packages/render/**` |
| [M3-T4](T4-ui.md) | agent-ui (Sonnet) | `packages/ui/**` |
| [M3-T5](T5-audio.md) | agent-audio (Sonnet) | `packages/audio/**` |

## Contract changes already made by the orchestrator (frozen; do not edit)
- **`content/schema.ts`:**
  - Facility kinds `nutrient`, `sterilizer`, `quarantine` and `bioreactor`; `BuildCategory` `"bio"`; `CoolingMode` `"bio"`.
  - `RackSpec.bio` (`OrganoidSpec`), `FacilityDef.bio` (`BioSpec`), `FacilityDef.growth` and `PlacementRules.needsNutrient`.
  - `Balance.bio`, `Balance.ascension` and `Balance.endings`.
  - `ClientTemplate.needsBio` and `ContractSpec.needsBio`.
  - `EventDef.minCorruption` and `EventDef.path`; `TechNode.path`; `TechBranch` `"wetware"`.
  - `AscensionPath`, `EndingId`, `EndingDef`, `PathDef`, and `ContentDB.paths` / `ContentDB.endings`.
- **`sim/api.ts`:**
  - `ConduitLayer` `"nutrient"` and the command `choosePath`.
  - Events: `pathChosen`, `growthSprouted`, `botMutated`, `contaminationIrreversible`; `gameOver.ending`; `GameOverKind` `"absorbed"`.
  - `FacilityStatus` `noNutrient` and `tooCold`.
  - `FacilityView`: `nutrientNet`, `grown` and `contamination`. `BotView.trait` (`BotTrait`).
  - `SimView`: `nutrient`, `nutrientNetOf`, `contamination`, `nutrientNets`, `corruption`, `contaminatedShare`, `irreversible`, `path`, `organoidPflops` and `endingProgress`.
- **`shared`:** `OverlayMode` `"nutrient"` and `"contamination"`; `AudioEngine.setHorrorIntensity`. The app already calls it from settings.
- **Placeholders**, each marked "M3":
  - `paths.json` and `endings.json`, and starter values in `balance.json`.
  - Constant view values.
  - Status and category maps.
  
  The tree is green at the start: typecheck, boundaries, lint and 741 tests.

## Rules (same as M2b, see `tasks/m2b/README.md`)
- **Scope:** write only in your owned paths. No installs. Don't edit contracts; if you need a change, say so in your report. Don't commit. **Never run `git stash`, `git checkout`, `git reset` or `git clean`**: five agents share this working tree.
- **No mistakes:** read before you change, test every behaviour, and re-read your diff adversarially.
- **Before finishing:** `npm run check` must pass. If it fails only in another agent's in-progress package, say so. Update your package's `AGENTS.md`.
- **Keep it tight:** be efficient, and keep your final report under 300 words, listing any contract concerns.
