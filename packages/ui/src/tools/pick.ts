import type { CellRef, SimView } from "@aitower/sim";
import type { Selection } from "@aitower/shared";

/** Facility under the cell ▸ nearest bot within 1 tile on that floor ▸ lift shaft ▸ null. */
export function pickAt(view: SimView, cell: CellRef): Selection {
	const f = view.facilities.find((f) => f.floor === cell.floor && cell.x >= f.x && cell.x < f.x + f.width);
	if (f) return { kind: "facility", id: f.id };
	let best: { id: number; d: number } | null = null;
	for (const b of view.bots) {
		if (Math.abs(b.floor - cell.floor) >= 0.5) continue;
		const d = Math.abs(b.x - cell.x);
		if (d <= 1 && (!best || d < best.d)) best = { id: b.id, d };
	}
	if (best) return { kind: "bot", id: best.id };
	const l = view.lifts.find((l) => l.x === cell.x && cell.floor >= l.floorMin && cell.floor <= l.floorMax);
	if (l) return { kind: "lift", id: l.id };
	return null;
}
