/**
 * Connected-component labelling of one conduit layer with union-find over 4-neighbour cells
 * (vertical neighbours = risers). Net ids are assigned in ascending order of each component's
 * lowest cell index, so labelling is deterministic.
 */
import type { GridDims } from "../core/grid";
import { floorCount } from "../core/grid";

function find(parent: Int32Array, i: number): number {
	let r = i;
	while (parent[r] !== r) {
		parent[r] = parent[parent[r]]; // path halving
		r = parent[r];
	}
	return r;
}

function union(parent: Int32Array, a: number, b: number): void {
	const ra = find(parent, a);
	const rb = find(parent, b);
	if (ra === rb) return;
	// Smaller index becomes the root.
	if (ra < rb) parent[rb] = ra;
	else parent[ra] = rb;
}

/** Writes net ids (-1 = none) into `out`; returns the number of nets. */
export function labelLayer(dims: GridDims, layer: Uint8Array, out: Int32Array, parent: Int32Array, label: Int32Array): number {
	const w = dims.width;
	const h = floorCount(dims);
	const n = w * h;
	for (let i = 0; i < n; i++) parent[i] = i;
	for (let row = 0; row < h; row++) {
		for (let x = 0; x < w; x++) {
			const i = row * w + x;
			if (!layer[i]) continue;
			if (x + 1 < w && layer[i + 1]) union(parent, i, i + 1);
			if (row + 1 < h && layer[i + w]) union(parent, i, i + w);
		}
	}
	label.fill(-1, 0, n);
	let next = 0;
	for (let i = 0; i < n; i++) {
		if (!layer[i]) {
			out[i] = -1;
			continue;
		}
		const r = find(parent, i);
		if (label[r] < 0) label[r] = next++;
		out[i] = label[r];
	}
	return next;
}
