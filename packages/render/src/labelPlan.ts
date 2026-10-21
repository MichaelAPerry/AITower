/**
 * Pure label selection for the world: which name tags and status words to show, and where.
 * Computed once per tick (not per frame); the renderer only culls and places the result.
 */
import type { FacilityStatus } from "@aitower/sim";

/** `name` = a type label; `warn` amber, `fault` red, `dim` quiet (idle or switched off). */
export type TagTone = "name" | "warn" | "fault" | "dim";

export interface StatusWord {
	word: string;
	tone: Exclude<TagTone, "name">;
}

/** Where a broken rack stands in the repair queue (from the sim's work order for it). */
export interface RepairInfo {
	/** 1-based place among orders no bot has taken, or null once a bot has one. */
	queuePos: number | null;
	route: "ok" | "noRoute" | "noBots";
}

/** The plain word for a facility that is not ok, or null when it is fine. NEXT explains why; this shows where. */
export function statusWord(status: FacilityStatus, enabled = true, repair?: RepairInfo): StatusWord | null {
	if (!enabled || status === "disabled") return { word: "OFF", tone: "dim" };
	switch (status) {
		case "ok":
			return null;
		case "idle":
			return { word: "IDLE", tone: "dim" };
		case "unpowered":
			return { word: "NO POWER", tone: "fault" };
		case "brownout":
			return { word: "LOW POWER", tone: "warn" };
		case "noCoolant":
			return { word: "NO COOLANT", tone: "warn" };
		case "noNutrient":
			return { word: "NO FEED", tone: "warn" };
		case "tooCold":
			return { word: "COLD", tone: "warn" };
		case "throttled":
			return { word: "HOT", tone: "warn" };
		case "tripped":
			return { word: "TRIPPED", tone: "fault" };
		case "failed":
			if (repair?.route === "noRoute") return { word: "NO ROUTE", tone: "fault" }; // no bot can get there: a lift is missing, unpowered or not joined
			if (repair?.route === "noBots") return { word: "NO BOTS", tone: "fault" };
			if (repair && repair.queuePos !== null) return { word: `BROKEN #${repair.queuePos}`, tone: "fault" };
			if (repair) return { word: "FIXING", tone: "warn" }; // a bot has the order
			return { word: "BROKEN", tone: "fault" };
	}
}

export interface TagFacility {
	id: number;
	defId: string;
	floor: number;
	/** Tile index of the left edge. */
	x: number;
	width: number;
	status: FacilityStatus;
	enabled: boolean;
}

export interface Tag {
	text: string;
	tone: TagTone;
	/** Centre, in tiles (multiply by TILE). */
	cx: number;
	floor: number;
}

const CHARS_PER_TILE = 4.5;

/** Shorten to fit `tiles` of width (never below 5 characters). */
export function fitName(name: string, tiles: number): string {
	const max = Math.max(5, Math.floor(tiles * CHARS_PER_TILE));
	return name.length <= max ? name : `${name.slice(0, max - 1).trimEnd()}…`;
}

/**
 * One status word over each facility that needs attention, and one name tag over each run of side-by-side
 * facilities of the same type. A run with an amber or red word in it gets no name tag (the word takes the line).
 * Quiet words (IDLE, OFF) are never shown in the world. Name tags are only drawn on hover and in help mode (the renderer decides).
 */
export function planTags(facilities: readonly TagFacility[], nameOf: (defId: string) => string | undefined, repairOf?: (facilityId: number) => RepairInfo | undefined): Tag[] {
	const out: Tag[] = [];
	const sorted = facilities.slice().sort((a, b) => a.floor - b.floor || a.x - b.x);
	let run: TagFacility[] = [];
	const flush = (): void => {
		if (run.length === 0) return;
		const first = run[0];
		const last = run[run.length - 1];
		const name = nameOf(first.defId);
		const words = run.map((f) => statusWord(f.status, f.enabled, f.status === "failed" ? repairOf?.(f.id) : undefined));
		// One word for the whole run when every member shares it (a row of racks all without power reads as one fact).
		const w0 = words[0];
		if (w0 && w0.tone !== "dim" && run.length > 1 && words.every((w) => w?.word === w0.word)) {
			out.push({ text: w0.word, tone: w0.tone, cx: first.x + (last.x + last.width - first.x) / 2, floor: first.floor });
		} else {
			run.forEach((f, i) => {
				const w = words[i];
				if (w && w.tone !== "dim") out.push({ text: w.word, tone: w.tone, cx: f.x + f.width / 2, floor: f.floor });
			});
		}
		const blocked = words.some((w) => w && w.tone !== "dim");
		if (name && !blocked) {
			const span = last.x + last.width - first.x;
			out.push({ text: fitName(name, span + 2), tone: "name", cx: first.x + span / 2, floor: first.floor });
		}
		run = [];
	};
	for (const f of sorted) {
		const prev = run[run.length - 1];
		if (prev && (prev.defId !== f.defId || prev.floor !== f.floor || prev.x + prev.width !== f.x)) flush();
		run.push(f);
	}
	flush();
	return declutter(out);
}

/** Rough width of a name tag in tiles (VT323 at 9 px is about 3.2 world px per character). */
const TILES_PER_CHAR = 0.24;
/** Status pills: width in world px for a word (10 px font, 3.6 px per character, plus padding and border). */
export const pillWidth = (word: string): number => Math.ceil(word.length * 3.6 + 8);
/** Same word closer than this many tiles (centre to centre) on one floor reads as one fact. */
const MERGE_TILES = 8;

/**
 * Status pills: merge same-word pills that are close on one floor into one (centred on the group), then nudge
 * different words right until they no longer overlap. A unique word is never dropped. Pure.
 */
function layoutWords(words: Tag[]): Tag[] {
	const out: Tag[] = [];
	const byFloor = new Map<number, Tag[]>();
	for (const w of words) byFloor.set(w.floor, [...(byFloor.get(w.floor) ?? []), w]);
	for (const list of byFloor.values()) {
		list.sort((a, b) => a.cx - b.cx);
		const merged: Tag[] = [];
		const groups: { tag: Tag; lo: number; hi: number }[] = [];
		for (const t of list) {
			const g = groups.find((x) => x.tag.text === t.text && t.cx - x.hi <= MERGE_TILES);
			if (g) {
				g.hi = t.cx;
				g.tag = { ...g.tag, cx: (g.lo + g.hi) / 2 };
			} else groups.push({ tag: t, lo: t.cx, hi: t.cx });
		}
		for (const g of groups) merged.push(g.tag);
		merged.sort((a, b) => a.cx - b.cx);
		let edge = Number.NEGATIVE_INFINITY;
		for (const t of merged) {
			const w = pillWidth(t.text) / 16;
			// Pills are drawn just right of the facility's centre (its badge sits there): `lead` is that offset in tiles.
			const left = t.cx + 7 / 16;
			const cx = left < edge + 2 / 16 ? t.cx + (edge + 2 / 16 - left) : t.cx;
			out.push({ ...t, cx });
			edge = cx + 7 / 16 + w;
		}
	}
	return out;
}

/**
 * Drop name tags that would overlap another tag on the same floor, left to right. Status pills always stay (and are
 * placed first), so trouble is never hidden by a label.
 */
export function declutter(tags: Tag[]): Tag[] {
	const words = layoutWords(tags.filter((t) => t.tone !== "name"));
	const kept: Tag[] = [...words];
	const clash = (t: Tag): boolean => kept.some((k) => k.floor === t.floor && Math.abs(k.cx - t.cx) < ((k.tone === "name" ? k.text.length * TILES_PER_CHAR : pillWidth(k.text) / 16) + t.text.length * TILES_PER_CHAR) / 2 + 0.5);
	for (const t of tags) if (t.tone === "name" && !clash(t)) kept.push(t);
	return kept;
}

/** Whether a world point is inside a rect grown by `pad` (hover test for bots and lifts). */
export const hits = (wx: number, wy: number, r: { x: number; y: number; w: number; h: number }, pad = 2): boolean => wx >= r.x - pad && wx <= r.x + r.w + pad && wy >= r.y - pad && wy <= r.y + r.h + pad;
