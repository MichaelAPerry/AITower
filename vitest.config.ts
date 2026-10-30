import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const pkg = (name: string) => fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@aitower/sim": pkg("sim"),
      "@aitower/content": pkg("content"),
      "@aitower/render": pkg("render"),
      "@aitower/ui": pkg("ui"),
      "@aitower/audio": pkg("audio"),
      "@aitower/shared": pkg("shared"),
    },
  },
  test: {
    include: ["packages/*/src/**/*.test.ts", "packages/*/src/**/*.test.tsx", "apps/*/src/**/*.test.ts", "tools/*/src/**/*.test.ts", "tools/dialogue/*.test.ts"],
    environment: "node",
    // Shared 2-core CI runners run the heavy integration tests (big-tower snapshots, 30-day sim runs) 2-3× slower
    // than a dev machine; the default 5 s is kept locally so slow tests still get noticed there.
    testTimeout: process.env.CI ? 20_000 : 5_000,
  },
});
