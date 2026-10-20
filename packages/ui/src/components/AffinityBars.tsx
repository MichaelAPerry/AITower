import type { ContentDB } from "@aitower/content";
import type { SimView } from "@aitower/sim";
import { PATH_COLOR, PATH_ORDER, sharePct } from "../ascension/ascension";

/** Three small bars: how far each ascension path leads, from what the player built, researched and chose. */
export function AffinityBars({ affinity, content, leading }: { affinity: SimView["affinity"]; content: ContentDB; leading?: string | null }) {
	const name = (id: string): string => content.paths?.find((p) => p.id === id)?.name ?? id;
	return (
		<ul className="ui-affinity" aria-label="Path affinity">
			{PATH_ORDER.map((id) => (
				<li key={id} className={leading === id ? "is-lead" : ""} data-path={id}>
					<span className="ui-affinity-name">{name(id)}</span>
					<span className="ui-affinity-bar" role="img" aria-label={`${name(id)} affinity ${sharePct(affinity[id])}`}>
						<i style={{ width: sharePct(affinity[id]), background: PATH_COLOR[id] }} />
					</span>
					<span className="ui-affinity-pct">{sharePct(affinity[id])}</span>
				</li>
			))}
		</ul>
	);
}
