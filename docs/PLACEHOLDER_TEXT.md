# Placeholder text

All text below is placeholder. Replace freely.

Lines like `- [id] Tag: text` can be edited here and put in the game with `npx tsx tools/dialogue/import.ts docs/PLACEHOLDER_TEXT.md` (add `--write` to apply it; without it you get a dry run that only reports changes).
Lines like ``- `key` (file): text`` are not read by the importer yet: edit the text and send the file back, and Claude will move it into the game. Keep any `{{term|label}}` markers as they are.

## Lesson 5: Going Liquid

Lesson `liquid`, file `packages/content/src/data/lessons.json`, advisor cass. Title, concept, goal, learned, outro and step text are in the dialogue format; the rest is plain.

- [liquid.title] Title: Going Liquid
- [liquid.concept] Concept: Liquid cooling: a dense rack is cooled by water from a chiller and a CDU, not by air.
- [liquid.goal] Goal: Run a liquid-cooled rack for three hours without it overheating.
- [liquid.learned] Learned: A liquid rack needs a loop: a coolant pipe, a {{chiller|chiller}} to cool the water and a {{cdu|CDU}} to hand it out. With the loop in place, a dense rack runs cool.
- [liquid.outro] cass: That's liquid. Pipe, chiller, CDU, rack. Keep the water cold.
- [liquid.pipe.objective] Objective: Lay a coolant pipe along the glowing run
- [liquid.pipe.say1] cass: Cass. Cooling.
- [liquid.pipe.say2] cass: Air only goes so far. Past that, you need water. That's {{dlc|liquid cooling}}.
- [liquid.pipe.say3] cass: Water needs a pipe. Open Structure. Pick the Coolant pipe. Drag it along the glowing run.
- [liquid.pipe.after1] cass: Good. Now the water has somewhere to go.
- [liquid.chiller.objective] Objective: Place a Chiller on the glowing spot
- [liquid.chiller.say1] cass: A {{chiller|chiller}} makes the water cold.
- [liquid.chiller.say2] cass: Open Cooling. Pick the Chiller. Click the glowing spot.
- [liquid.chiller.after1] cass: It's big. It'll hum. You get used to it.
- [liquid.cdu.objective] Objective: Place a CDU on the glowing spot
- [liquid.cdu.say1] cass: Next, a {{cdu|CDU}}. It hands the cold water on to the racks.
- [liquid.cdu.say2] cass: Cooling again. Pick the Coolant Distribution Unit. Click the glowing spot.
- [liquid.cdu.after1] cass: The loop is done. Nothing is on it yet.
- [liquid.rack.objective] Objective: Click the glowing rack and retrofit it to Synthetic
- [liquid.rack.say1] cass: Now the rack. Click the one that's glowing. Its panel opens on the right.
- [liquid.rack.say2] cass: Find Retrofit. Pick Synthetic. It becomes an LC-2, a liquid-cooled rack.
- [liquid.rack.after1] cass: There. It sits on the pipe, so it can drink.
- [liquid.heat.objective] Objective: Watch the Heat view while the rack takes a job
- [liquid.heat.say1] cass: I've put the heat view on. Warm colours are hot racks.
- [liquid.heat.say2] cass: A job is coming for it. Let's see if it stays cool.
- [liquid.heat.after1] cass: It's working and it's cool. That's what water buys you.
- [liquid.steady.objective] Objective: Keep it running for three hours
- [liquid.steady.say1] cass: Three hours. Make sure it holds.

- `liquid.passed` (packages/content/src/data/lessons.json): A liquid-cooled rack ran cool for three hours
- `liquid.failed` (packages/content/src/data/lessons.json): A rack got too hot. The pipe, the chiller and the CDU all have to be in place and running. Have another go.
- `liquid.holdLabel` (packages/content/src/data/lessons.json): hours running
- `liquid.setup[0].label` (packages/content/src/data/lessons.json): Lesson hall: nothing breaks today
- `liquid.star2Text` (packages/content/src/data/lessons.json): The hall's PUE was 1.6 or lower at the end.
- `liquid.star3Text` (packages/content/src/data/lessons.json): No rack was throttled or tripped for heat.

## Lesson 6: Lights Out

Lesson `lights_out`, file `packages/content/src/data/lessons.json`, advisor bea. Title, concept, goal, learned, outro and step text are in the dialogue format; the rest is plain.

- [lights_out.title] Title: Lights Out
- [lights_out.concept] Concept: Backup: a battery bank bridges the minutes after the grid drops, and a genset carries the racks for hours.
- [lights_out.goal] Goal: Ride out a grid failure with no dark racks.
- [lights_out.learned] Learned: A {{ups|battery bank}} carries the racks for the minutes a {{genset|genset}} needs to start. The genset carries them for hours. Build both before the grid drops.
- [lights_out.outro] bea: That's how you keep the lights on. Build the backup before you need it.
- [lights_out.battery.objective] Objective: Place a Battery Bank on the glowing spot
- [lights_out.battery.say1] bea: Bea. Power again. Today the grid goes out.
- [lights_out.battery.say2] bea: Not maybe. Today. So we get ready.
- [lights_out.battery.say3] bea: A {{ups|battery bank}} holds power for when the grid drops. Open Power. Pick the Battery Bank. Click the glowing spot.
- [lights_out.battery.after1] bea: Okay. Empty for now. It charges off the grid.
- [lights_out.genset.objective] Objective: Place a Diesel Genset on the glowing spot
- [lights_out.genset.say1] bea: Batteries don't last. Maybe an hour and a half at this load.
- [lights_out.genset.say2] bea: For longer you want an engine. A {{genset|genset}}. Diesel. Loud, and it burns money.
- [lights_out.genset.say3] bea: Open Power. Pick the Diesel Genset. Click the glowing spot.
- [lights_out.genset.after1] bea: Right. It starts itself when the grid runs short. It needs a few minutes to get up to speed.
- [lights_out.watch.objective] Objective: Check the Power view while the battery fills
- [lights_out.watch.say1] bea: I've put the power view on. That's where the load and the supply show.
- [lights_out.watch.say2] bea: Let the battery fill. Don't touch anything.
- [lights_out.watch.after1] bea: Full. Okay. Okay.
- [lights_out.watch.after2] bea: Hands off. Here it comes.
- [lights_out.outage.objective] Objective: Ride out the outage
- [lights_out.outage.say1] bea: There. Grid's gone.
- [lights_out.outage.say2] bea: The battery has the racks. The genset's waking up. Watch the load.
- [lights_out.outage.after1] bea: Genset's carrying them. The battery's topping up. Nobody went dark.
- [lights_out.outage.after2] bea: Grid's back. The genset stands down on its own.
- [lights_out.steady.objective] Objective: Keep the racks lit for half an hour
- [lights_out.steady.say1] bea: Give it half an hour. Make sure it holds.

- `lights_out.passed` (packages/content/src/data/lessons.json): The racks stayed lit through the outage
- `lights_out.failed` (packages/content/src/data/lessons.json): The racks stayed dark too long. The battery and the genset have to be up and running before the grid drops. Have another go.
- `lights_out.setup[0].label` (packages/content/src/data/lessons.json): Lesson hall: nothing breaks today
- `lights_out.beats[1].effects[0].label` (packages/content/src/data/lessons.json): Grid failure
- `lights_out.star2Text` (packages/content/src/data/lessons.json): Not one minute without power during the outage.
- `lights_out.star3Text` (packages/content/src/data/lessons.json): The battery never ran empty.

## Lessons 1 to 4: star texts

Shown on the lesson result screen next to the labels "Star 2" and "Star 3".

- `first_watt.star2Text` (packages/content/src/data/lessons.json): At least 10% of the power was always spare while the rack ran.
- `first_watt.star3Text` (packages/content/src/data/lessons.json): Not one minute without power once the first job started.
- `earn_your_keep.star2Text` (packages/content/src/data/lessons.json): Both contracts were paid, and you finished with more cash than you started with.
- `earn_your_keep.star3Text` (packages/content/src/data/lessons.json): No job ever sat stalled for want of storage.
- `grow_the_tower.star2Text` (packages/content/src/data/lessons.json): Done within 2 game days.
- `grow_the_tower.star3Text` (packages/content/src/data/lessons.json): The Foreman is on, and cash never fell below his $1 million reserve.
- `the_three_trees.star2Text` (packages/content/src/data/lessons.json): A Green rack and clean power both standing when the first Garden points arrived.
- `the_three_trees.star3Text` (packages/content/src/data/lessons.json): No minute without power, and no rack ran hotter than 80 degrees C.

## Lesson result screen labels

Row labels on the result screen of a starred lesson, `resultModel` in `packages/ui/src/lessons/lessons.ts`.

- `result.row.star2` (packages/ui/src/lessons/lessons.ts): Star 2
- `result.row.star3` (packages/ui/src/lessons/lessons.ts): Star 3

## Lesson build ghost

Label drawn over the glowing run while a lesson asks for a coolant pipe (`slotGhost` in `packages/ui/src/lessons/lessons.ts`). The label for placing a rack is still "BUILD HERE".

- `ghost.pipe` (packages/ui/src/lessons/lessons.ts): DRAG A PIPE HERE

## New-game screen: lesson scenarios

Names and descriptions of the two new lesson sites, `packages/content/src/data/scenarios.json`. Descriptions are in the dialogue format; names are plain.

- [scenario.lesson_lights_out.description] Description: A small working hall: three racks, an air handler and a grid intake. Bea shows you what happens when the grid drops, and what keeps the racks lit.
- [scenario.lesson_liquid.description] Description: A small working hall with Level 2 and the liquid-loop research done. Cass shows you a coolant pipe, a chiller, a CDU and a liquid-cooled rack.
- `scenario.lesson_liquid.name` (packages/content/src/data/scenarios.json): Lesson 5: Going Liquid
- `scenario.lesson_lights_out.name` (packages/content/src/data/scenarios.json): Lesson 6: Lights Out

## Handbook: "More guides"

Two short pages after the six core chapters, `guides()` in `packages/ui/src/handbook/chapters.ts`. The numbers (loan limits, interest rate, penalty factor, audit period) are filled in from the balance data; keep them as they are or tell Claude to wire your wording in.

- `handbook.group.guide` (packages/ui/src/handbook/HandbookDrawer.tsx): More guides
- `handbook.kicker.guide` (packages/ui/src/handbook/HandbookDrawer.tsx): GUIDE

### Loans, penalties and the audit

- `ch:books.title` (packages/ui/src/handbook/chapters.ts): Loans, penalties and the audit
- `ch:books.p1` (packages/ui/src/handbook/chapters.ts): Loans. Open Insights, then Finance. The Ministry lends up to a limit that rises with your Level: $2.00M at Level 1, $100.0M at the top. Every midnight you pay 0.5% of what you owe. Repay whenever you like.
- `ch:books.p2` (packages/ui/src/handbook/chapters.ts): Penalties. An inference contract is a promise to keep serving. While a running service falls short, you are fined 1.5 times its rate for each minute. Check the deadline and the penalty before you accept a contract.
- `ch:books.p3` (packages/ui/src/handbook/chapters.ts): The audit. Every 7 days an inspector grades your books from A to E: uptime against your Level's target, failed jobs, penalties and PUE. A and B earn cash. C is neutral. D and E cost you.
- `ch:books.tryIt.label` (packages/ui/src/handbook/chapters.ts): Open Insights

### Climbing a tree's ladder

- `ch:ladder.title` (packages/ui/src/handbook/chapters.ts): Climbing a tree's ladder
- `ch:ladder.p1` (packages/ui/src/handbook/chapters.ts): Each tree is a ladder of racks. Each step is a rung. A plain rack retrofits onto rung 1 of a tree. A rack that is already on a tree retrofits onto its next rung.
- `ch:ladder.p2` (packages/ui/src/handbook/chapters.ts): To go down a rung, retrofit the rack again. Select it, open Retrofit, and pick the same tree again. The panel shows the price: the new rack's cost, minus half the cost of the old one.
- `ch:ladder.p3` (packages/ui/src/handbook/chapters.ts): A rung also asks for your Level and for its research. The panel says which is missing. Some racks need more too, such as a coolant pipe under them.
- `ch:ladder.tryIt.label` (packages/ui/src/handbook/chapters.ts): Open Research

## Bankrupt ending: achievement line

Shown on the Bankrupt ending screen when "Notice of Termination" unlocks. In `docs/OWNER_TEXT.md` it is `end_bankrupt_note`, which the importer accepts too.

- [ach.ui.end_bankrupt_note] Label: The lamp in the control room stays on.

## Credits screen

Only the strings Claude wrote: the title-menu button, its subtitle, and the heading above the quote list. The lines you wrote or approved in `docs/OWNER_TEXT.md` are not repeated.

- [ach.ui.credits_menu_label] Label: CREDITS
- [ach.ui.credits_detail] Label: who made it · quotes
- [ach.ui.credits_quotes_head] Label: Quotes
