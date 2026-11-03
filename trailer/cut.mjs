#!/usr/bin/env node
// Cuts /tmp/trailer/raw/game.webm into the 30 fps, 100-frame JPEG clips the trailer plays (/tmp/trailer/clips/<name>/0001.jpg ...).
// The game renders at only ~5 fps in software GL, so each beat is recorded at real speed and time-lapsed into 100 frames (3.33 s).
// Usage: node trailer/cut.mjs        (capture.mjs calls it; run it alone to re-cut after tweaking the windows)
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const RAW = "/tmp/trailer/raw";
const OUT = 3.4; // seconds of output per clip
const marks = JSON.parse(readFileSync(join(RAW, "marks.json"), "utf8"));
const windows = {
	busy: [marks.busy, marks.busyEnd ?? marks.busy + 4, 1],
	build: [marks.build, marks.buildEnd, 1],
	research: [marks.research, marks.researchEnd, 1],
	upgrade: [marks.upgrade, marks.upgradeEnd, 1],
};
for (const [name, [a, b]] of Object.entries(windows)) {
	const dir = `/tmp/trailer/clips/${name}`;
	rmSync(dir, { recursive: true, force: true });
	mkdirSync(dir, { recursive: true });
	const span = Math.max(1, b - a);
	execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(a), "-t", String(span), "-i", join(RAW, "game.webm"), "-vf", `setpts=PTS*${OUT / span},fps=30`, "-frames:v", "100", "-q:v", "3", join(dir, "%04d.jpg")]);
	console.log(name, readdirSync(dir).length, "frames from", span.toFixed(1), "s");
}
