import { useId } from "react";

export interface SparklineProps {
	values: number[];
	width?: number;
	height?: number;
	color: string;
	/** Optional fixed y-range; defaults to data min/max with padding. */
	min?: number;
	max?: number;
	/** Optional horizontal reference line (e.g. throttle temp). */
	refLine?: number;
}

/** Hand-rolled SVG sparkline: area + line + last-point dot. */
export function Sparkline({ values, width = 200, height = 48, color, min, max, refLine }: SparklineProps) {
	const id = useId();
	if (values.length < 2) return <svg width={width} height={height} className="ui-spark" aria-hidden="true" />;
	let lo = min ?? Math.min(...values);
	let hi = max ?? Math.max(...values);
	if (refLine !== undefined && min === undefined) lo = Math.min(lo, refLine);
	if (refLine !== undefined && max === undefined) hi = Math.max(hi, refLine);
	if (hi - lo < 1e-9) {
		hi += 1;
		lo -= 1;
	}
	const pad = 3;
	const x = (i: number): number => pad + (i / (values.length - 1)) * (width - pad * 2);
	const y = (v: number): number => pad + (1 - (v - lo) / (hi - lo)) * (height - pad * 2);
	let line = "";
	for (let i = 0; i < values.length; i++) line += `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(values[i]).toFixed(1)}`;
	const area = `${line}L${x(values.length - 1).toFixed(1)} ${height}L${x(0).toFixed(1)} ${height}Z`;
	const last = values[values.length - 1];
	return (
		<svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="ui-spark" aria-hidden="true">
			<defs>
				<linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0" stopColor={color} stopOpacity="0.35" />
					<stop offset="1" stopColor={color} stopOpacity="0" />
				</linearGradient>
			</defs>
			{refLine !== undefined && <line x1="0" x2={width} y1={y(refLine)} y2={y(refLine)} stroke="var(--error)" strokeDasharray="3 3" strokeWidth="1" opacity="0.6" vectorEffect="non-scaling-stroke" />}
			<path d={area} fill={`url(#${id})`} />
			<path d={line} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
			<circle cx={x(values.length - 1)} cy={y(last)} r="2.5" fill={color} />
		</svg>
	);
}

/** Downsample to at most n points (keeps the last sample). */
export function downsample(values: number[], n: number): number[] {
	if (values.length <= n) return values;
	const out: number[] = [];
	const step = (values.length - 1) / (n - 1);
	for (let i = 0; i < n; i++) out.push(values[Math.round(i * step)]);
	return out;
}
