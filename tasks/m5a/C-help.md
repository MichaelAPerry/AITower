# M5a-C: help mode, Encyclopedia, world name tags
Owns `packages/ui/**`, `packages/render/**` (name tags only) and `e2e/smoke.mjs`.

1. **Help tooltips ("?"):**
   - **The control:** one "?" button in the top strip (key `?` or F1) toggles help mode.
   - **In help mode:**
     - Hovering any HUD region shows a plain-language tooltip with a "More…" link to its Encyclopedia entry.
     - The regions include each top-strip stat, the build dock, each drawer tab, the Goals card, NEXT, the inbox, and the speed buttons.
     - Regions get a faint dashed outline.
   - **Outside help mode:** the top-strip stats still show a short `title`-style tooltip after a hover delay, using the same text from one shared map.
   - **The text:** keep it in one data module, e.g. `help/helpText.ts`.
2. **Encyclopedia drawer (key `K`; also reachable from the "More…" links and the Esc menu):**
   - **Search box** at the top.
   - **Sections:**
     - Basics: how money works, contracts (training vs inference), power, cooling and heat, coolant loops, lifts and bots, spare parts, research, Level, Reputation, memos and the Compute Authority, paths and Ascension, automation.
     - Facilities: auto-generated from content, with name, description, cost, stats, unlock, and "Needs: power / coolant / …".
     - Bots, Research.
     - Glossary: PF, PFLOPS, kW, MW, CDU, CRAH, PUE, uptime, and others.
   - **Write-ups:** the Basics are hand-written, 2 to 5 short sentences each, with real numbers pulled from content and balance where useful.
   - **Locked items:** show what unlocks them, without spoilers for horror content beyond its name.
   - **Spec cards:** a facility's spec card gets a "?" or "More…" link to its entry.
3. **World name tags (render):**
   - **Always:** a tiny label above each facility type cluster or on hover in the world, using the content name. Bots and lifts get a hover label too.
   - **Broken things:** a small status glyph with a word ("NO POWER", "HOT", "BROKEN", "IDLE") above any facility that isn't ok. NEXT already explains why; this shows *where*.
   - **Constraints:** keep it calm. It respects the existing label/overlay toggles, adds no per-frame allocations, and stays within the bundle budget.
4. **Tests:** helpText covers every region key; the Encyclopedia search and generation are pure and tested; render label selection is pure and tested. Update e2e.
5. **Screenshots** to the scratchpad `m5a/` folder: help mode on, the Encyclopedia open on a facility, the name tags in the world. Look at them yourself.
