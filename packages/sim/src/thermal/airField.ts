/**
 * Tick stage 5a: explicit air-field step (ARCHITECTURE §4.1) in flux form (energy-conserving).
 * Built cells exchange heat with neighbours (horizontal: air, vertical: slab + upward buoyancy); edges and unbuilt neighbours couple to ambient; unbuilt cells = ambient.
 * Rack air heat is added, then CRAHs pull cells within their radius toward 20 °C (never below).
 */
import type { TickCtx } from "../core/context";
import { CRAH_TARGET_C, HEAT_EXPORT_FLOOR_C, MAX_LINK_COUPLING, SECONDS_PER_TICK, TICKS_PER_HOUR } from "../core/constants";
import { cellIdx, floorCount } from "../core/grid";
import { earn } from "../economy/ledger";
import { powerFactor } from "../power/powerSolve";
import { getDef } from "../world/defs";
import { perk } from "../research/research";

const coupling = (kKw: number, perKj: number): number => Math.min(MAX_LINK_COUPLING, kKw * perKj);

/** Outside-air cooling: full at or below `fullBelowC`, falling linearly to `hotFactor` at `hotC`, flat beyond. 1 for any other air handler. */
export function freeAirFactor(free: { fullBelowC: number; hotC: number; hotFactor: number } | undefined, ambientC: number): number {
	if (!free) return 1;
	if (ambientC <= free.fullBelowC) return 1;
	if (ambientC >= free.hotC) return free.hotFactor;
	return 1 - ((1 - free.hotFactor) * (ambientC - free.fullBelowC)) / (free.hotC - free.fullBelowC);
}

export function airFieldStep(ctx: TickCtx): void {
	const { state, content, scratch } = ctx;
	const th = content.balance.thermal;
	const w = state.width;
	const h = floorCount(state);
	const n = w * h;
	const amb = state.ambientC;
	const slab = state.slab;
	/** °C per kJ → ΔT per tick for a kW source = kW · 60 / C. */
	const perKj = SECONDS_PER_TICK / th.airCellHeatCapacity;
	const aAir = coupling(th.airConductance, perKj);
	const aSlab = coupling(th.slabConductance, perKj);
	/** Buoyancy share, clamped so slab + buoyancy ≤ MAX_LINK_COUPLING. */
	const aBuoy = coupling(th.slabConductance + th.buoyancy, perKj) - aSlab;
	const aEnv = coupling(th.envelopeConductance, perKj);

	const T = scratch.tempA;
	const next = scratch.tempB;
	for (let i = 0; i < n; i++) {
		T[i] = slab[i] ? state.airTemp[i] : amb;
		next[i] = T[i];
	}

	for (let row = 0; row < h; row++) {
		for (let x = 0; x < w; x++) {
			const i = row * w + x;
			if (!slab[i]) continue;
			const t = T[i];
			// Right neighbour (left neighbour's link handled when it was visited) / envelope.
			if (x + 1 < w && slab[i + 1]) {
				const flow = aAir * (T[i + 1] - t);
				next[i] += flow;
				next[i + 1] -= flow;
			} else next[i] += aEnv * (amb - t);
			if (x === 0 || !slab[i - 1]) next[i] += aEnv * (amb - t);
			// Upper neighbour: conduction through its slab plus buoyancy. Buoyancy lifts air that is
			// warmer than the cooler of (upper cell, outdoors) — a stack effect, so with equal loads the
			// upper floor ends warmer. Pairwise, so energy is conserved.
			if (row + 1 < h && slab[i + w]) {
				const up = T[i + w];
				const flow = aSlab * (t - up) + aBuoy * Math.max(0, t - Math.min(up, amb));
				next[i] -= flow;
				next[i + w] += flow;
			} else next[i] += aEnv * (amb - t);
			if (row === 0 || !slab[i - w]) next[i] += aEnv * (amb - t);
		}
	}

	// Rack heat into air.
	for (const f of state.facilities) {
		const d = getDef(content, f.defId);
		if (d.kind !== "rack" || f.heatKw <= 0) continue;
		const lf = d.rack?.liquidFraction ?? 0;
		const airKw = f.noCoolant ? f.heatKw : f.heatKw * (1 - lf);
		const dT = (airKw / f.width) * perKj;
		for (let k = 0; k < f.width; k++) {
			const i = cellIdx(state, f.x + k, f.floor);
			if (slab[i]) next[i] += dT;
		}
	}

	// CRAH sinks, in id order; each sees the result of the previous one. A perfusion unit (`bioOnly`) cools only the cells under
	// organoid racks and only down to its `holdC` (37 °C); an economizer (`freeAir`) loses capacity as the outside warms.
	const coolingPerk = perk(state, content, "coolingCapacity");
	let bioCells: Uint8Array | null = null;
	for (const f of state.facilities) {
		const d = getDef(content, f.defId);
		if (d.kind !== "crah") continue;
		f.heatKw = 0;
		if (!f.enabled) continue;
		const cs = d.cooling;
		const capKw = (cs?.capacityKw ?? 0) * coolingPerk * powerFactor(f.sat) * freeAirFactor(cs?.freeAir, amb);
		if (capKw <= 0) continue;
		const target = cs?.holdC ?? CRAH_TARGET_C;
		const bioOnly = cs?.bioOnly === true;
		if (bioOnly && !bioCells) {
			bioCells = new Uint8Array(n);
			for (const o of state.facilities) {
				const od = getDef(content, o.defId);
				if (od.kind === "rack" && od.rack?.cooling === "bio" && !od.growth) for (let k = 0; k < o.width; k++) bioCells[cellIdx(state, o.x + k, o.floor)] = 1;
			}
		}
		const r = cs?.radius ?? 0;
		const x0 = Math.max(0, f.x - r);
		const x1 = Math.min(w - 1, f.x + f.width - 1 + r);
		let wantKw = 0;
		for (let x = x0; x <= x1; x++) {
			const i = cellIdx(state, x, f.floor);
			if (slab[i] && next[i] > target && (!bioOnly || bioCells?.[i])) wantKw += (next[i] - target) / perKj;
		}
		if (wantKw <= 0) continue;
		const scale = Math.min(1, capKw / wantKw);
		for (let x = x0; x <= x1; x++) {
			const i = cellIdx(state, x, f.floor);
			if (slab[i] && next[i] > target && (!bioOnly || bioCells?.[i])) next[i] -= (next[i] - target) * scale;
		}
		f.heatKw = wantKw * scale;
	}

	// District-heat exporters (after the CRAHs): remove up to `green.exportKw` (× power satisfaction) from the warm cells in
	// reach, never below HEAT_EXPORT_FLOOR_C, and sell the heat at `green.heatPrice` per kWh.
	let exportedKw = 0;
	for (const f of state.facilities) {
		const d = getDef(content, f.defId);
		if (d.kind !== "heat_export") continue;
		f.heatKw = 0;
		const capKw = (d.green?.exportKw ?? 0) * powerFactor(f.sat);
		if (!f.enabled || capKw <= 0) continue;
		const r = d.green?.radius ?? 0;
		const x0 = Math.max(0, f.x - r);
		const x1 = Math.min(w - 1, f.x + f.width - 1 + r);
		let wantKw = 0;
		for (let x = x0; x <= x1; x++) {
			const i = cellIdx(state, x, f.floor);
			if (slab[i] && next[i] > HEAT_EXPORT_FLOOR_C) wantKw += (next[i] - HEAT_EXPORT_FLOOR_C) / perKj;
		}
		if (wantKw <= 0) continue;
		const scale = Math.min(1, capKw / wantKw);
		for (let x = x0; x <= x1; x++) {
			const i = cellIdx(state, x, f.floor);
			if (slab[i] && next[i] > HEAT_EXPORT_FLOOR_C) next[i] -= (next[i] - HEAT_EXPORT_FLOOR_C) * scale;
		}
		f.heatKw = wantKw * scale;
		exportedKw += f.heatKw;
		earn(state, (f.heatKw / TICKS_PER_HOUR) * content.balance.green.heatPrice);
	}
	state.metrics.heatExportKw = exportedKw;

	for (let i = 0; i < n; i++) state.airTemp[i] = next[i];
}
