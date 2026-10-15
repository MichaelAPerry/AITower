/**
 * Cassette-futurism palette (docs/STYLE.md §2). Every colour the renderer draws
 * is either a token below or a shade derived from one (mixed toward `ink` for
 * shadows and toward `paper` for warm highlights), so the whole world stays in
 * one tobacco-stained key. Facility body / accent colours come from content.
 */

/** Exact STYLE.md tokens. */
export const T = {
	ink: 0x0d0b08,
	housing: 0x2a261d,
	housingHi: 0x3b3528,
	housingLo: 0x17140f,
	putty: 0xc9bc9c,
	beige: 0xa8987a,
	olive: 0x5d6243,
	wall: 0x3d4a3f,
	brass: 0xc8a248,
	brassDk: 0x7d6227,
	copper: 0xc06a3b,
	verdigris: 0x4f9a85,
	steel: 0x6f7473,
	paper: 0xe8dfc6,
	amber: 0xffb000,
	amberDim: 0x7a5400,
	green: 0x33ff66,
	greenDim: 0x14662a,
	red: 0xff3b2f,
	sodium: 0xff8a3d,
	smog: 0x4a5a55,
} as const;

/** STYLE.md heat ramp stops (overlay): ≤18 → 24 → 30 → 36 → 42 → ≥50 °C. */
export const HEAT_RAMP = [0x1b3a5c, 0x3f7f6a, 0xffb000, 0xff8a3d, 0xff3b2f, 0xfff2c4] as const;

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
export const CLOTH = { black: mix(T.ink, T.housing, 0.7), ochre: mix(dk(T.amber, 0.45), T.brassDk, 0.4), ochreDk: mix(dk(T.amber, 0.62), T.housing, 0.3) } as const;

/** Wooden crate (stamped "FORM 27B/6"). */
export const CRATE = { hi: lt(T.beige, 0.25), mid: mix(T.beige, T.brassDk, 0.55), lo: dk(T.brassDk, 0.25), stamp: dk(T.red, 0.35) } as const;
