# M4-T5 — agent-audio: spatial audio, floor ambience, Greentech/Synthetic layers, event sounds
Owns `packages/audio/**`. Read `tasks/m4/README.md` and the audio code. All generative, no files.
- **Spatial audio:** pan and attenuate one-shots by their world position relative to the camera, with a pure helper for the panning. If the camera isn't available through `AudioEngine.update(view, events)`, approximate from the event's facility and report the contract need.
- **Per-floor ambience:** basement plant hum, rack-floor fans, roof wind. Mix it by what is built and running.
- **Path layers:**
  - **Greentech:** a brighter, quasi-modal music layer (marimba and flute-ish synth), a rustle and water bed, and a gentle spore "breath" at high score.
  - **Synthetic:** glassy and quantised.
  
  Driven by `view.path` and `view.pathScore`, smoothed, respecting horror intensity.
- **Remaining event sounds:** `earned` (a soft till chime, rate-limited), `autoBuilt` (a pneumatic clunk), the drought start/end, and the automation toggles (through the UI sound path, if one exists).
- **Tests:** pure parts (panning, ambience mix, layer levels, rate limits).
