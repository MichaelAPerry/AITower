import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const pkg = (name: string) => fileURLToPath(new URL(`../../${name}/src/index.ts`, import.meta.url));

export default defineConfig({
	root: fileURLToPath(new URL(".", import.meta.url)),
	plugins: [react()],
	resolve: {
		alias: {
			"@aitower/sim": pkg("sim"),
			"@aitower/content": pkg("content"),
			"@aitower/ui": pkg("ui"),
			"@aitower/shared": pkg("shared"),
		},
	},
});
