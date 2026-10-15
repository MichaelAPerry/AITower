import type { ReactNode } from "react";
import { fmtPue } from "../format";
import { Dial, type DialNeedle, type DialZone } from "./Dial";

const MIN = 1;
const MAX = 2.5;

/** Phosphor colour for a PUE value: green → amber → red. */
export function pueColor(v: number): string {
	if (v <= 1.35) return "var(--green)";
	if (v <= 1.75) return "var(--amber)";
	return "var(--red)";
}

const ZONES: DialZone[] = [
	{ from: 1, to: 1.35, color: "var(--green-dim)" },
	{ from: 1.35, to: 1.75, color: "var(--amber)" },
	{ from: 1.75, to: 2.5, color: "var(--red)" },
];

/** A needle gauge with a Dymo label and a CRT readout beside it. */
export function Gauge({
	label,
	min,
	max,
	needles,
	zones,
	majors,
	minors,
	face,
	ends,
	title,
	children,
	sub,
	tone = "amber",
}: {
	label: string;
	min: number;
	max: number;
	needles: DialNeedle[];
	zones?: DialZone[];
	majors?: number;
	minors?: number;
	face?: string;
	ends?: [string, string];
	title: string;
	children: ReactNode;
	sub?: ReactNode;
	tone?: "amber" | "green" | "red";
}) {
	return (
		<div className="ui-gauge" title={title}>
			<Dial min={min} max={max} needles={needles} zones={zones} majors={majors} minors={minors} face={face} ends={ends} title={title} />
			<div className="ui-gauge-read">
				<span className="ui-dymo">{label}</span>
				<div className={`ui-crt crt-${tone} ui-gauge-crt`}>
					<span className="ui-big">{children}</span>
					{sub !== undefined && <span className="ui-gauge-sub">{sub}</span>}
				</div>
			</div>
		</div>
	);
}

/** PUE needle gauge, 1.0 (perfect) to 2.5, with a CRT readout. */
export function PueGauge({ pue }: { pue: number }) {
	const tone = pue <= 1.35 ? "green" : pue <= 1.75 ? "amber" : "red";
	return (
		<Gauge
			label="PUE"
			min={MIN}
			max={MAX}
			majors={6}
			minors={2}
			zones={ZONES}
			face="PUE"
			ends={["1", "2.5"]}
			needles={[{ value: Number.isFinite(pue) ? pue : MIN }]}
			title="Power Usage Effectiveness (rolling 24h): total facility power ÷ IT power. 1.0 is perfect."
			tone={tone}
		>
			{fmtPue(pue)}
		</Gauge>
	);
}
