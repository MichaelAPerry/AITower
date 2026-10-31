# Suno prompts: in-game music

Replaces the current in-game music. Existing songs are Japanese city-pop vocal tracks (`packages/ui/src/music`: title, garden, lattice, flesh), played only on the title screen by `titleMusic.ts`. These three are instrumental, FM-synth city-pop, matching the PC-98 look (indigo night, cyan and magenta light, end of the world, gentle).

Setup for all three: Custom mode, Instrumental on, leave Lyrics empty. Paste the style line into "Style of music". Make several takes and pick the cleanest loop.

---

## 1. Tower Build (main gameplay loop)

- **Title:** Server Hall Nights
- **Instrumental:** yes
- **Style of music (about 180 chars):**
  `instrumental japanese city pop, PC-98 FM synth, slap bass, clean electric piano, soft gated drums, warm pads, 100 BPM, steady groove, nostalgic, calm focus, no vocals, loopable`

**Loop tips**
- Ask for a steady tempo and a repeating 8 or 16 bar chord cycle, with no big build or drop.
- Keep the arrangement flat: no solos, key changes or breakdowns. This avoids fatigue over long play.
- Add `end on tonic chord, no fade out, no outro` in the style line or title, and reject takes that fade.
- Trim at a bar line in an editor (Audacity) and crossfade 20 to 50 ms. Cut where the waveform crosses zero.
- Use Extend/Cover to get 3 to 4 minutes, then loop the middle section.

**Alt style lines**
- `instrumental city pop, YM2608 FM synth, mellow bass groove, shimmering electric piano, light hi-hats, 96 BPM, hypnotic, seamless loop, no fade out`
- `japanese fusion, 80s synth pop, arpeggiated FM bells, rounded bass, brushed drums, 104 BPM, serene night shift, instrumental, constant energy`

---

## 2. Conversation A (warm, relationship scenes)

- **Title:** Tea in the Control Room
- **Instrumental:** yes
- **Style of music (about 170 chars):**
  `instrumental japanese city pop ballad, PC-98 FM synth, warm electric piano, soft glockenspiel, mellow bass, brushed drums, 78 BPM, tender, sunset, hopeful, no vocals`

**Loop tips**
- Ask for a short 4 or 8 bar cycle with a gentle, repeating melody, and no vocals or strong hook that tires.
- Keep dynamics even; finish on the tonic (home chord), with no fade out and no ending ritardando.
- Same trim and crossfade method as above. Aim for 60 to 90 seconds of loop.

**Alt style lines**
- `soft city pop, 80s FM synth, Rhodes piano, warm strings pad, light bossa drums, 82 BPM, affectionate, golden hour, instrumental, steady tempo`
- `japanese lo-fi city pop, gentle FM bells, soft bass, dreamy chorus guitar, 74 BPM, comforting, instrumental, end on tonic`

---

## 3. Conversation B (tense, quiet, late night)

- **Title:** Four AM, Cooling Fans
- **Instrumental:** yes
- **Style of music (about 175 chars):**
  `instrumental dark city pop ambient, PC-98 FM synth, low pulsing bass, sparse electric piano, cold pads, soft clicks, 66 BPM, late night, uneasy, melancholic, no vocals`

**Loop tips**
- Ask for a sparse, minor-key drone with a slow pulse; no drums fills or risers, so it loops invisibly under dialogue.
- Keep it quiet and low in the mix so text stays readable. End on the tonic or a held pad, no fade out.
- Use a long crossfade (100 to 200 ms) since pads hide the seam well.

**Alt style lines**
- `minimal synthwave noir, FM synth, analog bass pulse, distant bell, rainy night, 70 BPM, tense but quiet, instrumental, steady tempo`
- `dark ambient japanese city pop, soft EP chords, humming server drone, slow heartbeat kick, 62 BPM, lonely, instrumental, no fade out`
