# M4b-T2 — agent-content: voice rewrite, fewer and clearer memos tied to paths
Owns `packages/content/**` (not `schema.ts`). Follow the voice guide in `tasks/m4b/README.md` exactly.

1. **Rename and redescribe** every facility, bot, tech node, client, path, ending, scenario and the opening copy into the dry corporate sci-fi voice.
   - Keep ids unchanged. Keep descriptions to one or two short sentences with the real numbers.
   - **Remove steampunk words:** steam, brass, punch card, riveted, zip-tied, triplicate, Ministry → **Compute Authority**, "Form …", and so on.
2. **Memos:**
   - **Cut to about 24 events in total.**
   - **Each has exactly 2 choices:** short labels (one or two words) and hints that state the effects plainly.
   - **Most choices carry an `affinity` effect** (+2 to +6) toward the path the choice fits. The choice must read as clearly biotech-, greentech- or synthetic-flavoured, for example "Lease the wet lab" vs "Sign the solar PPA".
   - **Cadence:** raise `balance.events.intervalTicks` so memos come about every 2–3 game days. Keep the scripted day-2 heat event, rewritten.
   - **Horror memos:** keep 6–8, euphemistic.
3. **Validation:** an `affinity` effect needs a valid path and amount ≥ 0. Update tests for the new counts.
