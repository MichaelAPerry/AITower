# M5b-S: bigger lot; fair, explained reputation
Owns `packages/sim/**` (not `api.ts` unless a view field is needed; if it is, add it and update the UI and render fakes so the tree compiles), `packages/content/**` and `tools/sim-cli/**`.

1. **Bigger lot:**
   - Raise every scenario's bounds generously: about 40 floors above ground and 5 basements (starter: floorMin −5, floorMax 40; scale the others similarly, sandbox larger).
   - Check that the renderer, camera and minimap/HUD cope (pan and zoom limits, floor labels), that the Foreman and pathing stay fast, and that the perf tests hold.
   - Keep cost balance sane: higher floors may cost a bit more slab, if a per-height cost exists.
2. **Find the reputation freefall:** reproduce it with sim-cli or a test. Play an automated mid-game run (tier 3–4, Contract Automation on, Foreman on) for about 10 days and log every standing change by cause.
   - **Suspected causes:**
     - Daily uptime targets of 0.99 and 0.992 at tiers 4–5, so every day is "bad" (−3).
     - Contract Automation accepting jobs that can't finish (−4 each).
     - Audits (−3/−6).
     - No battery or backup, so a grid dip kills uptime.
   - Report what actually drives it.
3. **Make reputation fair:**
   - Uptime targets of about [0, 0.93, 0.95, 0.96, 0.97].
   - The daily change scales with the shortfall: a near miss is −1, a big miss −3; meeting the target is +1.
   - A failed job costs −2.
   - Contract Automation only accepts a job when the free compute and its deadline leave a clear margin. Use the existing fit checks and add a margin.
   - Tune so that a reasonable, unattended automated run doesn't trend down. Add a regression test that runs the mid-game scenario for 10 days with automation on and asserts reputation doesn't fall more than 10.
4. **Explain it:** the view exposes the recent reputation changes with a cause (event/memo/job/daily-uptime/audit), e.g. `view.standingLog: { tick, delta, cause, detail }[]` (the last ~20).
   - Use an existing event if it can carry the cause; otherwise add the view field.
   - The UI can then show "Why did my reputation change?".
   - Also show the uptime target in the view if it isn't there already.
5. **Tests:** bounds, the freefall regression, the clerk margin, and the standing log.
