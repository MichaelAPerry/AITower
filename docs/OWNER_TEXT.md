# Owner text: small lines to write or approve

Edit the text after the label, as in the dialogue files. Send it back and it gets put in the game. Your words win.

## 1. Starting game description

> Shown on the new-game screen under "Garage Cluster" (scenario `starter`). It is the only start with no description. The others have 2 or 3 sentences, e.g. Brownfield: "A half-built tower bought at auction with the debts attached. ..."
> What it really is: 3 floors on a 48-tile lot, a grid intake in the basement, 4 air-cooled racks, 1 air handler, 1 storage array, a parts depot, a bot dock with one bot, 4 spare parts, $3M in the bank, Level 1.

- [scenario.starter.description] Description: A small lot at the edge of the district with three floors, four air-cooled racks, one air handler and a storage array. $3M in the bank and a bot in the basement. The usual way to start.

## 2. Bankrupt ending: the achievement line

> Shown on the Bankrupt ending screen when the hidden achievement "Notice of Termination" unlocks for the first time (spec id `end_bankrupt_note`, not built yet). One or two short lines, narrator or one advisor. It should match the tone of the ending (the receiver, the locks, the red lamp).
> For reference, the achievement's own text is: "Run out of money for a full day."

- [end_bankrupt_note] narrator: 

## 3. Credits screen

> A credits screen is being added (title menu). Draft below. Change anything.

- [credits.title] Title: Credits
- [credits.design] Line: Game design and direction: (your name or handle as you want it shown)
- [credits.code] Line: Code: written with Claude (Anthropic).
- [credits.art] Line: Art: portraits, backdrops, endings and icon sheets generated with ChatGPT. Some in-game sprites drawn in code with Claude.
- [credits.inspired] Line: Inspired by SimTower. No code, art or text was taken from it.
- [credits.fonts] Line: Fonts: DotGothic16 and VT323 (Google Fonts, SIL Open Font License).
- [credits.quotes] Line: Quotes: each quote in the game names its author and source. Full list in the credits.
