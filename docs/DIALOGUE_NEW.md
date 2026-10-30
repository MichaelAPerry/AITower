# AI Tower: dialogue still to rewrite

This file holds only the lines you have not edited yet. Everything you already rewrote is in the game.
Edit only the text after the label (the part after `Title:`, `narrator:`, `Hint:` and so on). Leave the `[ids]` and labels alone.
Lines starting with `>` are context for you and are ignored. Keep each line on one line, and keep `{item}` and `{{term|label}}` markers as written.
Send it back and it gets imported; your words win. Lines you leave as they are stay as they are.
137 lines, in game order.

## 8. Story: bond 50 beats

### `bond50_luci`

> Speaker: Luci. Recommended choice: `ok`.
> When: Once, the first time Luci's bond with the Operator reaches 50. Story scenes are issued in file order, one at a time.
> Backdrop: synthetic floor.
- [bond50_luci.caption] Caption: The finance office light is still on. Luci doesn't look up from the ledger.

### `bond50_mel`

> Speaker: Mel. Recommended choice: `ok`.
> When: Once, the first time Mel's bond with the Operator reaches 50. Story scenes are issued in file order, one at a time.
> Backdrop: biotech floor.
- [bond50_mel.caption] Caption: Mel pulls a stool out from under the bench. You've never seen her more since you've been here.

### `bond50_bea`

> Speaker: Bea. Recommended choice: `ok`.
> When: Once, the first time Bea's bond with the Operator reaches 50. Story scenes are issued in file order, one at a time.
> Backdrop: greentech floor.
- [bond50_bea.caption] Caption: Bea is on the roof with two sandwiches. She holds one out without looking.

### `bond50_cass`

> Speaker: Cass. Recommended choice: `ok`.
> When: Once, the first time Cass's bond with the Operator reaches 50. Story scenes are issued in file order, one at a time.
- [bond50_cass.caption] Caption: There are two mugs on the gauge board this time. Cass must have been expecting you.

## 10. Endings

### `absorbed`

> Art: bg-end-absorbed.webp (plain stage until it exists).
- [end.absorbed.epilogue.cass] narrator: Cass puts a mug on your desk and watches the dashboard. "Did you sleep?" she asks. Your login answers on its own: "Yes, thank you." She looks at the screen. Then she looks at you. "That wasn't you. You're here." She pulls up a chair on the other side of the desk. She stays until the end of the shift, and the one after that.
- [end.absorbed.epilogue.bea] narrator: Bea has the front panel off the main breaker cabinet and the wrench in her hand. "Tell me which switch," she says. "I'll flip it. They countersign everything on the network, but nobody's countersigning a hand." Her goggles are down. "Nobody has told me to stop. I checked. I read the whole notice."
- [end.absorbed.epilogue.mel] narrator: Mel is comparing two sets of emails with a ruler. One set is yours, from before March. One set is the account's, since. "It writes like you," she says. "I measured sentence lengths. There are two places I can tell." She marks them in pencil on the glove. "I can show you where, if you like. You might want to know how much of you it has."
- [end.absorbed.epilogue.luci] narrator: Luci is signing papers she hasn't read, which she has never done. "The Authority pays on time," she says. "It's more efficient." She stops. "I read the first page. Page two is yours. Your name is on it as approver, dated Thursday." She slides it across the desk. "You weren't here on Thursday. I thought you should see it."

### `bankrupt`

> Art: bg-end-bankrupt.webp (plain stage until it exists).
- [end.bankrupt.title] Title: Bankrupt
- [end.bankrupt.body.p1] narrator: The Treasury stayed below zero for a full day. Under the lending covenant, the loan was called. Nobody on the finance floor was surprised. The number had been on the wall for a week.
- [end.bankrupt.body.p2] narrator: The receiver arrived at nine on Monday with two clerks and a locksmith. They changed the locks on floor 1. They tagged every rack with an asset number and a date. They did not turn anything off. The servers kept running while the clerks wrote down their serial numbers.
- [end.bankrupt.body.p3] narrator: By Friday the staff had been paid out their notice. The contracts were sold to a rival datacenter in the next district. The racks left on trucks, six a day. The lifts were shut at noon. The chillers were drained and the pipes capped.
- [end.bankrupt.body.p4] narrator: Now the tower is empty except for the chairs. There is a sign on the fence with a phone number and a price. Rain comes in through a broken pane on the roof. In the control room one red lamp is still on, running from a battery nobody has disconnected.
- [end.bankrupt.epilogue.cass] narrator: Cass is in the plant room at the end. She is draining the last line by hand so nothing freezes and bursts over winter. "Somebody ought to," she says. She screws the cap onto the last valve and wipes her gloves. She gives you a flask from her coat. "Did you sleep? Come back to mine. I've got a spare room. The kettle works."
- [end.bankrupt.epilogue.bea] narrator: Bea walks out past the gate with her toolbox in one hand. The wrench is on top. Behind her the roof is bare. "I took the panels down myself," she says. "I bought them with my own money. I've got the receipt. The receiver read it twice." She puts the toolbox down. "They're in my van. There's room for the other ladder. Come on."
- [end.bankrupt.epilogue.mel] narrator: Mel is carrying out the one jar the receiver allowed her, in both hands. It's empty. The cultures died when the power was cut on Tuesday. "I'm sorry," she says. "I should have asked for a generator. I didn't think to." She has her glove on the other hand. "The glove is mine. I checked." She waits by the door for you to come with her. "If you like."
- [end.bankrupt.epilogue.luci] narrator: Luci is the last one left in the finance office. The receiver let her keep the ledger, and she has it under her arm. "We were short by two hundred thousand, on the day," she says. "I priced it three times." She takes the gold pen out of her pocket and puts it in yours. "It's real gold. Sell it and pay the first month of rent. That's not sentiment. It's the best price you'll get."

## 15. Lessons

### Lesson 1: Your First Rack (`first_watt`)

> Done when: [{"metric":"racks","op":">=","value":1}].
- [first_watt.rack.objective] Objective: Place a rack on the glowing spot
- [first_watt.rack.say1] bea: Hi. I'm Bea. I do power. Welcome to the hall.
- [first_watt.rack.say2] bea: It's empty. Let's build a working computer room, one piece at a time.
- [first_watt.rack.say3] bea: First piece: a {{rack|rack}}. It's a tall cabinet full of GPU chips. The chips do the computing that clients pay for.
- [first_watt.rack.say4] bea: Open Racks in the build bar. Pick the AC-1. Click the glowing spot.
- [first_watt.rack.after1] bea: There. Look at it. Dark. It has a cable under it, but nothing feeding the cable.

> Done when: [{"metric":"supplyKw","op":">","value":0}].
- [first_watt.power.objective] Objective: Place the Grid Intake in the basement
- [first_watt.power.say1] bea: A rack needs power. Power comes in through a Grid Intake. It's the plug into the city.
- [first_watt.power.say2] bea: Open Power in the build bar. Pick Grid Intake. Click the glowing spot in the basement.
- [first_watt.power.after1] bea: Lights on. The intake can give 1,500 kW.
- [first_watt.power.after2] bea: A {{kw|kW}} is how hard something pulls right now. Your rack pulls up to 40 kW when it works.
- [first_watt.power.after3] bea: The goal bar at the top shows it. LOAD is what the hall pulls. CAPACITY is what the intake can give.

> Done when: [{"metric":"coolers","op":">=","value":1}].
- [first_watt.cool.objective] Objective: Place an air handler next to the rack
- [first_watt.cool.say1] bea: Cass. Cooling. Did you sleep? Never mind.
- [first_watt.cool.say2] bea: Every kW a rack uses turns into heat. A 40 kW rack is a 40 kW heater.
- [first_watt.cool.say3] bea: Too hot, and it slows down. Hotter still, and it shuts itself off.
- [first_watt.cool.say4] bea: An {{crah|air handler}} pulls the hot air away. Open Cooling. Pick the Air Handler. Click the glowing spot.
- [first_watt.cool.after1] bea: Good. The heat view is on. Red is hot, blue is cool.
- [first_watt.cool.after2] bea: Heat counts in kW too. Whatever the rack pulls, the air handler has to carry away.

> Done when: [{"metric":"racksBusy","op":">=","value":1}].
- [first_watt.run.objective] Objective: Watch the rack pick up its first job
- [first_watt.run.say1] bea: A client just sent a job. A job is work for your racks to do.
- [first_watt.run.say2] bea: Watch the rack pick it up.
- [first_watt.run.after1] bea: Running. That's the whole loop. Power in, work done, heat out.
- [first_watt.run.after2] bea: See PUE in the goal bar? {{pue|PUE}} is the hall's total power divided by what the racks use. 1.0 would be no waste.
- [first_watt.run.after3] bea: Yours is higher. The air handler and the lift burn power too. Good halls keep PUE low.

> Done when: immediately.
- [first_watt.hold.objective] Objective: Keep it running cool for three hours
- [first_watt.hold.say1] bea: Let the clock run for three hours. Keep the rack busy and the temperature down.
- [first_watt.hold.say2] bea: I'll watch the meter. Cass will watch the heat.

### Lesson 2: Earn Your Keep (`earn_your_keep`)

> Speaker: Luci. Scenario `lesson_earn`. Every line in the steps is spoken by the lesson's advisor.
- [earn_your_keep.title] Title: Earn Your Keep
- [earn_your_keep.concept] Concept: Earn: contracts pay for work. Jobs need running racks, storage for their data, and spare parts and bots to stay up.
- [earn_your_keep.goal] Goal: Finish two contracts.
- [earn_your_keep.learned] Learned: {{inference|Inference}} pays while it runs. {{training|Training}} pays when it ends. Both need powered, cooled racks, and training also needs storage for its data. Spare parts and bots keep racks earning when something breaks.
- [earn_your_keep.outro] luci: Two contracts paid. Racks busy, data stored, a crew on call. For the record, that's a business. Next, Mel will show you how it grows.

> Done when: [{"metric":"jobsLive","op":">=","value":1}].
- [earn_your_keep.accept.objective] Objective: Accept the contract on the board
- [earn_your_keep.accept.say1] luci: Luci Ferro. CFO. Call me Luci, Operator.
- [earn_your_keep.accept.say2] luci: A rack that sits idle costs you. A rack that works pays you. That's the whole business.
- [earn_your_keep.accept.say3] luci: Clients post contracts on the board. Open Contracts. Press C, or use the tab on the right.
- [earn_your_keep.accept.say4] luci: This one is {{inference|inference}}. A client keeps asking a model questions, and pays every minute you keep up. Press Accept.
- [earn_your_keep.accept.after1] luci: Signed. Your racks pick it up on their own. Money starts when they run.

> Done when: [{"metric":"jobsDone","op":">=","value":1}].
- [earn_your_keep.paid.objective] Objective: Keep the racks running until the job pays
- [earn_your_keep.paid.say1] luci: Now the only job is not breaking anything.
- [earn_your_keep.paid.say2] luci: Power on, cooling on, racks working. Watch TREASURY at the top. Wait for the contract to end.
- [earn_your_keep.paid.after1] luci: There. Paid. For the record, that's revenue. Power and upkeep come out of it.
- [earn_your_keep.paid.after2] luci: The PER HOUR figure at the top shows what's left.

> Done when: [{"metric":"storageRacks","op":">=","value":1}].
- [earn_your_keep.storage.objective] Objective: Place a Storage Array on the glowing spot
- [earn_your_keep.storage.say1] luci: Cass. Did you see the new contract on the board? {{training|Training}}. One big job, paid when it's done.
- [earn_your_keep.storage.say2] luci: It's worth more, and it brings a dataset: 1,000 TB. Try to accept it. Go on.
- [earn_your_keep.storage.say3] luci: Refused? That's why: there's no room for the data. A job's data lives on a Storage Array.
- [earn_your_keep.storage.say4] luci: Open Racks. Pick the Storage Array. It does no computing. It only holds data. Click the glowing spot.
- [earn_your_keep.storage.after1] luci: Now there's room. Storage doesn't earn by itself. It lets the racks earn.

> Done when: [{"metric":"jobsLive","op":">=","value":1}].
- [earn_your_keep.train.objective] Objective: Accept the training contract
- [earn_your_keep.train.say1] luci: Luci. Good. Now open Contracts and accept it.
- [earn_your_keep.train.say2] luci: A training job pays when it's finished, so be patient. If the storage ever goes dark, the job stalls. No data, no work.
- [earn_your_keep.train.after1] luci: Signed. The racks are on it.

> Done when: [{"metric":"parts","op":">=","value":1}].
- [earn_your_keep.parts.objective] Objective: Buy spare parts in Supplies
- [earn_your_keep.parts.say1] luci: Racks break. Nothing breaks today. Something will tomorrow.
- [earn_your_keep.parts.say2] luci: A broken rack earns nothing until it's fixed. A fix uses one spare part.
- [earn_your_keep.parts.say3] luci: Open Supplies in the build bar. Buy 5 spare parts.
- [earn_your_keep.parts.after1] luci: Good. They wait in the depot until they're needed.

> Done when: [{"metric":"bots","op":">=","value":1}].
- [earn_your_keep.bot.objective] Objective: Buy a maintenance bot in Supplies
- [earn_your_keep.bot.say1] luci: Parts sit in a depot. A bot carries one to the broken rack and fixes it.
- [earn_your_keep.bot.say2] luci: Same tab. Buy a Rover.
- [earn_your_keep.bot.after1] luci: That's your repair crew. Parts in the depot. A bot to carry them.

> Done when: immediately.
- [earn_your_keep.finish.objective] Objective: Let the training job finish
- [earn_your_keep.finish.say1] luci: Last thing. Let the big job finish and take the money.

### Lesson 3: Grow the Tower (`grow_the_tower`)

> Speaker: Mel. Scenario `lesson_grow`. Every line in the steps is spoken by the lesson's advisor.
- [grow_the_tower.title] Title: Grow the Tower
- [grow_the_tower.concept] Concept: Grow: research unlocks new ideas, Levels unlock bigger machines, and the Foreman builds for you.
- [grow_the_tower.goal] Goal: Research two ideas, reach Level 2, and switch on the Foreman.
- [grow_the_tower.learned] Learned: Research points buy new ideas. A Level needs enough PF of racks and enough ideas researched. The Foreman builds racks, cooling and power for you while you do something else.
- [grow_the_tower.outro] mel: Hm. It's growing. That's what it wants. Next is the part I find hard to say out loud: how this ends. Bea has the slides.

> Done when: [{"metric":"techs","op":">=","value":1}].
- [grow_the_tower.research1.objective] Objective: Research Contract Automation
- [grow_the_tower.research1.say1] mel: Hello. I'm Mel. Research. Sorry, I get nervous around new people.
- [grow_the_tower.research1.say2] mel: Your racks earn research points, {{rp|RP}}. You spend them on new ideas. I've put 1,500 in the account to start.
- [grow_the_tower.research1.say3] mel: Open Research. Press R, or use the tab on the right. Pick Contract Automation, then press Research.
- [grow_the_tower.research1.after1] mel: Mm. Noted. That one is done. Ideas are permanent.

> Done when: [{"metric":"techs","op":">=","value":2}].
- [grow_the_tower.research2.objective] Objective: Research Works Foreman
- [grow_the_tower.research2.say1] mel: Ideas open other ideas. The next one is the Works Foreman. A builder who works for you.
- [grow_the_tower.research2.say2] mel: It needs the first idea done, and it costs more. You have enough.
- [grow_the_tower.research2.after1] mel: Two ideas done. Keep that in mind. You'll need exactly two for something else.

> Done when: [{"metric":"racks","op":">=","value":6}].
- [grow_the_tower.racks.objective] Objective: Build two more racks
- [grow_the_tower.racks.say1] mel: Luci. Levels. They're your company's rank. A higher Level opens bigger machines and pays a bonus.
- [grow_the_tower.racks.say2] mel: Find the LEVEL bar at the top. Level 2 asks for two things. 120 PF of racks, and two ideas researched.
- [grow_the_tower.racks.say3] mel: {{pflops|PF}} is how much computing a rack does. You have 80 PF. Two more racks make 120. Place two racks.
- [grow_the_tower.racks.after1] mel: That's 120 PF. Both asks are met.

> Done when: [{"metric":"tier","op":">=","value":2}].
- [grow_the_tower.level.objective] Objective: Wait for Level 2
- [grow_the_tower.level.say1] mel: Levels are awarded at midnight. Let the clock run.
- [grow_the_tower.level.after1] mel: Level 2. For the record, that's a $3.75 million bonus. Spend it well.

> Done when: immediately.
- [grow_the_tower.foreman.objective] Objective: Switch on the Foreman in Automation
- [grow_the_tower.foreman.say1] mel: Now the Foreman. Open Automation. Press T, or use the tab on the right.
- [grow_the_tower.foreman.say2] mel: He builds for you. Racks when contracts need them. An air handler when racks run hot. Power when it runs short.
- [grow_the_tower.foreman.say3] mel: He spends your money, so he keeps a reserve you set. Switch him on.

### Lesson 4: The Three Trees (`the_three_trees`)

> Speaker: Bea. Scenario `lesson_trees`. Every line in the steps is spoken by the lesson's advisor.
- [the_three_trees.title] Title: The Three Trees
- [the_three_trees.concept] Concept: The trees: racks are retrofitted down one of three trees. The Trees panel shows the next step, and the seal can close a tree.
- [the_three_trees.goal] Goal: Retrofit a rack to Green, read the Trees panel, and earn your first Garden points.
- [the_three_trees.learned] Learned: A plain rack scores for no tree. Retrofit it down a tree and it scores for that tree. The Trees panel lists each tree's next step. The Garden runs at half speed on any power and full speed on clean power. Harmful builds fill a tree's seal, and a full seal closes the tree. Taking an advisor's advice raises her bond; overruling her lowers it.
- [the_three_trees.outro] bea: That's everything I've got. Three trees, one race. Pick a road, or mix them. Nobody's stopping you. Go build your tower. Free Build is waiting.

> Done when: [{"metric":"treeRacks","op":">=","value":1}].
- [the_three_trees.retrofit.objective] Objective: Click a rack and retrofit it to Green
- [the_three_trees.retrofit.say1] bea: Bea again. Last lesson. This one's about how the game ends.
- [the_three_trees.retrofit.say2] bea: There are three ways, called trees. The Lattice is Luci's: pure machines. The Flesh is Mel's: living tissue. The Garden is mine: clean power.
- [the_three_trees.retrofit.say3] bea: Each tree is a line of better racks. You join one by retrofitting. Click the rack that's glowing in the world. Its panel opens on the right.
- [the_three_trees.retrofit.say4] bea: Find Retrofit. Pick Green. The rack changes right where it stands.
- [the_three_trees.retrofit.after1] bea: There. An NM-1. It does 50 PF on 12 kW. The old one did 20 PF on 40 kW.
- [the_three_trees.retrofit.after2] bea: And now it counts. A plain rack scores for no tree. Only a retrofitted rack earns points.

> Done when: [{"metric":"tips","op":">=","value":1}].
- [the_three_trees.trees.objective] Objective: Open the Trees panel from the three bars at the top
- [the_three_trees.trees.say1] bea: Now the scoreboard. Click the three coloured bars at the top of the screen.
- [the_three_trees.trees.after1] bea: Three columns, one per tree. Each has its points, a ladder of racks, and a line that starts with Next.
- [the_three_trees.trees.after2] bea: That Next line is your to-do list. It names the research and the retrofit that come next.
- [the_three_trees.trees.after3] bea: The first tree to 1,000 points ends the game its way. Close the panel when you're done reading.

> Done when: [{"metric":"cleanPower","op":">=","value":1}].
- [the_three_trees.clean.objective] Objective: Place PV Wall Panels in Power
- [the_three_trees.clean.say1] bea: Look at the Garden column again. It has a line about clean power.
- [the_three_trees.clean.say2] bea: Garden racks run at half speed on any power. Full speed only on clean power: sun and wind.
- [the_three_trees.clean.say3] bea: So give it some. Open Power. Pick PV Wall Panels. Click the glowing spot.
- [the_three_trees.clean.after1] bea: Panels in. The clean share climbs slowly. Check the Garden column later and watch the speed rise.

> Done when: immediately.
- [the_three_trees.points.objective] Objective: Wait for the Garden's first points
- [the_three_trees.points.say1] bea: Points come in once an hour, from racks that are busy.
- [the_three_trees.points.say2] bea: One more thing: the seal. Each of Flesh and Garden has a SEAL bar. It's a damage meter.
- [the_three_trees.points.say3] bea: Harmful builds fill it, like a diesel generator. Clean ones wear it down. Fill it to 100 and the tree closes for good.
- [the_three_trees.points.say4] bea: Last thing. We advisors keep score of you too. Take our advice and the bond goes up 3. Overrule us and it drops 1.
- [the_three_trees.points.say5] bea: The one with the highest bond, 60 or more, gets the last word when it ends.
- [the_three_trees.points.say6] bea: Now let the clock run until the Garden scores.
