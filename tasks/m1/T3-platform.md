# M1-T3 — agent-platform: crash safety, save system, settings persistence, frame budget

**Owns:** `apps/web/**` only.

**Read first:**
- `tasks/m1/README.md`
- `apps/web/src/*` (store, loop, main)
- `packages/shared/src/index.ts` (the new `Settings`, `normalizeSettings`, save types and `GameStore` methods)
- `packages/sim/src/api.ts`
- `docs/review/engineering.md` §1 and §3.

The placeholders in `apps/web/src/store.ts` are marked "M1-T3"; replace them.

## 1. Crash safety
- **Loop:** wrap each frame's simulation steps and drawing in try/catch (`apps/web/src/loop.ts`).
  - On a simulation exception: stop stepping, keep the last good view on screen, and show a **crash overlay**.
  - The overlay is plain DOM, styled like a Ministry "SYSTEM FAULT" memo, and must work even if React has died. It shows:
    - the error message
    - **Reload last autosave**
    - **Export save** (the current game if `sim.snapshot()` still works, else the autosave)
    - **Restart new game**
- **Renderer exceptions:** log them and skip that frame. After 3 consecutive failures, show the overlay.
- **Global handlers:** `window.onerror` and `unhandledrejection` log to the console. Show the overlay only for errors that come from the loop.
- **React:** add an error boundary around `<Hud>` in `main.tsx` that shows the same overlay.

## 2. Save system (implements the `GameStore` save methods)
- **Storage backend:** IndexedDB (database `aitower`, object store `saves`, key = `SaveSlotId`), with a localStorage fallback when IndexedDB is unavailable.
  - Put it behind a small `SaveBackend` interface so tests can use an in-memory backend. No `fake-indexeddb` is installed, so don't import it.
- **Envelope:** `{ format: "aitower-save", version: 1, savedAt, name, meta: { day, cash, tier }, snapshot }`.
  - `save()` / `load(json)` export and import this envelope. `load` also accepts a raw `SimSnapshot`, for older exports.
  - `load` throws `Error("Invalid save: …")` on bad JSON, a wrong format or a failed `simFromSnapshot`, and keeps the running game intact.
- **Slots:** `listSaves()` returns filled slots, newest first; corrupt entries are skipped. `saveTo`, `loadFrom` and `deleteSave` set `saveStatus` (`busy`, `lastSavedAt`, `error`).
  - `loadFrom` must never replace the running game with a broken one.
- **Autosave:** on each `newDay` event when `settings.autosave` is on, write to slot `"auto"` asynchronously, without blocking the frame.
  - Migrate the old `localStorage["aitower.autosave.v1"]` into `"auto"` once, then delete it.
- **Boot:** `?new` starts fresh. Otherwise load `"auto"` if it is valid; if it is invalid, start fresh and set `saveStatus.error`, rather than crashing.

## 3. Settings persistence
- **Storage:** localStorage key `"aitower.settings.v1"`. Read with `normalizeSettings`, so a missing key or garbage gives defaults. `setSettings` merges, normalises, persists and applies.
- **Apply on change and at boot:**
  - audio: `setMuted`, `setVolume(masterVolume)`
  - renderer: `setOptions({ reducedMotion, crtEffects, colorBlind, horrorIntensity })`
  - `GameState.settings`, plus `muted` kept in sync
- **Reduced motion default:** if no settings are stored yet, default `reducedMotion` to `matchMedia("(prefers-reduced-motion: reduce)").matches`.

## 4. Frame budget
- **Time-based cap:** `loop.ts` caps ticks per frame by **time** (about 12 ms of stepping per frame), not only by count. When it falls behind, it drops the backlog instead of spiralling.
- **Catch-up indicator:** expose a "sim is behind" flag so a future HUD can show it. Add it to the internals; do not change the contract.

## Tests (`apps/web/src/**/*.test.ts`, already in the vitest include; node environment)
- **Save layer:** with the in-memory backend:
  - envelope round-trip
  - a corrupt slot is skipped
  - `load` of garbage throws "Invalid save" and keeps the state
  - autosave on `newDay`
  - the one-time migration of the old key
- **Settings:** normalise, persist and apply calls (with fake audio and renderer).
- **Crash handling:** a fake sim whose `step()` throws stops the loop and calls the overlay.

## Verify in a real browser
1. Build with `npm run build`, serve with `npx vite preview apps/web --port 5183 --strictPort`, and drive it with a Playwright script using the global Playwright (see `scripts/screenshot.mjs` for how it is required).
2. Check that a save-to-slot / reload / load-from-slot round-trip works and that settings persist across a reload.
3. Inject `window.aitower.store.sim().step = () => { throw new Error("test") }` and confirm the crash overlay appears.
4. Save screenshots to `/tmp/claude-0/-home-user-AITower/a7f75a3b-71cb-517d-a9c2-dde0cac086fa/scratchpad/m1-platform/`.
