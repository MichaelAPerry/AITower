# M2-T3 — agent-audio: music engine v1 (generative ministry muzak on a decaying tape)

**Owns:** `packages/audio/**`.

**Read first:**
- `tasks/m2/README.md`
- `packages/audio/AGENTS.md` and all of `packages/audio/src`
- `docs/review/audio-music.md` (the design you are implementing; follow its recommendation (a), runtime generative WebAudio)
- `packages/shared/src/index.ts` (`AudioEngine.setMusicVolume`)
- `packages/sim/src/api.ts` (SimView, SimEvent)

## Build
- **Buses (`mixer.ts`):** music, sfx, ambience (the existing hum) and ui, into master.
  - `setVolume` stays master; `setMusicVolume` sets the music bus.
  - Duck the music by about 8 dB for about 1.5 s on alarms (`rackTripped`, `powerShortfall`, `gameOver`).
- **Score data (`music/score.ts`):** a hand-authored tier-1 piece, a 32–64-bar loop of *Brazil*-style bossa / ministry muzak.
  - Instruments: Rhodes-like electric piano chords (ii–V–I movement), a nylon-ish pluck bassline, a soft string-machine pad, a vibraphone melody, and light brush/rim percussion with a teletype-like hat.
  - About 96 BPM. Data only: notes, durations, velocities.
- **Sequencer (`music/sequencer.ts`):** lookahead scheduling on `AudioContext.currentTime` (the standard 25 ms timer / 100 ms horizon pattern). Bar-aligned stem enable/disable.
- **Instruments (`music/instruments.ts`):** synthesized with oscillators, filters and envelopes; no samples. Keep the voice count bounded and release voices properly.
- **Tape chain (`music/tape.ts`):**
  - wow and flutter (a modulated delay)
  - gentle saturation (waveshaper)
  - a low-pass "age" filter
  - occasional subtle dropouts
  - A single `corruption` parameter 0..1 scales detune, wow depth and dropouts. It is fixed at about 0.05 for now; M3 will drive it.
- **Director (`music/director.ts`), a pure function from the view and recent events to music params:**
  - IT load → percussion and bass stems on or off.
  - Night (`minuteOfDay`) → darker filter, no hats.
  - Paused (tick not advancing) → music fades to about 30%.
  - `memoIssued` → a short teletype stinger.
  - `tierUp` → a fanfare stinger (replaces the old one-shot).
  - `gameOver` → a tape-stop stinger, then silence.
- **Lifecycle:** nothing starts before `resume()`, and everything is a no-op without an `AudioContext`. `destroy()` stops all nodes and timers. `setMusicVolume(0)` stops scheduling notes.

## Tests (pure modules, node)
- Score sanity: bars consistent, notes in range.
- Director outputs for load, night, paused and events.
- Sequencer scheduling math with a fake clock: no double-scheduling, and it stays aligned after a long gap.
- Mixer ducking envelope parameters.
- Engine lifecycle with the existing fake `AudioContext` (extend it as needed): resume, update, setMusicVolume(0) and destroy leave no timers.

## Listen check
You can't hear audio here. Render 20 s of the music to a WAV with an `OfflineAudioContext` in headless Chromium:
1. Write a tiny page under `packages/audio/dev/` (create it).
2. Serve it with `npx vite packages/audio/dev --port 5186`.
3. Drive it with the global Playwright (see `scripts/screenshot.mjs` for how to require it), and write the WAV to `/tmp/claude-0/-home-user-AITower/a7f75a3b-71cb-517d-a9c2-dde0cac086fa/scratchpad/m2-audio/`.

Then check the rendered buffer numerically: no NaNs, peak below 0 dBFS, RMS in a sensible range, and no long silences except where intended. Report those numbers. Stop the server by PID.
