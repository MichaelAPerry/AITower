# AItower Build Log

| Date | Phase | Item | Status |
|---|---|---|---|
| 2026-10-15 | 1 | Research & competitive analysis → `docs/RESEARCH.md` | ✅ |
| 2026-10-15 | 2 | Architecture spec → `docs/ARCHITECTURE.md` | ✅ v0.2 |
| 2026-10-15 | 3 | Briefing answered: TS + Pixi + React, 2D side-cut pixel art, plausible physics, lean vertical slice | ✅ |
| 2026-10-15 | 4 | Scaffold, frozen contracts, boundary checker, task specs | ✅ |
| 2026-10-15 | 4 | T1–T4 sub-agent work integrated; MVP playable in the browser | ✅ |
| 2026-10-15 | 5 | Cassette-futurism art direction (`docs/STYLE.md`), retro fonts, restyled content | ✅ |
| 2026-10-15 | 5 | T5 world-art pass (agent-render) + T6 HUD pass (agent-ui) integrated | ✅ |
| 2026-10-15 | 5 | Publishing: GitHub Pages workflow + claude.ai artifact build (`scripts/build-artifact.mjs`) | ✅ |
| 2026-10-15 | 6 | MVP merged to `main` (MichaelAPerry/AITower#1) | ✅ |
| 2026-10-15 | 6 | Ministry Induction tutorial (13 steps, `packages/ui/src/tutorial`) | ✅ |
| 2026-10-15 | 6 | 1.0 feature review by 4 Sonnet reviewers → `docs/review/`, combined into `docs/ROADMAP_1.0.md` | ✅ |
| 2026-10-16 | M1 | Foundations: contracts, then T1 sim, T2 ui, T3 platform, T4 render, T5 CI (see `tasks/m1/`) | ✅ |
| 2026-10-16 | M2a | Ministry memos, standing, game over, economy retune, title screen, tutorial rework, music v1 (see `tasks/m2/`) | ✅ |
| 2026-10-16 | fix | Playtest fixes: deploys unblocked, money trap removed, CURRENT ORDERS, short tutorial, paused commands apply at once | ✅ |

## Sub-agent assignments
| Task | Agent | Scope | Status | Tests |
|---|---|---|---|---|
| T1 | agent-sim | `packages/sim`, `tools/sim-cli` | ✅ integrated | 39 |
| T2 | agent-render | `packages/render` | ✅ integrated | 32 |
| T3 | agent-ui | `packages/ui` | ✅ integrated | 19 |
| T4 | agent-assets | `packages/content`, `packages/audio` | ✅ integrated | 30 |
| T5 | agent-render | art pass, `packages/render` | ✅ integrated | 35 |
| T6 | agent-ui | HUD art pass, `packages/ui` | ✅ integrated | 19 |
| M1-T1 | agent-sim (Sonnet) | queue-aware commands, save validation and migration, multi-lift bots, scale | ✅ integrated | sim 120+ |
| M1-T2 | agent-ui (Sonnet) | system menu, saves UI, settings, controls help, UX fixes | ✅ integrated | ui 85 |
| M1-T3 | agent-platform (Sonnet) | crash safety, save slots, settings persistence, frame budget | ✅ integrated | web 35 |
| M1-T4 | agent-render (Haiku) | presentation options (reduced motion, CRT, colour-blind) | ✅ integrated | render 59 |
| M1-T5 | agent-ci (Sonnet) | Biome lint, e2e smoke, bundle budget, code-split, CI jobs | ✅ integrated | e2e 7 steps |

All four agents hit an API usage limit once and were resumed from their saved work.

## Orchestrator integration notes
- **Boundary checker:** `scripts/check-boundaries.mjs` now allows `vitest` imports in test files (reported by agent-assets).
- **Contract clarification:** `api.ts` documents `BotView.x` as a fractional tile index (raised by agent-render).
- **Thermal fix:** `balance.json` `envelopeConductance` changed from 0.3 to 0.05. At 0.3 the building leaked too much heat outdoors (agent-sim).
- **sim-cli auto-player:** it now accepts only offers its idle capacity can serve.
  - Before: accepting everything over-committed the starter and lost about $5.8M to SLA penalties in 10 days.
  - After: cash goes from $3.0M to $4.85M over 15 days, PUE stays at 1.33–1.59, and energy is about 20% of revenue.
- **`apps/web`:** the opening camera now centres on the starter row; the build palette was hiding it.
- **Browser check (headless Chromium):** boot, day/night, overlays, accepting a contract (the job runs) and placing a rack all work, with no page errors.

## Accepted deviations (from the agent reports)
- **Energy price is in game dollars:** 7.5 $/kWh base, about 90× a real tariff, so energy cost matters against compressed revenue.
- **The CRAH draws 40 kW:** it stands for the whole air-cooling chain, so air-cooled PUE comes out worse than liquid, as in reality.
- **The starter includes a storage rack:** training jobs need dataset storage.
- **Tier 2 needs 120 PFLOPS:** the starter has 80, so the player must expand to progress.

## Backlog (superseded by `docs/ROADMAP_1.0.md`; kept for history)
1. `canBuild(cmd)` on `Sim` and `GameStore`, so slab, conduit and lift ghosts use the sim's real validation (agent-ui proposal).
2. Move sim literals (idle draw 15%, 8-rack training cap, refund %, bot battery thresholds) into `Balance.sim` (agent-sim proposal).
3. `submit()` validation that accounts for queued commands, so "build slab" then "place" works within one paused tick.
4. Fiber fabric and network factor, grid outages and heatwaves, tech-tree screen, quarterly report.
5. Ascension paths: Biotech, Greentech and Synthetic Mind (ARCHITECTURE §9).
6. Bot routes through more than one lift; quantised temperatures for lockstep determinism across JS engines.
7. Code-split the Pixi bundle (the main chunk is 656 kB).

## Publishing
- **GitHub Pages:** `.github/workflows/pages.yml` runs check and build on every PR. On pushes to `main` it also
  deploys to Pages.
- **claude.ai artifact:** run `node scripts/build-artifact.mjs`, then publish
  `apps/web/dist-artifact/artifact.html` with `assets/app.js` and `assets/app.css`.

## M1 integration notes (orchestrator)
- **Contracts first:** I made the contract changes myself, with placeholder implementations, so every agent started from a green tree.
- **Tutorial text:** its final memo now points to the system menu, where the INDUCTION button moved.
- **Save probe:** added a test that `decodeSave`'s first-tick check runs on a throwaway copy.
- **`git stash` incident:** agent-sim briefly ran `git stash` on the shared tree. All other deliverables were verified intact afterwards.
- **End-to-end check (14 points, Chromium):**
  - building in a paused tick
  - malformed commands rejected
  - the Esc menu pauses the game
  - save slot → reload → load gives an identical hash
  - settings persist across a reload
  - a bad import keeps the running game
- **CI concurrency:** superseded PR runs are cancelled; deploys from main always finish.
- **Bundle:** Pixi is not split into its own chunk. Split chunks became circular and broke at runtime, and a single Pixi chunk is over budget. The reasoning is in `apps/web/vite.config.ts`.

## M2a integration notes (orchestrator)
- **Agents:** three Sonnet agents (sim+content, ui, audio), cut from five to save tokens. The tech tree and T2–T4 hardware moved to M2b.
- **Bug found in the real-game browser check:** a fresh game sat at tick 0, paused behind the title screen and the induction, before power had ever been solved. Every rack showed "unpowered".
  - Fix: `apps/web` now settles new games by one ordinary tick (`freshSim`), and a test covers it.
- **Real-build checks (Chromium, 12):**
  - the title screen pauses the game and offers CONTINUE once a save exists
  - NEW GAME starts the induction
  - the clock stays paused while reading, and ✕ CLOSE resumes it
  - a real heatwave memo arrives and is answered
  - standing stays in range

## Playtest fixes (owner: "title never shows, tutorial thick as mud, money only goes down")
- **The live site was stale.** Pages deploys from the M1 and M2 merges had failed on a wall-clock perf assert (2.1 ms vs 2 ms on a shared runner), so the owner played the pre-M1 build.
  - Fix: CI timing budgets get 3× slack.
  - New rule: after every merge, verify the deploy run **and** that the live bundle contains the new code.
- **Money trap.** You could accept contracts your racks could not serve, and queued inference was charged SLA penalties from acceptance. In a sim of an accept-everything player, penalties were $200–500k a day against $0 revenue.
  - Acceptance now requires the job to start on idle racks and free storage (`acceptCheck` mirrors `allocateRacks`), with plain reasons.
  - SLA penalties apply only after a service has started.
- **No income for days.** Training paid only on completion. It now bills 80% at checkpoints and the rest on completion.
- **Paused dead end.** Commands queued while paused never applied, so the tutorial waited forever after ACCEPT.
  - New contract method `Sim.flush()` applies queued commands at once. It is equivalent to the next tick's command stage and hash-identical, which is tested. The store uses it while the game is paused.
- **CURRENT ORDERS:** an always-visible strip with the next step (accept a fitting offer, buy parts, answer an urgent memo, build toward the next clearance) and today's income against costs.
- **Contracts table:** each offer shows "Fits your idle racks" or "Can't start: <reason>", and ACCEPT is disabled when an offer can't start.
- **Bottom-panel tabs:** clicking the open tab no longer collapses the panel.
- **Tutorial:** 15 memos (about 670 words) cut to 9 of at most 40 words each, enforced by a test. It points at CURRENT ORDERS, and the memo avoids covering the strip.
- **Verified in the real build:** a new-player journey (title, induction, accept the highlighted offer, the job starts, the steps advance, money rises over two days with zero penalties). e2e now follows the same path.

## Liquid-cooling report (owner: "the liquid cooled computes don't seem to work")
- **The sim was correct.** With a chiller, a CDU and liquid racks on one coolant pipe, the racks cool (about 32 °C) and run jobs. Nothing told the player *why* a cabinet sat dark, though: idle, a pipe not reaching a chiller or CDU, or an unpowered chiller.
- **Diagnosis everywhere** (`packages/ui/src/objective/diagnose.ts`):
  - Every non-working rack now has a one-sentence reason and fix in its dossier: no pipe, a loop missing its chiller or CDU, a chiller or CDU without power, a loop over capacity, idle with no job, broken.
  - CURRENT ORDERS raises "N compute cabinets can't run" with the reason, ahead of contract advice.
- **Clearance hint:** once unlocked, liquid cabinets are offered alongside air ones, and idle cabinets are counted.
- **Second money trap closed.** A training job could be accepted onto the one rack left idle and was then certain to miss its deadline (penalty). Acceptance now requires the racks the job would get to finish it within 90% of the deadline. Otherwise the offer shows "too slow for the deadline: your idle racks (X PF) need about N h, the deadline allows M h".
- **Verified in the real build:** a save with F1 liquid racks on a pipe that reaches nothing shows the alert and the dossier reason. Laying the joining pipe cools the racks and clears the alert. Auto-player over 15 days on 3 seeds: cash $3.0M → $5.2–5.6M.

## M2b: research, Contracts Clerk, credit and audits, T2–T4 trunk, failure feedback
- **Owner ask:** "automate accepting contracts, but keep a challenge". The **Contracts Clerk** is the first research node (180 RP, about 0.75 of a full starter day), so early accepting is manual. The clerk follows a standing order (job kinds, minimum $/PF·h, maximum penalty, liquid allowed) and keeps 6 % of what its jobs earn.
- **The challenge moves to decisions the clerk can't make:**
  - research choices: 36 nodes in 5 branches, tiers 1–4, about 83 days for the whole tree
  - the Credit Office (loans at 0.5 %/day) and the 12 % levy on daily profit
  - quarterly audits, graded A–E, with standing and a grant or fine
  - early heat pressure: on a hot afternoon four racks and one CRAH sit close to throttling
  - a scripted day-2 heat alarm
  - memo trade-offs between cash and standing
- **Agents (Sonnet ×4):**
  - **sim** (`tasks/m2b/T1-sim.md`): RP, perks, gating, clerk, loans and levy, audits, lifetime stats, scripted events, flying and carrying bots, snapshot v4 with a v3 migration.
  - **content** (`T2`): the tech tree, 20 facilities including 8 rack types (immersion among them), drone and lifter, 10 clients, 7 events, balance values.
  - **ui** (`T3`): the Department of Research (R), the clerk's standing-order form, the Finance tab (ledger, Credit Office, audits, lifetime record), the audit sheet, and gating in the palette.
  - **render** (`T4`): visuals for trips, fire, blackouts, brownouts and leaks; off-screen alert arrows; drone and lifter art; immersion tanks and tiered detailing.
- **Orchestrator:**
  - The contracts first, with placeholders, so every agent started green.
  - Content validation of minimum art widths (raised by agent-render).
  - The bot rows in the stores panel wrap instead of overflowing.
  - e2e now opens the research sheet.
- **Balance check (auto-player, 30 days):** profitable ($3.1M → $7.5–7.9M), all audits graded A. Standing drifts down only because the auto-player always picks the most cash in memos (memos −105 against jobs +44, daily +26, audits +20). Picking for standing instead gives 100 standing and half the cash. That trade-off is the challenge.
- **Real-build check (Chromium, 15 points):**
  - R opens the research sheet and pauses the clock; filing the clerk spends the RP; Esc resumes.
  - The clerk switches on and accepts 11 contracts in 7 days.
  - A loan is drawn.
  - The first audit (grade A) shows its sheet, and Esc closes it.
  - The scripted heat alarm arrives on day 2, and lifetime stats fill in.
  - No page errors.

## M3: the Biotech path, the body-horror arc, the Calm HUD, the synthetic look
- **Owner decisions this milestone:**
  - Declutter the HUD ("too much going on … text no one reads").
  - Move from cassette-futurism to a clean **synthetic** neutral look, for both world and HUD (`docs/STYLE_SYNTHETIC.md`).
  - Each path reskins every device at 25 / 50 / 75 / 100 % of its path score. Biotech turns fleshy (score = corruption); Greentech grows fungus, plants and fish; Synthetic gets more refined (both M4).
  - Keep three paths, and keep standing in the top bar.
- **Agents (Sonnet), run one at a time after five parallel agents hit the usage limit twice:**
  - **sim:** nutrient network, organoid incubators, contamination field, quarantine and sterile bays, mutations, growths, corruption, `choosePath`, three endings, snapshot v5.
  - **content:** 8 biotech facilities and 3 growths, a wetware tech branch, Clearance 5, 4 bio clients, 25 memos running from early seeds to horror, paths and endings.
  - **ui:** the Calm HUD (`tasks/m3/T4b-redesign.md`, mockup in `docs/mockups/`).
    - a top strip with PER HOUR and standing
    - a NEXT chip, a one-line ticker, and memo stamps with costs as numbers
    - the C/R/F/I drawers and a build dock
    - the Wetware tab, nutrient tool, Ascension sheet, ending copy and diagnosis
  - **render:** the synthetic base look and the stage system with the Biotech stages, plus wetware art, the nutrient layer and the contamination overlay.
  - **audio:** corruption layers on the tape chain, tier 2–3 tracks, and 10 stingers with ducking.
- **Orchestrator fixes found in the real build:**
  - **Organoid incubators were unplayable.** Tissue used the GPU heat formula, so a new incubator in a normal room died on its first tick, and again after every repair. Incubators now regulate (+25 °C / −6 °C around the room air) and die only when settling outside ±3× tolerance (for example a power cut). Tests cover both.
  - **Nutrient piping** now needs the research that unlocks the nutrient plant.
  - **Speed buttons:** the old key-cap CSS crushed them in the new strip.
  - **Bundle:** audio moved to its own chunk, and the budget rose to 1.45 MB because the path added content.
- **Real-build checks (Chromium):**
  - the induction walks all 9 steps, each with its highlight
  - the strip shows PER HOUR and standing
  - C/R/F/I open their drawers
  - a Clearance-5 save offers FORM A-5; choosing Biotech sets the path and shows the growth gauge
  - an organoid bay holds 37 °C for 3 days
  - the offline `AItower.html` runs from `file://`
  - no page errors
- **Notes:**
  - Overlay keys are now O (coolant), U (nutrient) and G (contamination). R opens the Research drawer, and the full sheet is a button inside it.
  - **M4 carries:** the Greentech and Synthetic stage art, the Greentech growth score, and a per-hour value that ignores construction.

## M4: automation, the Greentech and Synthetic paths, scenarios, juice, audio breadth
- **Owner ask:** "automate everything for ease of life, even building … all toggled on and off". It became the **Automation drawer (T)** with these standing orders, each toggled on its own and checked once per game-hour:
  - **Research** (branch priority)
  - **Spare parts** (keep N in stock)
  - **Bots** (one per N racks)
  - **Works Foreman** (auto-build): a Clearance-1 research unlock. It fills slab you have already built, with racks, air handlers, power, chargers and depots, keeping a cash reserve and building at most one facility per hour.
  - **Contracts Clerk**
  
  The Foreman never builds floors or conduits; that is the next big chunk.
- **Agents (Sonnet, one at a time):**
  - **sim:** automation, solar, wind, Dunkelflaute droughts, heat export, carbon credits, green and refinement scores, `pathScore`, two new endings, scenario options, `earned` events, snapshot v6.
  - **content:** 9 Greentech and 4 Synthetic facilities, 18 research nodes, 14 events, the Brownfield and Sandbox scenarios, the endings text, and all three paths available.
  - **ui:** the Automation drawer, the scenario picker and opening crawl, the path gauges, a drought chip, a SANDBOX badge, and ticker coalescing.
  - **render:** Greentech stages (moss → fungus and vines → plants and fish tanks → garden) and Synthetic stages, green facility art, the drought sky, "+$" floaters and build puffs.
  - **audio:** spatial one-shots, floor ambience, Greentech and Synthetic music layers, and event cues.
- **Orchestrator:**
  - **Contracts first, plus app wiring:** `newGame(seed, scenarioId)` and `renderer.pushEvents`.
  - **The Foreman's first version over-built into a Ministry shutdown.** Sent back: it is now maintenance-aware (it waits while the crew lags, uptime is low or a day lost money, it builds chargers and depots, and it leaves room for an air handler). That rework also found an old bug: bots could never repair basement racks.
  - **Works Foreman moved to Clearance 1:** at Clearance 2 an automated run could never reach it.
  - **My mistake:** I discarded the content agent's uncommitted `tech.json` with a checkout, thinking it was formatting noise. The agent restored all 18 nodes and I verified them (63 nodes). Rule: inspect a diff before reverting anything.
- **Checks:**
  - 1,170 tests pass, along with the budget and e2e.
  - Real build: 3 scenario cards; the crawl shows and Esc skips it; Brownfield starts; the T drawer toggles research and parts; automation acts by day 3; no game over and no page errors.
  - `sim --auto` over 30 days: the Foreman built 17 facilities, reaching Clearance 2 with $10M and 98.7 % uptime.
- **Moved to M5:** the Web Worker sim, desktop packaging, crash reporting, and the Foreman expanding floors and conduits. Also later: per-unit solar and wind output for the art, and the camera position for spatial audio.
