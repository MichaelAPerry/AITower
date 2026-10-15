# @aitower/audio

Synthesized WebAudio engine (no audio files). Depends on `sim` (types), `shared` (types).

## Files
| File | Purpose |
|---|---|
| `src/engine.ts` | `createAudio(): AudioEngine`. Lazily creates the `AudioContext` in `resume()`; hum graph (saw+sine drone → low-pass, looped noise → low-pass, fan-whine sine) and one-shot voice player. Master → compressor → destination. |
| `src/hum.ts` | Pure `humParams({itKw,totalKw,maxRackC,paused})` → gains/frequencies; `maxRackTemp(view)`. |
| `src/sounds.ts` | Pure `SOUNDS` recipes (oscillator/noise voices with glides & envelopes), `eventToSound`, `soundsForEvents`. |
| `src/rateLimit.ts` | Pure per-key limiter (≥ 300 ms floor, per-sound `minIntervalMs`). |
| `src/pause.ts` | Pure pause detector (tick unchanged for > 400 ms of audio time ⇒ paused ⇒ hum at 30 %). |
| `src/*.test.ts` | Pure-module tests + engine tests with a fake `AudioContext`. |

## Invariants
- Every method is a no-op without an `AudioContext` (Node/tests) or before `resume()`; never throws.
- Hum params are smoothed with `setTargetAtTime` (τ = 0.6 s); at most 4 one-shots start per `update`.
- Exponential ramps never target 0 (WebAudio throws) — envelopes go to 1e-4.

## Event → sound
rackTripped→alarm, componentFailed→zap, repaired→blip, liftArrived→ding, jobCompleted→cash, tierUp→fanfare,
powerShortfall→lowWarn, gensetStarted→rumble, jobFailed→fail.

## Test
`npx vitest run packages/audio`
