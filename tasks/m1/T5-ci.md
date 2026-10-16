# M1-T5 — agent-ci: lint, end-to-end smoke tests, bundle budget, code-splitting

Runs **after** M1-T1 to T4 are integrated, so the codebase is stable.

**Owns:** `.github/**`, root `package.json` scripts, `biome.json`, `e2e/**`, `apps/web/vite.config.ts` (code-splitting only),
plus minimal lint fixes anywhere. A lint fix must not change behaviour; if one would, add a targeted ignore with a reason.

**Read first:** `tasks/m1/README.md`, `.github/workflows/pages.yml`, `docs/review/engineering.md` §4.

## 1. Biome lint
- Add `@biomejs/biome` as a root devDependency at the exact version `2.5.15`. This is the one install allowed; run `npm install -D -E @biomejs/biome@2.5.15`.
- Add `biome.json` with the recommended lint rules and the formatter **disabled**. A repo-wide reformat would bury real diffs.
- Add a `lint` script and include it in `npm run check`.
- Fix or justify every finding. Prefer real fixes. Each `// biome-ignore` needs a reason.

## 2. End-to-end smoke test (Playwright)
- Add `e2e/smoke.mjs`, a plain Node script that uses Playwright. Locally that means the global install at `/opt/node22/lib/node_modules/` (see `scripts/screenshot.mjs`). In CI it is `npx playwright@1.56.1` with `npx playwright install --with-deps chromium`.
- Start it against `vite preview` of the built app. Then:
  1. Boot with `?new&seed=7` and wait for the HUD.
  2. Advance the tutorial through the first three memos.
  3. Accept a contract when one appears (run at 30× until one does).
  4. Place a rack through `window.aitower.store.dispatch`.
  5. Open the Esc menu.
  6. Save to slot 1, reload the page, load slot 1, and assert the rack count survived.
  7. Assert no page errors.
- Fail with a clear message at the first broken step.
- Add an `e2e` script, and a CI job that runs it after the build.

## 3. Bundle budget and code-splitting
- Split vendor code so PixiJS, React and app code load as separate chunks. Use `build.rollupOptions.output.manualChunks` for the normal build only; artifact mode must keep `inlineDynamicImports`.
- Add `scripts/bundle-budget.mjs` that fails when any JS chunk in `apps/web/dist/assets` exceeds 450 kB uncompressed, or total JS exceeds 1.3 MB. Run it in CI after the build.
- `node scripts/build-artifact.mjs` must still produce a working single-bundle build.

## 4. CI workflow
- Jobs: `check` (typecheck, boundaries, lint, tests), `build` (build, budget, e2e), and `deploy` (only on push to main).
- Cache npm.
- Keep the Pages deploy working exactly as now.

## Done when
`npm run check`, `npm run build`, the budget script, the e2e script and `node scripts/build-artifact.mjs` all pass locally. Report the chunk sizes before and after.
