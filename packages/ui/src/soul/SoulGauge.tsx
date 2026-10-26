import type { SimView } from "@aitower/sim";
import { treeBars, TREE_COLOR } from "./soul";
import "./soul.css";

/** Top strip: the three Singularity bars. A click opens the advisors' dossier. */
export function SoulGauge({ view, onOpen }: { view: Pick<SimView, "soul" | "path">; onOpen: () => void }) {
	if (!view.soul) return null;
	const bars = treeBars(view.soul, view.path);
	return (
		<button type="button" className="ui-chip soul-gauge" data-help="singularity" onClick={onOpen} title="Singularity points. Click for the advisors' dossier.">
			{bars.map((b) => (
				<span key={b.tree} className={`soul-bar is-${b.state}`} title={b.title} style={{ ["--tree" as string]: TREE_COLOR[b.tree] }} data-tree={b.tree}>
					<span className="soul-bar-label">{b.label}</span>
					<span className="soul-bar-track">
						<i style={{ width: `${Math.round(b.frac * 100)}%` }} />
					</span>
					<span className="soul-bar-pct">{b.state === "sealed" ? "SEALED" : `${Math.floor(b.frac * 100)}%`}</span>
				</span>
			))}
		</button>
	);
}
