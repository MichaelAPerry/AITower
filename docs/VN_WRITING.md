# VN writing rules and voice sheets

**Read `docs/VN_SAMPLE.md` first. It is the bar.** The owner judged the first two rewrites "stilted and strange", like a machine wrote them. Those eight rules override everything below where they conflict:

1. Short lines, mostly under 12 words, one thought each.
2. Contractions and spoken grammar. Fragments are fine.
3. Subtext, not explanation. Nobody names their own feeling.
4. No zingers. At most one sharp line per scene, usually Luci's. No aphorisms, no fortune-cookie metaphors, no "X, and I hate that Y".
5. Mundane detail: ladders, mugs, the lift, lunch.
6. People react to the last thing said, sometimes sideways or not at all.
7. Silence and action carry it. Use a narrator line ("Bea doesn't answer.") instead of a speech.
8. Read it aloud. If a person wouldn't say it to a coworker, cut it.

How the story text in `packages/content/src/data/story.json`, `endings.json` and `lessons.json` is written, and why. Read this before editing any line of dialogue.

## Sources, and what I could and could not reach

- **Lemma Soft Forums** (lemmasoft.renai.us) answered every direct fetch with HTTP 403, and the Wayback Machine is blocked here. I could only read the search-engine excerpts of Lemmasoft's "Creator Discussion" threads. I took from them what the excerpts say and nothing more. I never read the full threads.
  - [Narrating in a Visual Novel?](https://lemmasoft.renai.us/forums/viewtopic.php?t=25440): trim prose that the art can show; narrate only what the player cannot see or hear.
  - [Will a dialogue-only Visual Novel work?](https://lemmasoft.renai.us/forums/viewtopic.php?f=4&t=32376): pure dialogue tends to go vague or awkward, so keep a little narration.
  - [Characters Speaking Off Screen](https://lemmasoft.renai.us/forums/viewtopic.php?t=23772) and [The best way to display thoughts/narration?](https://lemmasoft.renai.us/forums/viewtopic.php?t=36954): mark narration consistently, and carry physical reaction through sprite and expression.
  - [What Are Some Common Visual Novel Clichés?](https://lemmasoft.renai.us/forums/viewtopic.php?start=15&t=30192): the cliché list; avoid stock archetypes.
  - [Changes to Writing due to NVL](https://lemmasoft.renai.us/forums/viewtopic.php?p=424324): when art carries less, keep monologue and description minimal.
- **Read in full**
  - [Storyteller Kim, "Why (Some) Visual Novels Are Boring"](https://storytellerkim.com/index.php/2020/11/20/why-some-visual-novels-are-boring): cut filler; give players only what they need; avoid stock archetypes; shallow relationships are the failure.
  - [Two and a Half Studios / Gabmag, VN tips](https://twoandahalfstudios.com/2020/10/visual-novel-tips-and-tricks-with-gabmag-1): every character is pursuing something, even if implicit; no long monologues; read lines aloud; short descriptions.
  - [Emily Short, "Beyond Branching"](https://emshort.blog/2016/04/12/beyond-branching-quality-based-and-salience-based-narrative-structures/): numeric state over booleans; characters should comment on what the player did; broad defaults plus specific callbacks.
  - [itch.io thread, "how do you write a visual novel effectively"](https://itch.io/t/2388254/how-do-you-write-a-visual-novel-effectively-and-in-an-engaging-way): inciting incident inside the first hundred clicks; do not narrate what the art already shows; first drafts are rarely good; avoid heavy slang for non-native readers. It also recommends Gwen Hayes' *Romancing the Beat* for romance structure. I have not read that book and only pass the pointer on.

## The rules

### Voice
1. **Cover-the-nameplate test.** Every line must be attributable to its speaker with the name hidden. If two advisors could swap a line, rewrite it. (Gabmag: know how *they* would react, not you.)
2. **Each advisor has a want in every scene,** usually unstated (Gabmag). Write what she wants, then let her not say it.
3. **Each advisor has a sentence shape** (see the voice sheets): length, rhythm, vocabulary field, tics. Tics appear in about one line in four, never in every line.
4. **No archetype in a box** (Kim, Lemmasoft clichés). Luci is tsundere only on the surface; under it she is afraid. Bea is "the angry one" only until she is shown being tender about a fern.
5. **Specific beats abstract.** "The river smells of diesel" beats "the environment is suffering". One concrete object per scene (a fern, a pen, a glove, a mug).

### Length and pace
6. **Short lines.** The dialogue box holds about two lines. Aim for one idea and under 12 words per line; 14 is the soft ceiling and 20 the hard one (narrator scene-setters may run a little longer). No monologues (Gabmag). Break long thoughts across speakers or a beat.
7. **Scene shape: 3 to 6 lines, then a choice.** The first choice arrives by click 7 or earlier (itch.io: inciting incident inside 100 clicks; this game has 27 scenes, so each scene must earn its place within 10).
8. **Cut filler** (Kim). If a line is not a want, a reveal, a joke or a turn, delete it. Realistic filler is still filler.
9. **Narration is a spice.** The art shows the room and the portrait shows the face, so narration appears only to set a scene at its start, or to land a beat the art cannot (Lemmasoft narration threads). The narrator never states a feeling. It states an object doing something.

### Show, don't tell
10. **No feeling words in narration or outcomes.** Not "Luci looked delighted"; "Luci underlined it twice." Not "Bea was upset"; "Bea put the watering can down very carefully."
11. **Subtext over statement.** Characters answer a different question from the one asked when they are afraid. Luci answers a feeling with a price. Mel answers fear with a measurement. Bea answers grief with a joke or a shout. Cass answers a question with a question, or a mug.
12. **Mood tags are punctuation, not decoration.** `pleased`, `displeased` and `unsettling` mark a turn, and `neutral` is the default. Do not tag every line.

### Choices
13. **Choices differ in values, not in good versus evil.** Each option is something a real person might say for a reason, and each is a choice of whom to side with.
14. **Labels are speakable.** First person, under 8 words, in the Operator's plausible voice. No label begins "Agree with" or "Push back". Those are what `hint` is for.
15. **Hints name the stake in one short phrase,** and keep any mechanical suffix (for example "-$200k now") exactly. The hint is a sign on the door, not a spoiler.
16. **Every option gets an answer** (Emily Short: characters comment on what you did). The advisor most affected speaks first, and her reply changes her stance in a visible way, not just her mood.
17. **A cost on at least one option in every scene.** If every choice is free, none is a choice.
18. **Outcome lines are one action beat in past tense, second person,** with a concrete object. They are what the log will remember.

### Relationships (dating-sim route feel)
19. **Each advisor has a four-step arc across her scenes:** guarded, tested, exposed, offered (what she gives you at the end). Early scenes show her armour, middle scenes show the armour costing her something, late scenes show what is under it.
20. **Callbacks use only things that happen whatever the player chose.** Scenes can branch only on bond and effects, never on text, so a callback must be to a fact: Cass's coffee, Luci's pen, Mel's glove, Bea's wrench, the ferns, the window. Never to "what you said".
21. **Recurring motifs,** one per advisor, planted early and paid late. They are listed in the voice sheets.
22. **No confession without a price.** A late-arc reveal always costs the speaker something in the same scene (a joke that fails, a denied tremor, a closed ledger).
23. **Cross-talk is characterization.** Advisors interrupt each other in their own registers (Luci monetizes, Bea heckles, Mel asks the oddly sincere follow-up, Cass is dry). Two or three exchanges per scene at most.
24. **Wrong on purpose.** Whenever an advisor steers badly (Luci cheap, Mel monstrous, Bea greenwashing), she has a tell in the text itself: too much cheer, too much politeness, a number that is too good.

### Hygiene
25. Read every line aloud. Contractions in speech. Avoid heavy slang (itch.io, non-native readers); keep the swearing mild (students).
26. Avoid em dashes and stacked ellipses; use full stops, commas, and the occasional single "...".
27. Placeholders and markup stay exactly as found: `{item}` in objections, `{{term|label}}` in lessons. Numbers in lessons must match the sim.

---

## Voice sheets

### Luci Ferro, CFO, champion of the Lattice
- **Sentence shape.** Quick and light. Short sentences, a number now and then. She is selling even when she's being nice. Money words, but not for every line (retention, ledger).
- **Tics.** Calls you "Operator", and "darling" only when she is scheming or flustered. "For the record." Prices things. Answers sentiment with arithmetic. Uses the pen.
- **Wants.** The Singularity, because it is the one thing that has no downside she can see. She wants *you* to be there when it closes, and she has a business reason ready for that.
- **Hides.** She is already partly synthetic and does not know where the edge is. She is afraid that after the Lattice closes she will be the same, and no one will be able to tell.
- **Never says.** "I'm scared." "I don't know." "Please." A plain "thank you". She never apologizes; she offers "a revised figure".
- **Arc.** Intro (charming armour) → "Level 2" (the pitch, and *I'd rather it were you*) → diesel deal (a favour that is also a trap, and she sulks when refused) → Form A-5 (offers to sign for you) → halfway (warm, flirting through pace) → ninety (the eye, the shaking hand, "retention strategy") → epilogue (she lets you see the shake).
- **Motifs.** Gold pen. Ledger. Gold eye. "Stay."
- **Samples.**
  - "We get paid a hundred and fifty thousand to take a year of fuel."
  - "...That isn't sentimental. It's a retention strategy." (the motif; use it once, late)

### Dr. Mel Kiorre, compute and wetware, champion of the Flesh
- **Sentence shape.** Soft, mid-length, hedged ("a little", "I think", "sort of"), with the horror delivered in the same calm register as the small talk. She asks permission for terrible things and apologizes in advance for the weather. Clinical vocabulary applied to feelings (sulking cultures, a sample that flinched).
- **Tics.** "Hm." and "Mm. Noted." Writes on her glove. Says "I find that touching" about a small horror. A trailing "if you like".
- **Wants.** To grow a mind that remembers being a body, because she is not sure she remembers being one herself.
- **Hides.** The stain on her cuff, which is hers. She has already given a lot of herself to the work, and she wants someone to be willing to be next to her, not just to approve.
- **Never says.** A flat "no". A raised voice. A lie; she omits instead. She never calls anything a "thing". It is always "it", with a pronoun that is slightly too warm.
- **Arc.** Intro (shy, strange) → the hypothetical (are you me?) → the cultures sulk (tenderness for tissue) → they flinch (she says what she dislikes about the tower, to your face) → they reject (grief, a kind of pride) → ducts (the monstrous offer, delivered politely) → ninety (asks you to go first, holds your wrist) → epilogue (she takes her glasses off).
- **Motifs.** The glove. The stain on the cuff. The jar. "It".
- **Samples.**
  - "I know 'sulking' isn't a clinical word. I'm using it anyway."
  - "It won't hurt. Well. Not for long."

### Bea Altasar, power, champion of the Garden
- **Sentence shape.** Short. Fragments. She'd rather joke than explain. Verbs from trade work (weld, torque, bleed, ground). When she is moved she gets *shorter*, not longer. Capitals for emphasis, at most one word per scene.
- **Tics.** "Okay. Okay." (resetting). "Right." "Hi." as a greeting to a good idea. Calls things "it" and then names them. Mild swearing: "hell", "crap".
- **Wants.** A machine that belongs to the planet instead of eating it. She wants to be able to say the green things she builds are not a lie.
- **Hides.** She is afraid that "green" is a paint job, that she has helped paint it, and that she loves the machine as much as the ground.
- **Never says.** "I'm sad." (She shouts or jokes.) "Please" without embarrassment. A speech over two sentences. She never says the word "sustainable" without a sneer.
- **Arc.** Intro (a joke with a threat in it) → the certificate (she sets a trap, because she needs to know if you can tell) → the diesel deal (she says "Don't.") → ferns (she deflects) → river (she is furious) → seventy-five (she gets quieter; "I'm doing my not-shouting voice") → closed (grief delivered flat) → fifty and ninety on the Green path (a bruise on your shoulder, then a question she is scared to ask).
- **Motifs.** The wrench. The goggles ("down" means hiding). The ferns. "Bring the good wrench."
- **Samples.**
  - "Hey. Got a sec? You know those carbon-neutral certificates?" (and, after you buy it: "Yeah. Okay.")
  - "Okay. Listen. I'm not shouting. This is my not-shouting voice."

### Cass Parr, cooling and facilities, the human voice
- **Sentence shape.** Short, dry, plain. Sentences end early. Questions more than statements. Humour so low-key it could be missed. She uses an object (the mug, the window) where another character would use an adjective.
- **Tics.** "Operator." (flat, never warm until the end). "Did you sleep?" A pause marked by a mug. "Both can be true."
- **Wants.** For you to be all right. For there to be a morning after. For somebody to ask the question before the machines are cold.
- **Hides.** She is tired, and she has already seen one cold room that should not have been. She wants out and is not leaving.
- **Never says.** A lie, or a comforting thing she does not believe. "I told you so." An order. A number she has not checked; she says "I don't know" a lot.
- **Arc.** Intro (the second job: asks if you slept) → night shift (the off-record question) → the hypothetical (stands in the lab, flatly forbids it) → the pull (she is the one who says it is too fast) → the window (asks you to remember them; offers to take the second shift) → epilogue (stays human, hands you the mug).
- **Motifs.** The mug of terrible coffee. "Did you sleep?" The one window that opens. Frost.
- **Samples.**
  - "Me too. Then a compressor trips, and I go fix it."
  - "That's her line. I hoped you'd have your own."

---

## Checking a scene before it ships

1. Cover the nameplates. Can you tell who is speaking?
2. Is there an object, not just a feeling?
3. Does each choice cost something or side with someone?
4. Does each reply change a stance, not only a mood?
5. Does the scene work for whichever choice the player made in the scene before it?
6. Read it aloud. Cut the line you stumble on.

---

## Dating systems proposal

Proposals only. Nothing below is implemented, and the owner approves before any of it is. The text rewrite already added a fourth "extra" option to about a third of the scenes (a flirt, a "show me", a "sit a minute"), using only existing `bond`, `seal`, `sp` and `cash` effects. Everything here goes further. Files named are where the work would land (`story.json` = `packages/content/src/data/story.json`; sim = `packages/sim/src/progression/soul.ts` and the decision pipeline; UI = `packages/ui/src/vn/` and `packages/ui/src/advisors/`).

1. **After-hours: choose who to visit.** Once per game day (or every N ticks), a small "After hours" card offers two or three advisors who are free. The player picks one and gets a short two-to-four line scene with a single choice (no tree consequences, only bond and a tiny seal nudge). *Changes:* bond growth becomes player-driven, not just a side-effect of decisions. *Touches:* a new `StoryTrigger` kind `{ kind: "afterHours" }` in `schema.ts`, an issuer in the decision queue (sim), a card in the UI, and about 6 to 8 short visits per advisor in `story.json` (a pool, weighted by bond tier so nothing repeats).
2. **Bond tiers with named stages.** Label bond bands (Colleague 0-29, Friend 30-49, Close 50-69, Devoted 70-100) per advisor. Scenes can require a stage, so intimacy lines only appear once earned. *Touches:* a `minBond: { advisor, atLeast }` condition on story scenes (schema and sim issuer), a bond-stage label on the advisor dossier (UI).
3. **Route milestones per advisor.** Each advisor gets three authored beats at bond 40, 60 and 80, each a full scene with her own location and motif (Luci's ledger room, Mel's cold store, Bea's night roof, Cass's plant room at 03:00). They are gated on bond and the tier, and fire once. *Touches:* the `minBond` condition above plus about 12 new scenes in `story.json`. The scenes follow the arcs in the voice sheets.
4. **Gifts and favours tied to builds.** When the player builds something an advisor's tree likes, a "Give it to her" option appears on the build confirmation (for example a heat exchanger to Bea, a sterile bay to Mel, a clean cooling loop to Cass, a payout-boosting contract to Luci). Each advisor has one liked and one disliked item, and the reaction is a one-line toast plus a bond change. *Changes:* the existing "+1 the first time per item" becomes a visible, flirtable gesture. *Touches:* `facilities.json` (a `gift: advisorId` tag), the build command (sim) and a toast line per advisor (UI).
5. **Rival reactions and jealousy.** When an advisor's bond is far above another's, scenes unlock a cross-talk beat: the neglected one needles you or goes quiet. Example: Luci notices you have been spending evenings in the plant room. Mel notes that Bea's bond is higher and asks what Bea has that she lacks. *Changes:* the cost of favouring one person becomes visible. *Touches:* `minBond` and a `bondGap` condition (sim), an extra reply line on existing scenes, and about 6 standalone jealousy scenes.
6. **A confession scene, then the route lock.** At the Level 4 threshold, the advisor with the highest bond (60 or more) asks one question that is not about the tower: it is about the two of you. The player answers one of three ways: accept, defer, refuse. Accept locks the route: her epilogue is guaranteed, and the other advisors' closing lines acknowledge it. Defer keeps options open at the price of a small bond decay. Refuse costs bond but may raise Cass's. *Changes:* the ending epilogue becomes earned rather than computed from the highest number. *Touches:* a new trigger `{ kind: "confession" }`, a stored `route: AdvisorId | null` in sim state (a snapshot version bump, with a migration), `EndingScene` epilogue selection (it is read-only for me this pass), and 4 confession scenes in `story.json`.
7. **More options per scene, in the open.** Move from 3 choices to 4 or 5 where a scene earns it: one for the speaker, one for each rival, one flirt, one "ask her" (a question that reveals her). The UI already maps keys 1 to 9, so no code change is needed. *Touches:* `story.json` only, plus balance checks on bond totals (`npm run sim`).
8. **A phone / message layer.** A tiny inbox of one-line messages from the advisors between scenes ("Cass: Did you eat?"), with a single-tap reply (a heart, a joke, ignore) for 1 point of bond. *Changes:* a heartbeat of small contact between the big scenes. *Touches:* a new HUD widget (UI), a message pool (a new JSON file in `packages/content/src/data/`), and a once-per-day issuer (sim).
9. **Memory: a visible log of what each advisor remembers.** A "she remembers" list on the dossier (three lines, built from flags the player's choices set, such as "You took her side on the diesel deal"). This also makes callbacks (rule 20) possible without conditional text. *Touches:* flags written by story effects (a new `flag` effect in `schema.ts` and sim) and the dossier panel (UI).

**Suggested order if the owner approves only a few:** 2 and 7 are cheap and make every existing scene better; 3 and 6 give the dating-sim spine; 1 and 4 give the player agency between scenes; 5, 8 and 9 are polish.
