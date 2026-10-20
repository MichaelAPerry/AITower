# @aitower/audio

Synthesized WebAudio engine (no audio files). Depends on `sim` (types), `shared` (types).

## Files
| File | Purpose |
|---|---|
| `src/engine.ts` | `createAudio(): AudioEngine`. Lazily creates the `AudioContext` in `resume()`; hum graph (saw+sine drone → low-pass, looped noise → low-pass, fan-whine sine) and one-shot voice player. Routes through the mixer. |
| `src/hum.ts` | Pure `humParams({itKw,totalKw,maxRackC,paused})` → gains/frequencies; `maxRackTemp(view)`. |
| `src/sounds.ts` | Pure `SOUNDS` recipes (oscillator/noise voices with glides & envelopes), `eventToSound`, `soundsForEvents`. |
| `src/rateLimit.ts` | Pure per-key limiter (≥ 300 ms floor, per-sound `minIntervalMs`). |
| `src/pause.ts` | Pure pause detector (tick unchanged for > 400 ms of audio time ⇒ paused ⇒ hum at 30 %). |
| `src/mixer.ts` | Buses (music/sfx/ambience/ui) → master → compressor → destination; music duck gain (-8 dB, 1.5 s hold on `rackTripped`/`powerShortfall`/`gameOver`); pure `duckSteps`, `shouldDuck`. `setVolume`=master, `setMusicVolume`=music bus. |
| `src/music/score.ts` | Data: 32-bar 96 BPM bossa/muzak loop (A A B A', ii-V-I in C) as sorted `ScoreNote`s on 16th steps; stems pad/keys/bass/vibes/brush/rim/hat. |
| `src/music/sequencer.ts` | Pure lookahead core (25 ms tick / 100 ms horizon, caller-supplied clock). Bar-aligned stem latching; skips missed steps after a gap, stays on grid. |
| `src/music/director.ts` | Pure `musicParams(view, events, paused, prev, {intensity, dtS})` → stems (IT-load hysteresis), level (paused 0.3, final game over 0; victory keeps playing), night filter/no hats, stingers, `track` (by tier), smoothed `corruption` (× horror scale: full 1, mild 0.5, off 0) and `layers` {drift >0.2, organic >0.45, cluster >0.7, under >0.9}, `tapeCorruption` (0.05 = clean). |
| `src/music/tracks.ts` | Tier 2 (104 BPM, F) and tier 3 (88 BPM, D minor) 64-bar scores built from chord/melody tables (`spell`, `buildTrack`); `trackForTier` (4-5 reuse 3). Music swaps track on a bar line (sequencer `startAt`). |
| `src/music/organic.ts` | Pure scheduler for the organic layer: wet clicks + 60 BPM lub-dub heartbeat sub; `clusterExtra` (cluster chords). |
| `src/music/instruments.ts` | Rhodes FM, nylon pluck, string-machine pad, vibes, brush/rim/teletype tick. Voice cap `MAX_VOICES`; every voice frees itself on `ended`; `dispose()` stops all. |
| `src/music/tape.ts` | Saturation → wow/flutter delay → age low-pass → dropouts; `setCorruption` (director's `tapeCorruption`; 0.05 baseline) scales detune/wow/dropouts; `setChew` adds stutter dips + pitch lurches; `stop()` = tape-stop. |
| `src/music/stingers.ts` | Stinger note data + pure event mapping (`stingersForEvents`, priority, max 2/frame, horror ones dropped at `off`): tierUp→fanfare, memoIssued→teletype, researched, quarterReport→auditGood (A/B)/auditBad, pathChosen, growthSprouted→sprout, botMutated→mutation, contaminationIrreversible→irreversible, gameOver→victory/absorbed/tapeStop. `src/music/index.ts`: `createMusic(ctx, out, {stingerOut})` glue (`run/stop/pump/update/destroy`); `update` returns the stinger length so the engine can duck; builds the "under" drone lazily; per-stinger 2 s rate limit. |
| `src/spatial.ts` | Pure `spatialParams(pos, listener)` → pan (±0.8 over 14 cols) + distance gain (floor 0.4); `eventSpot`/`spatialForEvent` place events by facilityId/built/lift; `listenerFromView` = facility centroid (no camera in the contract). Engine uses a `StereoPanner` when present. |
| `src/ambience.ts` | Pure `ambienceMix(view, paused)` → {plant, fans, wind} 0..1 from running facilities by `defId` family (plant: grid/genset/ups/chiller/cdu/..., fans: racks/crah, wind: floors above ground + `wind*` masts). Engine beds: plant tones, fan noise, roof wind noise with LFO. |
| `src/pathLayers.ts` | Pure Greentech/Synthetic layers: `pathTargets/pathLevels` (smoothed, τ 6 s, fades in from 0; spore breath + hollow tone x horror scale), `createPathNotes` (seeded pentatonic marimba/flute; synthetic glass on a 0.25 s grid), `noteVoices`, `dueNotes` (0.4 s lookahead, no burst after gaps). Engine builds the path graph lazily on the first update with a path; beds on the ambience bus, notes on the music bus (so duck + music volume apply; notes stop when paused or music volume 0). |
| `dev/` | Offline-render harness: `npx vite packages/audio/dev --port 5186`, then `node packages/audio/dev/render.mjs <outDir>` writes music.wav and prints peak/RMS/NaN stats. Not part of the build. |
| `src/*.test.ts` | Pure-module tests + engine tests with a fake `AudioContext`. |

## Invariants
- Every method is a no-op without an `AudioContext` (Node/tests) or before `resume()`; never throws.
- Hum params are smoothed with `setTargetAtTime` (τ = 0.6 s); at most 4 one-shots start per `update`.
- Exponential ramps never target 0 (WebAudio throws) — envelopes go to 1e-4.

- Music: nothing is created before `resume()`; the 25 ms timer runs only while music volume > 0 and is cleared by `setMusicVolume(0)` and `destroy()`. A music `tierUp` stinger replaces the old fanfare one-shot (the one-shot still plays when music volume is 0). Game over: tape-stop stinger, then the sequencer halts for good.

- Horror: `setHorrorIntensity` feeds the director (off = clean tape, no organic sounds/horror stingers, no hum breathing; mild = corruption x0.5). Stingers use `buses.stinger` (follows music volume, bypasses the duck); music is ducked -6 dB under them (`duckPlan`). The hum has a breathing LFO (0.22 Hz) driven by the organic layer.
- Music-volume 0: stingers other than the tierUp one-shot are silent (they are music).

- M4: ambience beds exist from `resume()`; path graph only once `view.path` is greentech/synthetic. Toggle ticks come from diffing `view.automation.policy` between updates (UI bus; first sight is silent). Positional one-shots go through `soundPlays` (first event per sound id keeps its position).

## Event → sound
rackTripped→alarm, componentFailed→zap, repaired→blip, liftArrived→ding, jobCompleted→cash, tierUp→fanfare,
powerShortfall→lowWarn, gensetStarted→rumble, jobFailed→fail, earned→till (2.5 s limit), autoBuilt→clunk, droughtStarted/Ended→droughtOn/Off; toggleOn/Off from policy diffs.

## Test
`npx vitest run packages/audio`
