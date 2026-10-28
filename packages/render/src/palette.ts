/**
 * Palette. Every colour the renderer draws is either a token below or a shade derived from one (mixed toward `ink` for
 * shadows and toward `paper` for highlights). Facility body / accent colours come from content and are re-skinned
 * to graphite glass by `skinColor` (color.ts).
 */

/**
 * PC-98 tokens (docs/SOUL.md §5): indigo glass, white rules, cyan light and sunset accents. The key names are kept from the
 * cassette palette so every draw call re-skins at once; the values are the synthetic ones:
 * ink = `--bg`, paper = `--text`, brass = `--accent` (cyan fittings and edges), copper / verdigris = coolant supply / return
 * (cyan lines), amber = power / warn, sodium = warm white, putty / beige / olive = glass cabinet shades, wall = graphite façade.
 */
export const T = {
	ink: 0x07072a,
	housing: 0x12124a,
	housingHi: 0x1c1c66,
	housingLo: 0x0b0b33,
	putty: 0x3d4290,
	beige: 0x2d3278,
	olive: 0x262a68,
	wall: 0x181c58,
	brass: 0x5ce1ff,
	brassDk: 0x2a6fa0,
	copper: 0x5ce1ff,
	verdigris: 0x3a8fc0,
	steel: 0x6b72c9,
	paper: 0xf0f0ff,
	amber: 0xffb347,
	amberDim: 0x7a4a1f,
	green: 0x6cf08f,
	greenDim: 0x1d6a40,
	red: 0xff4d5e,
	sodium: 0xffd7a8,
	smog: 0x1c1a5a,
	/** `--accent-2`: research. */
	accent2: 0xff6ad5,
	// M3 body-horror tokens (docs/review/ux-art.md): flesh (pink-beige), bile (olive), blood (deep desaturated red-brown).
	flesh: 0xb5877a,
	bile: 0x8a8a3a,
	blood: 0x6a2c22,
} as const;

/** `--tree-green` (docs/STYLE_PC98.md): the Green tree's colour. Trim and light of the Green racks and support items. */
export const TREE_GREEN = 0x9be564;

/** `--money` (docs/STYLE_SYNTHETIC.md): cash and per-hour figures, the "+$" floaters. */
export const MONEY = 0xffd75e;

/** STYLE.md heat ramp stops (overlay): ≤18 → 24 → 30 → 36 → 42 → ≥50 °C. */
export const HEAT_RAMP = [0x1b3a5c, 0x3f7f6a, 0xffb000, 0xff8a3d, 0xff3b2f, 0xfff2c4] as const;

/**
 * Colour-blind heat ramp (matplotlib "plasma", deuteranopia-safe): same six °C stops as `HEAT_RAMP`.
 * The `colorBlind` option swaps this in for the heat overlay and the rack temperature tint.
 */
export const HEAT_RAMP_CB = [0x0d0887, 0x6a00a8, 0xb12a90, 0xe16462, 0xfca636, 0xf0f921] as const;

/**
 * Colour-blind status scheme (Okabe-Ito blue / orange): replaces green/red for rack LEDs, CRT phosphor,
 * power and coolant satisfaction/load when the `colorBlind` option is on. Shapes (CRT glyphs) carry the rest.
 */
export const CB = {
	blue: 0x56b4e9,
	orange: 0xe69f00,
	vermilion: 0xff6a1a,
} as const;

const c8 = (c: number, s: number): number => (c >> s) & 0xff;

/** Linear mix of two 0xRRGGBB colours (local copy so this module has no imports). */
export const mix = (a: number, b: number, t: number): number => {
	const u = t < 0 ? 0 : t > 1 ? 1 : t;
	const m = (s: number) => Math.round(c8(a, s) + (c8(b, s) - c8(a, s)) * u);
	return (m(16) << 16) | (m(8) << 8) | m(0);
};

/** Shadow: toward ink. */
export const dk = (c: number, k: number): number => mix(c, T.ink, k);
/** Highlight: toward paper (warm, never pure white). */
export const lt = (c: number, k: number): number => mix(c, T.paper, k);

/** A 4-shade material ramp + outline (STYLE §4: ≤ 4–5 shades per material). */
export interface Mat {
	hi: number;
	mid: number;
	lo: number;
	dk: number;
	line: number;
}

export const mat = (c: number): Mat => ({
	hi: lt(c, 0.38),
	mid: c,
	lo: dk(c, 0.3),
	dk: dk(c, 0.55),
	line: dk(c, 0.82),
});

export const BRASS = mat(T.brass);
export const COPPER = mat(T.copper);
export const VERDI = mat(T.verdigris);
export const STEEL = mat(T.steel);
export const PAPER = mat(T.paper);
/** Nutrient conduit: pale green. */
export const PALE_GREEN = mix(T.green, T.paper, 0.55);
export const NUTRIENT = mat(PALE_GREEN);
export const FLESH = mat(T.flesh);
export const BILE = mat(T.bile);
export const BLOOD = mat(T.blood);

/** Phosphor colours for CRTs and lamps: [lit, dim]. */
export const PHOSPHOR = {
	green: [T.green, T.greenDim],
	amber: [T.amber, T.amberDim],
	red: [T.red, dk(T.red, 0.6)],
	dim: [T.greenDim, dk(T.greenDim, 0.5)],
} as const;

/** Glass / screen backgrounds. */
export const GLASS = dk(T.verdigris, 0.82);
export const SCREEN = mix(T.ink, T.greenDim, 0.18);

/** Cloth cable bundle (black + ochre braid). */
export const CLOTH = { black: mix(T.ink, T.housing, 0.7), ochre: T.sodium, ochreDk: mix(T.sodium, T.housing, 0.6) } as const;

/** Wooden crate (stamped "FORM 27B/6"). */
export const CRATE = { hi: lt(T.beige, 0.25), mid: mix(T.beige, T.brassDk, 0.55), lo: dk(T.brassDk, 0.25), stamp: dk(T.red, 0.35) } as const;
