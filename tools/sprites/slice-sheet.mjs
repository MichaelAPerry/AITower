#!/usr/bin/env node
/**
 * Slice an image-tool sheet (a grid of gold-rimmed plates on black) into a clean uniform atlas webp.
 * The grid need not be uniform: plates are found by their gold rims, then each is cropped square and downscaled.
 *
 *   node tools/sprites/slice-sheet.mjs --in sheet.png --cols 6 --rows 3 --out packages/ui/src/art/achievement-icons.webp \
 *        --ids end_lattice,end_flesh,... [--cell 64] [--method nearest|area] [--preview preview.png] [--compare cmp.png]
 *
 * --ids      comma list, row-major; used only for the preview labels and the printed `col,row` map.
 * --method   nearest (centre sample, default: crispest) or area (box average, softer).
 * --stretch true  map each plate's own box (not a square crop) to the cell: for sheets whose plates are not square.
 * --preview  PNG: the atlas at 3x with ids. --compare PNG: first cells, nearest over area, each at 4x, for choosing.
 * No dependencies of its own: decoding, resampling and the lossless webp encode run in the pre-installed Playwright's Chromium
 * (global, PLAYWRIGHT_DIR, or the repo root). Nothing is downloaded.
 */
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith("--") ? [...a, [v.slice(2), all[i + 1]]] : a), []));
for (const k of ["in", "cols", "rows", "out"]) if (!args[k]) throw new Error(`missing --${k}`);
const cols = Number(args.cols);
const rows = Number(args.rows);
const cell = Number(args.cell ?? 64);
const method = args.method ?? "nearest";
const ids = (args.ids ?? "").split(",").filter(Boolean);
if (ids.length && ids.length !== cols * rows) throw new Error(`--ids has ${ids.length}, grid has ${cols * rows}`);

function loadPlaywright() {
	const dirs = [process.env.PLAYWRIGHT_DIR, process.cwd(), "/opt/node22/lib/node_modules/"].filter(Boolean);
	try {
		dirs.push(execSync("npm root -g", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim());
	} catch {}
	for (const d of dirs) {
		try {
			return createRequire(`${resolve(d)}/`)("playwright");
		} catch {}
	}
	throw new Error("playwright not found (set PLAYWRIGHT_DIR)");
}

/** Runs in the page. Returns the atlas (and optional preview/compare) as data URLs plus the detected boxes. */
async function work({ src, cols, rows, cell, method, ids, wantCompare, stretch }) {
	const img = new Image();
	img.src = src;
	await img.decode();
	const W = img.naturalWidth;
	const H = img.naturalHeight;
	const c = document.createElement("canvas");
	c.width = W;
	c.height = H;
	const g = c.getContext("2d", { willReadFrequently: true });
	g.drawImage(img, 0, 0);
	const px = g.getImageData(0, 0, W, H).data;
	// Gold rim mask: bright, warm, not blue.
	const gold = new Uint8Array(W * H);
	for (let i = 0; i < W * H; i++) {
		const r = px[i * 4];
		const gr = px[i * 4 + 1];
		const b = px[i * 4 + 2];
		gold[i] = r > 190 && gr > 120 && b < 100 && r - b > 110 ? 1 : 0;
	}
	/** Runs of indices whose count exceeds `min`, bridging gaps shorter than `gap`. */
	const runs = (counts, min, gap) => {
		const out = [];
		let s = -1;
		let last = -1;
		counts.forEach((n, i) => {
			if (n > min) {
				if (s < 0) s = i;
				else if (i - last > gap) {
					out.push([s, last]);
					s = i;
				}
				last = i;
			}
		});
		if (s >= 0) out.push([s, last]);
		return out;
	};
	const rowCounts = Array.from({ length: H }, (_, y) => {
		let n = 0;
		for (let x = 0; x < W; x++) n += gold[y * W + x];
		return n;
	});
	const bands = runs(rowCounts, 8, 6).filter(([a, b]) => b - a > 40);
	if (bands.length !== rows) throw new Error(`found ${bands.length} row bands, expected ${rows}`);
	const boxes = [];
	for (const [y0, y1] of bands) {
		const colCounts = Array.from({ length: W }, (_, x) => {
			let n = 0;
			for (let y = y0; y <= y1; y++) n += gold[y * W + x];
			return n;
		});
		const cs = runs(colCounts, 3, 6).filter(([a, b]) => b - a > 40);
		if (cs.length !== cols) throw new Error(`found ${cs.length} plates in band at y=${y0}, expected ${cols}`);
		for (const [x0, x1] of cs) boxes.push({ x0, y0, x1, y1 });
	}
	const area = (b) => {
		// Square crop about the plate centre; with `stretch` the plate's own box is mapped to the cell (for sheets whose plates are not square).
		const bw = b.x1 - b.x0 + 1;
		const bh = b.y1 - b.y0 + 1;
		const side = Math.round((bw + bh) / 2);
		const sx = stretch ? b.x0 : Math.round((b.x0 + b.x1 + 1) / 2 - side / 2);
		const sy = stretch ? b.y0 : Math.round((b.y0 + b.y1 + 1) / 2 - side / 2);
		const out = new Uint8ClampedArray(cell * cell * 4);
		const k = (stretch ? bw : side) / cell;
		const ky = (stretch ? bh : side) / cell;
		for (let y = 0; y < cell; y++)
			for (let x = 0; x < cell; x++) {
				const o = (y * cell + x) * 4;
				if (method === "nearest") {
					const i = (Math.min(H - 1, Math.floor(sy + (y + 0.5) * ky)) * W + Math.min(W - 1, Math.floor(sx + (x + 0.5) * k))) * 4;
					for (let j = 0; j < 4; j++) out[o + j] = px[i + j];
				} else {
					let r = 0;
					let gg = 0;
					let bb = 0;
					let n = 0;
					for (let yy = Math.floor(sy + y * ky); yy < Math.ceil(sy + (y + 1) * ky); yy++)
						for (let xx = Math.floor(sx + x * k); xx < Math.ceil(sx + (x + 1) * k); xx++) {
							const i = (Math.min(H - 1, yy) * W + Math.min(W - 1, xx)) * 4;
							r += px[i];
							gg += px[i + 1];
							bb += px[i + 2];
							n++;
						}
					out[o] = r / n;
					out[o + 1] = gg / n;
					out[o + 2] = bb / n;
					out[o + 3] = 255;
				}
			}
		return out;
	};
	const atlas = document.createElement("canvas");
	atlas.width = cols * cell;
	atlas.height = rows * cell;
	const ag = atlas.getContext("2d");
	boxes.forEach((b, i) => {
		ag.putImageData(new ImageData(area(b), cell, cell), (i % cols) * cell, Math.floor(i / cols) * cell);
	});
	const res = { boxes, size: [W, H], webp: atlas.toDataURL("image/webp", 1) };
	const scaled = (z, labels) => {
		const p = document.createElement("canvas");
		p.width = atlas.width * z;
		p.height = atlas.height * z;
		const pg = p.getContext("2d");
		pg.fillStyle = "#333";
		pg.fillRect(0, 0, p.width, p.height);
		pg.imageSmoothingEnabled = false;
		pg.drawImage(atlas, 0, 0, p.width, p.height);
		if (labels) {
			pg.font = "bold 11px monospace";
			ids.forEach((id, i) => {
				const x = (i % cols) * cell * z + 3;
				const y = Math.floor(i / cols) * cell * z + 12;
				pg.fillStyle = "#000";
				pg.fillText(id, x + 1, y + 1);
				pg.fillStyle = "#fff";
				pg.fillText(id, x, y);
			});
		}
		return p.toDataURL("image/png");
	};
	res.preview = scaled(3, true);
	if (wantCompare) {
		const first = boxes.slice(0, 6);
		const cmp = document.createElement("canvas");
		cmp.width = first.length * cell * 3;
		cmp.height = cell * 3 * 2;
		const cg = cmp.getContext("2d");
		cg.imageSmoothingEnabled = false;
		for (const [row, m] of ["nearest", "area"].entries()) {
			method = m;
			first.forEach((b, i) => {
				const t = document.createElement("canvas");
				t.width = t.height = cell;
				t.getContext("2d").putImageData(new ImageData(area(b), cell, cell), 0, 0);
				cg.drawImage(t, i * cell * 3, row * cell * 3, cell * 3, cell * 3);
			});
		}
		res.compare = cmp.toDataURL("image/png");
	}
	return res;
}

const { chromium } = loadPlaywright();
const browser = await chromium.launch();
try {
	const page = await browser.newPage();
	const src = `data:image/png;base64,${readFileSync(args.in).toString("base64")}`;
	const res = await page.evaluate(`(${work.toString()})(${JSON.stringify({ src, cols, rows, cell, method, ids, wantCompare: !!args.compare, stretch: args.stretch === "true" })})`);
	const save = (path, url) => {
		mkdirSync(dirname(resolve(path)), { recursive: true });
		writeFileSync(path, Buffer.from(url.split(",")[1], "base64"));
	};
	save(args.out, res.webp);
	if (args.preview) save(args.preview, res.preview);
	if (args.compare) save(args.compare, res.compare);
	console.log(`sheet ${res.size.join("x")}, ${res.boxes.length} plates, method ${method}, cell ${cell}px`);
	console.log(`wrote ${args.out}: ${cols * cell}x${rows * cell}, ${statSync(args.out).size} bytes`);
	if (ids.length) console.log(ids.map((id, i) => `${id}: col ${i % cols}, row ${Math.floor(i / cols)}`).join("\n"));
} finally {
	await browser.close();
}
