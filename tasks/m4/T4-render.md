# M4-T4 — agent-render: Greentech and Synthetic stages, green facility art, juice
Owns `packages/render/**`. Read `tasks/m4/README.md`, `docs/STYLE_SYNTHETIC.md`, and `src/skin.ts` (the stage system).
- **Greentech stages** (fill the `pathSkin` placeholders; driven by `view.pathScore` once the path is green):
  - 25 %: moss on edges
  - 50 %: fungus shelves, vines on conduits
  - 75 %: plants growing out of devices, small fish tanks in coolant loops
  - 100 %: a living green tower (roof garden, glass aquaria)
  
  Per device "stays the same or changes" like Biotech. The fungal horror is quiet (spores, gill textures) and respects intensity.
- **Synthetic stages:** more refined. Finer light lines, brighter glass, then monolithic panels, then light-only geometry.
- **New kinds:**
  - **Solar:** panels on the façade and roof, dark at night.
  - **Wind:** a mast with a turning rotor whose speed follows output.
  - **Heat export:** a pipe to the street with a warm glow.
  - **Carbon:** an algae façade with green bubbles.
  
  Add all of them to the variety scene.
- **Drought:** a dimmer, flat sky, and the rotors stop.
- **Juice (`pushEvents`):**
  - **`earned`:** a "+$" floater rising from the job's racks (or the rack area), coalesced, capped, and colour-coded in money green.
  - **`autoBuilt`:** a small build puff.
  - **`jobFailed`:** a red "−$" floater.
  
  Reduced motion: no motion (a static fade only). No per-frame allocation; cap the particles.
- **Tests:** stage tables, floater coalescing and caps, art selection and bounds. Keep the tests fast (no thousands of `expect()` calls; CI timed out once).
