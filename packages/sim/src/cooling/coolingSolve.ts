/**
 * Tick stage 4: lumped coolant loops. Capacity = Σ chiller capped by Σ CDU (0 without a CDU);
 * load = Σ liquid-rack heat × liquidFraction; supply temp rises +10 °C per 10 % overload.
 */
import type { TickCtx } from "../core/context";
import { COOLANT_MAX_OVERLOAD_FRACTION, COOLANT_OVERLOAD_C_PER_FRACTION, EPS } from "../core/constants";
import type { CoolantNet } from "../core/state";
import { powerFactor } from "../power/powerSolve";
import { getDef, isLiquidRack } from "../world/defs";

export function coolingSolve(ctx: TickCtx): void {
	const { state, content } = ctx;
	const supplyC = content.balance.thermal.coolantSupplyC;
	const n = state.coolantNetCount;
	const chillerCap = new Float64Array(n);
	const cduCap = new Float64Array(n);
	const load = new Float64Array(n);

	for (const f of state.facilities) {
		if (f.coolantNet < 0 || !f.enabled) continue;
		const d = getDef(content, f.defId);
		const cap = (d.cooling?.capacityKw ?? 0) * powerFactor(f.sat);
		if (d.kind === "chiller") chillerCap[f.coolantNet] += cap;
		else if (d.kind === "cdu") cduCap[f.coolantNet] += cap;
	}
	const capacity = (net: number): number => (cduCap[net] > 0 ? Math.min(chillerCap[net], cduCap[net]) : 0);

	for (const f of state.facilities) {
		const d = getDef(content, f.defId);
		if (!isLiquidRack(d)) {
			f.noCoolant = false;
			continue;
		}
		f.noCoolant = f.coolantNet < 0 || capacity(f.coolantNet) <= EPS;
		if (!f.noCoolant) load[f.coolantNet] += f.powerKw * (d.rack?.liquidFraction ?? 0);
	}

	const nets: CoolantNet[] = [];
	for (let i = 0; i < n; i++) {
		const cap = capacity(i);
		const over = cap > EPS && load[i] > cap ? Math.min(COOLANT_MAX_OVERLOAD_FRACTION, (load[i] - cap) / cap) : 0;
		nets.push({ id: i, capacityKw: cap, loadKw: load[i], supplyTempC: supplyC + over * COOLANT_OVERLOAD_C_PER_FRACTION });
	}

	// Heat removed per device (chiller heat drives next tick's chiller power) and rack supply temps.
	for (const f of state.facilities) {
		const d = getDef(content, f.defId);
		if (d.kind === "chiller" || d.kind === "cdu") {
			const net = f.coolantNet;
			if (net < 0 || !f.enabled) {
				f.heatKw = 0;
				continue;
			}
			const removed = Math.min(load[net], capacity(net));
			const total = d.kind === "chiller" ? chillerCap[net] : cduCap[net];
			const own = (d.cooling?.capacityKw ?? 0) * powerFactor(f.sat);
			f.heatKw = total > EPS ? (removed * own) / total : 0;
		} else if (isLiquidRack(d)) {
			f.coolantC = f.noCoolant ? supplyC : nets[f.coolantNet].supplyTempC;
		}
	}
	state.coolantNets = nets;
}
