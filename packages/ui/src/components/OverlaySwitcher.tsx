import type { OverlayMode } from "@aitower/shared";
import { Kbd } from "./common";
import type { PanelProps } from "./context";

const MODES: { id: OverlayMode; label: string; key: string }[] = [
	{ id: "normal", label: "Normal", key: "N" },
	{ id: "heat", label: "Heat", key: "H" },
	{ id: "power", label: "Power", key: "P" },
	{ id: "coolant", label: "Coolant", key: "C" },
];

function Legend({ mode, content }: { mode: OverlayMode; content: PanelProps["content"] }) {
	const t = content.balance.thermal;
	if (mode === "heat") {
		const lo = 18;
		const hi = t.tripC;
		const at = (c: number): string => `${((c - lo) / (hi - lo)) * 100}%`;
		return (
			<div className="ui-legend">
				<div className="ui-legend-bar heat" />
				<div className="ui-legend-ticks">
					<span style={{ left: 0 }}>{lo}°</span>
					<span style={{ left: at(t.okC) }}>{t.okC}°</span>
					<span style={{ left: at(t.throttleC) }}>{t.throttleC}°</span>
					<span style={{ left: "100%" }}>{hi}°C</span>
				</div>
			</div>
		);
	}
	if (mode === "power")
		return (
			<div className="ui-legend">
				<div className="ui-legend-bar sat" />
				<div className="ui-legend-ticks">
					<span style={{ left: 0 }}>0%</span>
					<span style={{ left: "50%" }}>net supplied</span>
					<span style={{ left: "100%" }}>100%</span>
				</div>
			</div>
		);
	if (mode === "coolant")
		return (
			<div className="ui-legend">
				<div className="ui-legend-bar load" />
				<div className="ui-legend-ticks">
					<span style={{ left: 0 }}>0%</span>
					<span style={{ left: "50%" }}>loop load</span>
					<span style={{ left: "100%" }}>≥100%</span>
				</div>
			</div>
		);
	return null;
}

export function OverlaySwitcher({ store, content, state }: PanelProps) {
	return (
		<div className="ui-overlay ui-panel">
			<div className="ui-seg" role="radiogroup" aria-label="Overlay">
				{MODES.map((m) => (
					<button
						key={m.id}
						type="button"
						role="radio"
						aria-checked={state.overlay === m.id}
						className={`ui-seg-btn ov-${m.id} ${state.overlay === m.id ? "is-on" : ""}`}
						onClick={() => store.setOverlay(m.id)}
					>
						{m.label} <Kbd>{m.key}</Kbd>
					</button>
				))}
			</div>
			<Legend mode={state.overlay} content={content} />
		</div>
	);
}
