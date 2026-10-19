# Synthetic neutral style (replaces cassette-futurism as the starting look)

Owner decision (2026-10-19): the game starts in a clean **synthetic** look, for both the world and the HUD. The paths then re-skin
devices at 25 / 50 / 75 / 100 % of their path score:
- **Biotech** turns fleshy, driven by `view.corruption`.
- **Greentech** grows fungus, plants and fish, from its growth score (M4).
- **Synthetic Mind** keeps the look and gets more refined (M4).

The Ministry fiction and dry bureaucratic voice stay. Only the presentation changes: no more brass, paper or steampunk.

## Feel
Glass, graphite and cold light: a quiet, expensive machine. Flat surfaces, thin 1 px edges, soft inner glows, no textures,
no rivets, no paper. Motion is slow and smooth. Status reads from colour and light, not words.

## Tokens (HUD: CSS custom properties; render: the same hex values)
| Token | Value | Use |
|---|---|---|
| `--bg` | #0a0e13 | page and sky base |
| `--panel` | rgba(18, 26, 34, 0.86) | glass panels (with `backdrop-filter: blur(6px)` where cheap) |
| `--panel-edge` | rgba(140, 200, 220, 0.18) | 1 px panel border |
| `--text` | #dfe9ee | primary text |
| `--text-dim` | #8a9ba6 | labels |
| `--accent` | #5fd4e6 | interactive elements, progress, focus |
| `--accent-2` | #9b8cff | research and RP |
| `--good` | #4ee08a · `--warn` #f2b84b · `--bad` #ff5d5d | semantic states only |
| `--money` | #7cf0b0 | cash and per hour |
| `--radius` | 6px | panels; 4px controls |

## Type (Google Fonts)
- **Display and labels:** "Chakra Petch" (500 or 600, uppercase labels with 0.08em tracking).
- **Body:** "IBM Plex Sans".
- **Numbers:** "IBM Plex Mono", with tabular numerals.

## World (render)
- **Building:** graphite slabs with thin cyan floor edges, and glass façade panels lit cold at night.
- **Racks:** dark glass cabinets with a vertical light strip (green, amber or red for status) and no CRT screen. Tier shows through a taller light and finer detail.
- **Conduits:**
  - power: a thin warm-white line
  - coolant: a cyan line
  - nutrient: pale green
- **Bots:** small white drones and rovers with a single cyan eye.
