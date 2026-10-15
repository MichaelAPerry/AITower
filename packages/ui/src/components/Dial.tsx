import { useId } from "react";

export interface DialZone {
	from: number;
	to: number;
	/** A CSS colour, normally a palette token such as "var(--red)". */
	color: string;
}

export interface DialNeedle {
	value: number;
	/** "red" is the primary needle; "ink" is a secondary black pointer. */
	kind?: "red" | "ink";
}

export interface DialProps {
	min: number;
	max: number;
	needles: DialNeedle[];
	/** Rendered size in px (the drawing is 64 units square). */
	size?: number;
	/** Coloured bands printed on the dial face. */
	zones?: DialZone[];
	/** Number of major divisions (major ticks = majors + 1). */
	majors?: number;
	/** Minor ticks per major division. */
	minors?: number;
	/** Tiny typewritten legend printed on the face. */
	face?: string;
	/** Optional end-of-scale legends. */
	ends?: [string, string];
	title?: string;
}

const C = 32;
const SWEEP = 240;

/** Angle in degrees (0 = straight up, clockwise positive) for a value. Pegs slightly past each end. */
export function dialAngle(v: number, min: number, max: number): number {
	const t0 = (v - min) / (max - min || 1);
	const t = Number.isFinite(t0) ? Math.min(1.035, Math.max(-0.035, t0)) : 0;
	return -SWEEP / 2 + SWEEP * t;
}

function polar(deg: number, r: number): [number, number] {
	const a = ((deg - 90) * Math.PI) / 180;
	return [C + r * Math.cos(a), C + r * Math.sin(a)];
}

function arcPath(d0: number, d1: number, r: number): string {
	const [x0, y0] = polar(d0, r);
	const [x1, y1] = polar(d1, r);
	const large = d1 - d0 > 180 ? 1 : 0;
	return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/**
 * Analog panel gauge: brass bezel, cream face, black ticks, red needle.
 * Needles rotate with a CSS transition whose easing overshoots slightly (see `.ui-dial-needle`).
 */
export function Dial({ min, max, needles, size = 56, zones = [], majors = 4, minors = 4, face, ends, title }: DialProps) {
	const id = useId();
	const ticks: { a: number; major: boolean }[] = [];
	const n = majors * minors;
	for (let i = 0; i <= n; i++) ticks.push({ a: -SWEEP / 2 + (SWEEP * i) / n, major: i % minors === 0 });
	const zoneAngle = (v: number): number => Math.max(-SWEEP / 2, Math.min(SWEEP / 2, dialAngle(v, min, max)));
	return (
		<svg className="ui-dial" width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title}>
			{title && <title>{title}</title>}
			<defs>
				<linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="1">
					<stop offset="0" stopColor="var(--paper)" />
					<stop offset="0.25" stopColor="var(--brass)" />
					<stop offset="0.7" stopColor="var(--brass-dk)" />
					<stop offset="1" stopColor="var(--brass)" />
				</linearGradient>
				<radialGradient id={`${id}f`} cx="0.45" cy="0.4" r="0.65">
					<stop offset="0.55" stopColor="var(--paper)" />
					<stop offset="1" stopColor="var(--beige)" />
				</radialGradient>
			</defs>
			{/* bezel */}
			<circle cx={C} cy={C} r="31.5" fill="var(--ink)" />
			<circle cx={C} cy={C} r="30.5" fill={`url(#${id}b)`} />
			<circle cx={C} cy={C} r="27" fill="var(--brass-dk)" />
			{/* face */}
			<circle cx={C} cy={C} r="26.2" fill={`url(#${id}f)`} />
			{zones.map((z) => (
				<path key={`${z.from}-${z.to}`} d={arcPath(zoneAngle(z.from), zoneAngle(z.to), 21.6)} stroke={z.color} strokeWidth="3.2" fill="none" />
			))}
			{ticks.map((t) => {
				const [x0, y0] = polar(t.a, 24.6);
				const [x1, y1] = polar(t.a, t.major ? 19.4 : 22.2);
				return <line key={t.a} x1={x0} y1={y0} x2={x1} y2={y1} stroke="var(--ink)" strokeWidth={t.major ? 1.5 : 0.7} />;
			})}
			{face && (
				<text x={C} y={C + 13} className="ui-dial-face" textAnchor="middle">
					{face}
				</text>
			)}
			{ends && (
				<>
					<text x={polar(-SWEEP / 2, 15)[0] + 1} y={polar(-SWEEP / 2, 15)[1] + 1} className="ui-dial-end" textAnchor="middle">
						{ends[0]}
					</text>
					<text x={polar(SWEEP / 2, 15)[0] - 1} y={polar(SWEEP / 2, 15)[1] + 1} className="ui-dial-end" textAnchor="middle">
						{ends[1]}
					</text>
				</>
			)}
			{[...needles].reverse().map((nd, i) => (
				<g
					key={i}
					className={`ui-dial-needle n-${nd.kind ?? "red"}`}
					style={{ transform: `rotate(${dialAngle(nd.value, min, max).toFixed(2)}deg)`, transformOrigin: `${C}px ${C}px` }}
				>
					{nd.kind === "ink" ? (
						<path d={`M${C - 1.1} ${C + 3} L${C} ${C - 19} L${C + 1.1} ${C + 3} Z`} fill="var(--ink)" />
					) : (
						<path d={`M${C - 1.6} ${C + 6} L${C - 0.5} ${C - 23} L${C + 0.5} ${C - 23} L${C + 1.6} ${C + 6} Z`} fill="var(--red)" stroke="var(--ink)" strokeWidth="0.4" />
					)}
				</g>
			))}
			{/* hub + glass glint */}
			<circle cx={C} cy={C} r="3.4" fill="var(--brass)" stroke="var(--ink)" strokeWidth="0.8" />
			<circle cx={C - 0.8} cy={C - 0.8} r="1" fill="var(--paper)" opacity="0.7" />
			<path d="M12 22 A22 22 0 0 1 34 8" stroke="var(--paper)" strokeWidth="3" fill="none" opacity="0.28" strokeLinecap="round" />
		</svg>
	);
}

/** Round "nice" scale maximum (1, 2, 2.5, 5 × 10ⁿ) at or above v. */
export function niceMax(v: number): number {
	const a = Math.abs(v);
	if (!Number.isFinite(a) || a <= 0) return 1;
	const p = 10 ** Math.floor(Math.log10(a));
	for (const m of [1, 2, 2.5, 5, 10]) if (a <= m * p) return m * p;
	return 10 * p;
}
