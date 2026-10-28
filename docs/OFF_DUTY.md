# Off-duty portraits

Owner-approved, used instead of lingerie. One casual portrait per advisor, unlocked by one earned condition. Tasteful, quiet, never sexual: all four are adults in ordinary clothes, doing something ordinary, at rest. The intimacy is that she lets you see her off the clock.

Art rules: same face, hair and palette as her base portrait in `docs/ART_BRIEFS.md`. Fully clothed, loose and soft (no cleavage, no bare midriff, no pose aimed at the viewer). Prompts follow the owner's ChatGPT template, so attach her base portrait to the chat and say "same character".

## Unlock summary

| | Unlock (plain words) | Needs |
|--|--|--|
| Luci | Reach the Lattice ending with no debt, and Luci at Devoted. | `gameOver.ending`, `loanPrincipal`, `bonds.luci` |
| Mel | Reach the Flesh ending with corruption under half. | `gameOver.ending`, `corruption` |
| Bea | Win the Garden ending. (Owner's example.) | `gameOver.ending` |
| Cass | 30 days in a row at 99% uptime. (Owner's example.) | new field `uptimeStreak` |

Luci, Mel and Bea unlock at the ending, so each needs a different winning run. That is the point: it is a reason to play the other trees. Cass unlocks mid-run.

## Luci Ferro: the books closed

**Requirement.** "Win the Singularity with the books clean, and have Luci think well of you." She likes you first, so Devoted is reachable, and she has a business reason for it: she wants you there when it closes.

**Checks (all true at the moment the game ends):**
- `state.gameOver.kind === "victory"` and `state.gameOver.ending === "singularity"`
- `state.loanPrincipal === 0`
- `state.bonds.luci >= 70` (the Devoted band of `bondStage()`)

All three fields exist. Nothing to add.

**Caption.** "Off the clock. Don't put that in the ledger."

**Image prompt** (file: `packages/ui/src/art/portraits/luci-offduty.png`, 4:5, about 480x600; the game converts it to `packages/ui/src/art/luci-offduty.webp`)

> Authentic 16-bit pixel art screenshot from a 1993 Japanese MS-DOS game. A macro photograph of a CRT monitor showing visible scanlines and RGB subpixels. A half-body 2D character sprite, the same character as the attached image: a tall, thin, sharp-featured Italian woman in her late twenties, sleek crimson asymmetric bob haircut longer on one side, narrow amber eyes, a thin gold holographic lens over her left eye. Off duty, late at night in an empty office. The crimson coat is gone; she wears a loose cream knit sweater with the sleeves pushed up to her elbows, collar to the collarbone, and the sweater is slightly too big. Sitting sideways on a desk, one foot in a sock swinging, a paper cup of tea in both hands, the gold fountain pen tucked behind her ear. The ledger tablet is closed beside her. She looks past the viewer at a dark window, the half-lidded smirk gone soft and a little tired. Colour scheme crimson, cream, black and gold only, no blue. 1990s retro anime character design, art style of classic Falcom games, extreme limited 16-color palette, heavy pixel dithering, pure white background. Warm, private, unguarded.

**Avoid:** cleavage, off-shoulder, short skirt, lingerie, leaning toward the viewer, any wink at the camera, blue.

## Dr. Mel Kiorre: the second stool

**Requirement.** "Win the Flesh without losing yourself." Mel wants someone willing to stay beside her, not just approve. She is shown at rest only if you finished her path and stayed mostly human.

**Checks (at the moment the game ends):**
- `state.gameOver.kind === "victory"` and `state.gameOver.ending === "flesh"`
- `state.corruption < 0.5` (corruption is 0..1; 0.99 is Absorbed)

Both fields exist. This is the hardest of the three endings, so it is the rarest unlock. It stays reachable because a careful Bio run keeps corruption short of 99% anyway (`docs/SOUL.md`, section 1); the half-way mark asks for a clearly careful one. Tune the 0.5 with `soulRun.ts` if it proves too strict.

**Caption.** "Hm. It's warm in here. I think that's you."

**Image prompt** (file: `packages/ui/src/art/portraits/mel-offduty.png`, 4:5, about 480x600; webp: `packages/ui/src/art/mel-offduty.webp`)

> Authentic 16-bit pixel art screenshot from a 1993 Japanese MS-DOS game. A macro photograph of a CRT monitor showing visible scanlines and RGB subpixels. A half-body 2D character sprite, the same character as the attached image: a small, slight woman in her mid thirties, soft round face, very long straight black hair with a violet sheen, now loose and unbraided over one shoulder. Off duty, at night in her lab. No lab coat and no gloves; she wears a soft oversized dark violet cardigan over a pale pink nightshirt, long sleeves covering her hands, the cuffs plain. Her round wire-rimmed glasses are pushed up into her hair. She sits on a stool with a small cushion on it, hugging her knees, and beside her is a second stool with another cushion. A glass jar with a faintly glowing pink organoid sits on the bench behind her, out of focus. She looks up at the viewer for the first time, tired and gentle, a small honest smile. Colour scheme white, violet and flesh pink, no blue. 1990s retro anime character design, art style of classic Falcom games, extreme limited 16-color palette, heavy pixel dithering, pure white background. Quiet, soft, a little shy.

**Avoid:** see-through nightwear, bare legs or shoulders, a visible stain on the cuff (leave the cuffs plain), blue.

## Bea Altasar: the garden

**Requirement.** "Win the Garden." (Owner's example, as written.) The Garden is hard, and it is what she wanted most.

**Checks (at the moment the game ends):**
- `state.gameOver.kind === "victory"` and `state.gameOver.ending === "garden"`

The field exists. Nothing to add.

**Caption.** "Okay. Okay. It's not a lie. Look at it."

**Image prompt** (file: `packages/ui/src/art/portraits/bea-offduty.png`, 4:5, about 480x600; webp: `packages/ui/src/art/bea-offduty.webp`)

> Authentic 16-bit pixel art screenshot from a 1993 Japanese MS-DOS game. A macro photograph of a CRT monitor showing visible scanlines and RGB subpixels. A half-body 2D character sprite, the same character as the attached image: a short, sturdy, athletic Filipina woman in her early twenties, sun-browned skin, freckles, short messy copper hair with green-dyed tips. Off duty, in a garden of ferns and tall plants on the tower roof at sunrise, the old black solar panels behind her grown over with green. No overalls: she wears a worn orange t-shirt and soil-stained olive work trousers, sleeves rolled, the knotted bandana around her neck, the welding goggles hanging from a branch beside her, the brass leaf-and-lightning-bolt badge pinned to the shirt. She kneels with muddy hands cupped around a fern frond, not looking at the viewer, the chipped-tooth grin turned into a quiet, wondering smile. The big wrench lies forgotten in the grass. Colour scheme olive green, brass and orange, no blue. 1990s retro anime character design, art style of classic Falcom games, extreme limited 16-color palette, heavy pixel dithering, pure white background behind the plants. Warm, proud, soft light.

**Avoid:** tight or cropped top, bare midriff, wet clothes, leaning toward the viewer, blue.

## Cass Parr: the cot

**Requirement.** "Keep the tower at 99% uptime for 30 days in a row." (Owner's example, as written.) It fits her: she is the one who goes out and fixes the compressor at night.

**Checks.** Needs a new field:
- Add `uptimeStreak: number` to `SimState` (snapshot v16, migration default 0).
- In `closeAuditDay` (`packages/sim/src/economy/audit.ts`), after the day's mean is computed: `streak = dayMeanUptime >= 0.99 ? streak + 1 : 0`. Use the same `uptime` number the audit uses, and check whether it is 0..1 or 0..100 before choosing the threshold.
- Unlocked when `state.uptimeStreak >= 30`. Latch it in the profile, so a later outage does not take it away.
- `audit.days` cannot be used instead: it is cleared every audit period, and `closeAuditDay` wipes it when `state.irreversible`.

**Caption.** "Don't wake me. It's holding."

**Image prompt** (file: `packages/ui/src/art/portraits/cass-offduty.png`, 4:5, about 480x600; webp: `packages/ui/src/art/cass-offduty.webp`)

> Authentic 16-bit pixel art screenshot from a 1993 Japanese MS-DOS game. A macro photograph of a CRT monitor showing visible scanlines and RGB subpixels. A half-body 2D character sprite, the same character as the attached image: a tall, broad-shouldered woman in her mid forties of Inuit and Scandinavian descent, weathered face with laugh lines and a small scar through one eyebrow, cropped silver-white hair. Off duty, asleep on a narrow army cot in the B2 plant room, a dim cyan pipe-lit corner. The parka is off and folded under her head as a pillow, the fur hood visible; she wears a grey wool jumper with the sleeves pushed up, and a grey blanket is pulled to her chest. Snow goggles hang from the cot frame. On the floor beside the cot, a chipped mug of coffee still steaming faintly, and a thermal gun on a crate. Her face is turned toward the viewer in sleep, relaxed, mouth slightly open, the scar and laugh lines softened. Colour scheme ice cyan, white and grey. 1990s retro anime character design, art style of classic Falcom games, extreme limited 16-color palette, heavy pixel dithering, pure white background at the edges. Tired, safe, quietly tender.

**Avoid:** any exposed skin beyond hands and face, a pose suggesting display, text, blue uniform.

## Gallery

**Where it lives.** A new OFF DUTY tab on the advisor dossier (`packages/ui/src/advisors/`), beside her memories. One framed slot per advisor, with her base bust as a dimmed silhouette when locked. Clicking an unlocked slot opens the full portrait with the caption in the dialogue-box style. Also reachable from the title screen (GALLERY), so the ending-gated portraits can be viewed without loading a save.

**Locked-slot hint** (in her voice, without the numbers):

| | Locked hint |
|--|--|
| Luci | "Close the books. All of them. Then we'll see." |
| Mel | "Come all the way. Keep something of yourself. Then I'll show you." |
| Bea | "Show me the Garden. Not a certificate." |
| Cass | "Hold it up for a month. I'll tell you when I'm asleep." |

Below the hint, show the plain condition once her bond is Friend (30+), so the player can aim for it.

**Save field.** Unlocks outlive any one run (Luci, Mel and Bea each need a different ending), so they live outside the sim snapshot.
- Profile store in `localStorage`, key `aitower.gallery`: `{ v: 1, offDuty: { luci?: true, mel?: true, bea?: true, cass?: true } }`. Wrap reads and writes in try/catch.
- The UI writes it from the game-over event (`ending`, plus the end-of-run `loanPrincipal`, `bonds.luci` and `corruption`), and for Cass the moment `uptimeStreak` reaches 30, even if the player never saves.
- Sim side: only `uptimeStreak` is added to the snapshot (v16).
