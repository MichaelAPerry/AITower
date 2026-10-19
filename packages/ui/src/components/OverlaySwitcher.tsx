import type { HorrorIntensity, OverlayMode } from "@aitower/shared";
import { useState } from "react";
import { bioWords } from "../bio/bio";
import { heatRamp } from "../settings";
import { Icon, Lamp } from "./common";
import type { PanelProps } from "./context";

const COLLAPSED_KEY = "aitower.overlay.collapsed";
const readCollapsed = (): boolean => {
	try {
		return localStorage.getItem(COLLAPSED_KEY) === "1";
	} catch {
		return false;
	}
};
const writeCollapsed = (v: boolean): void => {
	try {
		localStorage.setItem(COLLAPSED_KEY, v ? "1" : "0");
	} catch {
		/* best effort */
	}
};

export const MODES: { id: OverlayMode; label: string; key: string }[] = [
	{ id: "normal", label: "Normal", key: "N" },
	{ id: "heat", label: "Heat", key: "H" },
	{ id: "power", label: "Power", key: "P" },
	{ id: "coolant", label: "Coolant", key: "C" },
	{ id: "nutrient", label: "Nutrient", key: "U" },
	{ id: "contamination", label: "Growth", key: "G" },
];

/** Button label and tooltip of an overlay: the contamination overlay is "Growth" (Ministry wording) unless horror is off. */
export function overlayLabel(m: { id: OverlayMode; label: string; key: string }, horror: HorrorIntensity): { label: string; title: string } {
	if (m.id === "contamination") {
		const w = bioWords(horror);
		return { label: w.overlayButton, title: `${horror === "off" ? "Contamination" : "Asset growth"} overlay (${m.key})` };
	}
	return { label: m.label, title: `${m.label} overlay (${m.key})` };
}

function Legend({ mode, colorBlind, horror }: { mode: OverlayMode; colorBlind: boolean; horror: HorrorIntensity }) {
	if (mode === "heat") {
		const ramp = heatRamp(colorBlind);
		const lo = ramp[0][0];
		const hi = ramp[ramp.length - 1][0];
		const pct = (c: number): number => ((c - lo) / (hi - lo)) * 100;
		const grad = `linear-gradient(90deg, ${ramp.map(([c, col]) => `${col} ${pct(c).toFixed(1)}%`).join(", ")})`;
		return (
			<div className="ui-legend ui-crt crt-amber" title="Heat overlay: air temperature per cell">
				<div className="ui-legend-bar" style={{ background: grad }} />
				<div className="ui-legend-ticks">
					{ramp.map(([c], i) => (
						<span key={c} style={{ left: `${pct(c)}%` }}>
							{i === 0 ? "≤" : i === ramp.length - 1 ? "≥" : ""}
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
	if (mode === "nutrient")
		return (
			<div className="ui-legend ui-crt crt-amber" title="Nutrient overlay: lines coloured by how much of their demand the plants supply">
				<div className="ui-legend-bar nutrient" />
				<div className="ui-legend-ticks">
					<span style={{ left: 0 }}>0%</span>
					<span style={{ left: "50%" }}>supplied</span>
					<span style={{ left: "100%" }}>100%</span>
				</div>
			</div>
		);
	if (mode === "contamination")
		return (
			<div className="ui-legend ui-crt crt-amber" title={bioWords(horror).overlayLegend}>
				<div className="ui-legend-bar contam" />
				<div className="ui-legend-ticks">
					<span style={{ left: 0 }}>0</span>
					<span style={{ left: "50%" }}>0.5</span>
					<span style={{ left: "100%" }}>1</span>
				</div>
			</div>
		);
	return null;
}

export function OverlaySwitcher({ store, state, embedded = false }: PanelProps & { embedded?: boolean }) {
	const [collapsed, setCollapsed] = useState(readCollapsed);
	const toggle = (): void => {
		writeCollapsed(!collapsed);
		setCollapsed(!collapsed);
	};
	const horror = state.settings.horrorIntensity;
	const cur = MODES.find((m) => m.id === state.overlay) ?? MODES[0];
	return (
		<div className={`ui-overlay ${embedded ? "is-embedded" : `ui-panel ${collapsed ? "is-collapsed" : ""}`}`}>
			{!embedded && (
			<button
				type="button"
				className="ui-overlay-fold"
				onClick={toggle}
				aria-expanded={!collapsed}
				title={collapsed ? "Show the overlay switcher" : "Fold the overlay switcher away"}
			>
				<Icon name={collapsed ? "chevDown" : "chevUp"} size={11} />
				<span className="ui-dymo ui-overlay-title">OVERLAY</span>
				{collapsed && (
					<span className="ui-overlay-cur">
						<Lamp on={state.overlay !== "normal"} tone="amber" plain />
						{overlayLabel(cur, horror).label}
					</span>
				)}
			</button>
			)}
			{(embedded || !collapsed) && (
				<div className="ui-seg" role="radiogroup" aria-label="Overlay">
					{MODES.map((m) => (
						// biome-ignore lint/a11y/useSemanticElements: styled button group acts as a radio group; native radio inputs would change the markup and CSS
						<button
							key={m.id}
							type="button"
							data-tut={`overlay-${m.id}`}
							role="radio"
							aria-checked={state.overlay === m.id}
							className={`ui-btn ui-ov ov-${m.id} ${state.overlay === m.id ? "is-on" : ""}`}
							onClick={() => store.setOverlay(m.id)}
							title={overlayLabel(m, horror).title}
						>
							<b>{m.key}</b>
							{overlayLabel(m, horror).label}
						</button>
					))}
				</div>
			)}
			{state.overlay !== "normal" && (embedded || !collapsed) && <Legend mode={state.overlay} colorBlind={state.settings.colorBlind} horror={horror} />}
		</div>
	);
}
