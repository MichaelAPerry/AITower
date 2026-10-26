# AI Tower: the Soul (design spec)

Owner direction (latest, overrides HANDOFF.md where they differ):

- The game is the player's journey down **three Singularity trees**.
- Power, cooling and compute stay the core mechanics, but each tree brings its own problems.
- **Singularity (Synthetic) is the default and the easiest ending.** Bio and Green are hard.
- Some devices quietly make Bio or Green harder. Every rack, cooler and power source holds a **secret number**.
- The game is also a **visual-novel dating sim at the end of the world**. The advisors argue, ask philosophical questions, push back and sometimes steer you wrong on purpose.
- The **PC-98 concept art** sets the visual style, and it is the top priority.

The concept art's numbers, stat names and Japanese text are placeholders (see `ai_tower_design_doc_prep(1).md`). Only the mood is used.

---

## 1. The three trees

| Tree | In the fiction | Champion | Art | Difficulty |
|--|--|--|--|--|
| **Synthetic: The Singularity** | Everything becomes the machine: a fully computer-run virtual world. | Luci Ferro | D-2 Synth floor (blue/white, red eyes) | Default. It accrues from almost any compute. |
| **Bio: The Flesh** | Tissue and machine fuse into a cyborg world. | Dr. Mel Kiorre | B-3 Bio floor (red tissue, blue racks) | Hard. You need Mel's trust, low bio seal, and corruption kept short of 99%. |
| **Green: The Garden** | The Singularity grows into nature and stops being separate from it. | Bea Altasar | C-4 Sunlight floor (greenery, glass dome) | Hard. You need Bea's trust, low green seal, and a weather-fed grid. |

Cass Parr (cooling) champions no tree. She is the human voice and asks whether anyone should end the world at all.

### 1.1 Singularity Points (SP)

SP is the score, and each tree fills its own bar to **1000 SP**. The first full bar ends the game with that tree's ending.

Points accrue hourly from compute that is actually running:

| Rack line | Synthetic SP | Bio SP | Green SP |
|--|--|--|--|
| Shared (Standard/Advanced/Frontier) | 1× | – | × green score |
| Synthetic line | 2× | – | – |
| Bio line (organoids) | – | 1× | – |
| Green line | 0.25× | – | 1× × green score |

- **Synthetic SP always accrues.** Before the player commits, every shared rack feeds it, and after committing to Bio or Green the shared racks still feed it.
  - This is "the pull": the default ending happens to you unless you build away from it.
- **Bio and Green SP** accrue only after committing to that tree, and are scaled by `1 − seal/100`.
- The player always sees all three bars, so drift toward the Singularity is visible as a threat.

### 1.2 Committing to a tree

- At **Level 3**, the player may commit (FORM A-5) to Bio or Green, but only when:
  - the tree's seal is under 100, and
  - its champion's bond is at least 50.
- Synthetic needs nothing: you are on it already. Committing to it is a formality, and Luci is delighted.
- If either condition fails, the sheet says so in the champion's words. That is one of the moments the secret numbers surface (see 2.3).

### 1.3 Endings: three wins and one failure

| Ending | Trigger | Art |
|--|--|--|
| **The Lattice** (Synthetic) | Synthetic SP reaches 1000, on any path. | D-2 Synth |
| **The Flesh Remembers** (Bio) | Bio SP reaches 1000 on the Bio path. | B-3 Bio |
| **The Garden** (Green) | Green SP reaches 1000 on the Green path. | C-4 Green |
| **Failure** | Bankruptcy or Absorbed (corruption ≥ 99%). | — |

- Each ending is a visual-novel scene over its art.
- The advisor with the highest bond (at least 60) gets an epilogue line: the dating-sim payoff.
- A high bond with Cass changes every ending's coda: someone stayed human with you.

---

## 2. The secret numbers (seal)

*Design-doc Task B. Three options were considered:*

1. **Alignment vector:** every item adds to a hidden 3-vector, and the largest share wins.
   - Rejected: it is invisible to reason about, and there is no lock-out moment.
2. **Hard gates:** "built a diesel genset → Green closed."
   - Rejected: binary, punishing, and you learn it from a wiki.
3. **Seal = scar + residue (chosen).**
   - Numbers accumulate, partly permanently.
   - You can see them through trust.
   - There is a dramatic lock-out.

### 2.1 Math

Each facility definition has a hidden `seal: { biotech?: n, greentech?: n }`.

- **Scar (permanent):** placing a facility adds `n` to that tree's scar. Demolishing does not refund it.
  - You cannot un-pour concrete.
- **Residue (cleanable):** each game hour, every running facility adds `n × 0.03 / 24` to residue.
  - Items aligned with a tree have **negative** `n` for it. They don't scar, but their running residue cleans that tree's residue toward 0.
  - The diesel genset only leaves residue while it is actually running.
- **Seal = scar + residue.** At **100** the tree is **sealed**.
- Decisions can add or remove seal directly. Luci's cheap options usually add some.
- Synthetic has no seal, and it can never be closed to you.

Tuning targets, checked with `npm run sim`:

- A careless Level 1–3 tower (diesel backup, refrigerant chillers, immersion) reaches about 70–100 green seal and 40–70 bio seal by Level 3.
- A careful one stays under about 40.

### 2.2 What it does

| Seal | Effect |
|--|--|
| < 100 | The tree's SP gain is scaled by `1 − seal/100`. |
| ≥ 100 before commit | You can't commit to that tree. |
| ≥ 100 after commit | **Lock-out.** The tree rejects you: a VN scene plays, the path reverts to Synthetic, and the tree's SP freezes. |

### 2.3 How the player finds out

Players learn it gradually: first hints, then the advisors, then trust, then a lock-out.

1. **Champion asides at 25 / 50 / 75 seal.** Story scenes fire once each.
   - Bea: "The river smells of diesel. That's yours, you know."
   - Mel: "The cultures don't like the coolant. Neither do I."
2. **Trust reveals the numbers.** At bond ≥ 40, the champion annotates build cards with her tree's number ("Bea: ✗ 20 green seal").
   - Below that she says nothing.
   - Luci always annotates, cheerfully, with the cost saving only.
3. **The commit sheet** shows each tree's state in words ("open", "scarred", "closed to you").
4. **The lock-out scene** names the three items that cost the most.

---

## 3. Advisors: the dating-sim half

*Design-doc Task C. Profiles: four women, distinct silhouettes and palettes, each with an agenda.*

The concept portraits are generic, so these briefs replace them. In-game portraits are recoloured, tightly cropped placeholders from the concept sheet until final art exists. Art briefs are in 3.3.

The names keep the owner's MAGI-plus-Lucifer rule. Lucien becomes **Luci**, because the finance portrait is a woman.

| | **Luci Ferro** | **Dr. Mel Kiorre** | **Bea Altasar** | **Cass Parr** |
|--|--|--|--|--|
| Role | CFO and Logistics | Compute and Wetware | Power | Cooling and Facilities |
| Tree | Synthetic | Bio | Green | none (the human) |
| Colour | crimson / gold | violet / flesh-red | leaf green / brass | ice cyan / white |
| Voice | Fast, warm, sharp, tsundere. Always right about money. | Soft, clinical, curious, unsettling. | Blunt, idealist, short fuse, funny. | Quiet, dry, sincere. Asks *why*. |
| Wants | The Singularity, because it is clean, inevitable and profitable. Secretly partly synthetic already. | To grow a mind that remembers being a body. | A machine that belongs to the planet instead of eating it. | For you to be all right. For there to be a morning after. |
| How she steers you wrong | Recommends the cheap option. It is financially correct and quietly adds seal. | Offers ethically monstrous shortcuts: fast Bio SP, much more corruption, edging toward Absorbed. | **Greenwash tests:** offsets and credits that feel green and do nothing. She is checking whether you can tell. | Recommends the human choice (slow down, rest, pay people), which costs SP. She never lies. |

### 3.1 Bond

- Each advisor has a bond from 0 to 100. Cass, Bea and Mel start at 20, and Luci at 30 because she likes you first.
- **Bond goes up** when you:
  - pick the advisor's recommended choice,
  - answer her philosophical questions in her spirit,
  - build things her tree likes (small: +1 the first time per item).
- **Bond goes down** when you overrule her or build what she objected to.

| Bond | Effect |
|--|--|
| ≥ 40 | She reveals her tree's secret numbers on build cards. Cass reveals both trees' numbers. |
| ≥ 50 | Required to commit to her tree. She hands you the key. |
| ≥ 60 | Highest bond picks the ending epilogue. |

### 3.2 How pushback triggers (three mechanisms)

1. **Objections (on build).** The first time you place an item that scars a champion's tree by 10 or more, that champion objects in a VN scene.
   - Choices: *keep it* (bond −) or *"you're right, I'll replace it"* (bond +).
   - Luci, overhearing, sometimes cuts in: "It saved us four hundred thousand."
2. **Agenda votes (on decisions).** The 24 operational decisions keep their recommended choice, now voiced by an advisor with an agenda.
   - Luci's recommendations often carry hidden seal.
   - Choosing someone's recommendation raises her bond.
   - The player learns whom to trust.
3. **Resolve tests (story beats).** Scripted scenes at Level 2, Level 3 (the commit), seal 25/50/75, SP 50% and SP 90%.
   - The champion of your tree, or Luci if you have none, challenges you with a philosophical question.
   - Holding your line raises her bond and lowers seal a little. Wavering raises a rival's bond and seal.
   - Some questions have no "right" answer. They show who you are.

### 3.3 Art briefs (for final portraits)

- **Luci:**
  - long crimson hair in a high ponytail with a gold clip,
  - fitted dark-red double-breasted coat with gold piping,
  - ledger tablet, and one gold eye under certain lighting (the synthetic tell).
  - Smirks. Never shows cleavage: she is all buttons.
- **Mel:**
  - black-violet hair down to the waist,
  - round wire glasses,
  - a lab coat with a red stain at the cuff she never mentions,
  - an organoid jar.
  - Small, kind smile; eyes slightly unfocused.
- **Bea:**
  - short copper-to-green dip-dyed hair,
  - welding goggles on her forehead,
  - green work overalls with solar-cell patches and a leaf-bolt badge,
  - a multimeter. Grins.
- **Cass:**
  - cropped silver-white hair,
  - snow goggles and a fur-collared ice-blue parka zipped to the chin,
  - frost on her gloves, a thermal gun.
  - Neutral face that softens.

All four are adults in work clothes. Use the PC-98 look (16-colour dithering and black outlines) at 160×200 bust size.

---

## 4. The catalogue around the trees

*Design-doc Task A. Spatial rules: heat stays per-floor air plus liquid loops, as now. The trees change what you build, not the grid.*

The facility ids stay the same, so saves and tests survive. Names, flavour, a `line` tag and the secret numbers are new. Each tree has its own power, cooling and compute line, and its racks are upgraded down the tree.

| Line | Power | Cooling | Compute |
|--|--|--|--|
| **Shared** | Grid ties, diesel genset (green 20, bio 6), gas genset (green 12), UPS | CRAH air, refrigerant chiller (green 10), CDU | Standard air racks, storage |
| **Synthetic** | Grid Autonomy feeder (green 14), Continuity UPS (bio 10) | Two-phase immersion (green 12, bio 15), Cryo Core (bio 25, green 15) | DLC blades → Immersion → **Mind Lattice** (bio 20) |
| **Bio** | Bioreactor (green −6, bio −10) | Nutrient plant (tissue at 37 °C, "cooled" by feeding), sterile bay | Organoid incubator → organoid vats → **Neural Pit** |
| **Green** | Solar skin → canopy, wind mast (green −8) | Heat exchanger / district pipeline (green −6 / −12), free-air adiabatic | Neuromorphic → **Photonic** (green line), algae, carbon capture |

The full list of numbers is in `packages/content/src/data/facilities.json` (`seal`, `line`).

---

## 5. Look and feel (PC-98)

- **Palette:**
  - deep indigo/navy panels (#0b0b3a to #1a1a6e),
  - white double-rule borders,
  - sunset orange/magenta accents from the title art,
  - one signature colour per advisor and per tree (Synthetic cyan/red, Bio crimson, Green leaf).
- **Type:** DotGothic16 (pixel gothic, OFL, Latin subset) for everything except numbers. Numbers use a mono font for legibility.
- **Frames:** black boxes with a 2 px white rule and a 1 px inner rule, square corners, like the concept stat boxes.
- **Title screen:** the concept title art, quantised to 16 colours at 640×480, with a ▶ menu at top left like the concept.
- **Dialogue:** a full-width bottom box with the portrait on the left in a framed window. It has a nameplate, typewriter text, ▶ choices, a location caption box at top left ("B-3 BIO-COMPUTE FLOOR"), and a dimmed backdrop. Story scenes show their tree's floor art behind.
- **Advisor dossier:** the concept layout: portrait left, framed box right with role, a one-line bio and stat bars for BOND, plus the tree she serves.
- **Endings:** full-screen tree art with a slow text crawl in the dialogue box.
- **CRT:** optional scanline and dither overlay (on by default, off with reduced motion or effects).

---

## 6. Decisions made here (owner can overrule)

1. **Shared early game:** Levels 1–2 are shared, and every tree's seal is decided there. Commitment opens at Level 3.
2. **Mixing trees:** you may build anything, but you can commit to only one tree. Synthetic SP accrues from everything not on a tree line.
3. **Failure:** bankruptcy or Absorbed (reputation and shutdown are removed).
4. **SP milestones:** 1000 per tree. Story beats fire at 50% and 90%.
5. **Levels vs SP:** Levels still gate equipment (the catalogue ladder). SP is the goal. Reaching Level 5 is not a win.
6. **Reputation:** removed. Uptime is now only the target the quarterly audit grades (a cash grant or fine); it no longer gates Levels.
