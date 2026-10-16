import type { Corner } from "./steps";

export interface Rect {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

export const intersects = (a: Rect, b: Rect): boolean => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

const ORDER: Record<Corner, Corner[]> = {
	br: ["br", "bl", "tr", "tl"],
	bl: ["bl", "br", "tl", "tr"],
	tr: ["tr", "tl", "br", "bl"],
	tl: ["tl", "tr", "bl", "br"],
};

/** Where the memo would sit in a corner of `area`. */
export function cornerRect(corner: Corner, area: Rect, w: number, h: number): Rect {
	const left = corner === "tl" || corner === "bl" ? area.left : area.right - w;
	const top = corner === "tl" || corner === "tr" ? area.top : area.bottom - h;
	return { left, top, right: left + w, bottom: top + h };
}

/**
 * The corner of the world area for the memo: the preferred one if it does not cover any of `avoid`, else the
 * first of the others (nearest first) that does not. If every corner overlaps, the preferred one is kept.
 */
export function pickCorner(preferred: Corner, area: Rect, memo: { w: number; h: number }, avoid: Rect[], pad = 6): Corner {
	const grown = avoid.map((r) => ({ left: r.left - pad, top: r.top - pad, right: r.right + pad, bottom: r.bottom + pad }));
	for (const c of ORDER[preferred]) {
		const r = cornerRect(c, area, memo.w, memo.h);
		if (!grown.some((a) => intersects(r, a))) return c;
	}
	return preferred;
}

/** A box around the middle of the world area: where the camera puts a step's focus cell and its ghost. */
export function centreBox(area: Rect, half = 90): Rect {
	const cx = (area.left + area.right) / 2;
	const cy = (area.top + area.bottom) / 2;
	return { left: cx - half, right: cx + half, top: cy - half, bottom: cy + half };
}
