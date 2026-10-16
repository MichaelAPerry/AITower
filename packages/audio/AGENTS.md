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
| `src/music/director.ts` | Pure `musicParams(view, events, paused, prev)` → stems (IT-load hysteresis), level (paused 0.3, game over 0), night filter/no hats, stingers. |
| `src/music/instruments.ts` | Rhodes FM, nylon pluck, string-machine pad, vibes, brush/rim/teletype tick. Voice cap `MAX_VOICES`; every voice frees itself on `ended`; `dispose()` stops all. |
| `src/music/tape.ts` | Saturation → wow/flutter delay → age low-pass → dropouts; `corruption` (fixed `TAPE_CORRUPTION`=0.05, M3 will drive it) scales detune/wow/dropouts; `stop()` = tape-stop. |
| `src/music/stingers.ts` | Stinger note data (teletype, fanfare). `src/music/index.ts`: `createMusic(ctx, out)` glue (`run/stop/pump/update/destroy`). |
| `dev/` | Offline-render harness: `npx vite packages/audio/dev --port 5186`, then `node packages/audio/dev/render.mjs <outDir>` writes music.wav and prints peak/RMS/NaN stats. Not part of the build. |
| `src/*.test.ts` | Pure-module tests + engine tests with a fake `AudioContext`. |

## Invariants
- Every method is a no-op without an `AudioContext` (Node/tests) or before `resume()`; never throws.
- Hum params are smoothed with `setTargetAtTime` (τ = 0.6 s); at most 4 one-shots start per `update`.
- Exponential ramps never target 0 (WebAudio throws) — envelopes go to 1e-4.

- Music: nothing is created before `resume()`; the 25 ms timer runs only while music volume > 0 and is cleared by `setMusicVolume(0)` and `destroy()`. A music `tierUp` stinger replaces the old fanfare one-shot (the one-shot still plays when music volume is 0). Game over: tape-stop stinger, then the sequencer halts for good.

## Event → sound
rackTripped→alarm, componentFailed→zap, repaired→blip, liftArrived→ding, jobCompleted→cash, tierUp→fanfare,
powerShortfall→lowWarn, gensetStarted→rumble, jobFailed→fail.

## Test
`npx vitest run packages/audio`
