# Research UI: study and proposal

Status: proposal for owner approval. No game code changed. Mockup: `docs/research_mockup_v2.html` (open in a browser; screenshot `docs/research_mockup_v2.png`).

## 1. What exists now

- 77 tech nodes, 8 lanes (Admin, Logistics, Power, Cooling, Compute are shared; Wetware = Flesh, Green = Garden, Synthetic = Lattice), 5 Levels. Cost 180 to 70,000 RP. Data: `packages/content/src/data/tech.json`.
- Research is a **purchase**, not a timer. You earn RP from running racks, then spend RP to unlock a node. There is no queue and no "in progress" state. The only progress to show is "RP saved toward a goal".
- UI: `packages/ui/src/research/`. Two views (Tree and List) behind a toggle. The Tree is one SVG, lanes as rows and Levels as columns, one line per prerequisite, with zoom and pan. A side Inspector explains the selected node.
- Screenshot of the current screen: `/tmp/research/current-tree.png` (early game, 1600x900).

### Problems (seen in the screenshot and the code)

1. **Text is far too small.** Node names are 12 px and the cost/state tags 9.5 px in SVG, then scaled down to 62% on open ("Fit"). On screen that is about 7 px. The style rule is 16 px or more.
2. **Everything is on screen at once.** 77 nodes, about 100 lines, and the lines cross lanes. A new player sees a wall of dashed boxes and cannot tell what to do next.
3. **State is hard to read.** Done, ready, poor, locked and "level too low" are all thin 1 px box outlines that differ only a little. Locked nodes are dim so the player cannot read them.
4. **Two UIs for one thing.** Tree and List have different layouts, different selection rules and a different tab bar. The toggle sits next to the zoom buttons and branch filters, so there are three rows of controls before any content.
5. **The three trees are not visible.** Lattice, Flesh and Garden appear as extra lanes named Synthetic, Wetware and Green at the bottom, and as extra tabs. The game's key choice looks like three more lanes of admin.
6. **The goal is hidden.** "Saving for X" shows only in List view. In Tree view nothing says how far off the next node is.
7. **The Inspector competes with the map.** It takes a third of the width and scrolls, so the Start button can be off screen.
8. **Naming drift.** Code says Synthetic and Wetware; the HUD and docs say Lattice and Flesh.

## 2. What other games do (short)

Sources were thin (see the end); the points marked (known) are from general knowledge of the games.

- **Civilization (V/VI):** a wide left-to-right graph. Players say it reads as a "web" and gets hard to follow when everything shows at once. VI adds a "boost" tag and a clear current-research bar on top. (forum thread cited below, known)
- **Factorio:** a tree with a strong state palette (done, available, locked) and a click-to-filter view that shows only the prerequisites and the follow-ups of one tech. Players ask for faster navigation inside that filtered view. (cited below)
- **Stellaris:** no tree at all. You are dealt 3 cards, weighted by your choices, and you pick one. It makes each choice small and readable and rewards the player's path. It also hides the future. (cited below, known)
- **Oxygen Not Included:** tiered columns by tier, each tech a labelled box, gated by research-station type. Tier gates are shown as a column header. (wiki cited below)
- **Path of Exile passive tree:** a huge graph, usable only because of search, highlight-on-hover of the path to a node, and zoom levels. It is the example of when a graph is worth it, and it needs many hours of play. (known)
- **Slay the Spire map / Against the Storm / Frostpunk:** show a small number of choices ahead, with a clear "you are here". Frostpunk's tree has few, large cards with a short effect line. (known)

### Principles to take

1. **Show few things at a time.** Group by Level and by road; fold what is done and what is far off.
2. **Cards, not dots.** Big text, a one-line effect, the cost, a state word. State is a word plus colour plus border style (never colour alone).
3. **Lines only for the selection.** Draw prerequisites and follow-ups for the picked node, or list them as a chain. Do not draw 100 lines.
4. **Say why it is locked, in words** ("First: Chilled-Water Loop Design"), on the card.
5. **One pinned goal with a progress bar and ETA**, always visible at the top. The player's question is "what am I saving for and how long".
6. **Make the three trees the top-level choice,** not lanes at the bottom. Use the three floor-painting colours.
7. **One layout,** with the detail panel always on the right and the primary button always in view.
8. **Text 16 px or more,** icons 48 px or more.

## 3. Options

### Option A: Level ladder with road tabs (recommended)

- Top: RP, rate, and the **pinned goal** with bar and ETA.
- Tabs: **Shared | Lattice | Flesh | Garden**, in the road colours, with a "n ready" badge.
- Body: **rows by Level**. Done Levels collapse to one line. The current Level is open with cards in a 3-column grid. The next Level is shown dimmed and dashed with "First: ..." text. Later Levels are one line.
- Each card (336 x 84 px): lane stripe, name 20 px, one-line effect 16 px, state word, cost. Ready cards get a green inset border.
- Right panel: icon, plain description, "You get", "Needs first" chain, "Leads to", cost / have / short / ETA, **Pin as goal** and **Start**.
- A "Three roads open at Level 2" strip at the bottom of the Shared tab shows each road's entry card, so the fork is visible before the player commits.
- Prerequisite lines: none in the grid. Selecting a card highlights its prerequisite and follow-up cards with a magenta outline.

Why it fits: the data is already Level-gated (every node has `minTier`), most nodes have 1 or 2 prerequisites, and the sim has no timer. A ladder matches how a player progresses and removes zoom and pan. It reuses `nodeState`, `branchView`, `chain`, `etaText` and the icons in `researchIcons.ts`.

Cost: remove `treeLayout.ts` and `ResearchTree.tsx` (about 600 lines, plus tests) and add a card grid. Medium work, low risk, all logic already exists. Needs one new UI field (pinned goal id).

### Option B: Three-road map, one road per screen

- Each road (Lattice, Flesh, Garden) gets a full-screen left-to-right graph with big nodes (about 220 x 80), only that road's 9 to 16 nodes plus the shared nodes it depends on greyed at the left edge. A fourth screen holds the shared Admin, Logistics, Power, Cooling and Compute lists.
- Edges are drawn, since each road is small enough to read.
- Better for showing a road as a story and its end item (for example Mind Lattice). Worse for the early game, where most of the player's choices are the shared nodes, and it needs a new layout engine and more screens.

### Recommendation

**Option A.** It fixes the real problems (size, clutter, state, goal) with the least new code, works with keyboard and gamepad-like focus, and still makes the three roads the first thing a player sees. Option B can be added later as a "road map" view for each road at Level 4 and up, where chains get long.

## 4. Next steps if approved

1. Build `ResearchLadder` and a `GoalBar` from existing helpers; delete the SVG tree and the List mode.
2. Add `researchGoal` to UI state (not saved in the sim).
3. Rename Synthetic and Wetware to Lattice and Flesh in tab labels.
4. Tests: card states, collapsed Levels, lock reason text, 16 px minimum in the CSS.
5. Open question for the owner: should RP gain feel like a timer (a "researching" bar that fills over game hours)? That is a sim change and is not part of this proposal.

## Sources

- Factorio forums, "Change the Research screen for more readability": https://forums.factorio.com/viewtopic.php?p=156608
- Stellaris tech progression guide: https://guildorder.com/ko/games/stellaris/wiki/tech-tree-progression
- Oxygen Not Included wiki, Research: https://oxygennotincluded.wiki.gg/wiki/Research
- Searches for Path of Exile, Against the Storm and Frostpunk tree design returned nothing usable; those lines are from general knowledge and should be treated as such.

## 7. v2 mockup: the Orb (owner feedback on v1)

Owner rejected v1 as "blocky and bad" and asked for a sphere of readable globes, a Tron-meets-PC-98 look, and trees that grow flavour (pixel plants, flesh) further out. Mockup: `docs/research_mockup_v2.html` (screenshot `docs/research_mockup_v2.png`, 1600x900). No game code changed.

**Owner's question: are today's trees just in that wrapper?** Yes. Today there is one graph of all 77 techs. Lattice, Flesh and Garden (code names Synthetic, Wetware, Green) are three of its eight lanes, drawn as rows with Levels as columns; edges that cross lanes are dashed. So the three trees are not separate structures, and the sphere is a new layout of the same data (`tech.json` needs no change).

What the mockup does:

- **Layout:** an elliptical orb. The shared techs (Admin, Logistics, Power, Cooling, Compute, 39 nodes) sit in the middle, pulled toward the tree that needs them. Lattice (9 nodes), Flesh (13) and Garden (16) each own a wedge. Distance from the core is Level, shown by five neon rings (LV1 to LV5). A collision pass nudges globes apart, so a ring is approximate, not exact.
- **Globes:** done = filled, glowing, with a tick. Ready = bright pulsing ring plus the RP cost under the name. Locked = dim ring and padlock, label still readable. State is shape and label weight, not colour alone. All names are 16 px (bold when done or ready) with a dark outline for contrast on the flora.
- **Look:** dark ground, dithered radial glow (4x4 Bayer, five blues), neon ellipses and spokes, glowing arc edges (lit only where a prerequisite is done), scanlines, DotGothic16 for headings and numbers, M PLUS Rounded 1c for body.
- **Flavour (drawn in code on a 4 px pixel canvas, no images):** Lattice = circuit traces with pads and crystal shards; Flesh = branching veins and dithered tissue cells; Garden = wavy vines with leaves, sprouts and small flowers. Each grows denser toward the rim.
- **Side panel:** tree and Level tag, name, You get, Needs first (done or needed), cost/have/short, START, PIN AS GOAL, legend. Click any globe to update it.
- **Zoom and pan:** wheel zooms (0.7x to 3x), drag pans, key 0 fits. The default view shows all 77 globes at once.

Trade-offs:

- 77 labelled globes on one screen is dense. 16 px names mean labels (up to 3 lines) outweigh the globes, and a few inner-ring labels sit close together (4 pairs still touch by a pixel or two in the static layout). A real build should use a proper layout pass or zoom levels (names only beyond a zoom threshold).
- At 1280x720 the stage scales by 0.8, so names fall to about 12.8 px; the 16 px minimum only holds at 1600x900 or larger.
- Flora competes with text. It is kept low in alpha and labels have a dark outline; stronger flavour would hurt locked-label contrast.
- Lattice has no node before Level 4 in the data, so its wedge is empty near the core. That is the real shape of the data, but it makes the wedge look sparse and the shared nodes dominate the middle.
- Fonts load from Google Fonts, so the HTML needs network access to render in the intended faces.
