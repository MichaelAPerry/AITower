import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

export interface SpecInfo {
	title: string;
	body: string;
	specs: [string, string][];
	warn?: string;
}

export interface Anchor {
	/** Viewport rect of the thing the card belongs to (the palette for its rows, the button for a dock row). */
	right: number;
	rowTop: number;
	rowBottom: number;
}

export interface SpecHover extends SpecInfo {
	anchor: Anchor;
}

const MARGIN = 8;

/**
 * Where the spec card goes, in CSS px of the zoomed HUD (viewport numbers divided by `scale`): just right of the anchor,
 * its top level with the hovered row, clamped so it stays inside the viewport. Never left of the anchor, so it cannot
 * cover the palette, the dock or the hovered row.
 */
export function specCardPos(anchor: Anchor, card: { w: number; h: number }, vw: number, vh: number, scale: number): { left: number; top: number } {
	const w = card.w * scale;
	const h = card.h * scale;
	const left = Math.max(MARGIN, Math.min(anchor.right + MARGIN, vw - w - MARGIN));
	const top = Math.max(MARGIN, Math.min(anchor.rowTop, vh - h - MARGIN));
	return { left: left / scale, top: top / scale };
}

/** The anchor for a hovered element: the card sits right of `edge` (default: the element itself). */
export function anchorOf(row: Element, edge?: Element | null): Anchor {
	const r = row.getBoundingClientRect();
	return { right: (edge ?? row).getBoundingClientRect().right, rowTop: r.top, rowBottom: r.bottom };
}

export function SpecCard({ hover, scale }: { hover: SpecHover; scale: number }) {
	const ref = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		const { left, top } = specCardPos(hover.anchor, { w: el.offsetWidth, h: el.offsetHeight }, window.innerWidth, window.innerHeight, scale);
		el.style.left = `${left}px`;
		el.style.top = `${top}px`;
		el.style.visibility = "visible";
	}, [hover, scale]);
	// Portalled to the HUD root: panels have backdrop filters and scroll areas, which would make `fixed` relative to them and clip the card.
	const host = typeof document === "undefined" ? null : document.querySelector(".aitower-hud");
	if (!host) return null;
	return createPortal(
		<div ref={ref} className="ui-tooltip ui-speccard" role="tooltip" style={{ visibility: "hidden" }}>
			<div className="ui-tooltip-title">{hover.title}</div>
			<p>{hover.body}</p>
			<div className="ui-tooltip-specs">
				{hover.specs.map(([k, v]) => (
					<div key={k} className="ui-row">
						<span className="ui-k">{k}</span>
						<span className="ui-v">{v}</span>
					</div>
				))}
			</div>
			{hover.warn && <div className="ui-tooltip-warn">{hover.warn}</div>}
		</div>,
		host,
	);
}
