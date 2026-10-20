const ARROW_PAD = 16;
const at = (side, t, w, h, gap) => {
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
const inside = (p, w, h, b) => p.left >= b.left && p.top >= b.top && p.left + w <= b.right && p.top + h <= b.bottom;
/**
 * Place a bubble of `size` next to `target` on the first of `prefer` (then the other sides) where it fits inside `bounds`
 * without touching the target; if none fits, the first preferred side, clamped into the bounds. The arrow always points at the
 * target's centre, kept inside the bubble's edge.
 */
export function placeBubble(target, size, bounds, prefer = ["below", "above", "right", "left"], gap = 14) {
    const { w, h } = size;
    const order = [...prefer, ...["below", "above", "right", "left"].filter((s) => !prefer.includes(s))];
    const clamp = (p) => ({ left: Math.max(bounds.left, Math.min(p.left, bounds.right - w)), top: Math.max(bounds.top, Math.min(p.top, bounds.bottom - h)) });
    const clear = (p) => !intersects({ left: p.left, top: p.top, right: p.left + w, bottom: p.top + h }, target);
    // First choice: a side where it fits as is. Second: a side where, clamped into the bounds, it still clears the target.
    let side = order.find((s) => inside(at(s, target, w, h, gap), w, h, bounds));
    if (!side)
        side = order.find((s) => clear(clamp(at(s, target, w, h, gap)))) ?? order[0];
    const { left, top } = clamp(at(side, target, w, h, gap));
    const horizontal = side === "above" || side === "below";
    const tip = horizontal ? (target.left + target.right) / 2 - left : (target.top + target.bottom) / 2 - top;
    const len = horizontal ? w : h;
    return { left, top, side, arrow: Math.max(ARROW_PAD, Math.min(len - ARROW_PAD, tip)) };
}
/** True when the two rectangles overlap. */
export const intersects = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
