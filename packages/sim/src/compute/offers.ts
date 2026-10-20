/** Contract offers: expiry and seeded generation roughly every `offerIntervalTicks` (±50 % jitter). */
import type { ContentDB, ContractSpec } from "@aitower/content";
import type { TickCtx } from "../core/context";
import { GUARANTEED_OFFER_TICKS } from "../core/constants";
import { nextRandom } from "../core/rng";
import type { SimState } from "../core/state";
import { dayOf } from "../core/time";
import { modFactor } from "../ministry/modifiers";
import { installedPflops } from "./allocation";
import { perk } from "../research/research";

export function nextOfferDelay(state: SimState, content: ContentDB): number {
	const interval = content.balance.economy.offerIntervalTicks;
	return Math.max(1, Math.round(interval * (0.5 + nextRandom(state.rng, "contracts"))));
}

export function offersStep(ctx: TickCtx): void {
	const { state, content, events } = ctx;
	const eco = content.balance.economy;
	if (state.offers.some((o) => o.expiresAt <= state.tick)) {
		state.offers = state.offers.filter((o) => {
			if (o.expiresAt > state.tick) return true;
			events.push({ type: "contractExpired", contractId: o.id });
			return false;
		});
	}
	if (state.offers.length === 0 && state.nextOfferTick > state.tick + GUARANTEED_OFFER_TICKS) state.nextOfferTick = state.tick + GUARANTEED_OFFER_TICKS;
	if (state.tick < state.nextOfferTick) return;
	state.nextOfferTick = state.tick + nextOfferDelay(state, content);
	if (state.offers.length >= eco.maxOffers) return;
	const id = pushOffer(state, content, generateSpec(state, content));
	events.push({ type: "contractOffered", contractId: id });
}

function generateSpec(state: SimState, content: ContentDB): ContractSpec {
	const rng = (): number => nextRandom(state.rng, "contracts");
	const generated = content.generateContract(rng, { tier: state.tier, capacityPflops: installedPflops(state, content), day: dayOf(state.tick) }, content);
	// Defensive copy so content code can't alias sim state.
	const spec = JSON.parse(JSON.stringify(generated)) as ContractSpec;
	spec.payout *= modFactor(state, "payout") * perk(state, content, "payout");
	return spec;
}

function pushOffer(state: SimState, content: ContentDB, spec: ContractSpec): number {
	const id = state.nextId.contract++;
	state.offers.push({ id, spec, expiresAt: state.tick + content.balance.economy.offerExpiryTicks });
	return id;
}

/** Air-cooled, non-organoid compute racks' PFLOPS, best first (what an easy opening contract can use). */
function airRackPflops(state: SimState, content: ContentDB): number[] {
	const out: number[] = [];
	for (const f of state.facilities) {
		const r = content.facilities[f.defId]?.rack;
		if (r && r.cooling === "air" && r.pflops > 0) out.push(r.pflops);
	}
	return out.sort((a, b) => b - a);
}

/**
 * New game: seed one offer at tick 0 so the first action is accepting a contract. Uses the seeded generator, retrying
 * until the job is an inference contract that fits the idle air racks (pays from its first tick) with no liquid/organoid need; otherwise the last draw is trimmed into an easy inference job.
 * Scenarios with no air compute racks just get the first draw.
 */
export function seedOpeningOffer(state: SimState, content: ContentDB): void {
	const air = airRackPflops(state, content);
	const idle = air.reduce((a, b) => a + b, 0);
	const fits = (s: ContractSpec): boolean => {
		if (s.needsLiquid || s.needsBio) return false;
		// Inference pays every tick; training only pays at checkpoints, which can be hours away.
		return s.kind === "inference" && (s.sustainedPflops ?? s.work) <= idle + 1e-9;
	};
	let spec = generateSpec(state, content);
	if (idle > 0) {
		for (let i = 0; i < 24 && !fits(spec); i++) spec = generateSpec(state, content);
		if (!fits(spec)) {
			const sustained = Math.max(1, Math.floor(idle * 5) / 10);
			const hours = 4;
			spec = { ...spec, kind: "inference", needsLiquid: false, needsBio: undefined, sustainedPflops: sustained, work: sustained, durationTicks: hours * 60, storageTB: 0, payout: Math.round((sustained * hours * 145) / 100) * 100 };
			delete spec.needsBio;
		}
	}
	pushOffer(state, content, spec);
}
