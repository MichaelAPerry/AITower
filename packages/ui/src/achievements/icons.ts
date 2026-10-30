/**
 * Achievement icons: pixel sprites authored in code, like the rest of the game's art (no image files).
 * Each icon is ICON_SIZE rows of ICON_SIZE characters; a character is a palette key, "." is transparent.
 * Add an icon = add one entry to ICONS and set its id in the `icon` field of the achievement row.
 * Drawn crisp at an integer scale (AchIcon.tsx). Palette = the PC-98 tokens (docs/STYLE_PC98.md).
 */

export const ICON_SIZE = 24;

/** Palette keys. Tokens: k --bg, g --money, w --text; the rest are indigo steps and shades of gold. */
export const ICON_PALETTE: Readonly<Record<string, string>> = {
	k: "#07072a",
	n: "#14144a",
	m: "#262672",
	q: "#3a3a80",
	r: "#5a5aa8",
	g: "#ffd75e",
	G: "#c8962e",
	o: "#7a5418",
	h: "#fff3b0",
	w: "#f0f0ff",
};

export const ICONS: Readonly<Record<string, readonly string[]>> = {
	// Deep Pockets: a stack of gold bars in an indigo vault hall, gold-rimmed plate.
	vault_bars: [
		"oGGGGGGGGGGGGGGGGGGGGGGo",
		"GkkkkkkkkkkkkkkkkkkkkkkG",
		"GknnnnnnnnnnnnnnnnnnnnkG",
		"GknmnmnmnmnmnmnmnmnmnmkG",
		"GkmnmnmnmnmnmnmnmnhnmnkG",
		"GknnnnnnnnnnnnnnnnwnnnkG",
		"GknnnnnnnnnnnnnnhwwwhnkG",
		"GknnnhnnnnnnnnnnnnwnnnkG",
		"GknnhwhnnnnnnnnnnnhnnnkG",
		"GknnnhnnnnnnnnnnnnnnnnkG",
		"GknnnnnnkkkkkkkkknnnnnkG",
		"GknnnnnnkhhhhhhhknnnnnkG",
		"GknnnnnnkhggggggknnnnnkG",
		"GknnnnnnkgggggggknnnnnkG",
		"GknnnnnnkGGGGGGGknnnnnkG",
		"GknkkkkkkkkkkkkkkkkkknkG",
		"GknkhhhhhhhkkhhhhhhhknkG",
		"GknkhggggggkkhggggggknkG",
		"GknkgggggggkkgggggggknkG",
		"GknkGGGGGGGkkGGGGGGGknkG",
		"GknkkkkkkkkkkkkkkkkkknkG",
		"GkmmmmmmmmmmmmmmmmmmmmkG",
		"GkkkkkkkkkkkkkkkkkkkkkkG",
		"oGGGGGGGGGGGGGGGGGGGGGGo",
	],
};

const plate = (): string[] =>
	Array.from({ length: ICON_SIZE }, (_, y) =>
		Array.from({ length: ICON_SIZE }, (_, x) => {
			const e = Math.min(x, y, ICON_SIZE - 1 - x, ICON_SIZE - 1 - y);
			return e === 0 ? "q" : e === 1 ? "k" : "n";
		}).join(""),
	);

/** The icon for a hidden achievement that is not yet earned (the failure endings), and the fallback for an unknown id: a plate with a "?". */
const UNKNOWN: readonly string[] = (() => {
	const rows = plate();
	const mark = ["..qqqq..", ".qqrrqq.", "qq....qq", "......qq", "....qqq.", "...qq...", "...qq...", "........", "...qq...", "...qq..."];
	mark.forEach((s, j) => {
		const y = 6 + j;
		const mid = [...s].map((c, i) => (c === "." ? rows[y][8 + i] : c)).join("");
		rows[y] = rows[y].slice(0, 8) + mid + rows[y].slice(16);
	});
	return rows;
})();

export const hasIcon = (id: string): boolean => id in ICONS;

/**
 * Locked variant: the icon's own silhouette, dimmed. The gold rim becomes indigo and every inner shape one flat dim tone,
 * so it reads as "something is here". Unknown ids fall back to the "?" plate.
 */
export function lockedIcon(id: string): readonly string[] {
	const src = ICONS[id];
	if (!src) return UNKNOWN;
	const map: Record<string, string> = { G: "q", o: "q", k: "k", n: "n", m: "n", g: "m", h: "m", w: "m" };
	return src.map((row) => [...row].map((c) => (c === "." ? "." : (map[c] ?? "m"))).join(""));
}

/** The pixel rows to draw. A hidden achievement that is still locked shows the "?" plate. */
export const iconRows = (id: string, locked = false, hidden = false): readonly string[] => (locked ? (hidden ? UNKNOWN : lockedIcon(id)) : (ICONS[id] ?? UNKNOWN));

/** Merge a grid into horizontal runs (one rect per run) for crisp SVG output. */
export function iconRuns(rows: readonly string[]): { x: number; y: number; w: number; fill: string }[] {
	const out: { x: number; y: number; w: number; fill: string }[] = [];
	rows.forEach((row, y) => {
		let x = 0;
		while (x < row.length) {
			const c = row[x];
			let w = 1;
			while (x + w < row.length && row[x + w] === c) w++;
			const fill = ICON_PALETTE[c];
			if (fill) out.push({ x, y, w, fill });
			x += w;
		}
	});
	return out;
}
