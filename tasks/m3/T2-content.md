# M3-T2 — agent-content: Biotech path content, Clearance 5, horror memos, endings

Read `tasks/m3/README.md` (taste rules), `packages/content/AGENTS.md`, `src/schema.ts` (M3 parts), `docs/ROADMAP_1.0.md` (arc table) and `docs/review/game-design.md` §2–3.
Write in the existing cassette-futurist *Brazil* voice. All of it is fictional. Never show a body or gore, and the Ministry never acknowledges the horror.

## 1. Clearance 5 and paths
- **Clearance 5:** add a 5th entry to `balance.tiers` (pflops, uptime and reward; about 3,000 PF). Then set `balance.ascension.minTier = 5`; the loan `maxByTier` also needs a 5th entry.
- **`paths.json`:** Biotech (available), plus Greentech and Synthetic Mind (`available: false`, "coming soon" copy), each with a strong one-paragraph description.

## 2. Biotech facilities (8 new) and growths
- **The eight:**
  - nutrient plant (`nutrient`)
  - sterile bay (`sterilizer`)
  - culling room (`sterilizer` with `cullsGrowths`)
  - quarantine lock (`quarantine`, 1 wide)
  - bio-reactor (`bioreactor`: `power` spec plus `bio.nutrientUse` and `bio.contamination`)
  - organoid incubator (rack, `cooling: "bio"`)
  - DNA vault (bio storage rack)
  - neural pit (big organoid rack, path-gated T5)
- **Hardware types:** the three are the organoid incubator, the DNA vault and the neural pit.
- **Growths:** add 2 or 3 `growth: true` defs (a free, unreliable organoid mass and a storage-like cyst), never buildable by the player.
- **Values:**
  - Organoids are about 3× the PFLOPS per kW of the best T4 rack, at a 37 °C target with 1 °C tolerance.
  - Plausible `nutrientUse` and `contamination`.
  - Category `"bio"` for the wetware facilities, and `needsNutrient` where it applies.
  - Width rules: native art widths, see `validate.ts`.
- **Gating:** everything sits behind wetware tech.
- **Validation:** update `KIND_CATEGORY` and the spec checks for the new kinds, plus organoid and bio specs, `needsNutrient`, and growth defs (no `tech`, cost 0).

## 3. Tech: a `"wetware"` branch of about 8 nodes
- **The chain:** the **Wetware Annex** (tier 3, unlocks the organoid incubator, nutrient plant and nutrient piping), then T4 nodes for the sterile bay, quarantine, culling room, DNA vault and bio-reactor, then T5 `path: "biotech"` nodes for the neural pit and perks.
- **Validation:** `TechNode.path` must be a known path.

## 4. Clients
- **4 biotech clients** with `needsBio` and a premium `payMultiplier`.

## 5. Events (`events.json`)
- **8 biotech events**, operational and Ministry, from T3 up, mechanically relevant: nutrient spoilage, contamination audits, "asset" registration fees, mutation reports.
- **At least 10 horror events** (`category: "horror"`, rising `minCorruption` 0.1 → 0.9). The escalation runs from bureaucratic oddity (forms that file themselves, lifts that arrive early) to the Ministry billing you for growths. Choices are real trade-offs between cash, standing, failure rate and so on.
- **T1–T2 seed memos (3 or 4):** a "Form 9-B: Wetware Pilot Programme" brochure, a damp stain, a smell report.
- **Validation:** `minCorruption` in 0..1, and `path` known.

## 6. Endings and balance
- **`endings.json`:** livingTower, cleanTower and absorbed, 2 or 3 paragraphs each of dry Ministry prose. The Absorbed ending is quietly devastating and never gory.
- **`balance.bio` and `balance.endings`:** tune and justify in your report. For example, a single organoid bay left unattended should raise contamination noticeably within days, and one sterile bay should hold a small annex clean.

## 7. Tests
- Every new validation rule, that the content loads, and the value ratios.
