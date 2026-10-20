export interface Rect {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

/** Where the bubble sits relative to its target: "below" puts it under the target with the arrow pointing up. */
export type Side = "above" | "below" | "left" | "right";

export interface Placed {
	left: number;
	top: number;
	side: Side;
	/** Distance of the arrow tip from the bubble's left (above/below) or top (left/right) edge. */
	arrow: number;
}

const ARROW_PAD = 16;

const at = (side: Side, t: Rect, w: number, h: number, gap: number): { left: number; top: number } => {
	const cx = (t.left + t.right) / 2;
	const cy = (t.top + t.bottom) / 2;
	switch (side) {
		case "below":
			return { left: cx - w / 2, top: t.bottom + gap };
		case "above":
			return { left: cx - w / 2, top: t.top - gap - h };
		case "left":
			return { left: t.left - gap - w, top: cy - h / 2 };
		case "right":
			return { left: t.right + gap, top: cy - h / 2 };
	}
};

const inside = (p: { left: number; top: number }, w: number, h: number, b: Rect): boolean => p.left >= b.left && p.top >= b.top && p.left + w <= b.right && p.top + h <= b.bottom;

/**
 * Place a bubble of `size` next to `target` on the first of `prefer` (then the other sides) where it fits inside `bounds`
 * without touching the target; if none fits, the first preferred side, clamped into the bounds. The arrow always points at the
 * target's centre, kept inside the bubble's edge.
 */
export function placeBubble(target: Rect, size: { w: number; h: number }, bounds: Rect, prefer: Side[] = ["below", "above", "right", "left"], gap = 14, avoid: Rect[] = []): Placed {
	const { w, h } = size;
	const order = [...prefer, ...(["below", "above", "right", "left"] as Side[]).filter((s) => !prefer.includes(s))];
	const clamp = (p: { left: number; top: number }) => ({ left: Math.max(bounds.left, Math.min(p.left, bounds.right - w)), top: Math.max(bounds.top, Math.min(p.top, bounds.bottom - h)) });
	const box = (p: { left: number; top: number }): Rect => ({ left: p.left, top: p.top, right: p.left + w, bottom: p.top + h });
	const clear = (p: { left: number; top: number }) => !intersects(box(p), target);
	const free = (p: { left: number; top: number }) => !avoid.some((a) => intersects(box(p), a));
	// First choice: a side where it fits as is and covers no obstacle (open panels). Then one that fits. Then one that,
	// clamped into the bounds, still clears the target.
	let side = order.find((s) => inside(at(s, target, w, h, gap), w, h, bounds) && free(at(s, target, w, h, gap)));
	if (!side) side = order.find((s) => inside(at(s, target, w, h, gap), w, h, bounds));
	if (!side) side = order.find((s) => clear(clamp(at(s, target, w, h, gap)))) ?? order[0];
	const { left, top } = clamp(at(side, target, w, h, gap));
	const horizontal = side === "above" || side === "below";
	const tip = horizontal ? (target.left + target.right) / 2 - left : (target.top + target.bottom) / 2 - top;
	const len = horizontal ? w : h;
	return { left, top, side, arrow: Math.max(ARROW_PAD, Math.min(len - ARROW_PAD, tip)) };
}

/** True when the two rectangles overlap. */
export const intersects = (a: Rect, b: Rect): boolean => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
