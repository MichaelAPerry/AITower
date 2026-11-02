# After-hours easter eggs (owner spec, Nov 2)

The owner's words below are copied exactly. The owner later asked for the spelling to be fixed (see Owner answers). The owner's words win.

## Rules (summary by Claude, from the owner's notes)

- REMOVE the relationship (bond) numbers and the attitude/relationship dialogue choices from the game.
- The after-hours pictures (off-duty portraits, NOT the bed ones) are unlocked by these easter eggs instead.
- The bed portraits still need: this easter egg done for EACH of the four characters AND all achievements.
- Earlier idea "advisor asks a couple of questions" is REPLACED by this spec.
- 4 new fixed places in the tower. They cannot be built over:
  - Mel's corner with a small fish tank on her desk.
  - Bea's fern corner in the lobby.
  - A coffee corner, also in the lobby, maybe on the other side from Bea's.
  - Luci's office (book / ledger on Luci's desk).
- Clickable: the fern, the fish tank, the coffee machine, the book on Luci's desk. A click does nothing visible.
- Clicking an item once a day on 3 consecutive days triggers that character's "third day" dialogue (yes/no).
- Continuing for 10 days (consecutive) offers an upgrade of the item for $1 million (the "tenth" dialogue, yes/no).
- Buying the upgrade unlocks a new (upgraded) item in the tower and that character's after-hours portrait.
- If the player says No on the tenth, they can come back (click again) and the game offers "(buy the {upgrade})" in various different ways, followed by the same tenth-day dialogue.
- Fern = Bea, fish tank = Mel, coffee machine = Cass, book = Luci.
- New in-tower sprites are drawn in code (owner rule). Upgraded versions: bigger pot with automatic watering/feeding (fern), bio-enhanced tank (fish), cappuccino machine (coffee), license/certificate (book).

## Owner text, verbatim

Bea's fern: 

After the third try:

Bea:  Oh you noticed nigel my fern Isn't he great!  
Bea: I'm glad you're watering him are you going to keep it up?

Yes

Oh thanks! You're the best 

No 

Oh come on, just cause I asked? 

After the tenth: 

Bea: Nigel is doing ok, but I think he deserves better. You think we could upgrade his pot, and give him an automatic watering and feeding huh? 
Bea: Isn't he worth it! 

Yes 

You're my hero! 

No 

Well, I left the catalogue on your desk. 


Mel's fish tank:

After the third day

Mel: You're the one feeding fido!   Yes that's his name, I know it's kinda weird for a fish, but I love em!  
Mel: Can you keep it up!? Sometimes I forget... 

Yes 

Thanks!

No 

Oh, I guess I'll have to remember. 


After the tenth: 

Mel:  Mr. Fido is doing good, but look at these new bio-enhancements we can add. He'll be so genetically perfect can we? 

Yes 

Yay! It will be awesome!

No 

Well, I left the feature set on your desk. 

Cass's Coffee machine:

After the third day

Cass: I wonder who was making the coffee, not the best but we need it.  
Cass: If you keep making it, I'll keep drinking it! 

Yes 

Java hero right here. 

No 

Time for me to figure out the automatic setting. 


After the tenth: 

Cass: I begged Luci and she said it's up to you, but I've been eyeing this new coffee maker.  It does cappuccino, steamed milk, everything, think we can spring for it? 

Yes 

Well, you know what makes me happy. 

No 

Ugh, cheapskate. 

After the third day

Luci: You're the one who's been coming in and checking the ledger.
Luci: Unusual, but I appreciate an operator who does the numbers

Yes 

If you ever want to talk numbers... 

No 

Oh, guess I was barking up the wrong tree. 


After the tenth: 

Luci: Well, you obviously care about our financial future.  But I need you to get your license if you keep it up.  Don't worry, it comes with perks and I get to be your instructor.  There is a small fee. 

Yes 

Excellent, class starts tonight.  Don't be late. 

No 

Well, hands off the books unless you're licensed. 


If the user selects no they can come back and it says (buy the {upgrade}) in various different ways with the same dialogue above on the tenth. 

## Owner answers (Nov 2)

- Missing a day resets the count to 0.
- "No" on the third day changes nothing; the count continues. It is just an option: a player can say No and still pay the $1M later and get the portrait.
- Re-offer lines: Claude writes simple placeholders, e.g. "[ buy the coffee machine ]"; list them in docs/PLACEHOLDER_TEXT.md.
- Places (corrected Nov 2): Bea and Cass on G (ground/lobby, opposite sides); Luci and Mel on B (basement). The 4 spots appear in EVERY game mode.
- Epilogue speaker: depends on which tree/ending the player builds (NOT on which upgrade was bought). Revert the agent's change.
- Sprites: ChatGPT sprite sheet (docs/ICON_PROMPTS.md sheet 10) replaces the code-drawn items once the owner sends the image.
- Owner (Nov 2): spelling in this dialogue fixed on request.

## Open questions for the owner (answered above)

- "Consecutive": does missing a day reset the count to 0? (Assume yes.)
- Does "No" on the third-day question change anything? (Assume the count continues either way.)
- The "(buy the {upgrade})" re-offer lines are new placeholder text; list them in docs/PLACEHOLDER_TEXT.md.
- Mel's corner: which floor? (Assume Mel's lab area / near bio racks.)
