import type { HorrorIntensity } from "@aitower/shared";
import type { SimView } from "@aitower/sim";
import { Meter } from "../components/common";
import { fmtPct } from "../format";
import { bioWords, growthTitle, showGrowthGauge } from "./bio";

/**
 * Top-bar "ASSET GROWTH INDEX" (plain "CONTAMINATION" at horror off): a small CRT with the corruption as a percentage
 * and a meter. Appears once corruption is above zero or from Clearance 3 on.
 */
export function GrowthIndex({ view, horror }: { view: Pick<SimView, "corruption" | "contaminatedShare" | "tier"> & { path?: SimView["path"] }; horror: HorrorIntensity }) {
	if (!showGrowthGauge(view)) return null;
	const c = view.corruption ?? 0;
	const tone = c >= 0.75 ? "error" : c >= 0.4 ? "warn" : "cyan";
	return (
		<div className={`ui-crt crt-${c >= 0.75 ? "red" : "amber"} ui-growth`} title={growthTitle(view, horror)} role="status">
			<span className="ui-label">{bioWords(horror).gauge}</span>
			<span className="ui-big">{fmtPct(c, 0)}</span>
			<Meter value={c} tone={tone} height={5} />
		</div>
	);
}
