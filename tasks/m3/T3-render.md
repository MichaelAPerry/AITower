# M3-T3 — agent-render: the horror overlay pipeline, wetware art, nutrient pipes, contamination overlay

Read `tasks/m3/README.md` (taste rules), `packages/render/AGENTS.md`, `docs/STYLE.md`, `docs/review/ux-art.md` ("Body-horror escalation plan") and the render code.
- **Constraints:**
  - Keep cached facility bodies intact. Horror is drawn as overlay and decal layers driven by `view.corruption`, the per-cell `view.contamination`, the tier and `RenderOptions.horrorIntensity`.
  - Respect reduced motion and colour-blind mode, and keep the frame budget.
- **Palette:** only three new tokens: flesh (pink-beige), bile (olive) and blood (a deep desaturated red-brown). Dithered creep, never smooth gradients.

1. **Nutrient layer:** bile-green nutrient pipes (the third conduit layer, `view.nutrient`), plus the new `OverlayMode`s:
   - `"nutrient"`: nets and satisfaction.
   - `"contamination"`: a dithered heat-map-style field using the data-texture approach of the heat overlay.
2. **Wetware art:**
   - organoid incubator (glass jars with a lumpy pale mass and a slow pulse)
   - DNA vault (stained tubes)
   - neural pit (big)
   - nutrient plant, sterile bay (clinical white with a UV glow), culling room, quarantine lock (heavy door) and bio-reactor
   - growths (`FacilityView.grown`): organic masses on the slab
   - kinds `nutrient`, `sterilizer`, `quarantine`, `bioreactor` and `cooling: "bio"`
   
   Add them to the `?scene=variety` dev scene.
3. **The horror arc by tier and corruption:**
   - **T2+:** lamps pulse slightly out of sync.
   - **T3:** damp stains, sweating copper.
   - **corruption > 0.3:** veined conduits, flesh-tone ducts, a bile-green coolant return.
   - **> 0.6:** breathing walls (a 2-frame wainscot inflate at 0.2 Hz), CRT eyes that slowly track the cursor and blink when paused, a second eye on mutated bots (`BotView.trait`: fleshed gets a flesh patch, tendriled gets tendrils).
   - **> 0.85:** tissue creeping over the slabs, and the MINISTRY sky sign flickering to another word.
   - **Intensity:** `mild` halves the alpha and drops eyes and faces; `off` disables it all.
4. **Statuses:** `noNutrient` and `tooCold` get LED and CRT cues (tooCold: a pale blue frost).
5. **Tests:** pure helpers covering stage selection by tier, corruption and intensity, dither masks, the overlay colour ramps and art selection. Existing tests stay green.
