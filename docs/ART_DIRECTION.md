# Art direction: the three trees' sprites

Owner direction (Oct 28). The code comments in `packages/render/src/pixi/*Sprites.ts` point here.

| Tree | Look | Reference |
|--|--|--|
| Green | **Alive and natural.** Plants and fungus, solarpunk. Each rung is more overgrown than the last, and the last rung reads as a tree. The machine is overtaken, not decorated. | NM-1 moss and sprouts, NM-2 mycelium and shelf fungus, PH-1 a sapling through the door, PH-2 a tree. Support items are pieces of garden doing the machine's job (a leaf-louvred economizer with a flower fan, a greenhouse chiller, a meadow on the iron-air container). |
| Bio | **Fleshy**, after the Magic card "Living Wall": a wall of tissue with eyes, mouths and veins. | OC-1 a membrane with a closed eye, OC-2 lobes and two eyes, OC-3 a great eye over a toothed mouth, OC-4 the wall itself with one huge eye. Eyes follow the cursor. |
| Synthetic | **Chrome.** Mirror-polished panels (sky-white top, dark horizon line, light bounce), cold cyan seams, a sweeping glint. | LC-2 sight tube, LC-3 seams and display, LC-4 etched traces, ML-1 one seamless monolith with a single slit. |

The first Green set (leaf-trimmed machines) was rejected by the owner and replaced, not polished.

## Consciousness Transfer Unit (CT-1, Synthetic special)

A chrome pod beside the lift. Every `transfer.everyHours` (6) game hours, if enabled, working and powered, one person walks out of the lift into the pod and is uploaded: `transfer.sp` (35.7) Synthetic SP, about one ML-1 rack's day of points per unit per day (143 SP/day).

- Sim: `kind: "transfer"` in `facilities.json`, tech `transfer_protocol` (after `mind_lattice_dossier`), `transferStep` in `packages/sim/src/progression/soul.ts`, event `consciousnessTransferred`. Tests: `packages/sim/src/transfer.test.ts`.
- Render: `transferAnim.ts` (pure timing shared by the walker and the pod), `pixi/transfers.ts` (the walker, fed by the event), the pod in `pixi/synthSprites.ts`. The walk, door and upload are held on one clock: walk, door slides up, they step in, the door shuts, cold light floods the pod and they rise as data.

## Previews

`npm run sprites` writes `docs/preview/green-sprites.png`, `bio-sprites.png`, `synthetic-sprites.png` and `transfer-unit.png` (harness `packages/render/dev/sprites.html?tree=green|bio|synthetic|transfer`). Every sprite is drawn by the real renderer on the game's own background at game scale (1x) and 3x, labelled.

Sprites not yet drawn for Bio and Synthetic keep the existing kind art: nutrient plant and works, bioreactor, digester, sterile bay, gensets, SMR, PV wall.
