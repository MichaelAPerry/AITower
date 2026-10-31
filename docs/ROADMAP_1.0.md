> **HISTORIC (Oct 2026).** This roadmap was written on 2026-10-15 and is kept for history. Much of it is built or replaced. For the current state read `HANDOFF.md`.

# AItower — Road to 1.0

_Combined from four independent reviews (Sonnet sub-agents, 2026-10-15). Full reports:
[game design](review/game-design.md) · [audio & music](review/audio-music.md) · [UX & art](review/ux-art.md) ·
[engineering](review/engineering.md)._

## Where we are
The **simulation is solid and the presentation has a strong identity**. Heat, power, coolant, jobs, failures, bots and
lifts all run deterministically, at about 2.6 ms per tick even on a 100-floor, 1,800-rack tower. The cassette-futurist
art and HUD land the tone, and a 13-step tutorial now exists.

What's missing is **the game around the sim**:
- **Content:** 11 facilities, 1 bot and 1 scenario.
- **Progression:** no tech tree, no events and no win state.
- **Audio:** no music.
- **Meta UI:** no settings, pause menu, or save/load screens.
- **Robustness:** a crash freezes the game, and saves are a single unvalidated slot.
- **Body horror:** the late game it was supposed to deliver doesn't exist yet.

The reviewers agree on all of this.

## The 1.0 vision in one paragraph
You run a datacenter for the Ministry of Computation. Clearance tiers T1–T4 grow it from air-cooled cabinets to liquid
plants, under escalating Ministry memos, audits and crises. At T5 you commit to an Ascension Path. As the tower grows,
it **stops being entirely a machine**. Wetware creeps in through the plumbing, contamination spreads like heat, and the
automatons mutate. The Ministry reclassifies the growths as "assets" and bills you for them. Embrace the flesh for about
3× compute per watt, or fight it with quarantine and bleach to keep the "Clean Tower" ending. Never gory: administrative,
organic and wrong.

## The body-horror arc (owner requirement)
| Tier | What the player sees and hears | What it does mechanically |
|---|---|---|
| T1–T2 | Odd memos, a damp stain, a "Form 9-B: Wetware Pilot Programme" brochure. Lamps pulse slightly out of sync. | Cosmetic seeds only. |
| T3 | A **Wetware Annex** unlocks: organoid jars, nutrient pipes, sweating copper. The muzak tape starts to wow. | Nutrient medium piped like coolant. Organoid racks must stay at 37 °C ± 1, so GPU waste heat becomes useful. |
| T4 | Veined cables, a bile-green coolant return, flesh-tone ducts. Bots slow down and twitch. Heartbeat textures enter the music. | A contamination field spreads like heat. Bots gain mutation traits. Quarantine locks appear. |
| T5 | Breathing walls, cursor-tracking eyes in the CRTs, growths on empty slabs. Ministry memos turn strange. | Growths act as free but unreliable conduits and racks. Self-healing hardware. |
| End | Tissue consumes the slabs, forms file themselves, lifts arrive before they are called. | Path endings: Living Tower, Carbon-Negative Exemplar, The Million Minds, plus a secret "Ministry Absorbed You". |

**Taste rules:**
- Never show a human body or gore.
- Horror comes through text, sound and texture.
- The Ministry never acknowledges it.
- An intensity setting (full / mild / off) is required.

**Technical approach:**
- One `corruption` scalar plus a contamination field in the sim.
- The renderer draws overlay decals with dithered creep, so cached facility art stays intact.
- The music director runs a tape-degradation chain from the same scalar.

## Music (owner requirement)
- **Direction:** *Brazil*-style ministry muzak on a decaying tape. Rhodes, bossa pluck, string-machine pad, vibes and
  teletype percussion, run through a wow / flutter / saturation chain. The same chain carries the horror: detune, then
  organic textures, then cluster chords and chewed tape.
- **How it's made:** generated at runtime with WebAudio, from hand-authored score data. There's nothing to download,
  it fits the existing all-synth audio, and corruption is just parameters. Pre-rendered OGG stems stay an optional
  later layer.
- **Scope:**
  - 3 tier tracks, each a 64-bar loop with 5 stems.
  - An alarm stem.
  - About 8 stingers.
  - Per-path late-game overlays.
- **Adaptive director:**
  - Clearance tier picks the track.
  - IT load drives the rhythm stems.
  - Alarms duck the music and add the alarm stem.
  - Time of day sets brightness.
  - Corruption drives the decay.
- **Supporting work:** a bus mixer (music, SFX, ambience, UI) with volume settings, and UI click sounds.

## Milestones
Each milestone ends playable, merged to `main` and deployed to Pages.

### M1 — Foundations: make it safe to play for hours (≈ 1–2 weeks)
| Item | Size | Source |
|---|---|---|
| Crash safety: guard the loop, recovery screen, error boundary, global handlers | S | eng |
| Save system: versioned envelope, validation, migrations, 3 slots + autosave, export/import, IndexedDB | M–L | eng, UX |
| Pause/system menu (Esc): resume, save, load, settings, controls help, new game | M | UX |
| Settings: volume buses, reduced motion, CRT effects, text scale, colour-blind palette, horror intensity | M | UX, audio |
| Command queue fixes: queue-aware `submit`, `canBuild` for ghosts, null-safe commands | M | eng |
| Bot/lift robustness: multi-lift routing, work-order timeout and reassignment | M | eng |
| CI: PR checks, Biome lint, Playwright smoke test (boot, tutorial, place, save/load), bundle budget, code-split | M | eng |
| Fix truncated palette text and the overlay-panel position; "best on desktop" notice | S | UX |

### M2 — The game loop: progression, drama, economy (≈ 3–4 weeks)
| Item | Size | Source |
|---|---|---|
| Event system (own RNG stream) + `events.json` + **Ministry memo UI with APPROVE / DENY / FILE choices**; first 30 events | L | design |
| Tech tree (≈ 36 nodes) and research points; tech-tree screen | L | design, eng |
| T2–T4 trunk content: +20 facilities, +8 hardware types, +10 clients, drone and lifter bots | L | design, art |
| Economy retune: 5× tier rewards or permanent perks, cash sinks (loans, taxes), a wider DLC/air gap, guaranteed minimum offers | M | design |
| Win/lose: audits, Ministry shutdown, game-over flow, lifetime stats, quarterly report | M | design, eng |
| Starter difficulty: early heat pressure and a scripted first emergency (ties into the tutorial) | M | design, UX |
| World failure feedback: trip, fire, blackout and leak visuals; off-screen alert arrows | L | UX, art |
| **Music v1:** engine, tape chain, director, tier-1 track, buses, ducking, UI sounds | L | audio |

### M3 — Into the flesh: Biotech path and the horror arc (≈ 3–4 weeks)
| Item | Size | Source |
|---|---|---|
| Sim: nutrient network, contamination field, organoid racks, mutation traits, growths, `corruption` in `SimView` | L | design, eng |
| Biotech path complete: 8 facilities, 3 hardware types, 4 clients, 8 events, ending | L | design |
| Render: horror overlay pipeline, T3–T5 palette shift, veined conduits, breathing walls, CRT eyes, organoid art | L | UX, art |
| Audio: corruption stages on the music, wet textures, heartbeat, tier 2–3 tracks, stingers | L | audio |
| Embrace vs resist: quarantine, sterilisation rooms, reversible below the 40% contamination threshold | M | design |

### M4 — Breadth and polish to 1.0 (≈ 3 weeks)
| Item | Size | Source |
|---|---|---|
| Greentech path (heat export, carbon credits, Dunkelflaute power drought) with its quieter fungal horror | L | design |
| Second scenario (brownfield) and sandbox mode after the win | M | design |
| Juice: build, cash and contract feedback; attention hierarchy in the top bar | M | UX |
| Scale: Web Worker sim and frame-time budget for 30× on 100-floor towers; allocation fixes | L | eng |
| Spatial audio by camera, per-floor ambience, the remaining event sounds | M | audio |
| Title screen with a *Brazil*-style opening crawl | M | UX |
| Desktop packaging (Tauri) evaluation; opt-in crash reporting | M | eng |

### Post-1.0 (COULD)
- The Synthetic Mind path.
- Full touch and mobile support.
- Key rebinding.
- Mod loader.
- Localisation.
- Cross-engine determinism and co-op.
- Steam / Steam Deck.

## Top risks to watch
1. **Scope:** three Ascension Paths is a lot. Ship Biotech fully and Greentech lighter; Synthetic Mind waits until after 1.0.
2. **Balance:** with no player-like auto-builder, the curve past day 30 has never been measured. Extend `sim-cli` with a
   build policy before tuning M2.
3. **Contract changes:** M2–M3 need closed sets opened up (`FacilityKind`, RNG streams, `unlockTier` to tech-tree
   unlocks, lot size). Plan one contract revision up front, rather than drifting into it.
4. **Horror tone:** without playtest feedback it could tip into gore or into silliness. Keep the taste rules and test
   the intensity setting.
