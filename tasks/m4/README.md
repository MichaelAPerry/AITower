# M4 — Automation, the Greentech and Synthetic paths, scenarios, juice, audio breadth

**Owner asks:**
- "Automate everything for ease of life, even building … all toggled on and off: research, bots, spare parts."
- M4 from `docs/ROADMAP_1.0.md`.

**Moved to M5 (release engineering):** the Web Worker sim, desktop packaging, and crash reporting.

**Run order: one agent at a time, Sonnet, frugal with tokens** (the owner has hit usage limits).
1. [T1 sim](T1-sim.md)
2. [T2 content](T2-content.md)
3. [T3 ui](T3-ui.md)
4. [T4 render](T4-render.md)
5. [T5 audio](T5-audio.md)

**Look and voice:** `docs/STYLE_SYNTHETIC.md` (synthetic world and HUD, Ministry voice). The horror taste rules in `tasks/m3/README.md` still apply. Greentech's horror is quieter and fungal; Synthetic's is about identity, never bodies.

## Contracts already in place (frozen; placeholders marked "M4")
- **`content/schema.ts`:**
  - Kinds `solar`, `wind`, `heat_export` and `carbon`; `FacilityDef.green` (`GreenSpec`).
  - Scenario fields `description`, `startingCash`, `startTier` and `sandbox`.
  - Endings `greenExemplar` and `millionMinds` (balance, optional); `Balance.green` and `Balance.automation`; the feature `foreman`.
- **`sim/api.ts`:**
  - The `setAutomation` command and `AutomationPolicy` (research / parts / bots / foreman).
  - Events: `earned`, `autoBuilt`, `autoBought`, `droughtStarted` / `droughtEnded`.
  - `SimView` fields: `pathScore`, `greenScore`, `refinement`, `drought`, `sandbox` and `automation`.
- **`shared`:** `Renderer.pushEvents(events)` and `GameStore.newGame(seed?, scenarioId?)`. The app wiring for both is done by the orchestrator.

## Rules
- **Scope:** write only in your owned paths. Don't edit contracts (report needs instead), and don't commit. Never run `git stash`, `checkout`, `reset` or `clean`.
- **No mistakes:** read before changing, test every behaviour, re-read your diff. `npm run check` must pass. Update your `AGENTS.md`.
- **Frugal:** don't re-read files you already know, and don't over-explore. Keep your report under 250 words.
