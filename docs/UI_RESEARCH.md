# AItower UI research and redesign proposal

Audience: students and non-experts. Goal: Sims-like "pick it, see it, place it", and a game that teaches datacenters from zero.
Method: walked the live build with Playwright at 1440x900 (screenshots named below), plus convention knowledge from reference games (no live web lookups were used; citations are by game, from design knowledge, not links).

Screenshot folder: `/tmp/claude-0/-home-user-AITower/a7f75a3b-71cb-517d-a9c2-dde0cac086fa/scratchpad/uiresearch/` (local scratch, not committed)..

## Summary

1. Every surface is a different widget: a left build palette, right drawers, a full-screen paper-styled research sheet, a cassette-style Automation panel. Each has its own open/close/select rules. Students must relearn the UI per panel.
2. Info is hidden behind hover and vanishes on pick. Nothing shows the selected item's details while placing it. Racks, the main thing you build, are not in the first tab.
3. Vocabulary is the real wall: PUE, CRAH, CDU, "Airflow Standardisation", "Contract Automation", "inference". The game shows terms before teaching them, and the Encyclopedia is a flat list of short paragraphs that never says what a chiller is by name.
4. Proposal: one model everywhere: left = catalog bar with big icons, center = world, right = one persistent "Inspector" panel that explains whatever is hovered or picked. Hover = preview, click = pick, ghost follows cursor, click = place, right-click/Esc = drop.
5. Replace the Encyclopedia with a "Datacenter Primer": 6 ELI5 chapters, each with one diagram and "try it" links, surfaced contextually (the "?" on any item opens its chapter).

## Friction audit (current build)

Click counts, from a fresh New Game after skipping the tutorial:

| Task | Clicks now | Notes |
|---|---|---|
| Build the first rack | 4 (More, RACKS tab, card, floor). 2 if it is one of the 3 pinned dock items | Racks are not in the default "BUILD" tab, which shows slab, conduits, lift, demolish (`03more.png`, `20racks`). The owner's "click the arrow first" is the "More ▸" button. |
| Read what an item is | hover, over a dense list | Spec tooltip floats to the right and covers the world, lists "Fail rate 20.0%/day" and "Cooling air" with no meaning (`21rackhover.png`). It disappears on click, so you cannot read it while placing. |
| Accept a contract | 1 to 2 | Drawer auto-opens, which is good, but the offer card is cramped: "Nimbus Climate Collective · inference $195k $130 [FITS]" has two unlabeled prices and a jargon tag (`01start.png`). |
| Start a research | 3 or more: R, "Open the full department of research", find the card, click | Quick drawer shows only "0 RP, Nothing within reach" (`08research.png`) so it is a dead end. Full sheet is a 5-column wall of text, 20+ cards, with a different (light paper) look, jargon names, and prerequisite text in dim blue (`23resfull.png`). |
| Learn what a chiller is | 3 to 4: K, type in search or guess a topic, open "Cooling and heat", scroll | The entry explains heat and air handlers, not chillers. Chiller appears only inside other entries (`24entry.png`). |
| Leave placement mode | Esc or right-click | Esc with a drawer open closed the drawer but left the build tool armed: status "Placing AC-1 ... Esc / right-click to exit" stayed on screen through later panels (`25auto`, `27gauge`). Two things share one key. |

Other concrete friction:

- Dock names truncate ("AC-1 Air-Cooled...", "Air Handler AH-..."), so the pinned shortcuts do not name what they are (`02nodrawer.png`).
- Palette tabs (BUILD / RACKS / POWER / COOL / LOGIS / WETWARE) are tiny 10px text with no icons; "LOGIS" is a truncated word. Locked items sit in the same list as buildable ones, 8 of 12 racks are greyed out.
- The right drawer clips the drawer-tab column ("inance", "auges" in `01start.png`) and covers 30 percent of the world. Contracts auto-open at start over the thing you should be looking at.
- Panels all have different interaction: Gauges has overlays (the genuinely useful heat/power/coolant views) buried below six jargon tiles (`27gauge.png`). Automation uses toggle switches, number boxes and "research:" pills in one list (`25auto.png`). Finance and Gauges overlap in purpose (cash, uptime, PUE).
- "?" help mode only added dashed outlines; no text appeared without a second hover, so it does not hand-hold (`28help.png`).
- HUD top-right has an unlabeled "0" badge, "50" reputation with no explanation, "PUE" shown as a headline.
- Jargon shown before taught: PUE, CRAH, CDU, PF, "inference", "throttle".

## Patterns from reference games

- **The Sims build/buy mode**: a bottom category bar of big pictograms (walls, floors, objects by room type); a catalog grid of thumbnails with the price under each; hover shows name and a one-line description; click picks, and the item ghosts under the cursor, rotate with a key, click to place and you stay in placement for more of them; right-click or Esc drops it. No drawer to open first, no separate "arrow".
- **Factorio / Satisfactory**: build menu is a tab bar of category icons with a grid of item icons; hover gives a tooltip with a description and stats; the item picks to the hand and the ghost shows green/red validity; Factoriopedia and the tutorial's in-world arrows teach concepts in the order you need them. Quick-bar numbers act as favourites. Factorio's research screen is a tree with the selected tech's description in a persistent side panel and "Queue" as the single action.
- **SimTower / Project Highrise**: the build bar is organized by what a tenant needs (office, residential, service), one tool strip at the bottom; a persistent inspector appears on click of a placed thing and states "why is this unhappy" in plain words. Problems are shown as icons on the object (they already do this with BROKEN).
- **Two Point Hospital/Campus**: category bar at the bottom, objects pre-grouped by room function; a persistent "requirements" list for each room with ticks; research is a card list, not a wall; a hint character gives short advice. The jobs/"contracts" are a board with a pinned active list.
- **Prison Architect / RollerCoaster Tycoon / Planet Coaster**: bottom toolbar of big icons that opens a flyout with a catalog; one item inspector window at a time (click it again to close); ghost with validity colors; costs shown on the ghost.
- **Cities: Skylines**: category icons on the bottom, unlock milestones shown as a locked row at the end (not mixed in), info panel on hover shows plain "what it does" plus a coverage overlay. Overlays are a toggle chip row, each tied to a concept (power, water).
- **Mini Metro / Kairosoft**: calm screen, one choice at a time, rewards are visible; Kairosoft menus are large single-column lists with an icon and a number; no hidden hover state, text is always visible.
- **Mobile idle/tycoon**: one primary action per card ("Upgrade $400") with the effect stated in the button text; the next unlock is a single highlighted goal; a badge dot shows when something is affordable.
- **Primers (Kerbal Space Program tutorials, Oxygen Not Included, Factorio tutorial)**: short chapters with one diagram, a "try it" button that sets up the scenario or highlights the item, and an in-context "?" link. ONI's per-object "tool tip with plain English and the number it changes" is the model for a spec card.

Extracted rules: category icons not text tabs; one catalog, one selected-item panel; click-to-pick with ghost; locked items collapsed at the end; verbs on buttons ("Build", "Start research", "Take job"); jargon shown with a plain-word gloss the first time; one panel at a time; overlays tied to concepts.

## Proposed redesign

Layout (see `docs/mockups/ui-v2.html`): world stays full width. Left edge = category bar. Left flyout = catalog grid. Right = one Inspector. Bottom = status/tool hint. Panels (Contracts, Research, Money, Primer) open as a single "sheet" in the right column or center, never stacked.

### Unified interaction model (all panels)

1. A list of cards on the left, an Inspector on the right showing the hovered or selected card in plain words.
2. Hover = preview in Inspector (no tooltips floating over the world). Click = select/pick. Primary action is a single large labeled button in the Inspector ("Build", "Take job", "Start research").
3. Esc always closes the topmost thing: first the picked tool/ghost, then the panel. Right-click drops the tool.
4. One panel open at a time. Opening another replaces it. Panels never auto-open except one-time first-use coachmarks.
5. Every Inspector has a "?" chip that opens the Primer chapter for it.
6. Locked items collapse into a "Coming at Level 2" row with the one thing that unlocks them.

### Build

- Category bar on the left, always visible (no "More ▸"): Racks, Power, Cooling, Floors and Lifts, Bots and Supplies, Wetware. 36px icons with a 12px label. The previously "BUILD" tab becomes Floors and Lifts; Demolish is a separate trash tool with its own key.
- Clicking a category opens the catalog grid: thumbnail, short name, price. Name never truncates (two lines allowed). Pinned favourites row moves to the bottom of the catalog (or number keys 1 to 9).
- Hover a catalog card: Inspector shows name, a one-sentence plain description ("A cabinet of computers. Hot air comes out the back."), three stat lines each with an icon and plain label: Power (40 kW), Heat (needs cooling nearby), Earns (20 PF of compute), Breaks (about 1 in 5 days).
- Click a card: it is picked. Inspector stays pinned to it. A ghost follows the cursor, green if legal, red with a one-line reason ("No power conduit within reach"). Click to place, stay in placement for repeat building, Esc/right-click to drop, R to rotate if relevant.
- Expected clicks: build a rack = 2 (category, card) then placing clicks. With a favourite = 1 plus placement.

### Contracts

- Job board: card list on the left, Inspector with "What they want", "You get", "It needs", and a single "Take job" button. Replace the two unlabeled prices with "Pays $195k" and "Costs you about $130 per hour to run". Replace "FITS" with a green check or "You can do this now" / amber "Needs 20 PF more".
- Active jobs pinned on top with a progress bar and the one thing blocking them.
- Does not auto-open; the first-use coachmark points at the top-bar Jobs button.

### Research

- Replace the 5-column wall with a tree: five branch tabs (Compute, Cooling, Power, Logistics, Admin) on the left, one branch's nodes as a vertical or horizontal chain with lock lines, Inspector on the right. Show only nodes whose prerequisite is met, plus one locked row ahead ("Next: ...").
- Names plain first, term second: "Better airflow (Airflow Standardisation)". The Inspector says "What you get: +5% cooling", "Why: your racks run hot, this lets them run longer".
- Primary action "Start research", with the RP cost. Always usable: the quick drawer's dead "Nothing within reach" state is removed; if no RP, the button reads "Need 360 RP (you have 0). Earn RP by running racks".
- Use the same dark glass look as the rest (the paper sheet is the outlier).

### Automation / Finance / Gauges

- Merge Finance and Gauges into one "Insights" panel with two sections: "Money" (cash, income, costs as a list of plain labeled lines) and "Health" (heat, power, uptime) with the overlay chips on top, because overlays are the most useful view and are what students need.
- Automation becomes a short checklist titled "Let the staff do it": each row = icon, plain verb sentence ("Hire a bot when racks grow"), on/off, locked rows say what to research. Hidden entirely until the first automation is unlocked.
- Hotkeys remain but the panel strip shrinks to: Jobs, Research, Insights, Primer.

### Encyclopedia becomes the Datacenter Primer

- Chapters, in order: 1. What is a datacenter? 2. Power: where the electricity comes from. 3. Heat and cooling. 4. Why racks break. 5. Uptime and reputation. 6. Money: what you earn and spend. Then "Words" (glossary).
- Each chapter: 80 to 120 words at about a grade-5 reading level, one inline SVG diagram (cabinet, hot and cold air arrows, power flow), a "Try it" button that highlights the relevant item in the world, and a "Next" button. The reference entries (Facilities, Bots, Research) stay under a "Look up" tab.
- Contextual entry: "?" in the Inspector, a glossary link on any term (dotted underline), and a first-run suggestion "New to datacenters? 3 minute primer". Include the word "chiller", with a plain gloss: "a fridge for water".
- Replace the "?" help mode with this: the top "?" opens Primer at the chapter for whatever is selected.

### Help

- Retire the dashed-outline help mode. Keep coachmarks for the first rack, first job and first research only, each with "Show me" and "Skip".

## Implementation order

Four independent chunks; each ships on its own.

**Chunk 1: Build catalog and Inspector (highest value).**
Category icon bar, catalog grid, Inspector panel, ghost, no truncation, Esc order. Acceptance: (a) first rack in 2 clicks plus placement from a fresh game; (b) hovering any card fills the Inspector without a floating tooltip; (c) picked item stays visible in Inspector until dropped; (d) Esc cancels the tool before closing a panel; (e) locked items are collapsed to one row; (f) no label is truncated at 1280x720 and 1440x900; (g) existing placement tests still pass.

**Chunk 2: Unified panel shell + Contracts + Insights.**
One "sheet" component (list + Inspector + action button), one panel open at a time, never auto-open. Contracts rewritten with labels and "Take job", Finance and Gauges merged into Insights with overlay chips. Acceptance: accepting a contract = 2 clicks (select, Take job) with plain-language terms; opening any panel closes the previous; tab strip not clipped at 1280 wide; keyboard shortcuts C, I still work.

**Chunk 3: Research tree on the shared shell.**
Branch tabs, node list, Inspector, plain names, hidden-until-reachable. Acceptance: start a research in 3 clicks from the world (R, node, Start); every node has a plain "What you get / Why" line; prerequisites shown as a chain; same visual theme as other panels; the quick drawer's dead end is gone.

**Chunk 4: Datacenter Primer.**
Six chapters plus Words, inline SVG diagrams, Try it buttons, "?" in Inspector, first-run prompt. Acceptance: "chiller" resolves in 2 clicks from anywhere (K, search) or 1 from any chiller card's "?"; each chapter is under 120 words with one diagram; all glossary terms used in the UI have a definition; copy reviewed at grade-5 level (Flesch-Kincaid <= 6); existing entries.test.ts updated.

Nice-to-have after: Automation checklist rewrite, first-use coachmarks consolidation, HUD label fixes (PUE headline replaced by "Cooling cost: 1.2x", rename "0" badge).
