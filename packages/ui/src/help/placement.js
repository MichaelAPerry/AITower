const GAP = 6;
const MARGIN = 8;
/** Hover delay: instant in help mode, a short beat otherwise so passing the mouse over the strip stays quiet. */
export const tipDelay = (helpOn) => (helpOn ? 0 : 650);
/**
 * Below the element when it sits in the upper half, above it when low; beside it (to its left) when it hugs the right edge
 * (the drawer tabs). Clamped inside the viewport.
 */
export function tipPos(r, card, vw, vh, scale) {
    const w = card.w * scale;
    const h = card.h * scale;
    let left;
    let top;
    if (r.left > vw * 0.85) {
        left = r.left - w - GAP;
        top = r.top;
    }
    else {
        left = r.left;
        top = r.bottom + GAP + h <= vh - MARGIN ? r.bottom + GAP : r.top - GAP - h;
    }
    left = Math.max(MARGIN, Math.min(left, vw - w - MARGIN));
    top = Math.max(MARGIN, Math.min(top, vh - h - MARGIN));
    return { left: left / scale, top: top / scale };
}
