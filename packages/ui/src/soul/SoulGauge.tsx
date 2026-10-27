import type { SimView } from "@aitower/sim";
import { TREE_COLOR, treeBars } from "./soul";
import "./soul.css";

/** Top strip: the three Singularity bars. A click opens the Trees panel. */
export function SoulGauge({ view, onOpen }: { view: Pick<SimView, "soul">; onOpen: () => void }) {
	if (!view.soul) return null;
	const bars = treeBars(view.soul);
	return (
		<button type="button" className="ui-chip soul-gauge" data-help="singularity" onClick={onOpen} title="Singularity points, one bar per tree. Click for the Trees panel.">
			{bars.map((b) => (
				<span key={b.tree} className={`soul-bar is-${b.state}`} title={b.title} style={{ ["--tree" as string]: TREE_COLOR[b.tree] }} data-tree={b.tree}>
					<span className="soul-bar-label">{b.label}</span>
					<span className="soul-bar-track">
						<i style={{ width: `${Math.round(b.frac * 100)}%` }} />
					</span>
					<span className="soul-bar-pct">{b.state === "closed" ? "CLOSED" : `${Math.floor(b.frac * 100)}%`}</span>
				</span>
			))}
		</button>
	);
}
