# @aitower/web — app shell (boot, loop, store, saves, crash handling)

Vite app that wires `content`, `sim`, `render`, `ui` and `audio` together. Only place allowed to import all of them.

## Files (`src/`)
- `main.tsx`: boot. URL params `?new`, `?seed`, `?speed`, `?overlay` (validated); `window.aitower = { store, content }` debug handle.
- `store.ts`: `createGameStore(content, renderer, audio, opts?)` implements `GameStore` plus internals (`advance`, `publish`, `sim`, `boot`, `idle`, `behind`, `readSlotRaw`). `opts` injects backend, storage, clock and reduced-motion default for tests.
- `saves.ts`: envelope `{format:"aitower-save",version:1,savedAt,name,meta,snapshot}`; `decodeSave` accepts envelope or raw snapshot, throws `Invalid save: …`, and probes one tick on a throwaway sim.
- `saveBackend.ts`: `SaveBackend` (IndexedDB `aitower`/`saves`, localStorage fallback, in-memory for tests). All backend access is serialised through one queue in the store.
- `settings.ts`: `localStorage["aitower.settings.v1"]`, normalised on read; reduced-motion default from the OS only when nothing is stored.
- `loop.ts`: fixed timestep, 12 ms step budget per frame (backlog dropped, `store.behind` set), sim fault stops the loop, 3 consecutive render faults show the overlay.
- `crash.ts` / `ErrorBoundary.tsx`: DOM-only "SYSTEM FAULT" overlay (reload autosave / export save / restart), works without React. Global `error`/`unhandledrejection` are logged only.

## Rules
- Autosave: on `newDay` when `settings.autosave`; snapshot is taken synchronously, written asynchronously to slot `"auto"`.
- Legacy `localStorage["aitower.autosave.v1"]` is migrated once into `"auto"` then removed (kept if unreadable).
- Tests are node-environment: never touch `window`/`localStorage` directly in testable code; inject.
