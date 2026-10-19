# M2b-T4 — agent-render: failure feedback, off-screen alerts, new bots, rack variety

Read `tasks/m2b/README.md`, `packages/render/AGENTS.md`, `docs/STYLE.md` and the render code.
Respect the presentation options (reduced motion, CRT and colour-blind modes) and the frame budget.

1. **Failure feedback in the world:**
   - **Tripped rack:** a steam burst and a red strobe.
   - **Failed rack:** a wrench and sparks; above `thermal.tripC` or so, a small fire with smoke.
   - **Blackout:** facilities and floor lights on a power net with satisfaction 0 go dark, with emergency lamps. Brownout flickers.
   - **Coolant leak:** a coolant net with `loadKw > capacityKw` drips from its conduit cells, using `coolantNetOf`.
   - **Reduced motion:** static equivalents.
2. **Off-screen alert arrows:**
   - When a facility with status failed, tripped, unpowered or noCoolant is outside the viewport, show an edge arrow pointing to it, coloured by severity and stacked or grouped when there are many.
   - Clicking the arrow focuses the camera on it. Use the existing input and focus paths and follow how `markers.ts` does it.
3. **New bots** (`BotDef`):
   - **`flying`:** a drone with rotor animation. It is drawn at a fractional floor while in state `"flying"`, never in a lift.
   - **`carry > 1`:** a bulkier lifter with a crate stack when `carrying`.
4. **Rack and facility variety:** about 20 new facilities arrive in content: same kinds, new ids, `unlockTier` 2–4.
   - `cooling: "immersion"` racks get distinct art: a glass tank with bubbling fluid.
   - Higher `unlockTier` gets visibly grander detailing (more brass, gauges, punch-card hoppers), and different widths must still look right.
   - Use `def.color` and `def.accent`. Add a dev-fixture scene with each kind × tier × width so it can be checked.
5. **Tests:** pure helpers (arrow placement and clamping, which states trigger which effect, art selection), and the existing render tests stay green.
