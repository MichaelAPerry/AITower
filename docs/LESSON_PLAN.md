# Lesson plan (proposal for the owner)

## 1. What exists, and the star gap
1. Your First Rack (Bea): place a rack, grid intake, air handler; run 3 h. Teaches kW, heat, PUE.
2. Earn Your Keep (Luci): accept inference, storage array for training, spare parts, a bot.
3. Grow the Tower (Mel): research two techs, reach Level 2, switch on the Foreman.
4. The Three Trees (Bea): retrofit one rack to Green, open the Trees panel, add solar, earn first points.

Stars: the sim awards 1 + headroom star + no-blackout star, but only when `starred` is not false. In lessons.json ALL FOUR are `starred:false`, lesson 1 included (HANDOFF is wrong about lesson 1). So every lesson pays exactly 1 star. The two star rules (headroom %, dark minutes) are power-only, so they mean nothing for lessons 2-4. Progress is saved by lesson id (`aitower.lessons.v1`, best stars), so renumbering is safe.

## 2. Gaps, worst first
1. Liquid cooling (chiller, CDU, coolant conduit, LC rack). Air racks cap out; Level 2 opens plumbing. No lesson touches it.
2. Outages and backup (UPS, genset, grid trip). Brownout events hit early; nothing prepares the player.
3. Money health: loans, quarter audit grade, contract penalties, Level uptime targets.
4. The retrofit loop: lesson 4 teaches rung 1 only. Climbing needs Level + research + cash + a coolant/nutrient site.
5. Structure: slabs, conduits, lift, upper floors. All lesson halls are pre-built; the player never lays a slab or conduit.
6. Advisor decisions/memos, logistics (depots, chargers), heat/power overlays. Lower pain; fold in as asides.

## 3. Proposed list (existing 1-4 keep their numbers; append 5-8)
Existing lesson 4 becomes not-last: reword Bea's "Last lesson" and its outro. Lessons 5-7 are independent of each other; 8 needs 4.

**5. Going Liquid (Cass)**. Goal: run a liquid-cooled rack on a coolant loop.
Steps: build coolant conduit under the row; place Chiller; place CDU; place LC-2 rack; watch it run hot-and-fine; open the Heat overlay.
Done: new metric `liquidRacks` >= 1 and racksBusy for a 3 h hold, maxRackC < 80.
Stars: 2 = PUE below a target at the end; 3 = no rack throttled/tripped. 
Setup: new scenario `lesson_liquid` (Level 2, tech `chilled_loop` done). New metric `liquidRacks` (small); commands add `buildConduit`; scenario small, content medium overall.

**6. Lights Out (Bea)**. Goal: ride through a grid trip with no dark racks.
Steps: place Battery Bank; place Diesel Genset; open Power overlay; a scripted beat trips the grid (`gridCap` factor 0, exists); watch UPS then genset take over; grid returns.
Done: win = racksDark <= 0 held through the outage; new metric `backupUnits` (UPS+genset count) >= 2 as a step.
Stars: 2 = zero dark ticks; 3 = battery never fully drained (new metric `upsMinPct`, medium) or just cash kept above a floor (small alternative).
Setup: beat uses existing `gridCap`; add `gensets` already a metric. Size: small to medium.

**7. The Books (Luci)**. Goal: finish a quarter with a passing audit.
Steps: take a small loan (`takeLoan`); accept a contract with a deadline/penalty, read the penalty line; repay the loan; open Insights; wait for the quarter report.
Done: new metric `auditGrade` (0=none, 1=fail ... ) >= pass, and loan repaid (new metric `debt` <= 0).
Stars: 2 = grade B or better; 3 = no penalty paid (new `penalties` metric or compare cash).
Needs: commands `takeLoan`, `repayLoan`, `acceptContract`; a quarter-length lesson (90 days?) is too long, so either shorten the lesson's audit via a lesson balance override or script a beat that triggers an early audit. Size: medium-large, the riskiest.

**8. The Climb (Mel, with Bea)**. Goal: take one rack two rungs down a tree.
Steps: research the rung-2 tech; confirm Level; retrofit rung 1 (recap); retrofit again to rung 2; read cost shown in the panel (new minus half old); watch compute rise.
Done: new metric `treeRung` (highest rung among tree racks) >= 2.
Stars: 2 = finish with cash above start; 3 = two racks at rung 2 (`treeRacks`>=2 and rung 2).
Setup: scenario `lesson_climb`: Level 3, research partly done, rich enough. Content wording must stay neutral: say "tree", "rung", "line", not what the trees lead to. Size: small to medium.

Optional later: Structure lesson (slab, conduit, lift, second floor), needs build commands and a bare scenario, medium.

## 4. Fixes to existing lessons
- Stars: set `starred:true` on 1-4 and replace the fixed two-rule star block with per-lesson star conditions (LessonCond lists, `stars2`/`stars3`) in schema, sim lessonStars, resultModel rows. Medium (schema, sim, UI result, tests).
- Suggested star rules: L1 headroom >= 10% and no dark minutes (already works); L2 both jobs paid and cash up, no stalled-storage minute; L3 finish within N days, Foreman on with no cash dip below reserve; L4 retrofit plus Green SP above a threshold, or clean power built before first points.
- Lesson 4 text: Bea's line "That's the world, you idiot" reads odd; "Last lesson" and "That's everything I've got" must change once more lessons follow. Lesson 3 outro "Where it goes is up to you" hints at plot slightly; soften.
- Lesson 4 never explains cost, Level and research gate on the next rung: moved into lesson 8.
- Lesson 2 outro and 3 intro chain by name; check once order is final.

## 5. Spoiler check
Nothing proposed mentions the seal, closing/sealed trees, residue, advisor bonds, SP targets, endings or epilogues. The word "tree" and rung ladders are already in lesson 4, which stays. Lesson 8 only says rungs cost money, Level and research. Cass, Luci, Bea speak only on cooling, power, money, as in VN_WRITING. Seal and bond remain taught by the one-time tips `tip_seal` and `tip_bond`. Retrofit-closing rules ("a tree that is not closed") must not appear in lesson text.

## 6. Build first
Lesson 6, Lights Out. Reasons: it uses mechanics the sim already supports (`gridCap` beat, `gensets`, `racksDark`, downTicks star), needs one tiny metric or none, starts from the lesson 2 scenario layout, and fixes gap 2. It also exercises the new star system on a power lesson where the existing star rules already fit. Do the star schema change (section 4) in the same pass.
Alternative if the owner prefers the biggest first-game pain: Going Liquid.
