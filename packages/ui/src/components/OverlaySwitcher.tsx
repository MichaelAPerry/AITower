import type { OverlayMode } from "@aitower/shared";
import { Toggle } from "./common";
import type { PanelProps } from "./context";

const MODES: { id: OverlayMode; label: string; key: string }[] = [
	{ id: "normal", label: "Normal", key: "N" },
	{ id: "heat", label: "Heat", key: "H" },
	{ id: "power", label: "Power", key: "P" },
	{ id: "coolant", label: "Coolant", key: "C" },
];

/** STYLE.md §2 heat ramp: [°C, colour token]. */
const HEAT_RAMP: [number, string][] = [
	[18, "var(--heat-18)"],
	[24, "var(--heat-24)"],
	[30, "var(--heat-30)"],
	[36, "var(--heat-36)"],
	[42, "var(--heat-42)"],
	[50, "var(--heat-50)"],
];

function Legend({ mode }: { mode: OverlayMode }) {
	if (mode === "heat") {
		const lo = HEAT_RAMP[0][0];
		const hi = HEAT_RAMP[HEAT_RAMP.length - 1][0];
		const pct = (c: number): number => ((c - lo) / (hi - lo)) * 100;
		const grad = `linear-gradient(90deg, ${HEAT_RAMP.map(([c, col]) => `${col} ${pct(c).toFixed(1)}%`).join(", ")})`;
		return (
			<div className="ui-legend ui-crt crt-amber" title="Heat overlay: air temperature per cell">
				<div className="ui-legend-bar" style={{ background: grad }} />
				<div className="ui-legend-ticks">
					{HEAT_RAMP.map(([c], i) => (
						<span key={c} style={{ left: `${pct(c)}%` }}>
							{i === 0 ? "≤" : i === HEAT_RAMP.length - 1 ? "≥" : ""}
							{c}°
						</span>
					))}
				</div>
			</div>
		);
	}
	if (mode === "power")
		return (
			<div className="ui-legend ui-crt crt-amber">
				<div className="ui-legend-bar sat" />
				<div className="ui-legend-ticks">
					<span style={{ left: 0 }}>0%</span>
					<span style={{ left: "50%" }}>supplied</span>
					<span style={{ left: "100%" }}>100%</span>
				</div>
			</div>
		);
	if (mode === "coolant")
		return (
			<div className="ui-legend ui-crt crt-amber">
				<div className="ui-legend-bar load" />
				<div className="ui-legend-ticks">
					<span style={{ left: 0 }}>0%</span>
					<span style={{ left: "80%" }}>80%</span>
					<span style={{ left: "100%" }}>≥100</span>
				</div>
			</div>
		);
	return null;
}

export function OverlaySwitcher({ store, state }: PanelProps) {
	return (
		<div className="ui-overlay ui-panel">
			<span className="ui-dymo ui-overlay-title">OVERLAY</span>
			<div className="ui-seg" role="radiogroup" aria-label="Overlay">
				{MODES.map((m) => (
					<Toggle
						key={m.id}
						role="radio"
						on={state.overlay === m.id}
						onClick={() => store.setOverlay(m.id)}
						lamp={m.id === "normal" ? "green" : "amber"}
						className={`ov-${m.id}`}
						title={`${m.label} overlay (${m.key})`}
						label={
							<>
								<b>{m.key}</b>
								{m.label}
							</>
						}
					/>
				))}
			</div>
			<Legend mode={state.overlay} />
		</div>
	);
}
