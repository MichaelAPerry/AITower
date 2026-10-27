import type { FacilityDef } from "@aitower/content";
import { TREE_COLOR } from "./soul";

const LINE_LABEL = { synthetic: "SYNTHETIC RUNG", biotech: "BIO RUNG", greentech: "GREEN RUNG" } as const;

/**
 * On a build card: which tree a rack belongs to and its rung. The seal numbers of an item stay hidden (docs/REFRAME.md): only the
 * total is shown, in the Trees panel.
 */
export function SealNotes({ def }: { def: FacilityDef | undefined }) {
	if (!def?.line || def.line === "shared" || def.rung === undefined) return null;
	return (
		<div className="soul-notes">
			<span className="soul-line" style={{ color: TREE_COLOR[def.line] }}>
				{LINE_LABEL[def.line]} {def.rung}
			</span>
		</div>
	);
}
