# Advisor portraits: redesign briefs

The four concept-art portraits all share one face, one body, one pose, the same navy-blue palette and the same open-jacket framing. These briefs give each character a different age, build, face, hair, silhouette, palette, pose, prop and expression. Each should be recognisable from her **silhouette alone** and from her **colour alone**.

All four are adults in practical, fully closed work clothes (no cleavage). The game is aimed at students.

## Shared style (paste in front of every prompt)

> PC-98 era Japanese visual novel character portrait, 1990s anime style, pixel art at 640x400 resolution, 16-colour palette, ordered dithering, crisp black outlines, cel shading, bust shot from the waist up, plain pale grey background with a faint dither pattern, no text, no UI.

**Negative prompt / avoid:** cleavage, open jacket, swimsuit, same face, generic anime girl, blue uniform, text, watermark, stat box, Japanese text, photo, 3D render, smooth gradients.

The stat box is added by the game. Generate it out of the picture.

## How the four differ at a glance

| | Luci | Mel | Bea | Cass |
|--|--|--|--|--|
| Age | late 20s | mid 30s | early 20s | mid 40s |
| Build | tall, angular, thin | small, slight | short, sturdy, athletic | tall, broad-shouldered |
| Hair | sleek **crimson asymmetric bob** | **waist-long black-violet braid** | **short messy copper with green tips**, bandana | **cropped silver-white** |
| Face | sharp chin, narrow eyes | soft round face, big round glasses | freckles, wide grin | weathered, scar through eyebrow, laugh lines |
| Palette | crimson / black / gold | white / violet / flesh-pink | olive green / brass / orange | ice cyan / white / grey |
| Silhouette | high-collared coat, straight vertical lines | baggy lab coat, hunched forward | rolled sleeves, wrench on shoulder | huge fur hood, bulky parka |
| Pose | arms crossed, pen in hand, chin up | looking down at a jar she holds | leaning in toward viewer | holding a steaming mug, relaxed |
| Expression | knowing half-lidded smirk | gentle, distracted smile | big open grin, chipped tooth | calm, tired kindness |

## Prompts

### Luci Ferro: CFO and Logistics, champion of the Singularity
> Tall angular Italian woman in her late twenties, sleek crimson asymmetric bob haircut longer on one side, sharp chin, narrow amber eyes with a thin gold HUD lens over her left eye, high-collared crimson and black double-breasted coat buttoned to the throat with gold piping and gold cufflinks, arms crossed holding a gold fountain pen, chin raised, knowing half-lidded smirk. Palette crimson, black, gold.

### Dr. Mel Kiorre: Compute and Wetware, champion of Bio
> Small slight woman in her mid thirties, soft round face, oversized round wire-rimmed glasses, very long straight black hair with a violet sheen in a loose braid over one shoulder, rumpled oversized white lab coat over a dark violet turtleneck, pale blue rubber gloves, holding a glass specimen jar with a softly glowing pink organoid, a small red stain on one coat cuff, looking down at the jar with a gentle distracted smile. Palette white, violet, flesh pink.

### Bea Altasar: Power, champion of Green
> Short sturdy athletic Filipina woman in her early twenties, freckles, sun-browned skin, short messy copper hair with green-dyed tips under a knotted olive bandana, welding goggles pushed up on her forehead, olive-green work overalls with sleeves rolled up and small solar-cell patches, a brass leaf-and-lightning-bolt badge, a big wrench resting on her shoulder, leaning toward the viewer with a wide open grin and a chipped front tooth. Palette olive green, brass, orange.

### Cass Parr: Cooling and Facilities, the human voice
> Tall broad-shouldered woman in her mid forties of Inuit and Scandinavian descent, weathered face with laugh lines and a small scar through one eyebrow, cropped silver-white hair, snow goggles hanging around her neck, bulky ice-blue parka with a large fur-trimmed hood zipped to the chin, frost on her grey gloves, holding a steaming mug of coffee in both hands, relaxed posture, calm tired kind smile. Palette ice cyan, white, grey.

## Expressions (optional, for the dialogue scenes)

Generate each character in these four expressions, keeping the same pose and crop:

- **neutral**
- **pleased** (blush for a high bond)
- **displeased** (pushback)
- **unsettling** (her agenda shows)

| Character | Unsettling version |
|--|--|
| Luci | lens glowing gold, smile too wide |
| Mel | glasses reflect red, smile unchanged |
| Bea | jaw set, goggles down |
| Cass | eyes closed, looking away |

## Delivery

- Files go in `packages/ui/src/art/portraits/{luci,mel,bea,cass}[-expression].png`.
- Each is a PNG of about 480×600, or any 4:5 bust. The game crops, quantises to 16 colours and frames them.

## ChatGPT prompts (owner's template)

Use these first. They follow the template the concept art was made with. Put the traits that make each woman different first, because the model weighs early words most.

The shared "Sexy" ending is a big part of why all four came out with the same body, pose and open jacket. Each prompt below replaces it with that character's own kind of appeal.

Use **one fresh chat per character**. For expressions, stay in that character's chat and attach her base portrait.

### 1. Luci Ferro (base)
Authentic 16-bit pixel art screenshot from a 1993 Japanese MS-DOS game. A macro photograph of a CRT monitor showing visible scanlines and RGB subpixels. A half-body 2D character sprite of a tall, thin, sharp-featured Italian woman in her late twenties, the Chief Financial Officer of a futuristic AI tower. Sleek crimson asymmetric bob haircut, longer on one side. Narrow amber eyes, with a thin gold holographic lens over her left eye. A high-collared crimson and black double-breasted coat buttoned all the way to the throat, with gold piping and gold cufflinks. Arms crossed, a gold fountain pen between two fingers, chin raised, a knowing half-lidded smirk. Colour scheme crimson, black and gold only, no blue. 1990s retro anime character design, art style of classic Falcom games, extreme limited 16-color palette, heavy pixel dithering, pure white background. Elegant, dangerous, alluring.

### 2. Dr. Mel Kiorre (base)
Authentic 16-bit pixel art screenshot from a 1993 Japanese MS-DOS game. A macro photograph of a CRT monitor showing visible scanlines and RGB subpixels. A half-body 2D character sprite of a small, slight woman in her mid thirties, the bio-computing scientist of a futuristic AI tower. Soft round face, oversized round wire-rimmed glasses, very long straight black hair with a violet sheen in a loose braid over one shoulder. A rumpled, oversized white lab coat over a dark violet turtleneck, pale blue rubber gloves, and a small red stain on one cuff. She cradles a glass specimen jar holding a softly glowing pink brain-like organoid, looking down at it rather than at the viewer, with a gentle, distracted smile. Colour scheme white, violet and flesh pink, no blue uniform. 1990s retro anime character design, art style of classic Falcom games, extreme limited 16-color palette, heavy pixel dithering, pure white background. Quietly unsettling, bookish charm.

### 3. Bea Altasar (base)
Authentic 16-bit pixel art screenshot from a 1993 Japanese MS-DOS game. A macro photograph of a CRT monitor showing visible scanlines and RGB subpixels. A half-body 2D character sprite of a short, sturdy, athletic Filipina woman in her early twenties, the renewable power engineer of a futuristic AI tower. Sun-browned skin, freckles, short messy copper hair with green-dyed tips under a knotted olive bandana, welding goggles pushed up on her forehead. Olive-green work overalls with the sleeves rolled up and small solar-cell patches, and a brass leaf-and-lightning-bolt badge. A big wrench rests on her shoulder. She leans toward the viewer with a wide open grin and a chipped front tooth. Colour scheme olive green, brass and orange, no blue. 1990s retro anime character design, art style of classic Falcom games, extreme limited 16-color palette, heavy pixel dithering, pure white background. Tomboyish, fiery, cute.

### 4. Cass Parr (base)
Authentic 16-bit pixel art screenshot from a 1993 Japanese MS-DOS game. A macro photograph of a CRT monitor showing visible scanlines and RGB subpixels. A half-body 2D character sprite of a tall, broad-shouldered woman in her mid forties of Inuit and Scandinavian descent, the cooling engineer of a futuristic AI tower. A weathered face with laugh lines and a small scar through one eyebrow, and cropped silver-white hair. Snow goggles hang around her neck. A bulky ice-blue parka with a huge fur-trimmed hood, zipped up to the chin, and frost on her grey gloves. She holds a steaming mug of coffee in both hands, relaxed, with a calm, tired, kind smile. Colour scheme ice cyan, white and grey. 1990s retro anime character design, art style of classic Falcom games, extreme limited 16-color palette, heavy pixel dithering, pure white background. Mature, warm, quietly handsome.

### 5–16. Expressions (optional, after the four bases)
In the same chat as the base, attach the base image and send:

> Same character, same outfit, same pose, same crop, same pixel art style and palette. Change only her face to: **[EXPRESSION]**.

| | displeased | pleased | unsettling |
|--|--|--|--|
| Luci | eyes narrowed, lips pressed thin, pen tapping her arm | a genuine surprised blush, looking away | the gold lens glowing, a smile slightly too wide |
| Mel | frowning at the viewer over her glasses | soft blush, finally looking up at the viewer | glasses reflecting red light, the same calm smile |
| Bea | jaw set, goggles pulled down over her eyes | laughing, eyes closed | none needed (use displeased) |
| Cass | stern, looking straight at the viewer | an open warm smile, slight blush | eyes closed, looking away, sad |

### Also useful (one each)
- **Ending art, if the floor art is reused for endings:** none needed. The B-3, C-4 and D-2 floor scenes work as they are.
- **Failure ending:** Authentic 16-bit pixel art screenshot from a 1993 Japanese MS-DOS game. A macro photograph of a CRT monitor showing visible scanlines and RGB subpixels. A dark, abandoned AI datacenter floor at night, server racks powered down, a single red emergency light, rain on a cracked glass dome, an empty office chair in the centre aisle. Extreme limited 16-color palette, heavy pixel dithering, no text.
