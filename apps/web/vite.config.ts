import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const pkg = (name: string) => fileURLToPath(new URL(`../../packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig(({ mode }) => ({
	base: "./",
	plugins: [react()],
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
	build:
		mode === "artifact"
			? {
					// Self-contained bundle for a claude.ai artifact: one JS file, one CSS file, fonts inlined.
					target: "es2022",
					outDir: "dist-artifact",
					assetsInlineLimit: 10_000_000,
					cssCodeSplit: false,
					chunkSizeWarningLimit: 4000,
					rollupOptions: {
						output: {
							inlineDynamicImports: true,
							entryFileNames: "assets/app.js",
							assetFileNames: "assets/app[extname]",
						},
					},
				}
			: { target: "es2022", chunkSizeWarningLimit: 2000 },
}));
