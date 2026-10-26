import type { AdvisorId } from "@aitower/content";
import { type Expression, FULL, PORTRAITS } from "../art";
import { ADVISORS } from "./advisors";

/**
 * An advisor's face from the PC-98 portrait sheets (docs/ART_BRIEFS.md), in a square frame with her colour as the rule.
 * `mood` picks the expression; `talking` adds the speaking pulse.
 */
export function Portrait({ id, size = 44, talking = false, mood = "neutral" }: { id: AdvisorId; size?: number; talking?: boolean; mood?: Expression }) {
	const a = ADVISORS[id];
	return (
		<span className={`adv-portrait ${talking ? "is-talking" : ""}`} role="img" aria-label={a.name} style={{ ["--adv" as string]: a.color, width: size, height: size }} data-mood={mood}>
			<img src={PORTRAITS[id][mood]} alt="" draggable={false} />
		</span>
	);
}

/** The full-length portrait for dossiers and endings. */
export function FullPortrait({ id, className }: { id: AdvisorId; className?: string }) {
	return <img className={`adv-full ${className ?? ""}`} src={FULL[id]} alt={ADVISORS[id].name} draggable={false} />;
}
