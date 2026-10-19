# M2b-T3 — agent-ui: Research screen, Contracts Clerk, loans and finance, audits, stats

Read `tasks/m2b/README.md`, `packages/ui/AGENTS.md` and `docs/STYLE.md` (cassette-futurist bureaucracy: index cards, rubber stamps, Dymo labels, phosphor CRTs, toggles), plus the new parts of `sim/src/api.ts` and `content/src/schema.ts`.
- **Data:** until the sim and content agents finish, the view holds placeholder values and `content.tech` is empty. Build and test against `src/dev/fakeStore.ts`, which you own; give it tech nodes, a clerk, a loan and a report.
- **Rules:**
  - Every new control works by keyboard and has a `title`.
  - Nothing overlaps CURRENT ORDERS or the memo slip.
  - Plain English first, Ministry flavour second.

## 1. Research
- **Opening it:** a top-bar button shows the RP count, and **R** opens a full-screen "DEPARTMENT OF RESEARCH" sheet. Esc closes it.
- **Layout:** five branch columns. Each node is an index card with:
  - name, cost and branch
  - effects in plain words: perks as "−10 % failure rate"; features; and "Unlocks: <facility/bot names>", found by scanning `content.facilities` and `content.bots` for `tech`
  - prerequisites
  - a state: researched (stamped FILED), available, too expensive, or locked (tier or prerequisite, with the reason)
- **Action:** RESEARCH dispatches `{type:"research"}`.
- **Pause:** the sheet pauses the clock while open and restores the previous speed on close. Follow how the menu does this.
- **Build palette:** items whose `tech` isn't researched are shown disabled with "Requires research: <name>". Use `canBuild` and `content` to decide.

## 2. Contracts Clerk (Contracts tab)
- **Locked:** a slip reading "Hire a Contracts Clerk: research <node name> (N RP)".
- **Unlocked:** a compact standing-order form that dispatches `setClerk` on each change:
  - an ON/OFF toggle
  - a checkbox per job kind
  - min $/PF·h
  - max penalty (0 = any)
  - allow liquid
  - the fee %, and the count accepted so far
- **Offer rows:** each shows its pay rate (`payPerPflopHour`) and whether the clerk would take it.

## 3. Finance tab, audits and stats
- **Loans:** principal, limit, daily rate and interest per day, with TAKE and REPAY buttons (preset amounts: 25 %, 50 %, all of the remaining limit or principal).
- **Ledger:** add the columns taxes, interest and fees, everywhere the ledger is shown.
- **`moneyToday` and CURRENT ORDERS:** include taxes, interest and fees.
- **Quarterly report:** on a `quarterReport` event, a modal "QUARTERLY AUDIT" sheet with the figures, a big grade stamp, the standing and cash change, and the remark. It doesn't pause, and closes with a button or Esc. Past reports are listed in the Finance tab.
- **Lifetime stats:** shown in the Finance tab and on the game-over screen.

## 4. CURRENT ORDERS and wording
Add these rules, keeping the order sensible and the tests:
- research is affordable: "File a research request (R)" naming the cheapest available node
- the clerk is unlocked but off
- cash < 0 with loan headroom: mention the Credit Office

Also word the new events in `events.ts` properly; placeholders are there now.

## Tests
Cover the pure logic (node state, effect text, clerk-would-take, loan presets, `moneyToday`) and the components' key interactions (dispatches).
