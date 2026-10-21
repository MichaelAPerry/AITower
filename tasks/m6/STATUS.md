# M6 status (handoff)

**Live on main:**
- M6 bug fixes (#18)
- M6.1 research tree (#19)
- M6.2 tier ladder and Foreman rules (#20)
- M6.3 advisors and decisions (#21)

**In progress on branch `claude/serene-ramanujan-ojshkh`: M6.4** (lesson engine, Lesson 1 "First Watt", Handbook, calm pass).
- Uncommitted work-in-progress was saved as "M6.4 lessons and Handbook (WIP)" commits.
- The agent was stopped at the owner's request (usage limit), so the work may be incomplete.

**To resume:**
1. Run `npm run typecheck && npm run check` on the branch and see what is unfinished.
2. Spec: `docs/mockups/m6-redesign.html`, section 05 and the M6.4 row in section 08.
3. Finish M6.4, then open ONE PR, then playtest with the owner before starting M6.5 or M6.6.

**Process rules learned:**
- Agents run with `isolation: "worktree"`, so the main checkout stays clean and the stop hook doesn't fire.
- One PR per playtest round.
- Lean verification: targeted tests plus one browser pass.
- Never run `tsc -b` (it emits .js files next to the sources).
- `perf.test.ts` is timing-sensitive under load.

**Remaining after M6.4:**
- M6.5: Lessons 2–6 and the Ops view.
- M6.6: graphics pass (direction A with B's lighting).

## Owner playtest notes (latest build): fix first, small
1. **Foreman builds a liquid-cooled rack, then puts an air handler next to it.**
   - Check whether that is intended. Liquid racks have `liquidFraction < 1`, so some of their heat still goes to air.
   - If so, the Foreman should cover that residual with existing air capacity, or say why ("residual 20% heat needs air").
   - If not, fix the cooling choice in `packages/sim/src/automation/foreman.ts` so the support it builds matches the rack's line.
2. **Advisor portraits and tips sometimes cover the build catalog and inspector.**
   - The strip must never overlap the build bar, catalog or inspector.
   - Move or shrink it while the catalog is open, or dock it elsewhere.
   - Files: `packages/ui/src/advisors/`, `packages/ui/src/build/`.
