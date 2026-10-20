# M4b-T3 — agent-ui: palette and spec card fixes, title layout, the voice in the UI, the path from affinity
Owns `packages/ui/**` and `e2e/smoke.mjs`. Follow the voice guide in `tasks/m4b/README.md` for all UI copy.

1. **Build palette:**
   - **LOGIS** must list the logistics facilities (depot, charger and the rest; check the category filter).
   - **WETWARE** items must not end up at the bottom of other tabs. Sort each tab by unlock tier, then cost, with locked items after unlocked ones.
   - **Locked rows** must stay readable: a single "Locked: <research>" line, with no overlapping text.
2. **Spec card (hover):**
   - It **always** appears next to the hovered row, to the right of the palette and vertically aligned with the row, clamped to the viewport.
   - It is opaque and high-contrast (synthetic tokens) and never covers the build dock or the hovered item.
   - The same applies to the dock and More popover rows.
3. **Title screen:**
   - The panel is centred and never clipped at any width (test 1280 to 2560).
   - The scenario cards wrap their text.
   - Rename the copy per the voice guide: no "Ministry induction" (use "Tutorial"), no "Form 0", and so on.
4. **HUD copy:** apply the voice guide everywhere the UI writes words. "Dept. of Provisioning" becomes "Build", "Stores requisition" becomes "Supplies", plus the drawer titles, Ministry → Compute Authority, and the tutorial and ticker wording.
5. **Path from affinity:**
   - Show three small affinity bars (in the Gauges drawer and on the Ascension sheet).
   - At Clearance 5 the Ascension sheet pre-selects the leading path, so the player just confirms; they can pick another.
   - Memo stamps show the affinity effect as a coloured path chip.
6. **Lift tool:**
   - Dragging from an existing lift shows the extension cost (new floors × per-floor, with no base fee).
   - Diagnosis: floors with facilities but no lift reach get a NEXT hint, "F7 has no lift access: extend a lift".
7. **Tests:** pure helpers and the key interactions. Keep e2e green.
