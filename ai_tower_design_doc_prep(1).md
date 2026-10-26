# AI Tower: Co-Design Prompt & Architecture Document

## 1. Project Overview & "The Soul"
"AI Tower" is a hybrid genre game: a brutalist tower-management simulation (focused on server hardware, cooling, and power) wrapped in a philosophical, end-of-the-world PC-98 virtual dating sim. 

Currently, we have the shell of the tower-building mechanics, but we need to inject the "soul." The core journey revolves around the player building their tower to reach one of three Singularity Trees:
*   **Singularity (Default/Easy):** The path of brute-force machine computation.
*   **Bio (Hard):** The path of organic computing and flesh-tech.
*   **Green (Hard):** The path of sustainable, harmony-driven tech.

## 2. Concept Art & Visual Vibe (CRITICAL NOTE)
*Please reference the provided PC-98 concept art images (image_7b2104.jpg through image_7b1dc0.jpg).*

**Important Disclaimer for AI/Developer:** All text, numbers, UI layouts, and stats (like "LOG", "END", "HP") seen in the concept art are **purely thematic placeholders**. Do *not* attempt to reverse-engineer or hardcode these specific stats. 
Use the art strictly as a mood board for the retro-anime aesthetic, color palettes, and the general vibe of the Bio, Green, and Synth late-game environments. You have full freedom to design the actual UI and mathematical stats to fit the mechanics we develop.

## 3. Co-Design Tasks for Claude
*Claude, please act as the Lead Game Designer and provide three (3) distinct proposals for each of the following systems:*

### Task A: The Core Loop & Spatial Mechanics
The player must balance Power, Cooling, and Compute. How does physical placement within the tower matter?
*   **Prompt:** Propose 3 different mechanical rulesets for spatial puzzles. For example, how does heat move? (e.g., Does heat rise, penalizing servers on higher floors? Do cooling systems need direct adjacency to specific racks? How is power routed from generators?)

### Task B: The Hidden Alignment Math ("Secret Numbers")
The game features a hidden alignment system. Building certain early-game racks or cooling units should silently make it harder to reach the Bio and Green endings, defaulting the player toward the Singularity ending.
*   **Prompt:** Propose 3 mathematical or logical ways this hidden alignment system could work. How do we assign these "secret numbers" to equipment? How heavily should a cheap diesel generator penalize the "Green" path? How does the player eventually realize they are being locked out?

### Task C: Advisor Narrative, Pushback & "Wrong" Choices
The generic advisors must be replaced with fleshed-out characters who represent the dating-sim/visual novel half of the game. They shouldn't just be tutorials; they must argue with the player, offer philosophical pushback, and actively test them.
*   **Prompt:** Propose 3 distinct character profiles for the Advisors (aligning with the three trees). More importantly, propose 3 mechanical ways their "pushback" triggers. How do we mechanically implement them suggesting intentionally "wrong" choices? (e.g., Do they try to trick the player to fulfill their own agenda, or is it a test of the player's philosophical resolve?)