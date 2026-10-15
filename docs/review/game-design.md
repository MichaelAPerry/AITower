# AItower: Game Design Review (gap analysis to 1.0)

Scope: README, BUILD_LOG, ARCHITECTURE §0/§8/§9, STYLE, `packages/content/src/data/*.json`, `packages/sim/src`, and two `sim-cli` runs (starter, 30 days, seeds 1 and 99).

## 0. Where the build stands

Strong simulation foundation: deterministic sim, thermal, power, coolant, jobs, bots, lifts, tiers. The *game* around it barely exists.

- Content is tiny: **11 facilities** (`facilities.json`: 3 racks, 3 cooling, 3 power, 2 logistics), **13 clients**, **1 bot** (rover), **1 scenario** (`starter`), 4 tiers (`balance.json` `tiers`).
- `packages/sim/src/progression/tier.ts` is the *entire* progression system. There are no events, no tech tree, no reputation, no research, no win or lose state beyond bankruptcy, and no paths.
- Backlog items 4 and 5 in BUILD_LOG (grid outages, heatwaves, tech tree, quarterly report, Ascension) are all unbuilt.

## 1. Core loop and pacing

**Minute-to-minute (now):** accept or decline offers, drop a rack, patch heat, restock parts. Reactive, with no strategic choices once the starter is stable.

**Sim-cli evidence (auto-player, accept-all):**
- Seed 1: cash $3.12M → $6.70M in 30 days. Seed 99: $2.96M → $6.60M. Both ended at tier 1.
- Revenue is lumpy: $0 on days 7, 12, 13 and 18 (seed 1) and on days 0, 1, 3 and 17 (seed 99), against single days of $857k and $564k. Energy is flat at ~$30–41k/day, so profit is driven by offer luck.
- The starter sits at ~50–80 PFLOPS and never reaches tier 2's 120 PFLOPS. The player must build. The auto-player never does, so the curve past day 30 is unmeasured.
- Penalties are spiky ($15–50k a day, e.g. $50,093 on seed 99 day 11) and failures run at 0–3 a day on 4 racks. That is a failure every ~12 hours per rack-pair, which is noisy but not yet a decision.
- Max rack temperature hovers at 60–66 °C, well under `okC` 80, so heat is not a threat in the starter. That removes the central tension on day 1.

**Hour 1:** the starter is cash-rich ($3M) and has nothing worth buying except racks, since only 3 rack types exist. Expect a quick dead-end: the tier-1 build menu is racks plus a few utilities.
**Hour 5:** reaching T2 (120 PFLOPS, 95% uptime, $250k reward) is trivial. T3 (400 PFLOPS, ~5 DLC racks plus chiller and CDU) is the first real puzzle. T4 (1200 PFLOPS, 99% uptime) has no new items to build with.
**Hour 20:** nothing. There is no content past T4, so the game ends in a plateau: cash accumulates with no sink, no goal and no failure pressure.

**Pacing risks:**
1. Tier rewards ($250k, $750k, $2M) are small against $3M starting cash and ~$150k/day income. Tier-ups feel unrewarding, so tie each to a *menu unlock and a Ministry audit*, not just cash.
2. The T1→T2 jump is gated by one number (PFLOPS) and the player can reach it by spamming `rack_air_gpu`. Gate with something that forces a new skill (a coolant loop, N+1 power).
3. No sink: with ~$100k+/day net and nothing expensive, money loses meaning by hour 2. Add loans, taxes, the Ministry "levy", and expensive late build items.

## 2. Progression: content lists needed for 1.0

### Trunk (T1–T4), shared

| Tier | Theme | New facilities | New hardware | New clients | Unlock gate |
|---|---|---|---|---|---|
| T1 Garage | Air | 2 (fire suppression, UPS-2) | 1 (rack gen-2) | 6 existing | start |
| T2 Hall | Liquid | 5 (CDU-2, dry cooler, 2nd lift, fibre patch bay, break room for bots) | 2 (DLC rack, switch) | 4 existing | 120 PF |
| T3 Campus | Immersion, grid | 7 (immersion tank, battery hall, substation, solar array, wind turbine, water tower, security) | 3 (immersion rack, TPU pod, network spine) | 3 existing | 400 PF + N+1 |
| T4 Citadel | Scale | 6 (bot foundry, 2nd generator hall, cold-plate lab, R&D lab, press office, bunker) | 2 (exascale pod, optical interconnect) | 1 existing | 1200 PF, 99% |

Totals needed: roughly **+20 trunk facilities, +8 hardware, +10 clients (about 23 total), +3 bots (drone, lifter, hauler), +3 scenarios** (starter, brownfield tower, island site). All of it is JSON; the engine barely changes.

### Tech tree (new, `content/techtree/*.json`)
- About 36 nodes: 4 trunk tiers × ~6 nodes, plus 3 paths × ~4 nodes each shown at T5.
- Currency: **Research Points** from R&D lab jobs and contract completions. Make R&D a *job kind* in `offers.ts` so it competes with paying work for rack time. That is the key tradeoff.
- Cadence target: one meaningful unlock every 15–20 min of play, with a build or new problem following each.

### The three paths (T5, one chosen; respec is costly)

Each needs about **8 facilities, 3 hardware types, 4 clients, 8 events, 1 resource, 1 hazard, 1 bot class, 1 ending.**

| | Biotech | Greentech | Synthetic Mind |
|---|---|---|---|
| Facilities | nutrient plant, sterile bay, organoid incubator, DNA vault, quarantine lock, bio-reactor, culling room, neural pit | district heat exchanger, algae façade, solar skin, wind mast, carbon capture, storage hall, drone nest, heat pipeline | cryo core, vacuum hall, continuity monitor, bot fab, mind lattice, ethics office, backup vault, upload chamber |
| Hardware | organoid rack, DNA archive, bio-NIC | photonic rack, neuromorphic rack, heat-pump rack | mind lattice, quantum memory, cryo rack |
| Resource | nutrient medium | carbon credits | continuity % |
| Hazard | infection / contamination | Dunkelflaute | identity drift |
| Win | Living Tower: self-healing, 100% bio racks | net-negative carbon, power N blocks | 1M minds at 99.999% continuity |

Verdict: Greentech is the safest to ship (it extends existing power and thermal mechanics). Biotech is the highest-value and riskiest (a new spreading field plus 37 °C ± 1 control). Synthetic Mind has the least gameplay-novel mechanics (mostly numbers), so give it the Brazil-style bureaucracy via ethics events. **Recommend shipping one path fully (Biotech) and two thinner, rather than three equal.**

## 3. Body-horror arc (required)

**Principle:** the building does not turn gory; it turns *administrative and organic*. Horror comes from forms, euphemism and creeping wrongness, never splatter. Copy stays dry Ministry prose ("Cabinet 4 has been reclassified as a resident."). Visuals: ducts gain a pulse, panel seams weep, fluorescent tubes become sphincter-pale, and tile-grid art gets a "flesh overlay" layer in `packages/render`. No gore sprites; show *things that were machines and aren't quite*.

**Mechanics it touches (all reuse existing systems):**
- **Nutrient medium:** piped like coolant (reuse the coolant net layer in `networks/rebuild.ts`), spoils over time, with a cost per day. Organoid racks need it as well as power.
- **Contamination field:** spreads like heat (reuse the air-field flux model in `thermal/airField.ts`) from organoid bays through ducts and conduits. A level 0–1 per cell: visual creep, failure-hazard multiplier, bot slowdown.
- **Organoid racks:** thermally *inverted*: too cold is also failure (37 °C ± 1). GPU waste heat can warm bio-bays, which is a real synergy and a real trap.
- **Staff / automaton mutations:** repair bots exposed to contamination gain traits: "Fleshed Rover" (faster repair, +hazard), "Tendriled Lifter" (carries more, can't leave its floor). Trade-off, not pure debuff.
- **The building grows:** at high contamination, empty slabs gain "growths" that act as free (unreliable) conduits or racks the player did not place.

**Tier-by-tier escalation (all paths, intensity differs):**

| Tier | Beat | Mechanic | Tone |
|---|---|---|---|
| T1 | None, only seeds: odd memos, a damp stain, a "Form 9-B: Wetware Pilot Programme" brochure | Cosmetic | Mild unease |
| T2 | Ministry mandates a "Wellness Biocompatibility Survey"; first flesh-coloured ducting | Tiny contamination events, bots report "smell" | Bureaucratic |
| T3 | Optional **Wetware Annex** unlock: the first organoid rack, nutrient pipe | Nutrient medium, 37 °C control | Seductive: big payoff |
| T4 | Contamination spreads; bots mutate; the Ministry classifies growths as "assets" and bills you | Spread field, mutation traits, quarantine locks | Dread |
| T5 | Path commit. The building grows; empty rooms are "occupied"; staff memos get strange | Growth entities, self-healing hardware | Uncanny |
| T6 (endgame) | Ministry and tower merge: forms self-file, lifts arrive before being called | Win-state animation | Surreal, calm |

**By path:**
- **Biotech (strongest):** the whole arc, mandatory. Win = Living Tower.
- **Synthetic Mind (strong, different texture):** horror is *identity* not tissue: hosted minds echo staff, bots start filing forms about themselves, "continuity" erodes into shared fragments. Flesh appears as *vestigial* bodies in the upload chamber.
- **Greentech (present, quiet):** algae façade overgrows, the "carbon-negative" ideal becomes a literal fungus layer; biomass is a *resource you farm* and only slowly turns on you. This gives a lighter, still-creepy option.

**Embrace vs resist (the key design lever):** every contamination level trades throughput for control.
- *Embrace:* organoid racks run at ~3× PFLOPS per kW; growths self-heal (no work orders); nutrient-sector clients pay premium; Ministry reputation rises ("Productive"). Costs: contamination hazard, mutation, lose lift and bot control, blocked ending options.
- *Resist:* sterile bays, quarantine locks, UV, bleach/cull rooms, bot sanitation. Costs money and PFLOPS but keeps SLAs and the "Clean Tower" ending.
- Make the choice reversible until contamination crosses a threshold (e.g. 40% of cells). After that, resisting is a losing arms race and the Ministry quietly stops sending inspectors.

**Taste rules:** never show a human body; no gore palette (stick to STYLE.md's putty, ochre, brass, plus one muted flesh pink); rely on text and sound (wet hum in the audio synth, `packages/audio`); the Ministry never acknowledges the horror.

## 4. Events and narrative

**Unbuilt: zero events.** Needed: a deterministic event scheduler (own RNG stream in `core/rng.ts`) plus a data file `events.json`.

Target ~60 events at 1.0:
- **Environmental (10):** heatwave (ambient +10 °C, hits chiller COP), cold snap, grid brownout, blackout, flood in basement, lightning strike, dunkelflaute, drought (water), supply-chain shortage, labour strike.
- **Operational (12):** GPU batch recall, firmware bug (class-wide failure), lift jam, fibre cut, cooling loop leak, bot malfunction, parts theft, ransomware, power surge, fire alarm, hot aisle fault, storage corruption.
- **Ministry (20):** quarterly audit, fire inspection, tax levy, form-in-triplicate delay, "Department of Misplaced Compute" claims a rack, mandatory rebrand, surprise promotion, memo about memos, reclassification, subsidy, leaked report, census. Each is a **Memo** with an APPROVE/DENY/FILE choice, so bureaucracy becomes gameplay.
- **Client (8):** contract cancellation, surge bonus, scandal, rival poaching.
- **Horror (10+):** per §3.

**Lose conditions:** bankruptcy exists. Add: Ministry shutdown (three failed audits), fatal-incident count, reputation floor, "contamination lockdown".
**Win / endings:**
- Per path: Living Tower, Carbon-Negative Exemplar, The Million Minds, each with a ~2 min ending sequence and epilogue memo.
- Plus a secret fourth ending: "Ministry Absorbed You", for embracing every compromise.
- A sandbox mode after the win.

## 5. Economy and balance risks seen in data

1. **Energy price 7.5 $/kWh is ~90× real** (BUILD_LOG accepted deviation). It was tuned for a 4-rack starter. At T3+ the bill will scale with MW; check that revenue per PFLOPS keeps up, or energy swamps late tiers.
2. **Reward scaling:** `reward` $250k/$750k/$2M but rack costs go $0.4M→$1.4M and the tier needs 3–10× more PF. Rewards are ~0.5 rack: irrelevant. Raise them ~5× or convert to permanent perks.
3. **Uptime gates 95/97/99%**: starter runs 92–100% with penalties of up to $50k a day. T4 at 99% will feel punishing with a ~12-hour failure interval. Provide redundancy tools or loosen failure rates (`failurePerDay` 0.2–0.25 on all racks).
4. **DLC rack economics:** 90 PF for $1.4M versus 20 PF for $0.4M (air). Air is 50 PF/$M, DLC 64 PF/$M, only 28% better while needing coolant, CDU and chiller. Air racks win until power density bites. Widen the gap, or add a space/power cap that makes density mandatory.
5. **One bot type and a shared rover speed of 0.25 tiles per tick** will bottleneck at higher rack counts; no bot upgrade path means the repair queue grows without bound.
6. **Offer RNG:** zero-revenue days are common. Add guaranteed minimum offers, or contract variance the player can hedge (retainers vs spot).
7. **No cash sinks:** see §1.
8. **Starter is almost solved:** max rack temp ~65 °C under an 80 °C ok threshold, so day 1 has no emergency.

## 6. Prioritised list

**MUST for 1.0**

| Item | Rationale | Size |
|---|---|---|
| Event system plus `events.json` plus Ministry memo UI | The game has no drama; this is the biggest gap | L |
| Tech tree and research currency | Core unlock cadence; no hour-5 goal otherwise | L |
| T2–T4 trunk content (+20 facilities, +8 hardware, +10 clients) | Menu is empty past T1 | L |
| Economy retune (rewards, sinks, rack ratios, offer variance) | Findings §1/§5 | M |
| Biotech path complete (nutrient, contamination field, organoids, ending) | Owner requirement and the flagship identity | L |
| Win/lose states: audits, shutdown, one ending | Without them there is no game | M |
| Starter difficulty pass (early heat pressure, scripted first emergency, tutorial memos) | Hour-1 retention | M |
| Brownfield scenario and a second scenario | Variety | M |
| Save/load plus quarterly report | Session length | M |

**SHOULD**

| Item | Rationale | Size |
|---|---|---|
| Greentech path (heat export, carbon credits, Dunkelflaute) | Second path, reuses power sim | L |
| Reputation per sector | Ties clients to choices | M |
| Bot classes (drone, lifter) and multi-lift routing | Late-game logistics | M |
| Fibre fabric and network factor | Missing from architecture §6 | M |
| Contamination visuals and audio layer in render and audio | Body-horror delivery | M |
| Loans, taxes and money sinks | Mid-game economy | S |

**COULD**

| Item | Rationale | Size |
|---|---|---|
| Synthetic Mind path (continuity, identity drift, ethics office) | Third path; mostly numbers plus text | L |
| Sandbox mode after the win | Replayability | S |
| Secret "Ministry Absorbed You" ending | Memorable | S |
| Respec and path switching | Costly; low demand | S |
| Code-split bundle (656 kB) | Polish | S |
| Quantised temperatures for cross-engine determinism | Only matters for shared saves | M |

## Final recommendation

Ship 1.0 as: **trunk to T4, tech tree, events and memos, Biotech complete with the body-horror arc, Greentech as the lighter second path, Synthetic Mind explicitly "coming soon".** That delivers the pitch with the horror at its strongest where the owner wants it.
