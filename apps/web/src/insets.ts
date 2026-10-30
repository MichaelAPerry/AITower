/** Overlays that can cover the left or right end of the world view (classified by which half of the screen they sit in). */
const OVERLAYS = [".bld-catalog", ".bld-bar", ".ui-goals", ".ui-right .ui-inspector", ".ui-dtabs", ".ui-drawer.is-open", ".ui-edge"].join(",");

export interface Box {
	left: number;
	right: number;
	width: number;
	height: number;
}

/** Pure: how far the left and right edges of a `vw`-wide screen are covered by `boxes`. */
export const insetsFor = (boxes: Box[], vw: number): { left: number; right: number } => {
	let left = 0;
	let right = 0;
	for (const b of boxes) {
		if (b.width < 4 || b.height < 4) continue;
		if ((b.left + b.right) / 2 < vw / 2) left = Math.max(left, Math.min(b.right, vw));
		else right = Math.max(right, Math.min(vw - b.left, vw));
	}
	return { left, right };
};

/** Returns a function that measures the open overlays and reports changed insets to `apply`. */
export const createInsetTracker = (apply: (left: number, right: number) => void): (() => void) => {
	let last = "";
	return () => {
		const boxes: Box[] = [];
		for (const el of document.querySelectorAll<HTMLElement>(OVERLAYS)) {
			const r = el.getBoundingClientRect();
			boxes.push({ left: r.left, right: r.right, width: r.width, height: r.height });
		}
		const { left, right } = insetsFor(boxes, window.innerWidth);
		const key = `${Math.round(left)},${Math.round(right)}`;
		if (key === last) return;
		last = key;
		apply(left, right);
	};
};
