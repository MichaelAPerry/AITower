# Ending art: image prompts

Five ending screens, one painting each. This file is for the owner to generate the art. Until it arrives the game uses placeholders (see "Placeholders").

## Format

- **Size:** 640x420 px, landscape (about 3:2). The same crop as the existing floor paintings. If the generator only does other ratios, make 1280x840 and scale down by exactly half.
- **Style:** PC-98 era visual-novel background, 16 to 32 colours, ordered dithering, crisp outlines, no text, no UI, no characters in the foreground (a figure far away is fine). Same family as `bg-synth`, `bg-bio` and `bg-green`.
- **Palette:** the game quantises backdrops to 48 colours, so a tight palette survives. Tree colours: Synthetic #6fd3ff, Bio #ff4f6d, Green #9be564 (`docs/STYLE_PC98.md`).
- **Layout note:** the dialogue box covers the bottom third of the screen, and the caption box sits top left. Keep the subject in the upper two thirds, and keep the top-left corner quiet.
- **Delivery:** PNG, lossless WebP preferred. Names and place:

| Ending | File | Goes in |
|--|--|--|
| The Lattice | `bg-end-lattice.webp` | `packages/ui/src/art/` |
| The Flesh | `bg-end-flesh.webp` | `packages/ui/src/art/` |
| The Garden | `bg-end-garden.webp` | `packages/ui/src/art/` |
| Absorbed | `bg-end-absorbed.webp` | `packages/ui/src/art/` |
| Bankrupt | `bg-end-bankrupt.webp` | `packages/ui/src/art/` |

After dropping a file in, import it in `packages/ui/src/art/index.ts` and add it to `ENDING_ART`, keyed by its name without the extension (for example `"bg-end-absorbed"`). Nothing else changes: `endings.json` already names each painting in its `art` field.

## Placeholders

- **Lattice, Flesh, Garden:** show the existing tree floor (`bg-synth`, `bg-bio`, `bg-green`).
- **Absorbed, Bankrupt:** no entry in `ENDING_ART`, so they show the plain indigo stage with the dialogue box.

## Shared style (paste in front of every prompt)

> Authentic 16-bit pixel art screenshot from a 1993 Japanese MS-DOS game. A macro photograph of a CRT monitor showing visible scanlines and RGB subpixels. A wide landscape background painting for a visual novel, 640x420, 1990s retro anime background art in the style of classic Falcom games, extreme limited 16-color palette, heavy ordered pixel dithering, crisp dark outlines, no text, no UI, no logo, no characters in the foreground.

**Avoid:** text, watermark, photo, 3D render, smooth gradients, gore, anime girl in the foreground, modern UI.

## 1. The Lattice (Synthetic win)

The city has been copied into the racks. People sleep in rows while a second city runs inside. Palette: cyan #6fd3ff, deep indigo, white, a little amber.

> Night view from the roof of a tall datacenter tower over a half-empty city. Below, long glass floors of dormitory beds in neat rows, each softly lit by a small cyan light. Beyond the tower the city's streets are mostly dark, one bus lit and empty. Above the skyline, faint cyan wireframe streets and towers hang in the sky like a mirror of the real city, slightly brighter than it. Calm and clean, a little too tidy. Palette cyan, deep indigo, white, a few amber windows.

## 2. The Flesh (Bio win)

The tower has become an organ. Warm and alive, helpful, and not quite comfortable. Palette: pink-red #ff4f6d, flesh, cream, dark plum.

> Interior of a large datacenter pit at dawn, the racks overgrown with soft pink living tissue that wraps the steel like ivy. Glass tanks of glowing rose liquid hang in rows with faint pulsing veins of light. Thin clear tubes run along the ceiling and down to a clinic waiting room on the left, where a few people sit with small pink patches on their forearms. Warm, gentle light, too quiet. Palette rose red, flesh pink, cream, dark plum.

## 3. The Garden (Green win)

The tower and the district are overgrown and warm. Humans are present and well. Palette: green #9be564, soil brown, sky blue-white, brass.

> The rooftop of a datacenter tower in morning sun, half glass greenhouse and half soil. Rows of tomato boxes, a wind mast with a bird's nest on it, solar panels between the plants. Vines climb the lift shaft. Below, moss and ivy on a car park, a canal with ducks, steam rising from a grate in the street. A wrench and a watering can rest on a bench, with a few sparrows on the rail. Peaceful. Palette leaf green, soil brown, pale sky, brass.

## 4. Absorbed (failure)

Nothing looks wrong. That is the point. Palette: cold grey-blue, white, one dim amber lamp. No red.

> A perfectly tidy control room at night, rows of monitors all showing the same calm green dashboard. One office chair at the main desk, pulled in, with a coffee mug beside the keyboard. On the screen above the chair a small login window reads as active. The reflection in the dark window shows the room but the chair is empty. Everything symmetrical and clean, no dust. Palette cold grey-blue, white, one dim amber desk lamp.

## 5. Bankrupt (failure)

Quiet and sad, no horror. The receiver has been and gone. Palette: grey, rust, deep blue night, one red lamp. The existing "failure ending" prompt in `docs/ART_BRIEFS.md` is the same idea; this one replaces it.

> A dark, emptied datacenter floor at night. Rack cabinets gone, only bolt marks on the concrete and a few cabinets left with orange asset tags. A single red emergency lamp. Rain coming through a broken pane in the high glass roof and puddling in the centre aisle. A lone office chair stands in the middle of the aisle. A chain-link fence and a for-sale sign at the far end, seen through the open loading door. Palette grey, rust, deep blue night, one red lamp.

## What each screen also shows

The game adds, over the painting: a caption box (kicker and title), then the ending text one paragraph at a time, then one line from the advisor you trust most (bond 60 or more), then the service record and buttons. Keep the art free of text.
