# Audio and music review (1.0)

Scope: `packages/audio/src/*`, the `AudioEngine` contract in `packages/shared/src/index.ts`, and `SimView`/`SimEvent` in `packages/sim/src/api.ts`. Read-only review.

## 1. Audit of current audio

**What exists.** `createAudio()` in `engine.ts` builds one graph: master gain, then a compressor, then the destination. It has:
- a hum made of a saw+sine drone through a low-pass, looped noise, and a heat-driven fan whine (`hum.ts`, load-driven and smoothed with τ = 0.6 s);
- 9 synthesized one-shots (`sounds.ts`);
- a pause detector, a rate limiter, and a cap of 4 shots per update.

The code is tidy, pure where it can be, tested, and never throws.

**Quality risks.**
- **Constant hum.** A saw drone at 48–62 Hz plus noise is one static timbre for the whole game. It will fatigue within 15 minutes and is not distinctive. Nothing varies per room, tier or time.
- **Loud, clean alerts.** The `alarm` is a plain square-wave two-tone chirp, `fanfare` is a stock saw arpeggio, and `cash` is a cartoon register. They sound like generic chiptune, not 1983 mainframe hardware. Nothing says Brazil, teletype or relay clatter.
- **Sparse alert coverage.** One 900 ms-limited alarm is the only escalation. Multiple trips collapse to one sound because of the dedupe in `soundsForEvents` and the 300 ms floor.
- **Master-only mix.** The single compressor on the master bus pumps the hum when a one-shot fires.
- **Noise buffer.** A 2 s looped noise buffer will audibly repeat.
- **Pausing.** The pause detector infers pause from a stalled tick, so it is heuristic. A 400 ms stall during heavy load looks like a pause and the hum dips.

**Gaps.**
- **Buses and settings.** There is only `setMuted` and `setVolume`. There are no music/SFX/ambience buses, so the player cannot turn music down while keeping alarms. `volume` (default 0.7) and `muted` are not persisted. There is no audio setting in the contract.
- **Ducking.** None. An alarm should duck music and ambience by about 6 dB for 1.5 s.
- **Spatialisation.** `update(view, events)` receives no camera. Events carry `facilityId`, `floor` and `x` (`built`, `liftArrived`, `repaired`), and facilities have `floor` and `x`. The camera could pan and attenuate by distance, and could roll off by floor. Every sound is currently centred, full-volume and global.
- **Missing event sounds.**
  - `rackThrottled`, `rackRecovered`, `gensetStopped`, `upsDepleted`, `contractOffered`, `contractExpired`, `jobStarted` (a pneumatic-tube thunk fits), `jobRolledBack`, `newDay`, `bankrupt`, `built`, `demolished`, `commandRejected` have none.
  - The `STYLE.md` bot chirps and welding sparks are absent, because bots are not an event source (read `view.bots[].state`).
  - Lift motion has no loop, only a ding.
- **UI clicks.** None. Switches, push buttons, stamps and teletype toasts (`STYLE.md` §1 UI) are an obvious sound set, and the engine has no `playUi(id)` entry point.
- **Zones and ambience.** The hum is global. There is nothing per floor, so basements, the lobby and the upper floors sound identical, and there is no outside, wind or city sound. The "layered ambient hum tracking kW and fan RPM" in ARCH §12 is delivered as one layer.
- **Day/night.** `view.minuteOfDay` is unused. The `STYLE.md` sodium dusk and searchlight night have no audio counterpart.
- **Late-game body-horror.** ARCH §9 describes the Biotech path (organoids, nutrient medium, infection). `SimView` has no field for path or contamination, so audio cannot react to the arc even if it wanted to.

## 2. Music design for 1.0

**Style.** Muzak that is slightly wrong: a *Brazil* ministry lobby tape that has been played for 40 years. Core palette:
- electric piano (Rhodes/FM), muted bossa nylon-ish pluck, slow string-machine pad, vibes/celesta, brushed or drum-machine rim shots;
- a bass that doubles as a transformer hum;
- teletype, relay and tape-reel noises as rhythm.

The in-world conceit is a tape loop that decays. Everything runs through a tape-warp stage: wow/flutter (a 0.5–6 Hz pitch LFO), saturation, hiss and dropout.

**Tracks.** Keep it small and loopable.
- **Tier tracks (3).** Each is a 64-bar loop at about 84–96 BPM, roughly 2:30–3:00. Early game has a warm, sparse trio (Rhodes, bass, brushes) in a single key centre. Mid game adds strings and vibes. Late game adds a drum machine, an arpeggiator and denser chords.
- **Stems.** Each tier track is 5 stems: *bed* (pad and bass), *harmony*, *melody*, *rhythm*, *texture*. They are aligned to the bar and mixed by intensity.
- **Per-path late layer.** Three overlays, one per Ascension Path. Biotech is the body-horror one (below). Greentech is bright and quasi-modal. Synthetic Mind is glassy and quantised.
- **Alarm layer.** One tense ostinato stem (low pulse, muted tritone) shared by all tracks, fading in under alarms.
- **Stingers (about 8, 1–4 s).** Tier up, contract accepted, first day complete, bankrupt (tape stop), mass trip, recovery (resolve chord), path chosen, corruption milestone.

**Reactivity (state → music).**

| Signal | Source | Effect |
|---|---|---|
| Tier | `view.tier` | Select track and key set; crossfade over 2 bars, starting on a bar line |
| Time of day | `view.minuteOfDay` | Day is brighter (more vibes, high filter). Night is dark: low-passed, slower, pad-led. Sodium dusk gets a slow filter sweep |
| Load | `view.itKw`, `pflops` | Maps to the rhythm and texture stems (intensity 0..1) |
| Stress | tripped or failed share, `maxRackC`, `powerShortfall` | Alarm stem in, melody out, tempo drift, ducking |
| Money | `view.cash`, `bankrupt` | Cash low plays a minor-mode substitution; bankrupt is a tape-stop stinger |
| Events | `SimEvent` | Stingers (above), quantised to the next beat |
| Corruption | new `view.corruption` 0..1 | Biotech escalation (below) |

**Body-horror escalation.** Drive it from a single 0..1 `corruption` value; the sim must expose it, since nothing in `SimView` provides it today. In stages:
1. **0.0–0.25:** wow/flutter depth rises and tape hiss grows.
2. **0.25–0.5:** detune creeps in (fixed ±15–40 cent drift on pads and Rhodes, chorus beating), dropouts get longer, and a slow loop-length drift desyncs the layers.
3. **0.5–0.75:** organic textures enter: wet clicks, breath-like formant-filtered noise, heartbeat kick at about 60 BPM, slow sub swell, granular smears of the melody.
4. **0.75–1.0:** harmony slips toward cluster chords, the tape "chews" (stutter, reverse), the pulse locks to the heartbeat, and the muzak melody persists, off-pitch, under it.

Keep the clean muzak audible throughout so the contrast stays horrifying.

## 3. Production approach

| | (a) Runtime generative WebAudio | (b) Tracker-module player | (c) Pre-rendered OGG stems |
|---|---|---|---|
| Download | about 0 KB | 50–500 KB (libopenmpt/chiptune3 WASM is 300+ KB, plus samples) | 3 tiers × 5 stems × 3 min ≈ 25–40 MB at OGG q4 |
| Fit with existing code | Direct; same `AudioContext`, same recipes | Foreign runtime; module formats are 8–32 channel, sample-based | New asset pipeline, loader and streaming |
| Adaptivity | Total: every parameter is live (tempo, detune, filter, density) | Pattern/order jumps are coarse; per-channel mute only | Stem gain only; detune/tape effects need DSP anyway |
| Body-horror | Natural: corruption is just parameters | Hard: fixed samples | Possible only by baking dirty variants (doubles size) |
| Quality ceiling | Risky: needs a composer-grade patch and pattern design, otherwise it sounds like a toy | Good in skilled hands, with a strong retro look | Highest: real instruments and mixing |
| Cost/licensing | Engineering time only; no licences | Free modules need per-track licence checks (CC-BY etc.) | Commission or licence; spend and rights tracking |

**Recommendation: (a) a hybrid, with generative synthesis as the core.** The game is already all-synth with zero audio files. Corruption, tempo, time-of-day and load are continuous parameters, which procedural generation handles better than any stem set. A bundle of tape-warped DSP (wow/flutter, saturation, dropout) is also exactly the effect the horror needs, and (c) would require it at runtime anyway. The quality risk is real, so mitigate it by composing the *score* as data (chord progressions, motifs, rhythm patterns written by hand per tier) while the *performance* is synthesised. Keep an escape hatch: the player can play optional pre-rendered OGG sample loops later for stems that synthesis can't carry (e.g. the shared texture layer), without changing the architecture.

**Architecture** (all under `packages/audio/src/music/`, following the existing pure-core / thin-engine split):
- `score.ts`: pure data. Per tier: key, chord progression, bass/melody motifs, rhythm grids, and per-stem intensity thresholds.
- `director.ts`: pure. `musicParams(view, events, camera?) -> { tier, intensity, stress, night, corruption, stingers[] }`. Smooths inputs (hysteresis, so a single trip doesn't flip the mix) and picks stingers. Unit-testable in Node like `hum.ts`.
- `sequencer.ts`: a lookahead scheduler (`setInterval` at 25 ms scheduling ~100 ms ahead against `ctx.currentTime`) that turns the score plus `musicParams` into note events on the beat.
- `instruments.ts`: voice factories (Rhodes-ish FM, nylon pluck, string-machine saw ensemble, vibes, brush noise, tape-click percussion). They reuse `playVoice` from `engine.ts` (extract it to a shared module).
- `tape.ts`: the master tape chain: wow/flutter LFO on a short delay line, soft clipping via `WaveShaper`, hiss, dropout gain automation. `corruption` controls it and the organic voices.
- `index.ts` in the package exports `createMusic(ctx, out)`, returning `{ update(params), stinger(id), destroy() }`.

**Mixer** (`mixer.ts`): master, then `music` / `sfx` / `ambience` / `ui` buses, each with its own gain; a sidechain-style ducker driven by alarm events. Replace the single compressor with a per-bus limiter.

**Interface change to `AudioEngine`** (`packages/shared/src/index.ts`; contract change, so orchestrator sign-off applies):
```ts
interface AudioSettings { master: number; music: number; sfx: number; ambience: number; ui: number; muted: boolean }
interface AudioEngine {
  resume(): Promise<void>;
  update(view: SimView, events: SimEvent[], camera?: { floor: number; x: number }): void;
  setSettings(s: Partial<AudioSettings>): void;   // supersedes setMuted/setVolume (keep them as wrappers)
  playUi(id: UiSoundId): void;                    // click, toggle, stamp, teletype, deny
  destroy(): void;
}
```
`SimView` gains `corruption: number` (0..1) and `path: "none" | "bio" | "green" | "synth"`; without them the horror arc cannot be built. `GameState` already has `muted`; add a persisted audio-settings object and a settings panel.

**Consumption.** Each frame `update()` already receives `view` and `events`. The director derives `musicParams` from them with a debounce, and events map to stingers via an `eventToStinger` next to `eventToSound`. Determinism is not required, so `Math.random` is acceptable for note variation, with a seeded LCG preferred for testability.

**Budget.** At most about 12 live voices, with voice stealing. Note events need `AudioParam` automation, not per-note nodes beyond the pooled set. Pause the sequencer when `ctx.state !== "running"` or the tab is hidden.

## 4. Priorities

**MUST**
- Bus mixer with music/SFX/ambience/UI sliders, persisted settings, and the `AudioEngine` change (M).
- Music engine v1: sequencer, instruments, tape chain, and one tier-1 loop that sounds good (L).
- Director with tier, load, stress and time-of-day reactions, plus tier-up crossfade (M).
- `corruption` and `path` fields in `SimView`; the three-stage body-horror pass for the Biotech path (L, spans sim and audio).
- Alert ducking, and a distinct alarm for mass trips (S).
- UI click sounds (`playUi`) (S).

**SHOULD**
- Tier 2 and 3 tracks plus the alarm stem (L).
- Remaining stingers: tier up, bankrupt tape-stop, recovery (M).
- Missing event sounds: `rackThrottled`, `jobStarted`/tube thunk, `contractOffered` (teletype), `newDay`, `built`, `commandRejected` (M).
- Camera-based pan and distance attenuation by floor (M).
- Per-floor ambience and day/night ambience (outside layer, searchlight hum) (M).
- Replace the 2 s noise loop with a longer or generated noise source; revise the hum timbre and the alarm for the era (S).

**COULD**
- Per-path late-game overlays for Greentech and Synthetic Mind (M).
- Bot chirps and welding, lift motion loops (S).
- Optional OGG layer for stems that synthesis can't carry (M).
- Pause detection from an explicit flag instead of tick stall (S).
- Soundtrack "jukebox" or tape-deck UI toggle for the player (S).
