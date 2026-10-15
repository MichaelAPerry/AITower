/** Pure formatting helpers. All functions are total (NaN/Infinity render as "—"). */

const DASH = "—";
const bad = (n: number): boolean => !Number.isFinite(n);

/** $ with k/M/B suffixes: 950 → "$950", 12_345 → "$12.3k", 2_500_000 → "$2.50M", −800 → "−$800". */
export function fmtMoney(n: number): string {
	if (bad(n)) return DASH;
	const sign = n < 0 ? "−" : "";
	const a = Math.abs(n);
	let body: string;
	if (a < 1_000) body = Math.round(a).toString();
	else if (a < 100_000) body = `${trim((a / 1_000).toFixed(1))}k`;
	else if (a < 1_000_000) body = `${Math.round(a / 1_000)}k`;
	else if (a < 1_000_000_000) body = `${(a / 1_000_000).toFixed(a < 10_000_000 ? 2 : 1)}M`;
	else body = `${(a / 1_000_000_000).toFixed(2)}B`;
	return `${sign}$${body}`;
}

/** kW below 1 MW, MW above: 8.25 → "8.3 kW", 640 → "640 kW", 1250 → "1.25 MW". */
export function fmtPower(kw: number): string {
	if (bad(kw)) return DASH;
	const a = Math.abs(kw);
	if (a >= 1_000) return `${(kw / 1_000).toFixed(a >= 10_000 ? 1 : 2)} MW`;
	if (a < 10) return `${trim(kw.toFixed(1))} kW`;
	return `${Math.round(kw)} kW`;
}

/** Energy in kWh/MWh. */
export function fmtEnergy(kwh: number): string {
	if (bad(kwh)) return DASH;
	return Math.abs(kwh) >= 1_000 ? `${(kwh / 1_000).toFixed(1)} MWh` : `${Math.round(kwh)} kWh`;
}

/** °C with fixed decimals: 41.26 → "41.3 °C". */
export function fmtTemp(c: number, digits = 1): string {
	if (bad(c)) return DASH;
	return `${c.toFixed(digits)} °C`;
}

/** Ratio 0..1 → percent: 0.9951 → "99.5%". */
export function fmtPct(ratio: number, digits = 1): string {
	if (bad(ratio)) return DASH;
	return `${(ratio * 100).toFixed(digits)}%`;
}

/** PFLOPS: 0.5 → "0.50 PF", 12.34 → "12.3 PF", 250 → "250 PF". */
export function fmtPflops(pf: number): string {
	if (bad(pf)) return DASH;
	const a = Math.abs(pf);
	return `${a < 10 ? pf.toFixed(2) : a < 100 ? pf.toFixed(1) : Math.round(pf).toString()} PF`;
}

/** Game ticks (minutes) → compact duration: 45 → "45m", 200 → "3h 20m", 3000 → "2d 2h". */
export function fmtDuration(ticks: number): string {
	if (bad(ticks)) return DASH;
	const t = Math.max(0, Math.round(ticks));
	const d = Math.floor(t / 1440);
	const h = Math.floor((t % 1440) / 60);
	const m = t % 60;
	if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
	if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
	return `${m}m`;
}

/** PUE with two decimals. */
export function fmtPue(pue: number): string {
	return bad(pue) ? DASH : pue.toFixed(2);
}

const trim = (s: string): string => s.replace(/\.0$/, "");

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : Number.isFinite(v) ? v : 0);
