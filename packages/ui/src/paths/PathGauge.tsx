import type { ContentDB } from "@aitower/content";
import type { SimView } from "@aitower/sim";
import { Meter } from "../components/common";
import { fmtPct } from "../format";
import { pathGauge } from "./paths";

/** Top-strip gauge for the chosen path (green score or refinement), styled like the growth index. Nothing on other paths. */
export function PathGauge({ view, content }: { view: Pick<SimView, "path" | "greenScore" | "refinement">; content: ContentDB }) {
	const g = pathGauge(view, content);
	if (!g) return null;
	return (
		<div className="ui-crt crt-green ui-growth ui-pathgauge" title={g.title} role="status" data-path-gauge={g.id}>
			<span className="ui-label">{g.label}</span>
			<span className="ui-big">{fmtPct(g.value, 0)}</span>
			<Meter value={g.value} tone={g.tone} height={5} />
		</div>
	);
}
