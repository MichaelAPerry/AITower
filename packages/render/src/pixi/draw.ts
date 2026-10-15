/** Tiny drawing primitives over Pixi Graphics for pixel art. */
import type { Graphics } from "pixi.js";

/** Filled axis-aligned rect. */
export const px = (g: Graphics, x: number, y: number, w: number, h: number, color: number, alpha = 1): void => {
	if (w <= 0 || h <= 0) return;
	g.rect(x, y, w, h).fill({ color, alpha });
};

/** 1px rectangle outline drawn with filled rects (crisper than strokes). */
export const box = (g: Graphics, x: number, y: number, w: number, h: number, color: number, alpha = 1, t = 1): void => {
	px(g, x, y, w, t, color, alpha);
	px(g, x, y + h - t, w, t, color, alpha);
	px(g, x, y + t, t, h - 2 * t, color, alpha);
	px(g, x + w - t, y + t, t, h - 2 * t, color, alpha);
};

/** Small spinning fan (blades as pixel spokes). */
export const fan = (g: Graphics, cx: number, cy: number, r: number, angle: number, housing: number, blade: number): void => {
	g.circle(cx, cy, r).fill({ color: housing });
	g.circle(cx, cy, r - 1).fill({ color: 0x0d0f12 });
	for (let i = 0; i < 3; i++) {
		const a = angle + (i * Math.PI * 2) / 3;
		const ex = cx + Math.cos(a) * (r - 1.5);
		const ey = cy + Math.sin(a) * (r - 1.5);
		g.moveTo(cx, cy).lineTo(ex, ey).stroke({ width: 1.5, color: blade });
	}
	px(g, Math.round(cx) - 1, Math.round(cy) - 1, 2, 2, housing);
};
