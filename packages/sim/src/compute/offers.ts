/** Contract offers: expiry and seeded generation roughly every `offerIntervalTicks` (±50 % jitter). */
import type { ContentDB } from "@aitower/content";
import type { TickCtx } from "../core/context";
import { nextRandom } from "../core/rng";
import type { SimState } from "../core/state";
import { dayOf } from "../core/time";
import { installedPflops } from "./allocation";

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
	if (state.tick < state.nextOfferTick) return;
	state.nextOfferTick = state.tick + nextOfferDelay(state, content);
	if (state.offers.length >= eco.maxOffers) return;
	const rng = (): number => nextRandom(state.rng, "contracts");
	const generated = content.generateContract(rng, { tier: state.tier, capacityPflops: installedPflops(state, content), day: dayOf(state.tick) }, content);
	// Defensive copy so content code can't alias sim state.
	const spec = JSON.parse(JSON.stringify(generated)) as typeof generated;
	const id = state.nextId.contract++;
	state.offers.push({ id, spec, expiresAt: state.tick + eco.offerExpiryTicks });
	events.push({ type: "contractOffered", contractId: id });
}
