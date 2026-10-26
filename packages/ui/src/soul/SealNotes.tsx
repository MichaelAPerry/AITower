import type { FacilityDef } from "@aitower/content";
import type { SimView } from "@aitower/sim";
import { ADVISORS } from "../advisors/advisors";
import { Portrait } from "../advisors/Portrait";
import { sealNotes, TREE_COLOR, TREE_LONG } from "./soul";

const LINE_LABEL = { synthetic: "SYNTHETIC LINE", biotech: "BIO LINE", greentech: "GREEN LINE" } as const;

/**
 * On a build card: the item's tree line, and what the advisors say about its secret numbers. The champion speaks only once
 * she trusts you (`bondReveal`); until then Luci fills the silence, cheerfully and wrongly.
 */
export function SealNotes({ def, view }: { def: FacilityDef | undefined; view: Pick<SimView, "soul"> }) {
	const soul = view.soul;
	if (!def || !soul) return null;
	const notes = sealNotes(soul, def.seal);
	const told = new Set(notes.map((n) => n.tree));
	const hidden = (["greentech", "biotech"] as const).some((t) => (def.seal?.[t] ?? 0) >= 5 && !told.has(t));
	const line = def.line && def.line !== "shared" ? def.line : null;
	if (!line && notes.length === 0 && !hidden) return null;
	return (
		<div className="soul-notes">
			{line && (
				<span className="soul-line" style={{ color: TREE_COLOR[line] }}>
					{LINE_LABEL[line]}
				</span>
			)}
			{notes.map((n) => (
				<p key={n.tree} className="soul-note" style={{ ["--adv" as string]: ADVISORS[n.advisor].color }}>
					<Portrait id={n.advisor} size={22} mood={n.value > 0 ? "displeased" : "pleased"} />
					<span>
						<b>{ADVISORS[n.advisor].first}:</b>{" "}
						{n.value > 0 ? `“That scars ${TREE_LONG[n.tree]} by ${n.value}. It doesn't wash out.”` : `“That heals ${TREE_LONG[n.tree]} a little every day it runs.”`}
					</span>
				</p>
			))}
			{hidden && (
				<p className="soul-note" style={{ ["--adv" as string]: ADVISORS.luci.color }}>
					<Portrait id="luci" size={22} mood="pleased" />
					<span>
						<b>Luci:</b> “Good value. Nothing to worry about.”
					</span>
				</p>
			)}
		</div>
	);
}
