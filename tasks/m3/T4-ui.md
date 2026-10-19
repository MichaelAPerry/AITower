# M3-T4 — agent-ui: Wetware tab, nutrient tools and overlays, Ascension sheet, endings, diagnosis, corruption

Read `tasks/m3/README.md` (taste rules), `packages/ui/AGENTS.md`, `docs/STYLE.md` and the M3 parts of `sim/src/api.ts` and `content/src/schema.ts`.
Build against `src/dev/fakeStore.ts`, which you own; give it biotech defs, a nutrient net, contamination and a path. The Ministry never acknowledges the horror in copy, and `horrorIntensity: "off"` switches to plain wording.

1. **Build palette:**
   - a **Wetware** tab for category `"bio"`
   - a **nutrient conduit** tool next to power and coolant (same drag behaviour, cost shown)
   - overlay buttons and keys for `"nutrient"` and `"contamination"`; pick free keys and document them in the controls help
2. **Diagnosis** (`objective/diagnose.ts`):
   - `noNutrient`: no pipe / the net has no nutrient plant / plant unpowered / net short.
   - `tooCold`: put it near warm racks or heat the room.
   - Organoid band text, contamination at the rack, grown facilities ("Unregistered asset"), mutated bots in the bot dossier.
3. **Ascension sheet:**
   - When tier ≥ `balance.ascension.minTier` and `view.path` is null, CURRENT ORDERS says so and a modal "FORM A-5: ASCENSION" sheet lists `content.paths`.
   - Unavailable paths are stamped COMING SOON.
   - Choosing one asks for confirmation (it is irreversible), then dispatches `choosePath`.
4. **Endings:** the game-over sheet shows `content.endings` text for `gameOver.ending` (victory with livingTower or cleanTower; `absorbed`), and handles kind `"absorbed"`.
   CURRENT ORDERS shows `view.endingProgress` ("Living Tower: 2 of 3 days").
5. **Corruption in the HUD:** a small top-bar gauge labelled in Ministry euphemism ("ASSET GROWTH INDEX") that appears once corruption > 0 or tier ≥ 3. The memo slip gains a subtle stain at high corruption (unless intensity is off).
   Word the new events properly in `events.ts`.
6. **Tests:** cover the pure logic and the key interactions (choose-path confirm and dispatch, ending copy selection, the overlay keys, diagnosis rules).
