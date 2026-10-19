/**
 * Tick stage 3b: nutrient nets. Supply = Σ enabled plant `bio.nutrientCapacity` × power factor; demand = organoid racks
 * (`rack.bio.nutrientUse` × load) + bioreactors (`bio.nutrientUse`). Satisfaction = min(1, supply/demand). Every unit
 * supplied is billed at `balance.bio.nutrientPrice` as upkeep.
 */
import type { TickCtx } from "../core/context";
import { EPS } from "../core/constants";
import type { NutrientNet } from "../core/state";
import { spend } from "../economy/ledger";
import { powerFactor } from "../power/powerSolve";
import { getDef } from "../world/defs";
import { ensureBioIndex, rackLoad } from "./index";

export function nutrientSolve(ctx: TickCtx): void {
	const { state, content } = ctx;
	const idx = ensureBioIndex(ctx);
	const n = state.nutrientNetCount;
	const supply = new Float64Array(n);
	const demand = new Float64Array(n);
	for (const f of idx.plants) {
		if (f.nutrientNet < 0 || !f.enabled) continue;
		supply[f.nutrientNet] += (getDef(content, f.defId).bio?.nutrientCapacity ?? 0) * powerFactor(f.sat);
	}
	for (const f of state.facilities) {
		f.nutrientSat = 1;
		f.noNutrient = false;
	}
	const need = (f: (typeof idx.consumers)[number]): number => {
		if (!f.enabled) return 0;
		const d = getDef(content, f.defId);
		if (d.kind === "bioreactor") return d.bio?.nutrientUse ?? 0;
		return (d.rack?.bio?.nutrientUse ?? 0) * rackLoad(state, content, f);
	};
	for (const f of idx.consumers) if (f.nutrientNet >= 0) demand[f.nutrientNet] += need(f);
	const nets: NutrientNet[] = [];
	let total = 0;
	for (let i = 0; i < n; i++) {
		nets.push({ id: i, supply: supply[i], demand: demand[i], satisfaction: demand[i] > EPS ? Math.min(1, supply[i] / demand[i]) : 1 });
		total += supply[i];
	}
	for (const f of idx.consumers) {
		f.nutrientSat = f.nutrientNet >= 0 ? nets[f.nutrientNet].satisfaction : 0;
		f.noNutrient = f.enabled && f.nutrientSat <= EPS;
	}
	state.nutrientNets = nets;
	spend(state, "upkeep", total * content.balance.bio.nutrientPrice);
}
