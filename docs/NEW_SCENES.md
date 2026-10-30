# AI Tower: new scenes (draft for the owner)

Same grammar as DIALOGUE.md. Edit only the text after `speaker:` or `Label:`. Lines starting with `>` are notes for you and for the importer's metadata. Existing scenes were checked: none of these ids exist in `story.json` or the owner's file.

## What is new, and what code each needs

| id | When it fires, in plain words | New code? | Backdrop |
|--|--|--|--|
| seal_biotech | The Flesh (biotech) seal reaches 100 | Yes: story trigger `{kind:"seal", tree:"biotech"}`, one `case` in `storyHolds` (`decisions.ts`) using `isSealed(state, content, tree)` (`soul.ts`) | B1 · WETWARE ANNEX (`bg-loc-wetware-annex`) |
| seal_greentech | The Garden (greentech) seal reaches 100 | Yes: same, `tree:"greentech"` | ROOF · PANEL DECK (`bg-loc-panel-deck`) |
| bond50_luci | Luci's bond first reaches 50 | Yes: story trigger `{kind:"bond", advisor, atLeast:50}`, one `case` reading `state.bonds[advisor]` | F1 · FINANCE OFFICE |
| bond50_mel | Mel's bond first reaches 50 | Yes: same | B1 · WETWARE ANNEX |
| bond50_bea | Bea's bond first reaches 50 | Yes: same | ROOF · PANEL DECK |
| bond50_cass | Cass's bond first reaches 50 | Yes: same | B1 · PLANT ROOM |
| end.*.epilogue.fallback (5 paragraphs) | Ending screen, only when `epilogueAdvisor` returns null (nobody at bond 60) | Yes: new `epilogue.fallback` string per ending in `endings.json` and a null branch in `EndingScene.tsx` | the ending's own art |
| cass_night_shift | Day 10 of the game, a story scene | No: existing `{kind:"tick", atLeast:14400}` plus `minDay: 10` (1 tick = 1 minute, 1440 per day) | B1 · PLANT ROOM |
| ach_unlock_luci / mel / bea / cass | Opening her casual portrait in the gallery | Yes: the whole achievements UI is unbuilt (`ACHIEVEMENTS.md`) | the portrait itself |
| ach_bed_intro | The 18th achievement lands, first gallery visit after | Yes: same | gallery |
| ach_bed_luci / mel / bea / cass | Opening a bed portrait | Yes: same | the portrait itself |
| ach_gallery_empty | First visit to the gallery | Yes: same | gallery |
| ach_hint_luci / mel / bea / cass | Selecting a locked off-duty frame | Yes: same | the dimmed bust |

Seal scenes: nothing covers this today. `obj_greentech` and `obj_biotech` are the only lock-adjacent scenes. They only fire on placing a facility, and `issueStory` skips them once the tree is sealed (`isSealed` check), so nothing speaks at the moment of sealing. Scenes issue one at a time, 120 ticks after the last answered decision (`STORY_SPACING_TICKS`), so a seal scene may arrive up to two hours late. That is fine.

Bond note: the epilogue bar stays 60. Bond 50 is the "she will speak at the end" signal. Each bond beat quietly says "come find me when it's over". Headless runs reach 50 for Luci and Bea, 38 for Mel, about 30 for Cass, so Mel and Cass may be rare. Consider 40 for those two. The `atLeast` number is the only thing to change.

No new art is needed. Every location reuses an existing backdrop. The gallery scenes sit on the portrait frames.

---

## A1. Seal scenes

### seal_biotech — The Flesh Closes
> trigger: new `{kind:"seal", tree:"biotech"}`, once, when biotech seal first reaches 100
> location: B1 · WETWARE ANNEX
> speaker: Mel. recommended: `stay`
> note: the racks keep running after sealing but stop scoring, so Luci says it plainly. This is the only place the player is told.
- [seal_biotech.title] Title: The Flesh Closes
- [seal_biotech.location] Location: B1 · WETWARE ANNEX
- [seal_biotech.caption] Caption: The annex panel has changed. Mel is standing in front of it. Cass is in the doorway.
- [seal_biotech.l1] narrator: Technicians and bots work around you sealing lines.  Mel is posting closed signs over tube inputs. Cass is in the doorway.
- [seal_biotech.l2] mel: Nothing more to do my babies.
- [seal_biotech.l3] mel: I'm sorry I couldn't do more. 
- [seal_biotech.l4 mood=pleased] luci: They still work Mel, just in check like they're supposed to be. 
- [seal_biotech.l5] cass: Almost like any other rack. 
- [seal_biotech.l6 mood=unsettling] mel: Heh, I guess.. *she holds back a sob*
- [seal_biotech.l7] mel: You guys can go, I have some work to finish here. 

Choice `stay` (recommended):

- [seal_biotech.stay.label] Label: Stay with her a minute.
- [seal_biotech.stay.hint] Hint: Mel will like that.
- [seal_biotech.stay.outcome] Outcome: You stood next to Mel at the panel until she was done closing the input. 
> Effects: Mel bond +3.
- [seal_biotech.stay.r1 mood=pleased] mel: Thank you.
- [seal_biotech.stay.r2] mel: They did well. For a while they did very well.

Choice `other`:

- [seal_biotech.other.label] Label: We're pivoting is all, nothing but numbers Mel. 
- [seal_biotech.other.hint] Hint: Luci will like that.
- [seal_biotech.other.outcome] Outcome: You said the word another. Mel took the jar downstairs.
> Effects: Luci bond +1; Mel bond -1.
- [seal_biotech.other.r1] mel: Yes. Of course.
- [seal_biotech.other.r2 mood=pleased] luci: Good. Remember we are the sails blown by our clients wind. 

### seal_greentech — The Garden Closes
> trigger: new `{kind:"seal", tree:"greentech"}`, once, when greentech seal first reaches 100
> location: ROOF · PANEL DECK
> speaker: Bea. recommended: `own`
- [seal_greentech.title] Title: The Garden Closes
- [seal_greentech.location] Location: ROOF · PANEL DECK
- [seal_greentech.caption] Caption: The leaf badge on the cabinet has gone grey. Bea is sitting on the parapet with her clipboard on her knees.
- [seal_greentech.l1] narrator: The leaf badge on the cabinet has gone grey. Bea is sitting on the parapet with her clipboard on her knees.
- [seal_greentech.l2] bea: Well I tried to make the world a better place. 
- [seal_greentech.l3] bea: Guess people want their information regardless of the planet. 
- [seal_greentech.l4] bea: And you just all go along with it, it just makes too much damn logical sense you yall doesn't it.
- [seal_greentech.l5] cass: Bea.. The panels still work, we're still helping something.
- [seal_greentech.l6 mood=pleased] luci: A cost saving measure for sure... 
- [seal_greentech.l7] bea: ...Hmm 

Choice `own` (recommended):

- [seal_greentech.own.label] Label: That one was on me.
- [seal_greentech.own.hint] Hint: Bea will like that.
- [seal_greentech.own.outcome] Outcome: You told Bea the Garden closing was your call. She didn't argue.
> Effects: Bea bond +3.
- [seal_greentech.own.r1] bea: Okay.
- [seal_greentech.own.r2 mood=pleased] bea: Thanks for owning up to it at least. You're still a scoundrel.

Choice `other`:

- [seal_greentech.other.label] Label: We'll go another direction. 
- [seal_greentech.other.hint] Hint: Luci will like that.
- [seal_greentech.other.outcome] Outcome: You turned to the stairwell. Bea stayed up on the roof a while.
> Effects: Luci bond +1; Bea bond -1.
- [seal_greentech.other.r1] bea: Sure. I'll be up here.
- [seal_greentech.other.r2 mood=pleased] luci: I'm pleased with you Operator. 

---

## A2. Bond 50 beats

> One per advisor. No mechanics are mentioned. Each ends by asking the player to find her at the end, which is the player's cue that her epilogue is in reach. The single choice is only a Continue button; drop it if the engine allows a scene with no choice.

### bond50_luci — Ms. Ferro Stays Late
> trigger: new `{kind:"bond", advisor:"luci", atLeast:50}`, once
> location: F1 · FINANCE OFFICE
- [bond50_luci.title] Title: Ms. Ferro Stays Late
- [bond50_luci.location] Location: F1 · FINANCE OFFICE
- [bond50_luci.l1] narrator: The finance office light is still on. Luci doesn't look up from the ledger.
- [bond50_luci.l2 mood=pleased] luci: You've been right about more things than I expected from you.
- [bond50_luci.l3] luci: I never said that to you, officially that is. Unofficially I think we have some unfinished business. 
- [bond50_luci.l4] luci: When this is over, come and see me. We'll settle up.

Choice `ok`:

- [bond50_luci.ok.label] Label: I'll bring the pen.
- [bond50_luci.ok.hint] Hint: She'll remember.
- [bond50_luci.ok.outcome] Outcome: Luci smiles and writes something small in her calendar. 

### bond50_mel — Mel Offers a Seat
> trigger: new `{kind:"bond", advisor:"mel", atLeast:50}`, once. Suggest 40 for Mel: headless runs only reach 38.
> location: B1 · WETWARE ANNEX
- [bond50_mel.title] Title: Mel Offers a Seat
- [bond50_mel.location] Location: B1 · WETWARE ANNEX
- [bond50_mel.l1] narrator: Mel pulls a stool out from under the bench. You've never seen her more since you've been here. 
- [bond50_mel.l2] mel: Sit. Please. 
- [bond50_mel.l3] mel: You listen when I talk about them. I like that, and they like that. 
- [bond50_mel.l4 mood=pleased] mel: We'll be here waiting for your ear. 

Choice `ok`:

- [bond50_mel.ok.label] Label: I'd like that.
- [bond50_mel.ok.hint] Hint: She'll remember.
- [bond50_mel.ok.outcome] Outcome: You sat on the stool. The vats hummed. Mel spoke about things you didn't understand for hours, but it felt like minutes. 

### bond50_bea — Bea Shares Her Lunch
> trigger: new `{kind:"bond", advisor:"bea", atLeast:50}`, once
> location: ROOF · PANEL DECK
- [bond50_bea.title] Title: Bea Shares Her Lunch
- [bond50_bea.location] Location: ROOF · PANEL DECK
- [bond50_bea.l1] narrator: Bea is on the roof with two sandwiches. She holds one out without looking.
- [bond50_bea.l2 mood=pleased] bea: Cheese. It's the only kind I make.
- [bond50_bea.l3] bea: Hey, if this all goes sideways, I'll be down at the river.
- [bond50_bea.l4] bea: Just saying, in case you need someone.

Choice `ok`:

- [bond50_bea.ok.label] Label: Take the sandwich.
- [bond50_bea.ok.hint] Hint: She'll remember.
- [bond50_bea.ok.outcome] Outcome: You thank her for lunch and she punches you. 

### bond50_cass — Cass Pours Two
> trigger: new `{kind:"bond", advisor:"cass", atLeast:50}`, once. Suggest 40 for Cass: headless runs sit near 30.
> location: B1 · PLANT ROOM
- [bond50_cass.title] Title: Cass Pours Two
- [bond50_cass.location] Location: B1 · PLANT ROOM
- [bond50_cass.l1] narrator: There are two mugs on the gauge board this time. Cass must have been expecting you. 
- [bond50_cass.l2 mood=pleased] cass: There you are, grab a cup. 
- [bond50_cass.l3] cass: You ask me what I think, I appreciate that you listen. That's rare. 
- [bond50_cass.l4] cass: When it's over, find me at the lodge. 

Choice `ok`:

- [bond50_cass.ok.label] Label: Thanks for the mug.
- [bond50_cass.ok.hint] Hint: She'll remember.
- [bond50_cass.ok.outcome] Outcome: The coffee was instant. It was hot, which was the point.

---

## A2b. Fallback epilogues (nobody reached bond 60)

> trigger: new. On the ending screen, if `EndingScene.epilogueAdvisor` returns null, show this paragraph in place of an advisor epilogue. Store as `epilogue.fallback` in `endings.json`. Lattice is `singularity` in the data.
- [end.singularity.epilogue.fallback] narrator: Nobody is waiting for you. The kitchen is empty and the kettle is cold. On your desk there's a note in your own handwriting, which you didn't write. It says thank you, and that you can go home. You stay a while at the window. The drones go over, one after another, and the city is very quiet.
- [end.flesh.epilogue.fallback] narrator: The basement is warm. Nobody has come up to meet you. On your desk there's a mug, still steaming, and you never find out who left it. The walls rise and fall slowly. After a while you notice you are breathing with them.
- [end.garden.epilogue.fallback] narrator: The roof is empty and the sun is already up. Somebody left a note that says back by dark. You sit on the step. The solar panels and sunflowers turn toward the light. For a while there is nothing to do so you stare at the stars. 
- [end.absorbed.epilogue.fallback] narrator: Your desk is clean, and your mug is on it. Nobody has stopped by since last week, but it's hard to remember when last week actually was. You look at your hands and they look like yours. But when an approval comes across your screen your fingers act of their own accord to approve it.
- [end.bankrupt.epilogue.fallback] narrator: Nobody stays for the handover. The receiver's clerk gives you a cardboard box for your things. There's a mug in it that isn't yours, and you take it anyway. Rain comes in through the broken pane. At the gate, the guard says take care. 

---

## A3. Cass, in her own scene

### cass_night_shift — Night Shift
> trigger: existing `{kind:"tick", atLeast:14400}` with `minDay: 10` and `minTier: 1`. No new code. (The scene is set after midnight whatever the clock says. An uptime-dip trigger would also fit but needs new code.)
> location: B1 · PLANT ROOM
> speaker: Cass. recommended: `ask`
- [cass_night_shift.title] Title: Night Shift
- [cass_night_shift.location] Location: B1 · PLANT ROOM
- [cass_night_shift.caption] Caption: It's past midnight. Cass has the panel off number two compressor and a flashlight in her teeth.
- [cass_night_shift.l1] narrator: It's past midnight. Cass has the panel off number two compressor and a flashlight in her teeth.
- [cass_night_shift.l2] cass: Oh. Hey, Hold onto this?
- [cass_night_shift.l3] narrator: You hold the flashlight. The compressor shudders and catches.
- [cass_night_shift.l4] cass: Bearing's going. *she wipes the sweat from her brow*
- [cass_night_shift.l5] cass: FUBAR'd for sure. 
- [cass_night_shift.l6] cass: Parts are slow now, I'll just try some more grease. 
- [cass_night_shift.l7] cass: Thanks for the help, Did you come down to say something?
- [cass_night_shift.l8] narrator: You didn't. You couldn't sleep either.
- [cass_night_shift.l9 mood=pleased] cass: Couldn't sleep? Me neither, most nights.
- [cass_night_shift.l10] cass: But something needs fixing all the time. 
- [cass_night_shift.l11] cass: Want the real version of this tower? Not the spreadsheet view? 

Choice `ask` (recommended):

- [cass_night_shift.ask.label] Label: Tell me the honest version.
- [cass_night_shift.ask.hint] Hint: Cass will like that.
- [cass_night_shift.ask.outcome] Outcome: Cass told you. It took ten minutes and she didn't soften any of it.
> Effects: Cass bond +4.
- [cass_night_shift.ask.r1] cass: It's old. It's loud.
- [cass_night_shift.ask.r2] cass: Without us and duct tape, it would be beyond FUBAR'd. 
- [cass_night_shift.ask.r3 mood=pleased] cass: But it needs me, I like being needed. 

Choice `order`:

- [cass_night_shift.order.label] Label: Order the bearing now. Rush it.
- [cass_night_shift.order.hint] Hint: -$12k now. Cass will say what she thinks.
- [cass_night_shift.order.outcome] Outcome: You rang the supplier from the plant room. Cass wrote the part number on her glove.
> Effects: cash amount=-12000; Cass bond +2; Luci bond -1.
- [cass_night_shift.order.r1] cass: You rushed it??
- [cass_night_shift.order.r2] cass: But I won't say no. Thanks.
- [cass_night_shift.order.r3 mood=displeased] luci: I'll find the funds.  I guess. 

---

## B. Achievements and gallery

> All of these are UI-fired (unbuilt, see `ACHIEVEMENTS.md` section 5). The last line of each `ach_unlock_*` is the portrait's caption.

### ach_unlock_luci — Off the Clock: Luci
> trigger: opening Luci's casual portrait (Lattice ending, loan cleared, bond 50)
> location: GALLERY · OFF DUTY
- [ach_unlock_luci.title] Title: Off the Clock
- [ach_unlock_luci.location] Location: GALLERY · OFF DUTY
- [ach_unlock_luci.l1] narrator: A frame opens. Luci, in red, with a glass she isn't drinking from.
- [ach_unlock_luci.l2 mood=pleased] luci: What a day. Finally some me time. 
- [ach_unlock_luci.l3] luci: Care to join me for a drink Operator? 

### ach_unlock_mel — Off the Clock: Mel
> trigger: opening Mel's casual portrait (Flesh ending, corruption under 0.5, bond 40)
> location: GALLERY · OFF DUTY
- [ach_unlock_mel.title] Title: Off the Clock
- [ach_unlock_mel.location] Location: GALLERY · OFF DUTY
- [ach_unlock_mel.l1] narrator: Mel's chair is tipped back. Her boots are off, and a mug has gone cold at her elbow.
- [ach_unlock_mel.l2] mel: Oh, Operator! 
- [ach_unlock_mel.l3] mel: Come join me for a conversation, I can make more tea.

### ach_unlock_bea — Off the Clock: Bea
> trigger: opening Bea's casual portrait (Garden ending, green seal under 50, bond 50)
> location: GALLERY · OFF DUTY
- [ach_unlock_bea.title] Title: Off the Clock
- [ach_unlock_bea.location] Location: GALLERY · OFF DUTY
- [ach_unlock_bea.l1] narrator: Bea is by the river, boots in the grass, a line in the water.
- [ach_unlock_bea.l2] bea: You! No more peace and quiet, but come have a seat. 
- [ach_unlock_bea.l3 mood=pleased] bea: Nothing's biting. But it's about the best day I've had.

### ach_unlock_cass — Off the Clock: Cass
> trigger: opening Cass's casual portrait (uptime streak of 20 days)
> location: GALLERY · OFF DUTY
- [ach_unlock_cass.title] Title: Off the Clock
- [ach_unlock_cass.location] Location: GALLERY · OFF DUTY
- [ach_unlock_cass.l1] narrator: You enter the lodge room. The steam and smell of a sauna hits your nostrils.
- [ach_unlock_cass.l2] cass: Ready to get warm? 
- [ach_unlock_cass.l3 mood=pleased] cass: Come on in, I won't bite. 

### ach_bed_intro — The Last Door
> trigger: the 18th achievement lands; the first gallery visit after
> location: GALLERY · OFF DUTY
- [ach_bed_intro.title] Title: The Last Door
- [ach_bed_intro.location] Location: GALLERY · OFF DUTY
- [ach_bed_intro.l1] narrator: Something's clicked.  The singularity has been fulfilled across multiple different timelines. 
- [ach_bed_intro.l2] narrator: You walk down a white hallway for what seems like ages. There are 4 doors ready to open. 

### ach_bed_luci — After Hours: Luci
> trigger: opening Luci's bed portrait. Quiet, at rest, covered, no pose to the viewer.
> location: GALLERY · OFF DUTY
- [ach_bed_luci.title] Title: After Hours
- [ach_bed_luci.location] Location: GALLERY · OFF DUTY
- [ach_bed_luci.l1] luci: Stay until it's light, time to settle up. 

### ach_bed_mel — After Hours: Mel
> trigger: opening Mel's bed portrait
> location: GALLERY · OFF DUTY
- [ach_bed_mel.title] Title: After Hours
- [ach_bed_mel.location] Location: GALLERY · OFF DUTY
- [ach_bed_mel.l1] mel: I sleep badly. It's easier when I'm with someone. 

### ach_bed_bea — After Hours: Bea
> trigger: opening Bea's bed portrait
> location: GALLERY · OFF DUTY
- [ach_bed_bea.title] Title: After Hours
- [ach_bed_bea.location] Location: GALLERY · OFF DUTY
- [ach_bed_bea.l1] bea: There you are, I've been waiting. 

### ach_bed_cass — After Hours: Cass
> trigger: opening Cass's bed portrait
> location: GALLERY · OFF DUTY
- [ach_bed_cass.title] Title: After Hours
- [ach_bed_cass.location] Location: GALLERY · OFF DUTY
- [ach_bed_cass.l1] cass: Shh, shut the door and get under the covers. 

### ach_gallery_empty — Nothing Yet
> trigger: first visit to the gallery, before any portrait is earned
> location: GALLERY · OFF DUTY
- [ach_gallery_empty.title] Title: Nothing Yet
- [ach_gallery_empty.location] Location: GALLERY · OFF DUTY
- [ach_gallery_empty.l1] narrator: The frames are dim and nobody has come to hang anything.

### ach_hint_luci — Locked Frame: Luci
> trigger: selecting Luci's locked frame
> location: GALLERY · OFF DUTY
- [ach_hint_luci.title] Title: Locked Frame
- [ach_hint_luci.location] Location: GALLERY · OFF DUTY
- [ach_hint_luci.l1] luci: We aren't there yet. 

### ach_hint_mel — Locked Frame: Mel
> trigger: selecting Mel's locked frame
> location: GALLERY · OFF DUTY
- [ach_hint_mel.title] Title: Locked Frame
- [ach_hint_mel.location] Location: GALLERY · OFF DUTY
- [ach_hint_mel.l1] mel: How far will these bodies take us I wonder. 

### ach_hint_bea — Locked Frame: Bea
> trigger: selecting Bea's locked frame
> location: GALLERY · OFF DUTY
- [ach_hint_bea.title] Title: Locked Frame
- [ach_hint_bea.location] Location: GALLERY · OFF DUTY
- [ach_hint_bea.l1] bea: We got to make a difference. 

### ach_hint_cass — Locked Frame: Cass
> trigger: selecting Cass's locked frame
> location: GALLERY · OFF DUTY
- [ach_hint_cass.title] Title: Locked Frame
- [ach_hint_cass.location] Location: GALLERY · OFF DUTY
- [ach_hint_cass.l1] cass: Can you keep it up? 
