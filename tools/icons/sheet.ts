// Writes an HTML sheet of every HUD icon with its name: `npx tsx tools/icons/sheet.ts [out.html]` (default /tmp/icons/sheet.html).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { ICON_NAMES, iconPaths } from "../../packages/ui/src/icons/pixelIcons";

const out = process.argv[2] ?? "/tmp/icons/sheet.html";
const cell = (n: (typeof ICON_NAMES)[number], px: number): string =>
	`<svg width="${px}" height="${px}" viewBox="0 0 16 16" shape-rendering="crispEdges">${iconPaths(n)
		.map(([f, d]) => `<path fill="${f}" d="${d}"/>`)
		.join("")}</svg>`;
const html = `<!doctype html><meta charset="utf-8"><title>AI Tower icons</title>
<style>body{background:#07072a;color:#f0f0ff;font:14px monospace;margin:16px}h1{font-size:16px}
.g{display:grid;grid-template-columns:repeat(8,150px);gap:8px}
.c{border:2px solid #4a4ab0;padding:8px;display:grid;justify-items:center;gap:6px;background:#0d0d3a}
.r{display:flex;gap:6px;align-items:end}</style>
<h1>AI Tower icon set (${ICON_NAMES.length}): 16x16 grid, shown at 20 / 32 / 64 px</h1>
<div class="g">${ICON_NAMES.map((n) => `<div class="c"><div class="r">${cell(n, 20)}${cell(n, 32)}${cell(n, 64)}</div><span>${n}</span></div>`).join("")}</div>`;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`${ICON_NAMES.length} icons -> ${out}`);
