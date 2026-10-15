/** Pure colour helpers (numbers are 0xRRGGBB). */

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

/** Air temperature ramp: ≤18 blue → 27 green/yellow → 35 red → 45+ white-hot. */
export const HEAT_STOPS = [
	[18, 0x2f6bff],
	[22, 0x22b8c8],
	[27, 0xb8e04a],
	[31, 0xffb22e],
	[35, 0xff3a1f],
	[40, 0xff8a6a],
	[45, 0xffffff],
] as const;

export const heatColor = (tempC: number): number => ramp(HEAT_STOPS, tempC);

/** Overlay alpha for a heat cell: cool air faint, hot air stronger. */
export const heatAlpha = (tempC: number): number => 0.28 + 0.32 * clamp01((tempC - 18) / 27);

/** Rack die temperature ramp (°C), aligned with typical ok/throttle/trip limits. */
export const RACK_TEMP_STOPS = [
	[40, 0x2f6bff],
	[60, 0x22b8c8],
	[75, 0xb8e04a],
	[85, 0xffb22e],
	[92, 0xff3a1f],
	[100, 0xffffff],
] as const;

export const rackTempColor = (tempC: number): number => ramp(RACK_TEMP_STOPS, tempC);

/** Satisfaction / health: 0 red → 0.5 amber → 1 green. */
export const satisfactionColor = (s: number): number =>
	ramp(
		[
			[0, 0xff3030],
			[0.5, 0xffb020],
			[1, 0x40e070],
		],
		s,
	);

/** Load ratio: 0 green → 0.8 amber → ≥1 red. */
export const loadColor = (r: number): number =>
	ramp(
		[
			[0, 0x40e070],
			[0.8, 0xffb020],
			[1, 0xff3030],
		],
		r,
	);

const NET_PALETTE = [0xffd23f, 0x3fd2ff, 0xff6fd8, 0x7dff6f, 0xff8f3f, 0xb48cff, 0x3fffc0, 0xff5f5f];

/** Stable distinct colour per network id. */
export const netColor = (id: number): number => NET_PALETTE[((id % NET_PALETTE.length) + NET_PALETTE.length) % NET_PALETTE.length];

// ─── Sky ────────────────────────────────────────────────────────────────

export interface SkyColors {
	top: number;
	horizon: number;
	/** 0 (day) .. 1 (full night) — drives stars and window glow. */
	night: number;
	/** City silhouette colour. */
	city: number;
}

/** Keyframes: [minuteOfDay, top, horizon, night, city]. */
const SKY_KEYS: readonly (readonly [number, number, number, number, number])[] = [
	[0, 0x070b1e, 0x16204a, 1, 0x0c1024],
	[300, 0x070b1e, 0x16204a, 1, 0x0c1024],
	[360, 0x2b2f6a, 0xe58a6a, 0.5, 0x1d1a35],
	[420, 0x3c78c8, 0xf3c28e, 0.1, 0x2b3550],
	[480, 0x3f8fdc, 0xa9d6f2, 0, 0x3a4d68],
	[1020, 0x3f8fdc, 0xa9d6f2, 0, 0x3a4d68],
	[1110, 0x4a3c8a, 0xf08a52, 0.2, 0x2a2440],
	[1170, 0x1e1f52, 0x8a4a6a, 0.6, 0x15142c],
	[1230, 0x070b1e, 0x16204a, 1, 0x0c1024],
	[1440, 0x070b1e, 0x16204a, 1, 0x0c1024],
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
			};
		}
	}
	const k = SKY_KEYS[0];
	return { top: k[1], horizon: k[2], night: k[3], city: k[4] };
};
