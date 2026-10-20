# M4b-T1 — agent-sim: path affinity, a Foreman that respects reach, memo cadence
Owns `packages/sim/**` (not `api.ts`) and `tools/sim-cli/**`.

1. **Affinity:** keep raw points per path in state (snapshot v7, with a migration from v6). Points come from:
   - **Memos:** an `affinity` effect adds `amount`.
   - **Research:** a researched node with `path` adds +3 to that path. Content gives each path's branch flavour through `path` or a `TechBranch`; also count nodes whose tech unlocks a facility of that path's kinds.
   - **Facilities:** per hour, by what is running. Organoid and bio kinds count toward biotech; solar, wind, heat_export and carbon toward greentech; racks with `unlockTier` ≥ 4 (non-bio) toward synthetic. Each running facility adds 0.01 per hour.
   
   `view.affinity` reports shares (each path's points over the total; all 0 when the total is 0).
2. **Foreman reach:** place only on floors a bot can reach: the bot's floor, a floor served by a lift whose shaft connects to the charger floor, or any floor for flying bots if one exists. Count the floor as reachable through any chain of lifts. If nothing is reachable, place nothing and don't loop. Add tests.
3. **Memo cadence:** respect `balance.events.intervalTicks` as is; content will raise it. Nothing else needs to change.
4. **Tests:** affinity accrual from each source, the migration, determinism, and the Foreman reach rule.
