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
			: {
					target: "es2022",
					chunkSizeWarningLimit: 500,
					rollupOptions: {
						output: {
							// React and the pure-TS packages get their own long-cached chunks. PixiJS is deliberately NOT a manual chunk:
							// claiming it makes Rollup pull its lazily imported back ends (WebGL/WebGPU/Canvas, ~270 kB) into the eager
							// chunk, and a manual split of Pixi's circular modules breaks at runtime. Left to Rollup, Pixi's core stays
							// in the entry chunk with the render glue, and the back ends load on demand.
							manualChunks(id) {
								if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "react";
								if (/\/packages\/(sim|content|shared)\//.test(id)) return "sim";
								if (/\/packages\/ui\//.test(id)) return "ui";
								if (/\/packages\/audio\//.test(id)) return "audio";
								return undefined;
							},
						},
					},
				},
}));
