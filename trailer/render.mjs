#!/usr/bin/env node
// Renders trailer/trailer.html to /tmp/trailer/trailer.mp4 and .webm (1280x720, 30 fps, 900 frames, music cut).
// Steps window.setTime(t) frame by frame (no wall clock), screenshots each frame and pipes it into ffmpeg.
// Needs the gameplay frames from `node trailer/capture.mjs` (after `npm run build`); runs the capture itself when they are missing.
// Usage: npm run trailer
import { spawn, spawnSync } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const OUT = "/tmp/trailer";
const CLIPS = join(OUT, "clips");
const FPS = 30;
const FRAMES = 900;
// Music window: strongest 30 s of title.mp3 (loudness + onset strength), starting on a strong onset; the track runs at about 143 BPM.
const MUSIC_START = 182.787;
const MUSIC = join(root, "packages/ui/src/music/title.mp3");
const STILLS = { "still-cutin.png": 12.2 + 0.84 * 0 + 0.55, "still-slam.png": 8.0 + 0.5, "still-endcard.png": 28.4 };

mkdirSync(OUT, { recursive: true });
if (!existsSync(join(CLIPS, "d", "0096.jpg"))) {
	console.log("gameplay frames missing, recording them first");
	if (!existsSync(join(root, "apps/web/dist/index.html"))) spawnSync("npm", ["run", "build"], { cwd: root, stdio: "inherit" });
	const r = spawnSync("node", [join(root, "trailer/capture.mjs")], { cwd: root, stdio: "inherit" });
	if (r.status !== 0) throw new Error("capture failed");
}

let playwright;
for (const dir of [root, "/opt/node22/lib/node_modules/"]) {
	try { playwright = createRequire(join(dir, "/"))("playwright"); break; } catch { /* try next */ }
}
if (!playwright) throw new Error("playwright not found");

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".webp": "image/webp", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".woff": "font/woff", ".png": "image/png" };
const server = createServer((req, res) => {
	const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
	const base = path.startsWith("/clips/") ? CLIPS : root;
	const file = normalize(join(base, path.startsWith("/clips/") ? path.slice(6) : path));
	if (!file.startsWith(base) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404).end(); return; }
	res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
	createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/trailer/trailer.html`;

const browser = await playwright.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => console.error("pageerror:", e.message));
await page.goto(url, { waitUntil: "load" });
await page.evaluate(() => window.ready);
// warm up: touch every scene once so fonts and images are loaded before frame 0
for (const t of [0.8, 1.8, 3.5, 8.3, 12.5, 13.5, 14.3, 15.2, 17, 21.2, 22.5, 24.8, 28.5]) await page.evaluate((x) => window.setTime(x), t);
await page.evaluate(() => document.fonts.load("40px DotGothic16", "ルーシー・フェッロ世界の終わりエーアイ・タワー"));
await page.evaluate(() => document.fonts.load("800 40px 'M PLUS Rounded 1c'", "THREE WAYS TO END THE WORLD"));
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);

const mp4 = join(OUT, "trailer.mp4");
const webm = join(OUT, "trailer.webm");
const afilter = "afade=t=in:st=0:d=0.2,afade=t=out:st=29:d=1";
const ff = spawn("ffmpeg", [
	"-v", "error", "-y",
	"-f", "image2pipe", "-framerate", String(FPS), "-c:v", "png", "-i", "-",
	"-ss", String(MUSIC_START), "-t", "30", "-i", MUSIC,
	"-filter_complex", `[1:a]${afilter},asplit=2[a1][a2]`,
	"-map", "0:v", "-map", "[a1]", "-c:v", "libx264", "-preset", "slow", "-crf", "25", "-maxrate", "1500k", "-bufsize", "3000k", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-t", "30", mp4,
	"-map", "0:v", "-map", "[a2]", "-c:v", "libvpx-vp9", "-b:v", "1100k", "-crf", "33", "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", "-pix_fmt", "yuv420p", "-c:a", "libopus", "-b:a", "96k", "-t", "30", webm,
], { stdio: ["pipe", "inherit", "inherit"] });
const done = new Promise((res, rej) => { ff.on("exit", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}`)))); });

const stillFrames = new Map(Object.entries(STILLS).map(([name, t]) => [Math.round(t * FPS), name]));
for (let f = 0; f < FRAMES; f++) {
	await page.evaluate((t) => window.setTime(t), f / FPS);
	const png = await page.screenshot({ type: "png" });
	if (stillFrames.has(f)) (await import("node:fs")).writeFileSync(join(OUT, stillFrames.get(f)), png);
	if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once("drain", r));
	if (f % 100 === 0) console.log(`frame ${f}/${FRAMES}`);
}
ff.stdin.end();
await done;
await browser.close();
server.close();
for (const f of [mp4, webm]) console.log(f, (statSync(f).size / 1e6).toFixed(2), "MB");
