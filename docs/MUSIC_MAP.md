# Music map

What plays when. Source of truth is `packages/ui/src/gamemusic/sceneMusic.ts` (rules plus a per-scene override list); a test pins the counts below.

## Songs

- Tower loop: plays during normal play (building the tower). Loops.
- Warm scene song: friendly, hopeful, bonding scenes.
- Quiet scene song (Noctune FM): tense, closing, late-night scenes.
- Title songs (title, Garden, Lattice, Flesh): the title screen only, unchanged. They stop when a game starts.

## Behaviour

- Music starts at the first click or key (browser rule). The tower loop plays in the game. When a scene opens, its song fades in while the tower loop fades out (about 0.6 s); when the scene closes they swap back, and each song resumes where it left off.
- The tower loop stops on the ending / game-over screen. Ending scenes have no song of their own today, so they were left alone (silent). Continuing a game after game over brings the tower loop back.
- Volume = Master x Music; Mute silences it. Event cards (heat wave, audit, etc.) are not scenes and stay on the tower loop.

## Rule

Tense, crisis, failure, closing, late-night, locked or empty -> quiet. Bonding, relationship, friendly, celebration, milestones, introductions -> warm. Anything not listed is warm. To move one scene, add it to `SCENE_OVERRIDES` in `sceneMusic.ts` (an exact id wins over the rules).


## Scene list (38 scenes: 23 warm, 15 quiet)

| Scene id | Title | Kind | Song | Why |
|--|--|--|--|--|
| st_intro | The Operator Arrives | Story | Warm scene song | warm default (the first meeting) |
| obj_greentech | Bea Objects | Story | Quiet scene song (Noctune FM) | tense: an advisor objects to a placement |
| obj_biotech | Mel Objects | Story | Quiet scene song (Noctune FM) | tense: an advisor objects to a placement |
| rung_syn_1 | The First Lattice Rack | Story | Warm scene song | milestone: a retrofit is a small celebration |
| rung_syn_2 | Cold Plates | Story | Warm scene song | milestone: a retrofit is a small celebration |
| rung_syn_3 | Blades | Story | Warm scene song | milestone: a retrofit is a small celebration |
| rung_syn_4 | The Mind Lattice | Story | Warm scene song | milestone: a retrofit is a small celebration |
| rung_bio_1 | The First Organoid | Story | Warm scene song | milestone: a retrofit is a small celebration |
| rung_bio_2 | The Vat Bank | Story | Warm scene song | milestone: a retrofit is a small celebration |
| rung_bio_3 | The Perfused Cortex | Story | Warm scene song | milestone: a retrofit is a small celebration |
| rung_bio_4 | The Neural Vat | Story | Warm scene song | milestone: a retrofit is a small celebration |
| rung_green_1 | The First Green Rack | Story | Warm scene song | milestone: a retrofit is a small celebration |
| rung_green_2 | Event-Driven | Story | Warm scene song | milestone: a retrofit is a small celebration |
| rung_green_3 | Light | Story | Warm scene song | milestone: a retrofit is a small celebration |
| rung_green_4 | The Photonic Mesh | Story | Warm scene song | milestone: a retrofit is a small celebration |
| cass_night_shift | Night Shift | Story | Quiet scene song (Noctune FM) | late at night |
| seal_biotech | The Flesh Closes | Story | Quiet scene song (Noctune FM) | a tree closes for good |
| seal_greentech | The Garden Closes | Story | Quiet scene song (Noctune FM) | a tree closes for good |
| tip_seal | The Seal Bar | Story | Quiet scene song (Noctune FM) | the seal warning |
| tip_bond | A Word at the Desk | Story | Warm scene song | bonding / relationship |
| bond50_luci | Ms. Ferro Stays Late | Story | Warm scene song | bonding / relationship |
| bond50_mel | Mel Offers a Seat | Story | Warm scene song | bonding / relationship |
| bond50_bea | Bea Shares Her Lunch | Story | Warm scene song | bonding / relationship |
| bond50_cass | Cass Pours Two | Story | Warm scene song | bonding / relationship |
| ach_unlock_luci | Off the Clock | Gallery | Warm scene song | friendly off-duty portrait |
| ach_unlock_mel | Off the Clock | Gallery | Warm scene song | friendly off-duty portrait |
| ach_unlock_bea | Off the Clock | Gallery | Warm scene song | friendly off-duty portrait |
| ach_unlock_cass | Off the Clock | Gallery | Warm scene song | friendly off-duty portrait |
| ach_bed_intro | The Last Door | Gallery | Warm scene song | override: the 18th achievement is a celebration |
| ach_bed_luci | After Hours | Gallery | Quiet scene song (Noctune FM) | after hours |
| ach_bed_mel | After Hours | Gallery | Quiet scene song (Noctune FM) | after hours |
| ach_bed_bea | After Hours | Gallery | Quiet scene song (Noctune FM) | after hours |
| ach_bed_cass | After Hours | Gallery | Quiet scene song (Noctune FM) | after hours |
| ach_gallery_empty | Nothing Yet | Gallery | Quiet scene song (Noctune FM) | empty frames |
| ach_hint_luci | Locked Frame | Gallery | Quiet scene song (Noctune FM) | a locked portrait, "not there yet" |
| ach_hint_mel | Locked Frame | Gallery | Quiet scene song (Noctune FM) | a locked portrait, "not there yet" |
| ach_hint_bea | Locked Frame | Gallery | Quiet scene song (Noctune FM) | a locked portrait, "not there yet" |
| ach_hint_cass | Locked Frame | Gallery | Quiet scene song (Noctune FM) | a locked portrait, "not there yet" |
