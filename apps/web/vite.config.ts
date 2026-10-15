import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const pkg = (name: string) => fileURLToPath(new URL(`../../packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
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
	build: { target: "es2022", chunkSizeWarningLimit: 2000 },
});
