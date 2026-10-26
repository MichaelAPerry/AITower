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
