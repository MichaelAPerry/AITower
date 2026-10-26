# Style: PC-98

**Owner direction:** lean heavily into the PC-98 concept art.

The concept sheets are on branch `claude/serene-ramanujan-ojshkh`. They are the title painting, the B-3 Bio, C-4 Green and D-2 Synth floor paintings, and the four advisor sheets.

This look replaces the "synthetic glass" look in `STYLE_SYNTHETIC.md`. The layouts are unchanged; the tokens and frames are swapped.

## Tokens

The tokens live in `packages/ui/src/pc98/pc98.css` (HUD) and `packages/render/src/palette.ts` (world). Tests check that the two agree.

| Token | Value | Use |
|--|--|--|
| `--bg` | #07072a | Deep indigo night. The ink of the world and the panel background. |
| `--text` | #f0f0ff | White phosphor text and frame rules. |
| `--accent` | #5ce1ff | Cyan light: fittings, coolant, links. |
| `--accent-2` | #ff6ad5 | Magenta: research. |
| `--good` | #6cf08f | Healthy, ok. |
| `--warn` | #ffb347 | Sunset orange: warnings, power. |
| `--bad` | #ff4d5e | Failures. |
| `--money` | #ffd75e | Gold: cash. |

### Tree colours

These match the three floor paintings:

- **Synthetic:** `--tree-syn` #6fd3ff
- **Bio:** `--tree-bio` #ff4f6d
- **Green:** `--tree-green` #9be564

### Advisor colours

| Advisor | Colour |
|--|--|
| Luci | crimson #ff5d6c |
| Mel | violet #c58bff |
| Bea | leaf #9be564 |
| Cass | ice #7fdcff |

## Rules

- **Frames:**
  - a 2 px white rule outside,
  - a dark gap, then a 1 px indigo inner rule,
  - a hard 3 px drop shadow,
  - square corners everywhere.
- **Panel fill:**
  - deep indigo,
  - plus a 2 px checker dither at 4% white.
- **Type:**
  - DotGothic16 (pixel gothic, OFL, Latin subset, 10 kB) for everything.
  - Use 16 px or larger where you can, because the face is drawn on a 16 px grid.
- **Art:**
  - Portraits are quantised to 32 colours and the backdrops to 48.
  - Both are stored as lossless WebP (`packages/ui/src/art/`) and drawn with `image-rendering: pixelated`.
  - Portraits sit on the sheet's pale background inside a frame ruled in the advisor's colour.
- **Scanlines:**
  - a faint 1-in-3 line over the whole screen (`.aitower-hud::after`),
  - switched off with the CRT effects setting.
- **Sky (world):**
  - an indigo night,
  - orange-to-violet dawn and dusk,
  - a blue-violet day with a lavender horizon, as in the title painting.
- **Visual-novel scenes (`packages/ui/src/vn/`):**
  - the floor painting, or the dimmed tower,
  - a caption box top left,
  - a square standing portrait,
  - a full-width dialogue box with a nameplate in the speaker's colour, typewriter text and ▶ choices.
