# M3-T4b — agent-ui: Calm HUD redesign (supersedes the layout parts of M3-T4)

Owner feedback: "too much going on at one time … more text that no one reads". It's a clicker, so the world comes first.
The approved mockup is `docs/mockups/calm-hud.html` (open it in a browser). Owner decisions: **standing stays in the top strip**; start now.
Your earlier M3-T4 work in `packages/ui` (partly done: Wetware, nutrient tool, Ascension, endings, diagnosis, corruption gauge, memo stain) folds into this layout. Finish it inside the new structure, and don't build anything twice.

## Layout (match the mockup)
1. **Top strip only:**
   - DAY and clock
   - speed
   - TREASURY
   - **PER HOUR**: income per game-hour, rolling over about the last 6 game-hours from `view.ledger` / `view.history`; define it in a pure tested helper
   - a **Clearance progress bar** (PF installed / needed, plus the uptime state)
   - **STANDING**
   - INBOX stamp with a count
   - MENU
   - the corruption gauge (euphemistic label), only once corruption > 0
   
   PUE, IT load, uptime detail, outside temperature, grid price and the modifier chips move to the Gauges drawer.
2. **NEXT chip:** one line from `currentObjective` (short title plus the key to press). The detail goes in its tooltip.
3. **Ticker:** one line at the bottom of the world, a count badge, and a click opening the alert log.
   - Stop toasting events the game handles itself: `componentFailed` while parts are in stock, `repaired`, `jobStarted`, `rackRecovered`, routine `contractOffered`.
   - Keep real problems: no parts, a job failed, a power shortfall, bankruptcy risk, an urgent memo.
4. **Memo slip:**
   - A headline plus 2–3 stamps whose effects show as compact numbers and icons, derived from `choice.effects` (for example "−$160k · ★−4", "2 racks fail").
   - The prose sits behind "read memo".
   - Only urgent memos pop up (expiring within about 12 game-hours, or ones that fail racks or cost more than 10 % of cash). The rest just raise the inbox count.
5. **Drawers on hotkeys, one open at a time, along the right edge:**
   - **C Contracts:** offers, plus running jobs; the clerk is one line with Edit.
   - **R Research:** only what is affordable or close, with a button for the full Department of Research sheet.
   - **F Finance:** today, the Credit Office, audits, the record.
   - **I Gauges:** instruments, overlays (including nutrient and contamination) and modifiers.
   
   The bottom panel goes away; Jobs and Alerts move into Contracts and the ticker log.
6. **Build dock:** bottom left, showing the 3 most useful builds for the current state (a pure tested helper; for example a rack when idle capacity is short, a CRAH when racks are hot, parts when the cage is empty). They glow when affordable. "More" opens the full palette (all categories, Wetware included) as a popover.
7. **Rules for all of it:**
   - Text is minimal: numbers, colour states and icons first.
   - Every colour, font and size comes from CSS tokens, because a later restyle to a cleaner neutral "synthetic" look must be only a token swap. No literals in components.

## Keep working
- **Tutorial:** update its targets and wording to the new layout, keeping each step at 40 words or fewer.
- **e2e:** keep `e2e/smoke.mjs` passing (you may edit that file) and all existing behaviours (menu, saves, settings, the research sheet, the audit sheet, the clerk, loans).
- **Tests:** cover the pure helpers (per hour, dock picks, memo effect chips, urgency, ticker filtering) and the key interactions.

## Rules
- Write in `packages/ui/**` and `e2e/smoke.mjs` only.
- **Be frugal with tokens:** the owner hit usage limits twice. Don't re-read files you know, and don't over-explore.
- Finish with `npm run check` and a report under 250 words.
