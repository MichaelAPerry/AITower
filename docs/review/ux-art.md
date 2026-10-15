# AItower UX / Art review: gap analysis to 1.0

Screenshots (scratchpad `/tmp/claude-0/-home-user-AITower/a7f75a3b-71cb-517d-a9c2-dde0cac086fa/scratchpad/review/`): `a1440.png` (1440x900), `b1280.png` (1280x720), `c390.png` (390x844 phone), `d_heat.png` (heat overlay). Source reviewed: `docs/STYLE.md`, `packages/ui`, `packages/render`, `apps/web/src`.

**Verdict:** The art and HUD are strong and on-brief (bakelite housings, CRT readouts, paper forms, dial gauges). What is missing is everything around the game: onboarding, meta UI (settings, save/load, pause, help), accessibility, touch, and the entire body-horror layer. The facility roster is also small, 11 defs in `packages/content/src/data/facilities.json`, so variety is thin.

## 1. First-time-user experience (first 5 minutes)

Evidence: `a1440.png`. The game starts at 10x speed (`speed=10` was in the URL, but nothing in the UI introduces speed), with a pre-built "Garage Cluster" (`scenarios.json`).

- **No goal, no tutorial, no title or new-game screen.** `apps/web/src/main.tsx` autoloads a save or starts a game directly. The player sees a finished-looking cluster and zero guidance on what to do next.
- **The state looks broken at start.** COMPUTE reads `0.00 PF`, PUE is a red `3.09`, NET TODAY is red `-$5.2k`, and 4 racks are built. Nothing explains that the racks are idle (no job, perhaps no coolant), why PUE is bad, or what fixes it. Red numbers on minute one read as "I already failed".
- **The contract is the only call to action and it is easy to miss.** FORM AT-7 sits in the bottom panel, which looks like decoration. "40.8 PF sustained" is more than the current 0.00 PF, so accepting it may be a trap. Nothing says what a contract is, what happens on DECLINE, or what the penalty means.
- **Unexplained jargon and numbers:** PUE, "IT LOAD 26 kW of 80 kW", CLEARANCE lamps (the 4 lamps are a tier, with no label saying "tier"), NEEDS "—", WINDOW "1d 16h", "Spare parts", "Bots", "Stores requisition". Gauges have no ranges marked as good or bad. Titles exist as tooltips only (`title=` in `TopBar.tsx`), so touch users and anyone who does not hover never see them.
- **Build discoverability:** the BUILD tab lists slab, conduit, coolant and lift, but the racks live in the RACKS tab. The hint copy is truncated ("drag an L-shape…", "drag vertic", visible in `c390.png` and `b1280.png`). Nothing says "slabs first, then conduit, then racks". The sim has hard dependencies (power conduit to the rack, a slab beneath it, coolant to the CRAH and rack) that are invisible until a placement is rejected.
- **Camera and controls are undocumented:** right-drag pans, wheel zooms, WASD pans, 1-5 sets speed, N/H/P/C sets overlay, X demolishes, backtick toggles the panel, right-click cancels. The Kbd primitive exists but no help screen uses it.
- **Overlay legend and panel:** the OVERLAY switch panel floats over the world at bottom-left and covers the building (`a1440.png`). Switching to heat only tints; nothing says what to do about red.

**Tutorial must cover** (another engineer is building it; not designed here):
1. Goal and loop: contracts pay for compute, so power and cool racks.
2. Pause, speed, and the fact that the clock is always running.
3. Build order: slab, power conduit, rack, coolant.
4. Reading PUE, IT load, uptime and net per day.
5. Accepting a contract and delivering it (and the penalty).
6. Overlays, with heat as the main failure signal.
7. Alerts, bots and spare parts.
8. Camera controls and keys.
9. Where save and settings live (once they exist).
10. A skippable and re-openable flow.

## 2. HUD / UX issues

- **Information hierarchy is flat.** All 8+ top-bar readouts have equal visual weight. In `a1440.png` the eye lands on the bright "10X" and the amber numbers, not on the problem (negative net, PUE 3.09). Add a single attention state: the worst current problem pulses and has a stamp label.
- **Readability:** the Silkscreen 8 px labels (tab names, `PUE`, `IT LOAD`, `CLEARANCE`, the overlay captions) are tiny and low contrast on dark bakelite. Dim tabs ("RACKS", "POWER") look disabled. STYLE.md says Silkscreen is for labels at ≤10 px, but the 1440 view needs about 11-12 px minimum. The top bar only fits 1280 because the brand plate and grid price are hidden under 1480 px (`ui.css` media queries at 1600, 1480 and 1360). That is fragile.
- **Action feedback:** the controller has toasts for rejections, plus the "DENIED" ghost stamp. Missing: placement confirm (thunk plus a small dust and spark burst), a cash delta floating at the cursor, an "insufficient funds" state on palette cards (cards never grey out), and an inspector prompt after placing something.
- **Errors:** rejection reasons come from sim strings via `notices.ts`. They need a copy pass (bureaucratic tone but actionable: say what to do, e.g. "DENIED: no slab below. Lay FLOOR SLAB first").
- **No settings menu.** There is no volume or mute beyond one AUDIO toggle, no text size, no reduced-motion override, no CRT or scanline toggle, no colour-blind mode, and no rebinding.
- **No save/load/new-game UI.** `apps/web/src/store.ts` autosaves to localStorage on each new day (`aitower.autosave.v1`) and exposes `save()` and `load(json)`, but there is no button for either. There is no export or import of a save, no slots, no "autosave happened" confirmation, and no way to start a new game short of editing the URL (`?new`). If storage fails, the failure is silent.
- **No pause or system menu.** Space pauses, but there is no Esc menu (resume, save, settings, help, quit), and no "paused" banner over the world. Esc currently only cancels the tool or the selection.
- **Keybinding help:** none. Needs a `?` overlay built from `keyboard.ts`.
- **Accessibility:**
  - Heat overlay and status lamps rely on blue to green to amber to red (`d_heat.png`). Red versus green lamps and CRT phosphors (green ok, red tripped) collapse for deuteranopes. Add a shape or glyph channel (the existing lamp badge, hatching on tripped racks, a text status in the inspector) and an alternate ramp (viridis-like).
  - Prefers-reduced-motion is respected in the UI (`ui.css:1979`) but not by the renderer (shimmer, steam, flicker, scanline overlay, parallax). The renderer should read the same media query plus a setting.
  - Fonts: VT323 and 8 px Silkscreen have no scale option. There is no ARIA or screen-reader layer over the canvas. HUD panels have some `title`/`aria` attributes (74 occurrences), but the world is opaque.
  - The scanline and vignette overlay is capped at 6-8 % per STYLE.md, which is fine, but needs an off switch.
- **Mobile / touch:** effectively desktop-only. At 390x844 (`c390.png`) the 250 px build panel takes about 65 % of the width, the top bar clips (treasury cut off), the overlay switches and contracts form overlay the world, and the world is a sliver. There is no pinch-zoom, no two-finger pan, no long-press for "right click" cancel (cancel is right-click or Esc), and no touch hit sizes. Decide: either declare desktop-only for 1.0 (show a "best on desktop" notice) or build a compact layout (bottom sheet palette, collapsible bars).
- **Window sizes:** 1440x900 and 1280x720 work. In `b1280.png` the world viewport is cramped, with only about 3 floors visible once the bottom panel opens. The bottom panel should default to collapsed or shorter at below 800 px height, and the overlay panel should dock to the top-right of the viewport so it does not hide the lowest floors. Test 1024x768, ultrawide and 4K scaling (integer zoom caps at 4).

## 3. Art gaps for 1.0

**Present and good:** facility bodies and live details (CRT, lamps, reels, fans), conduits with flanges and drips, bots with welding sparks, pneumatic capsules, parallax skyline with the MINISTRY sign, day/dusk/night sky, heat shimmer, steam and smoke.

**Gaps:**
- **Variety:** one rack art (air GPU) with a recoloured DLC and a storage variant. `ARCHITECTURE.md` plans immersion, cryo and "bio" cooling plus T5 racks (photonic, neuromorphic, organoid, DNA vault). None exist as content or art yet. The 4-5 shade material limit makes recolours cheap but samey, so each tier needs a distinct silhouette.
- **Workforce and life:** one bot design, one bot. There are no human figures at all (clerks with forms would sell the Brazil bureaucracy), no visitor or inspector, and no other lift traffic.
- **World failure feedback is weak.** A tripped rack changes lamp and CRT colour only. Needed: smoke wisps, sparks, an alarm beacon (rotating amber light), a red wash on the room, a "tripped" stamp, a scorch-mark decal that stays after repair, a fire state, flooding and leak puddles, a blackout state (building lamps die, only emergency red remains), and a camera nudge to the event. The Alerts tab is a teletype list, but nothing in the world draws the eye (`events.ts` has a focus cell; use it for an offscreen arrow).
- **Juice:** no build animation (scaffold, drop-in, dust), no demolish debris, no money pop, no contract-complete stamp animation on screen, no tier-up fanfare (clearance lamps lighting is the only cue), and no day/night lamp response in the facility interiors.
- **Empty floors:** above the starter row, most of the 13-floor building is bare wall (`a1440.png`), so the mid game looks empty. Add decal sets (posters, filing cabinets, pipes, stains) as free ambient dressing.
- **Overlays:** heat tints facilities in flat blue (`d_heat.png`), which reads as a "cyanotype" ghost at idle. Show gradient and air flow arrows, and add a legend value readout under the cursor. The legend is only visible on the overlay panel.

### Body-horror escalation plan (unsettling over gory; stays inside STYLE.md rules)

Principles: keep the 1 px outline, 4-5 shade pixel discipline and the palette tokens, and add three new tokens only: `--flesh` (#b5877a-ish pink-beige), `--bile` (#8a8a3a) and `--blood` (a deep, desaturated `--red` mix). Horror grows by **wrongness**, not splatter: things that should be static move, things that should be machines look slightly alive. Never show gore, only implication. Audio carries the wet sound, so visuals should be silent and still.

| Tier | Theme | Visual changes |
|---|---|---|
| T1-T2 (garage, rack hall) | Clean, bureaucratic baseline | None. Establish the normal so later change is felt. Tiny seed: one CRT showing a single blink where the scan bar should be, once per day, and a faint breathing-like sway in a ribbon streamer. |
| T3 (optimised hall) | Uncanny | Palette: wall tile warms 3-5 % toward `--beige`. Pipes sweat (extra drips, but slow and slightly too round). Lamps blink in a rhythm that looks like a pulse (about 1 Hz, irregular). Dust becomes pale hair-like threads in the heat shimmer. Occasional CRT line text: "ARE YOU STILL THERE". |
| T4 (liquid and immersion) | Organic infiltration | Coolant return turns bile-green and cloudy. Pipe flanges get wart-like bulges. Cable bundles show pulsing "veins" (a 1 px `--blood` line travelling along ochre cable, reusing the pneumatic capsule path code). Rack kick plates get stained, mottled dithering (checkerboard in `--flesh`) at the base and rising with load. Louvres begin to look like gill slits. |
| T5 "Frontier" (organoid and neuromorphic) | Wetware | Organoid racks: glass jars (reuse the UPS jar art) with a lumpy pale mass and a slow pulse; DNA vault as a rack of stained tubes. Walls: a breathing 2-frame inflate/deflate of the wainscot (0.2 Hz, sub-pixel-feeling via alternating tile rows). Conduits fully veined, with tendrils crossing the slab beams. CRTs: the green scroll becomes a pair of eyes that track the mouse cursor slowly, and blink when you pause. Some rack CRTs show a face-like bar graph. Bots grow a second, smaller eye and a patch of flesh on the dome. Sky: the MINISTRY sign flickers to a different word; searchlights sweep the building. |
| Endgame (merge) | Total | Slabs and I-beams partly consumed with pink tissue that creeps with the fraction of wetware compute; the lift gate shows a mouth-like accordion; the HUD is touched too: bakelite panel texture gains veins, the dial needle twitches, and toast copy turns first-person ("WE ARE HELPING"). Palette desaturates elsewhere so only flesh and red glow. |

Implementation notes: drive everything from one scalar `horror = f(tier, wetwareShare, uptime)` in the view, applied as render overlays (decal layers and tint) so facility bodies stay cached. Use dither masks for creep (never smooth gradients). Add a "gore/horror intensity" setting (full, mild, off) for accessibility. Pair with the audio package: wet clicks, a breathing hum modulation (`packages/audio/src/hum.ts` can take the horror scalar), whispers under pause (`pause.ts`).

## 4. Prioritised list

**MUST (1.0 blockers)**
- Tutorial / first-run flow and objective tracker (L). Owned by the tutorial engineer; see section 1 for coverage.
- Fix the broken-looking start: explain 0.00 PF and PUE 3.09, or start in a healthier state (S-M).
- Pause/system menu on Esc with resume, save, load/export, settings, new game, help (M).
- Save/load UI plus a visible autosave indicator and storage-failure message (M).
- Settings: volume, reduced motion, CRT effects off, UI text scale, colour-blind palette (M).
- Keybinding / controls help overlay and camera hint (S).
- Tooltips that work on focus and tap (not only hover) for every gauge and jargon term, plus a glossary entry for PUE (M).
- Fix truncated palette descriptions and the overlay panel position (S).
- Colour-blind-safe status and heat encoding (shape or glyph plus alternate ramp) (M).
- World failure feedback: trip, fire, blackout and leak visuals, offscreen alert arrow (L).
- Body-horror pipeline: `horror` scalar, T3-T5 palette shift, veined conduits, and organic rack art for the new tiers (L).
- Declare mobile out of scope with a "best on desktop" notice, or minimal touch support (S for the notice, L for full support).

**SHOULD**
- Build, demolish, money and contract-complete juice (M).
- Placement affordability state on cards and a clearer error copy pass (S).
- Attention hierarchy: highlight the worst problem in the top bar (S-M).
- More rack, cooling and facility variants and art for tiers T3-T5 (L).
- Human figure sprites (clerk, inspector) and ambient decals for empty floors (M).
- Eyes-in-CRTs and breathing walls (M).
- Renderer honours prefers-reduced-motion (S).
- 1024x768 layout and shorter bottom panel on small heights (M).

**COULD**
- Pinch-zoom, two-finger pan and a full touch layout (L).
- Key rebinding (M).
- Title screen with a Brazil-style opening crawl (M).
- Save slots and cloud export (M).
- Screen-reader summary of the cluster state (M).
- Photo mode and screenshot stamp (S).
- Horror intensity slider with an "off" mode (S, but make it part of the MUST settings pass).
