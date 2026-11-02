/**
 * Luci's one-line quips on inspection cards. All text here is placeholder (docs/PLACEHOLDER_TEXT.md).
 * Data first: add a line to a pool and it is picked up. Selection is pure: the same thing inspected gives the same quip.
 */

/** What is being inspected. `lift` and `bot` are not facilities. */
export type QuipKind = "rack" | "power" | "cooling" | "logistics" | "bot" | "lift";
/** `trouble`: not doing its job. `off`: switched off or idle. `fine`: working. An empty pool falls back to `fine`. */
export type QuipState = "fine" | "off" | "trouble";

export const QUIPS: Record<QuipKind, Record<QuipState, readonly string[]>> = {
	rack: {
		fine: ["Every busy rack is money. Keep it busy.", "A rack earning its keep. I like that in a rack.", "That one pays for its own power. Mostly."],
		off: ["An idle rack earns nothing. Find it a client."],
		trouble: ["That rack is costing us. Find out why.", "A rack that isn't computing isn't paying."],
	},
	power: {
		fine: ["Power is the biggest bill. Watch it."],
		off: [],
		trouble: ["Short on power, and everything downstream pays for it."],
	},
	cooling: {
		fine: ["Cool racks run fast racks. Fast racks pay."],
		off: [],
		trouble: ["If this fails the racks slow down. So does the money."],
	},
	logistics: {
		fine: ["Boring parts. Expensive if they go missing."],
		off: [],
		trouble: ["When the spares run out, repairs wait. So do we."],
	},
	bot: {
		fine: ["A bot on the job. Cheaper than a person."],
		off: [],
		trouble: ["A flat battery earns nothing. Charge it."],
	},
	lift: {
		fine: ["The lift moves parts and bots. Don't let it stall."],
		off: [],
		trouble: ["A stuck lift strands the bots. Look into it."],
	},
};

/** Which pool a facility status falls in. */
export function quipState(status: string, problem: boolean): QuipState {
	if (status === "disabled" || status === "idle") return "off";
	if (problem || status !== "ok") return "trouble";
	return "fine";
}

/** A small stable number from an id or a key (a string hashes). */
function seedOf(seed: number | string): number {
	if (typeof seed === "number") return Math.abs(Math.trunc(seed));
	let h = 0;
	for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
	return h;
}

/** Pick Luci's quip for what is inspected. Same inputs, same line. */
export function pickQuip(kind: QuipKind, state: QuipState, seed: number | string, pools: typeof QUIPS = QUIPS): string {
	const pool = pools[kind][state].length > 0 ? pools[kind][state] : pools[kind].fine;
	return pool[seedOf(seed) % pool.length] ?? "";
}
