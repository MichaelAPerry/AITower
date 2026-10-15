import { fmtPue } from "../format";

const MIN = 1;
const MAX = 2;
const R = 26;
const CX = 32;
const CY = 31;

/** Point on the gauge arc for PUE value v (1.0 = left, 2.0 = right). */
function pt(v: number, r = R): [number, number] {
	const t = Math.min(1, Math.max(0, (v - MIN) / (MAX - MIN)));
	const a = Math.PI * (1 - t);
	return [CX + r * Math.cos(a), CY - r * Math.sin(a)];
}

function arc(v0: number, v1: number): string {
	const [x0, y0] = pt(v0);
	const [x1, y1] = pt(v1);
	return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/** Green → amber → red band colour for a PUE value. */
export function pueColor(v: number): string {
	if (v <= 1.25) return "var(--good)";
	if (v <= 1.5) return "var(--lime)";
	if (v <= 1.75) return "var(--warn)";
	return "var(--error)";
}

const BANDS: [number, number, string][] = [
	[1, 1.25, "var(--good)"],
	[1.25, 1.5, "var(--lime)"],
	[1.5, 1.75, "var(--warn)"],
	[1.75, 2, "var(--error)"],
];

/** Semicircle PUE gauge: 1.0 green → 2.0 red, needle + numeric readout. */
export function PueGauge({ pue }: { pue: number }) {
	const [nx, ny] = pt(Number.isFinite(pue) ? pue : MIN, R - 7);
	return (
		<div className="ui-pue" title="Power Usage Effectiveness (rolling 24h): total facility power ÷ IT power. 1.0 is perfect.">
			<svg width="64" height="36" viewBox="0 0 64 36" aria-hidden="true">
				{BANDS.map(([a, b, c]) => (
					<path key={a} d={arc(a + 0.008, b - 0.008)} stroke={c} strokeWidth="5" fill="none" opacity="0.85" />
				))}
				<line x1={CX} y1={CY} x2={nx} y2={ny} stroke="var(--text)" strokeWidth="2" strokeLinecap="round" />
				<circle cx={CX} cy={CY} r="3" fill="var(--text)" />
			</svg>
			<div className="ui-pue-read">
				<span className="ui-label">PUE</span>
				<span className="ui-big" style={{ color: pueColor(pue) }}>
					{fmtPue(pue)}
				</span>
			</div>
		</div>
	);
}
