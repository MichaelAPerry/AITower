/** Pure colour helpers (numbers are 0xRRGGBB). Ramps use the STYLE.md tokens from `palette.ts`. */
import { HEAT_RAMP as R, T, dk, lt, mix } from "./palette";

export const hex = (s: string): number => {
	const m = /^#?([0-9a-f]{6})$/i.exec(s.trim());
	return m ? Number.parseInt(m[1], 16) : 0xff00ff;
};

const ch = (c: number, shift: number): number => (c >> shift) & 0xff;

export const rgb = (r: number, g: number, b: number): number =>
	(Math.round(Math.min(255, Math.max(0, r))) << 16) |
	(Math.round(Math.min(255, Math.max(0, g))) << 8) |
	Math.round(Math.min(255, Math.max(0, b)));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

export const lerpColor = (a: number, b: number, t: number): number => {
	const u = clamp01(t);
	return rgb(lerp(ch(a, 16), ch(b, 16), u), lerp(ch(a, 8), ch(b, 8), u), lerp(ch(a, 0), ch(b, 0), u));
};

/** Multiply brightness (k < 1 darkens, k > 1 lightens toward white). */
export const shade = (c: number, k: number): number =>
	k <= 1 ? rgb(ch(c, 16) * k, ch(c, 8) * k, ch(c, 0) * k) : lerpColor(c, 0xffffff, k - 1);

/** Piecewise-linear ramp over sorted stops. */
export const ramp = (stops: readonly (readonly [number, number])[], v: number): number => {
	if (v <= stops[0][0]) return stops[0][1];
	for (let i = 1; i < stops.length; i++) {
		const [x1, c1] = stops[i];
		if (v <= x1) {
			const [x0, c0] = stops[i - 1];
			return lerpColor(c0, c1, (v - x0) / (x1 - x0));
		}
	}
	return stops[stops.length - 1][1];
};

/** Air temperature ramp (STYLE.md §2): ≤18 deep blue → 24 verdigris → 30 amber → 36 sodium → 42 red → ≥50 cream-hot. */
export const HEAT_STOPS = [
	[18, R[0]],
	[24, R[1]],
	[30, R[2]],
	[36, R[3]],
	[42, R[4]],
	[50, R[5]],
] as const;

export const heatColor = (tempC: number): number => ramp(HEAT_STOPS, tempC);

/** Overlay alpha for a heat cell: cool air faint, hot air stronger. */
export const heatAlpha = (tempC: number): number => 0.42 + 0.3 * clamp01((tempC - 18) / 27);

/** Rack die temperature ramp (°C), aligned with typical ok/throttle/trip limits; same hues as the heat ramp. */
export const RACK_TEMP_STOPS = [
	[40, R[0]],
	[60, R[1]],
	[75, R[2]],
	[85, R[3]],
	[92, R[4]],
	[100, R[5]],
] as const;

export const rackTempColor = (tempC: number): number => ramp(RACK_TEMP_STOPS, tempC);

/** Satisfaction / health: 0 red → 0.5 amber → 1 green. */
export const satisfactionColor = (s: number): number =>
	ramp(
		[
			[0, T.red],
			[0.5, T.amber],
			[1, T.green],
		],
		s,
	);

/** Load ratio: 0 green → 0.8 amber → ≥1 red. */
export const loadColor = (r: number): number =>
	ramp(
		[
			[0, T.green],
			[0.8, T.amber],
			[1, T.red],
		],
		r,
	);

/** Network tints, all phosphor/metal tokens: amber first (power), verdigris second (coolant). */
const NET_PALETTE = [T.amber, T.verdigris, T.paper, T.sodium, T.green, T.copper, lt(T.verdigris, 0.45), T.brass];

/** Stable distinct colour per network id. */
export const netColor = (id: number): number => NET_PALETTE[((id % NET_PALETTE.length) + NET_PALETTE.length) % NET_PALETTE.length];

// ─── Sky ────────────────────────────────────────────────────────────────

export interface SkyColors {
	top: number;
	horizon: number;
	/** 0 (day) .. 1 (full night) — drives stars, window glow, searchlights. */
	night: number;
	/** Near city silhouette colour. */
	city: number;
	/** Far (hazier) city layer. */
	cityFar: number;
	/** Low smog band hanging over the skyline. */
	haze: number;
}

// Night: brown-black. Dawn/dusk: sodium. Day: dirty teal smog.
const NIGHT_TOP = T.ink;
const NIGHT_HZ = mix(T.ink, T.sodium, 0.16);
const DAY_TOP = dk(mix(T.smog, T.verdigris, 0.2), 0.22);
const DAY_HZ = mix(mix(T.smog, T.paper, 0.45), T.amber, 0.08);
const DUSK_TOP = mix(T.housing, T.copper, 0.25);
const DUSK_HZ = mix(T.sodium, T.copper, 0.35);

/** Keyframes: [minuteOfDay, top, horizon, night, cityNear, cityFar, haze]. */
const SKY_KEYS: readonly (readonly [number, number, number, number, number, number, number])[] = [
	[0, NIGHT_TOP, NIGHT_HZ, 1, dk(T.housingLo, 0.2), T.housingLo, mix(T.ink, T.sodium, 0.22)],
	[300, NIGHT_TOP, NIGHT_HZ, 1, dk(T.housingLo, 0.2), T.housingLo, mix(T.ink, T.sodium, 0.22)],
	[370, mix(T.housing, T.smog, 0.3), mix(T.sodium, T.housing, 0.45), 0.5, T.housingLo, T.housing, mix(T.sodium, T.housing, 0.5)],
	[450, mix(T.smog, T.housing, 0.25), mix(T.smog, T.paper, 0.32), 0.1, dk(T.smog, 0.55), dk(T.smog, 0.25), mix(T.smog, T.paper, 0.3)],
	[540, DAY_TOP, DAY_HZ, 0, dk(T.smog, 0.5), dk(T.smog, 0.18), mix(T.smog, T.paper, 0.35)],
	[1020, DAY_TOP, DAY_HZ, 0, dk(T.smog, 0.5), dk(T.smog, 0.18), mix(T.smog, T.paper, 0.35)],
	[1110, DUSK_TOP, DUSK_HZ, 0.25, mix(T.housingLo, T.copper, 0.12), mix(T.housing, T.copper, 0.3), mix(T.sodium, T.paper, 0.2)],
	[1170, mix(T.ink, T.housing, 0.6), mix(T.copper, T.ink, 0.45), 0.65, dk(T.housingLo, 0.1), mix(T.housingLo, T.copper, 0.15), mix(T.sodium, T.ink, 0.45)],
	[1240, NIGHT_TOP, NIGHT_HZ, 1, dk(T.housingLo, 0.2), T.housingLo, mix(T.ink, T.sodium, 0.22)],
	[1440, NIGHT_TOP, NIGHT_HZ, 1, dk(T.housingLo, 0.2), T.housingLo, mix(T.ink, T.sodium, 0.22)],
];

export const skyColors = (minuteOfDay: number): SkyColors => {
	const m = ((minuteOfDay % 1440) + 1440) % 1440;
	for (let i = 1; i < SKY_KEYS.length; i++) {
		const b = SKY_KEYS[i];
		if (m <= b[0]) {
			const a = SKY_KEYS[i - 1];
			const t = (m - a[0]) / (b[0] - a[0] || 1);
			return {
				top: lerpColor(a[1], b[1], t),
				horizon: lerpColor(a[2], b[2], t),
				night: lerp(a[3], b[3], t),
				city: lerpColor(a[4], b[4], t),
				cityFar: lerpColor(a[5], b[5], t),
				haze: lerpColor(a[6], b[6], t),
			};
		}
	}
	const k = SKY_KEYS[0];
	return { top: k[1], horizon: k[2], night: k[3], city: k[4], cityFar: k[5], haze: k[6] };
};
