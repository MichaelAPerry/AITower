# M3-T5 — agent-audio: corruption on the music, wet textures, tier tracks, stingers

Read `tasks/m3/README.md` (taste rules), `packages/audio/AGENTS.md`, `docs/review/audio-music.md` (especially "Body-horror escalation") and the audio code: the music engine, director, tape chain and hum.
Everything stays generative WebAudio (no audio files). Respect `setHorrorIntensity` (now in the `AudioEngine` contract; it is a placeholder in `engine.ts`): `off` means a clean tape and no organic sounds, `mild` means about half the depth.

1. **Corruption on the tape chain**, driven from `view.corruption` (smoothed):
   - **> 0.2:** detune drift and extra wow.
   - **> 0.45:** organic textures: wet clicks, a breathing modulation on the hum, a slow heartbeat sub.
   - **> 0.7:** cluster chords and chewed-tape dropouts.
   - **> 0.9:** the muzak keeps playing politely underneath something that is not music.
2. **Tier tracks:** add score data for tier 2–3 tracks (and reuse one for 4–5), each a 64-bar loop with its stems, in the same bossa-muzak voice. The director picks by tier.
3. **About 8 stingers** (1–4 s), each mapped to its trigger:
   - tier up (`tierUp`)
   - research filed (`researched`)
   - audit filed: good or bad grade (`quarterReport`)
   - path chosen (`pathChosen`)
   - growth sprouted (`growthSprouted`)
   - mutation (`botMutated`)
   - irreversible (`contaminationIrreversible`)
   - game over, victory or absorbed (`gameOver`)
   
   Duck the music under them.
4. **Tests:** pure parts such as director params by corruption, tier and intensity, stinger mapping, and score data validity. Keep the CPU light: no per-frame node creation beyond the existing patterns.
