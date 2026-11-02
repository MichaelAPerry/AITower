# Placeholder text

All text below is placeholder. Replace freely.

Lines like `- [id] Tag: text` can be edited here and put in the game with `npx tsx tools/dialogue/import.ts docs/PLACEHOLDER_TEXT.md` (add `--write` to apply it; without it you get a dry run that only reports changes).
Lines like ``- `key` (file): text`` are not read by the importer yet: edit the text and send the file back, and Claude will move it into the game. Keep any `{{term|label}}` markers as they are.

## Lessons rebuilt on the full game UI (Lessons 1 to 4)

Lessons now use the whole game screen. Each step names the control by its on-screen label, and the real button is outlined and pointed at with an arrow. The advisor no longer starts or stops the clock: Lesson 1 asks the player to press Play, Pause and a faster speed with the real speed buttons, and waits. Lines below are the new or changed ones only (placeholder). Lines not listed here are unchanged: the owner-written lines that still fit were kept as they were (for example Luci's "Once signed, your racks pick it up on their own." and "Racks break. Something will break today.", Mel's nervous hello, Bea's "ball of wax ... you idiot" and the tree names). Two owner-written lines were changed because they no longer fit and are flagged: Lesson 4 dropped "Last lesson." (lessons 5 and 6 follow) and its Retrofit line now says to pick Green (the lesson needs the Garden); the Lesson 4 outro lost "That's everything I've got." for the same reason.

### Lesson 1: Your First Rack (`first_watt`, advisor bea)

- [first_watt.outro] bea: That's a working hall. Power in, work done, heat out. Next, Luci will show you how it pays.
- [first_watt.clock.objective] Objective: Press 1× to start the clock
- [first_watt.clock.say1] bea: Hi. I'm Bea. I do power. Welcome to the hall.
- [first_watt.clock.say2] bea: Time is stopped. Press 1× in the speed controls at the top to start the clock.
- [first_watt.rack.say1] bea: First piece: a {{rack|rack}}. A tall cabinet of GPU chips that does the work clients pay for.
- [first_watt.rack.say2] bea: Click Racks in the build bar, then the AC-1, then the glowing spot.
- [first_watt.power.say1] bea: A rack needs power. A Grid Intake is the plug into the city.
- [first_watt.power.say2] bea: Click Power in the build bar, then Grid Intake, then the glowing spot in the basement.
- [first_watt.power.after1] bea: Lights on. {{kw|kW}} is how hard something pulls. The bar at the top shows LOAD against CAPACITY.
- [first_watt.cool.say1] bea: Cass. Cooling. Every kW a rack uses turns into heat. Too hot, and it slows down.
- [first_watt.cool.say2] bea: Click Cooling in the build bar, then Air Handler, then the glowing spot.
- [first_watt.cool.after1] bea: Good. An {{crah|air handler}} carries the heat away.
- [first_watt.run.objective] Objective: Wait for the rack's first job
- [first_watt.run.say1] bea: A client just sent a job. Watch the rack pick it up.
- [first_watt.run.after1] bea: Running. Power in, work done, heat out.
- [first_watt.run.after2] bea: See PUE at the top? {{pue|PUE}} is the hall's total power over what the racks use. Lower is better.
- [first_watt.pause.objective] Objective: Press Pause
- [first_watt.pause.say1] bea: You can stop time whenever you like. Press the Pause button, the left-most of the speed controls.
- [first_watt.pause.say2] bea: Building still works while time is stopped.
- [first_watt.fast.objective] Objective: Press 3× to run faster
- [first_watt.fast.say1] bea: Now speed things up. Press 3× in the speed controls.
- [first_watt.hold.say1] bea: Three hours of game time. Keep the rack busy and watch the bar fill.

### Lesson 2: Earn Your Keep (`earn_your_keep`, advisor luci)

- [earn_your_keep.accept.objective] Objective: Take the contract on the board
- [earn_your_keep.accept.say2] luci: Clients post contracts on the board. Open Contracts, the tab on the right (or press C), and press Take job. This one is {{inference|inference}}: a client keeps asking a model questions, and pays every minute you keep up.
- [earn_your_keep.paid.say1] luci: Now the only job is not breaking anything. Watch TREASURY at the top until the contract ends.
- [earn_your_keep.storage.say1] luci: Cass. A new contract on the board: {{training|Training}}. One big job, paid when it's done, with a 1,000 TB dataset.
- [earn_your_keep.storage.say2] luci: Try to take it in Contracts. It refuses: a job's data lives on a Storage Array, and you have none.
- [earn_your_keep.storage.say3] luci: Click Racks in the build bar, then Storage Array, then the glowing spot.
- [earn_your_keep.train.objective] Objective: Take the training contract
- [earn_your_keep.train.say1] luci: Luci. Good. Now open Contracts and take it.
- [earn_your_keep.train.after2] luci: If the storage ever goes dark, the job stalls. No data, no work.
- [earn_your_keep.parts.say2] luci: A fix uses one spare part. Click Supplies in the build bar and buy 5 spare parts.
- [earn_your_keep.finish.say2] luci: It takes a while. The speed controls at the top will get you there sooner.

### Lesson 3: Grow the Tower (`grow_the_tower`, advisor mel)

- [grow_the_tower.research1.say3] mel: Open Research, the tab on the right (or press R). Pick Contract Automation, then press Research.
- [grow_the_tower.research2.say2] mel: Same panel. It costs more, but you have enough.
- [grow_the_tower.racks.say2] mel: Find the LEVEL bar at the top. Level 2 asks for 120 PF of racks and two ideas researched. {{pflops|PF}} is how much computing a rack does.
- [grow_the_tower.racks.say3] mel: You have 80 PF. Click Racks in the build bar and place two more AC-1 racks.
- [grow_the_tower.level.say1] mel: Levels are awarded at midnight. Let the clock run; the speed controls at the top will get you there sooner.
- [grow_the_tower.foreman.say1] mel: Now the Foreman. Open Automation, the tab on the right (or press T).

### Lesson 4: The Three Trees (`the_three_trees`, advisor bea)

- [the_three_trees.outro] bea: That's the trees. Pick a road, or mix them. Nobody's stopping you.
- [the_three_trees.retrofit.objective] Objective: Click the glowing rack and retrofit it to Green
- [the_three_trees.retrofit.say1] bea: Bea again. This one's about how the whole ball of wax goes. That's the world, you idiot.
- [the_three_trees.retrofit.say3] bea: You join one by retrofitting. Click the glowing rack. Its panel opens on the right.
- [the_three_trees.retrofit.say4] bea: Find Retrofit. Pick Green, the Garden's button. The rack changes right where it stands.
- [the_three_trees.retrofit.after1] bea: There. A better rack, right where the old one stood.
- [the_three_trees.trees.objective] Objective: Open the Trees panel: click the three coloured bars at the top
- [the_three_trees.trees.after3] bea: Close the panel when you're done reading.
- [the_three_trees.clean.say3] bea: Click Power in the build bar, then PV Wall Panels, then the glowing spot.
- [the_three_trees.points.say2] bea: Let the clock run until the Garden scores. The speed controls at the top will hurry it.

## Lesson 5: Going Liquid

Lesson `liquid`, file `packages/content/src/data/lessons.json`, advisor cass. Title, concept, goal, learned, outro and step text are in the dialogue format; the rest is plain.

- [liquid.title] Title: Going Liquid
- [liquid.concept] Concept: Liquid cooling: a dense rack is cooled by water from a chiller and a CDU, not by air.
- [liquid.goal] Goal: Run a liquid-cooled rack for three hours without it overheating.
- [liquid.learned] Learned: A liquid rack needs a loop: a coolant pipe, a {{chiller|chiller}} to cool the water and a {{cdu|CDU}} to hand it out. With the loop in place, a dense rack runs cool.
- [liquid.outro] cass: That's liquid. Pipe, chiller, CDU, rack. Keep the water cold.
- [liquid.pipe.objective] Objective: Lay a coolant pipe along the glowing run
- [liquid.pipe.say1] cass: We're going to learn some cooling.
- [liquid.pipe.say2] cass: Air only goes so far, after that we use water. That's {{dlc|liquid cooling}}.
- [liquid.pipe.say3] cass: Water needs a plumbing. So pick the Coolant pipe. Drag it along the glowing line.
- [liquid.pipe.after1] cass: Excellent, now you got it flowing!
- [liquid.chiller.objective] Objective: Place a Chiller on the glowing spot
- [liquid.chiller.say1] cass: A {{chiller|chiller}} um... chills the water haha. 
- [liquid.chiller.say2] cass: Open Cooling. Pick the Chiller. Click the glowing spot.
- [liquid.chiller.after1] cass: It's big. It'll hum. No more than usual in this place. 
- [liquid.cdu.objective] Objective: Place a CDU on the glowing spot
- [liquid.cdu.say1] cass: Next, a {{cdu|CDU}}. It hands the cold water to the racks.
- [liquid.cdu.say2] cass: Cooling again. Pick the Coolant Distribution Unit. Click the glowing spot.
- [liquid.cdu.after1] cass: Now we have the backbone we need to upgrade CPUs. 
- [liquid.rack.objective] Objective: Click the glowing rack and retrofit it to Synthetic
- [liquid.rack.say1] cass: Now the rack. Click the one that's glowing. Its panel opens on the right.
- [liquid.rack.say2] cass: Find Retrofit. Pick Synthetic. It becomes an LC-2, a liquid-cooled rack.
- [liquid.rack.after1] cass: There. It sits on the pipe, so it can drink.
- [liquid.heat.objective] Objective: Switch on the Heat view
- [liquid.heat.say1] cass: Let's watch the heat. Press E, or open Insights and pick Heat. Warm colours are hot racks.
- [liquid.heat.say2] cass: A job is coming for it. Let's see if it stays cool.
- [liquid.heat.after1] cass: It's working and it's cool. That's what water buys you.
- [liquid.steady.objective] Objective: Keep it running for three hours
- [liquid.steady.say1] cass: Make sure you watch the map. 

- `liquid.passed` (packages/content/src/data/lessons.json): A liquid-cooled rack ran cool for three hours
- `liquid.failed` (packages/content/src/data/lessons.json): A rack got too hot. The pipe, the chiller and the CDU all have to be in place and running. Have another go.
- `liquid.holdLabel` (packages/content/src/data/lessons.json): hours running
- `liquid.setup[0].label` (packages/content/src/data/lessons.json): Lesson hall: nothing breaks today

## Lesson 6: Lights Out

Lesson `lights_out`, file `packages/content/src/data/lessons.json`, advisor bea. Title, concept, goal, learned, outro and step text are in the dialogue format; the rest is plain.

- [lights_out.title] Title: Lights Out
- [lights_out.concept] Concept: Backup: a battery bank bridges the minutes after the grid drops, and a genset carries the racks for hours.
- [lights_out.goal] Goal: Ride out a grid failure with no dark racks.
- [lights_out.learned] Learned: A {{ups|battery bank}} carries the racks for the minutes a {{genset|genset}} needs to start. The genset carries them for hours. Build both before the grid drops.
- [lights_out.outro] bea: That's how you keep the lights on. Battery backup is a crucial concept. 
- [lights_out.battery.objective] Objective: Place a Battery Bank on the glowing spot
- [lights_out.battery.say1] bea: We don't know when the power will go out. 
- [lights_out.battery.say2] bea: The point is to be prepared for any eventuality. 
- [lights_out.battery.say3] bea: A {{ups|battery bank}} holds power for when the grid drops. Open Power. Pick the Battery Bank. Click the glowing spot.
- [lights_out.battery.after1] bea: Okay. My least favorite exercise X_X. 
- [lights_out.genset.objective] Objective: Place a Diesel Genset on the glowing spot
- [lights_out.genset.say1] bea: Batteries don't last. Maybe an hour and a half at this load.
- [lights_out.genset.say2] bea: For longer you want an engine. A {{genset|genset}}. Diesel. Y'know dirty, loud, money grubbin' pollution. 
- [lights_out.genset.say3] bea: Open Power. Pick the Diesel Genset. Click the glowing spot.
- [lights_out.genset.after1] bea: Right. It starts itself when the grid fails. Chugging like a freakin' train. 
- [lights_out.watch.objective] Objective: Switch on the Power view while the battery fills
- [lights_out.watch.say1] bea: Press P, or open Insights and pick Power. That's where the load and the supply show.
- [lights_out.watch.say2] bea: Let the battery fill. Don't touch anything.
- [lights_out.watch.after1] bea: Full. Okay. Okay!
- [lights_out.watch.after2] bea: Hands off. Here it comes.
- [lights_out.outage.objective] Objective: Ride out the outage
- [lights_out.outage.say1] bea: There. The grid's gone.
- [lights_out.outage.say2] bea: The battery is doing its job. The genset's waking up. Watch the load.
- [lights_out.outage.after1] bea: Genset's carrying them. The battery's topping up. 100% uptime! Yay!
- [lights_out.outage.after2] bea: Grid's back. The genset stops automatically!
- [lights_out.steady.objective] Objective: Keep the racks lit for half an hour
- [lights_out.steady.say1] bea: Give it half an hour. Make sure it holds.

- `lights_out.passed` (packages/content/src/data/lessons.json): The racks stayed lit through the outage
- `lights_out.failed` (packages/content/src/data/lessons.json): The racks stayed dark too long. The battery and the genset have to be up and running before the grid drops. Have another go.
- `lights_out.setup[0].label` (packages/content/src/data/lessons.json): Lesson hall: nothing breaks today
- `lights_out.beats[1].effects[0].label` (packages/content/src/data/lessons.json): Grid failure

## Quarterly inspection: Luci's remarks

Luci's short remark on the inspection sheet (`packages/ui/src/finance/auditQuips.ts`), chosen by the result: the worst finding if the grade is not an A, else the grade. All placeholder.

- `quip.passed.1` (packages/ui/src/finance/auditQuips.ts): Clean sheet. The Ministry can't find a thing to fine you for.
- `quip.passed.2` (packages/ui/src/finance/auditQuips.ts): Good quarter. Enjoy the grant, and don't touch anything.
- `quip.warning.1` (packages/ui/src/finance/auditQuips.ts): Not a disaster. Not a compliment either.
- `quip.warning.2` (packages/ui/src/finance/auditQuips.ts): They let you off with a warning. I'd fix it before next quarter.
- `quip.failed.1` (packages/ui/src/finance/auditQuips.ts): That went badly. I'll put the kettle on and we'll go through it.
- `quip.failed.2` (packages/ui/src/finance/auditQuips.ts): A fine. Well. It was bound to happen sooner or later.
- `quip.failedJobs` (packages/ui/src/finance/auditQuips.ts): Failed jobs on the sheet. Clients remember those.
- `quip.penalties` (packages/ui/src/finance/auditQuips.ts): Penalties paid. Look at where they came from first.
- `quip.lowUptime` (packages/ui/src/finance/auditQuips.ts): Uptime is where the inspector looked hardest. So should we.
- `quip.hotHall` (packages/ui/src/finance/auditQuips.ts): The PUE is high. Too much power is going to cooling, not work.
- `quip.loss` (packages/ui/src/finance/auditQuips.ts): We spent more than we earned. Check the ledger before the next audit.

## Lesson build ghost

Labels drawn in the world while a lesson asks for a coolant pipe or a rack click (`slotGhost` in `packages/ui/src/lessons/lessons.ts`). The label for placing a rack is still "BUILD HERE".

- `ghost.pipe` (packages/ui/src/lessons/lessons.ts): DRAG A PIPE HERE
- `ghost.rack` (packages/ui/src/lessons/lessons.ts): CLICK THIS RACK (marks the rack a lesson step wants clicked)

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
- `ch:books.p1` (packages/ui/src/handbook/chapters.ts): Loans. Open Insights, then Finance. The Bank lends up to a limit that rises with your Level: $2.00M at Level 1, $100.0M at the top. Every midnight you pay 0.5% of what you owe. Repay whenever you like.
- `ch:books.p2` (packages/ui/src/handbook/chapters.ts): Penalties. An inference contract is a promise to keep serving. While a running service falls short, you are fined 1.5 times its rate for each minute. Check the deadline and the penalty before you accept a contract.
- `ch:books.p3` (packages/ui/src/handbook/chapters.ts): The audit. Every 7 days an inspector grades your books from A to E: uptime against your Level's target, failed jobs, penalties and PUE. A and B earn cash. C is neutral. D and E cost you.
- `ch:books.tryIt.label` (packages/ui/src/handbook/chapters.ts): Open Insights

### Climbing a tree's ladder

- `ch:ladder.title` (packages/ui/src/handbook/chapters.ts): Climbing a tree's ladder
- `ch:ladder.p1` (packages/ui/src/handbook/chapters.ts): Each tree is a ladder of racks. Each step is a rung. A plain rack retrofits onto rung 1 of a tree. A rack that is already on a tree retrofits onto its next rung.
- `ch:ladder.p2` (packages/ui/src/handbook/chapters.ts): To go down a rung, retrofit the rack again. Select it, open Retrofit, and pick the same tree again. The panel shows the price: the new rack's cost, minus half the cost of the old one.
- `ch:ladder.p3` (packages/ui/src/handbook/chapters.ts): A rung also asks for your Level and for its research. The panel says which is missing. Some racks need more too, such as a coolant pipe under them.
- `ch:ladder.tryIt.label` (packages/ui/src/handbook/chapters.ts): Open Research

## Credits screen

Only the strings Claude wrote: the title-menu button, its subtitle, and the heading above the quote list. The lines you wrote or approved in `docs/OWNER_TEXT.md` are not repeated.

- [ach.ui.credits_menu_label] Label: CREDITS
- [ach.ui.credits_detail] Label: who made it · quotes
- [ach.ui.credits_quotes_head] Label: Quotes
- Music credit line "Music: Perry, made with Suno." and the seven song titles (`packages/ui/src/title/titleMusic.ts`, shown in `CreditsPane.tsx`). RESOLVED (owner decision): song titles stay exactly as tagged in the files: "まだ見ぬ世界へ" (title), "君の明日が晴れますように" (Garden), "銀のホーム" (Lattice), "雨のしずく" (Flesh), "深夜のゲーム" (tower loop), "夕陽のメロディ" (warm scene song), "Noctune FM" (quiet scene song). The owner's typed variants ("まだない明日へ", "銀のホームを") are not used.

## After hours (the four easter eggs)

The owner's dialogue (the character lines and the Yes / No answers) is in `docs/AFTER_HOURS.md` and is not repeated here. Everything below was written by Claude and is placeholder: the scene titles, locations and captions, the small hint and outcome lines under Yes / No, and the one-line lead-ins that play before the tenth-day scene when the player says No and comes back (the first of each set is the "[ buy the coffee machine ]" style the owner asked for). They are in `story.json` as the scenes `ah_<item>_third`, `ah_<item>_tenth` and `ah_<item>_again1..3`; `<item>` is `fern` (Bea), `tank` (Mel), `coffee` (Cass) or `book` (Luci).

### `ah_fern_third`

- [ah_fern_third.title] Title: Nigel the Fern
- [ah_fern_third.location] Location: G · LOBBY
- [ah_fern_third.caption] Caption: Bea's fern by the lobby window.
- [ah_fern_third.yes.hint] Hint: Keep it up.
- [ah_fern_third.yes.outcome] Outcome: Noted.
- [ah_fern_third.no.hint] Hint: Not promising anything.
- [ah_fern_third.no.outcome] Outcome: Noted.

### `ah_fern_tenth`

- [ah_fern_tenth.title] Title: Nigel Deserves Better
- [ah_fern_tenth.location] Location: G · LOBBY
- [ah_fern_tenth.caption] Caption: Bea and the fern again.
- [ah_fern_tenth.yes.hint] Hint: $1,000,000
- [ah_fern_tenth.yes.outcome] Outcome: Bought.
- [ah_fern_tenth.no.hint] Hint: Not now.
- [ah_fern_tenth.no.outcome] Outcome: Not now.

### `ah_fern_again1`

- [ah_fern_again1.l1] narrator: [ buy the bigger pot for the fern ]

### `ah_fern_again2`

- [ah_fern_again2.l1] narrator: [ (buy the fern's new pot) ]

### `ah_fern_again3`

- [ah_fern_again3.l1] narrator: [ you could buy the pot with automatic watering ]

### `ah_tank_third`

- [ah_tank_third.title] Title: Fido the Fish
- [ah_tank_third.location] Location: B1 · MEL'S CORNER
- [ah_tank_third.caption] Caption: Mel's fish tank on her desk.
- [ah_tank_third.yes.hint] Hint: Keep it up.
- [ah_tank_third.yes.outcome] Outcome: Noted.
- [ah_tank_third.no.hint] Hint: Not promising anything.
- [ah_tank_third.no.outcome] Outcome: Noted.

### `ah_tank_tenth`

- [ah_tank_tenth.title] Title: Fido's Upgrade
- [ah_tank_tenth.location] Location: B1 · MEL'S CORNER
- [ah_tank_tenth.caption] Caption: Mel and the fish tank again.
- [ah_tank_tenth.yes.hint] Hint: $1,000,000
- [ah_tank_tenth.yes.outcome] Outcome: Bought.
- [ah_tank_tenth.no.hint] Hint: Not now.
- [ah_tank_tenth.no.outcome] Outcome: Not now.

### `ah_tank_again1`

- [ah_tank_again1.l1] narrator: [ buy the bio-enhanced tank ]

### `ah_tank_again2`

- [ah_tank_again2.l1] narrator: [ (buy the tank upgrade) ]

### `ah_tank_again3`

- [ah_tank_again3.l1] narrator: [ you could buy Fido's bio-enhancements ]

### `ah_coffee_third`

- [ah_coffee_third.title] Title: The Coffee Corner
- [ah_coffee_third.location] Location: G · LOBBY
- [ah_coffee_third.caption] Caption: Cass's coffee machine in the lobby.
- [ah_coffee_third.yes.hint] Hint: Keep it up.
- [ah_coffee_third.yes.outcome] Outcome: Noted.
- [ah_coffee_third.no.hint] Hint: Not promising anything.
- [ah_coffee_third.no.outcome] Outcome: Noted.

### `ah_coffee_tenth`

- [ah_coffee_tenth.title] Title: A Better Coffee Maker
- [ah_coffee_tenth.location] Location: G · LOBBY
- [ah_coffee_tenth.caption] Caption: Cass and the coffee machine again.
- [ah_coffee_tenth.yes.hint] Hint: $1,000,000
- [ah_coffee_tenth.yes.outcome] Outcome: Bought.
- [ah_coffee_tenth.no.hint] Hint: Not now.
- [ah_coffee_tenth.no.outcome] Outcome: Not now.

### `ah_coffee_again1`

- [ah_coffee_again1.l1] narrator: [ buy the coffee machine ]

### `ah_coffee_again2`

- [ah_coffee_again2.l1] narrator: [ (buy the cappuccino machine) ]

### `ah_coffee_again3`

- [ah_coffee_again3.l1] narrator: [ you could buy the new coffee maker ]

### `ah_book_third`

- [ah_book_third.title] Title: The Ledger
- [ah_book_third.location] Location: B1 · LUCI'S OFFICE
- [ah_book_third.caption] Caption: The ledger on Luci's desk.
- [ah_book_third.yes.hint] Hint: Keep it up.
- [ah_book_third.yes.outcome] Outcome: Noted.
- [ah_book_third.no.hint] Hint: Not promising anything.
- [ah_book_third.no.outcome] Outcome: Noted.

### `ah_book_tenth`

- [ah_book_tenth.title] Title: Get Licensed
- [ah_book_tenth.location] Location: B1 · LUCI'S OFFICE
- [ah_book_tenth.caption] Caption: Luci and the ledger again.
- [ah_book_tenth.yes.hint] Hint: $1,000,000
- [ah_book_tenth.yes.outcome] Outcome: Bought.
- [ah_book_tenth.no.hint] Hint: Not now.
- [ah_book_tenth.no.outcome] Outcome: Not now.

### `ah_book_again1`

- [ah_book_again1.l1] narrator: [ buy the license ]

### `ah_book_again2`

- [ah_book_again2.l1] narrator: [ (buy the license and the certificate) ]

### `ah_book_again3`

- [ah_book_again3.l1] narrator: [ you could sign up for the license class ]

### Story scenes that lost their choices

The relationship numbers are gone, so the story scenes whose choices only moved those numbers (the opening, the two objections, the twelve rung scenes and the two seal scenes) now end with one button, `Got it.`, with this placeholder hint and outcome. The scene's own lines are unchanged; the old choices and replies were removed.

- [st_intro.ok.hint] Hint: Moving on.
- [st_intro.ok.outcome] Outcome: The scene ends and the day goes on.
- [obj_greentech.ok.hint] Hint: Moving on.
- [obj_greentech.ok.outcome] Outcome: The scene ends and the day goes on.
- [obj_biotech.ok.hint] Hint: Moving on.
- [obj_biotech.ok.outcome] Outcome: The scene ends and the day goes on.
- [rung_syn_1.ok.hint] Hint: Moving on.
- [rung_syn_1.ok.outcome] Outcome: The scene ends and the day goes on.
- [rung_syn_2.ok.hint] Hint: Moving on.
- [rung_syn_2.ok.outcome] Outcome: The scene ends and the day goes on.
- [rung_syn_3.ok.hint] Hint: Moving on.
- [rung_syn_3.ok.outcome] Outcome: The scene ends and the day goes on.
- [rung_syn_4.ok.hint] Hint: Moving on.
- [rung_syn_4.ok.outcome] Outcome: The scene ends and the day goes on.
- [rung_bio_1.ok.hint] Hint: Moving on.
- [rung_bio_1.ok.outcome] Outcome: The scene ends and the day goes on.
- [rung_bio_2.ok.hint] Hint: Moving on.
- [rung_bio_2.ok.outcome] Outcome: The scene ends and the day goes on.
- [rung_bio_3.ok.hint] Hint: Moving on.
- [rung_bio_3.ok.outcome] Outcome: The scene ends and the day goes on.
- [rung_bio_4.ok.hint] Hint: Moving on.
- [rung_bio_4.ok.outcome] Outcome: The scene ends and the day goes on.
- [rung_green_1.ok.hint] Hint: Moving on.
- [rung_green_1.ok.outcome] Outcome: The scene ends and the day goes on.
- [rung_green_2.ok.hint] Hint: Moving on.
- [rung_green_2.ok.outcome] Outcome: The scene ends and the day goes on.
- [rung_green_3.ok.hint] Hint: Moving on.
- [rung_green_3.ok.outcome] Outcome: The scene ends and the day goes on.
- [rung_green_4.ok.hint] Hint: Moving on.
- [rung_green_4.ok.outcome] Outcome: The scene ends and the day goes on.
- [seal_biotech.ok.hint] Hint: Moving on.
- [seal_biotech.ok.outcome] Outcome: The scene ends and the day goes on.
- [seal_greentech.ok.hint] Hint: Moving on.
- [seal_greentech.ok.outcome] Outcome: The scene ends and the day goes on.
- [ah_fern_again1.ok.hint] Hint: Moving on.
- [ah_fern_again1.ok.outcome] Outcome: The scene ends and the day goes on.
- [ah_fern_again2.ok.hint] Hint: Moving on.
- [ah_fern_again2.ok.outcome] Outcome: The scene ends and the day goes on.
- [ah_fern_again3.ok.hint] Hint: Moving on.
- [ah_fern_again3.ok.outcome] Outcome: The scene ends and the day goes on.
- [ah_tank_again1.ok.hint] Hint: Moving on.
- [ah_tank_again1.ok.outcome] Outcome: The scene ends and the day goes on.
- [ah_tank_again2.ok.hint] Hint: Moving on.
- [ah_tank_again2.ok.outcome] Outcome: The scene ends and the day goes on.
- [ah_tank_again3.ok.hint] Hint: Moving on.
- [ah_tank_again3.ok.outcome] Outcome: The scene ends and the day goes on.
- [ah_coffee_again1.ok.hint] Hint: Moving on.
- [ah_coffee_again1.ok.outcome] Outcome: The scene ends and the day goes on.
- [ah_coffee_again2.ok.hint] Hint: Moving on.
- [ah_coffee_again2.ok.outcome] Outcome: The scene ends and the day goes on.
- [ah_coffee_again3.ok.hint] Hint: Moving on.
- [ah_coffee_again3.ok.outcome] Outcome: The scene ends and the day goes on.
- [ah_book_again1.ok.hint] Hint: Moving on.
- [ah_book_again1.ok.outcome] Outcome: The scene ends and the day goes on.
- [ah_book_again2.ok.hint] Hint: Moving on.
- [ah_book_again2.ok.outcome] Outcome: The scene ends and the day goes on.
- [ah_book_again3.ok.hint] Hint: Moving on.
- [ah_book_again3.ok.outcome] Outcome: The scene ends and the day goes on.

### Other changes Claude made with the bond removal

- The ending screens no longer pick an advisor by trust. The closing epilogue speaker depends on the tree and ending built, as before (reverted Nov 2); with none bought, the narrated fallback closes the ending. No new words.
- Three ministry choices that only changed trust (`compute_subsidy` decline, `form_9b_brochure` decline, `heat_tariff_revision` keep) now simply do nothing; their hint already says "nothing now".
- Open Door (research) no longer gives bonds. Its description now reads: "An open-door policy for your advisors. Contract payouts +4%."
- Removed achievements: "Someone You Trust" and "The Whole Crew".
- Pressing a click on an item shows nothing; if the cash is not there, the Yes of the tenth-day scene shows the notice "Needs $1,000,000" and stays on the choice.
- New achievements, one per off-duty portrait unlock (placeholder names and texts, listed in `docs/ACHIEVEMENTS_TEXT.md`): Green Thumb (Bea), Fish Person (Mel), Barista Bonus (Cass), Fully Licensed (Luci). Earned when that upgrade is bought; the bed portraits still need all of them plus all four eggs.
