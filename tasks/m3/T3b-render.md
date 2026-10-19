# M3-T3b — agent-render: synthetic base look and staged path reskins (supersedes the art parts of M3-T3)

Owner decisions (2026-10-19), see `docs/STYLE_SYNTHETIC.md`:
- **New starting look:** the world starts in a clean **synthetic** style (glass, graphite, cold light) instead of cassette-futurism.
- **Staged reskins:** each path reskins every device in four stages, at 25 / 50 / 75 / 100 % of its path score. Each device either stays the same at a stage or changes:
  - **Biotech:** fleshy. Score = `view.corruption` (it applies even before the path is chosen, from the T3 wetware onward).
  - **Greentech:** fungus, plants and fish. M4: build the stage system so it plugs in, and add placeholders only.
  - **Synthetic Mind:** stays synthetic, growing more refined. M4: placeholder.

Your earlier M3-T3 work is on disk. Keep what still fits: the nutrient layer, the contamination overlay, the statuses, the horror overlays, the wetware facility art, growths and the intensity rules. Restyle it to the synthetic base.

## 1. Synthetic base restyle
- **Everything:** the building, sky, slabs, conduits, every facility kind, the bots and the overlays move to the synthetic tokens.
- **Racks:** dark glass cabinets with a status light strip and no CRTs. Tier detail shows through light and finer detail, not brass.
- **Kept:** all status cues, failure feedback (trip, fire, blackout, leak), alert arrows, reduced motion and colour-blind support.

## 2. A stage system, reusable by every path
- **Pure helper:** `pathSkin(view): { path: "biotech" | "greentech" | "synthetic" | null, stage: 0 | 1 | 2 | 3 | 4 }`, plus a per-device-kind table of what changes at each stage. Unit-test it.
- **Biotech stages per device:**
  - 25 %: damp stains, a faint pulse
  - 50 %: veined surfaces, flesh-tone panels, bile coolant
  - 75 %: breathing housings, eyes in the status lights
  - 100 %: the devices are tissue, and the slab is creeping
- **Taste rules** (`tasks/m3/README.md`): never a body or gore. Intensity `mild` halves the effect; `off` shows the plain synthetic look.
- **Draw cheaply:** cache per device × stage, with no per-frame allocation.

## Rules
- Write only in `packages/render/**`.
- **Be frugal with tokens:** don't re-read files you already know.
- Keep the dev scenes working (`?scene=variety` should show every kind × stage).
- Finish with `npm run check` and a report under 250 words.
