// Usage: node packages/audio/dev/render.mjs <outDir>   (needs `npx vite packages/audio/dev --port 5186` running)
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire("/opt/node22/lib/node_modules/");
const { chromium } = require("playwright");
const out = process.argv[2];
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto("http://localhost:5186/", { waitUntil: "load" });
await page.waitForFunction(() => typeof window.render === "function");
const r = await page.evaluate(() => window.render(20));
await browser.close();
const n = r.left.length;
const pcm = Buffer.alloc(44 + n * 4);
pcm.write("RIFF", 0); pcm.writeUInt32LE(36 + n * 4, 4); pcm.write("WAVEfmt ", 8);
pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(2, 22); pcm.writeUInt32LE(r.sr, 24);
pcm.writeUInt32LE(r.sr * 4, 28); pcm.writeUInt16LE(4, 32); pcm.writeUInt16LE(16, 34); pcm.write("data", 36); pcm.writeUInt32LE(n * 4, 40);
let nan = 0, peak = 0, sumSq = 0;
for (let i = 0; i < n; i++) {
	for (const [c, ch] of [[0, r.left], [1, r.right]]) {
		const v = ch[i];
		if (!Number.isFinite(v)) { nan++; continue; }
		peak = Math.max(peak, Math.abs(v)); sumSq += v * v;
		pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 4 + c * 2);
	}
}
writeFileSync(`${out}/music.wav`, pcm);
const win = Math.floor(r.sr * 0.5);
const wins = [];
for (let s = 0; s + win <= n; s += win) {
	let e = 0;
	for (let i = s; i < s + win; i++) e += r.left[i] ** 2;
	wins.push(+(20 * Math.log10(Math.sqrt(e / win) + 1e-9)).toFixed(1));
}
console.log(JSON.stringify({ seconds: n / r.sr, nan, peakDbfs: +(20 * Math.log10(peak)).toFixed(2), rmsDbfs: +(10 * Math.log10(sumSq / (2 * n))).toFixed(2), windowRmsDb500ms: wins, voicePeak: r.voicePeak, errors }));
