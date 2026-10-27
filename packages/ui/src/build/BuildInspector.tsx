import { fmtMoney } from "../format";
import { Icon } from "../components/common";
import { FlavorLine } from "../components/FlavorLine";
import type { PanelProps } from "../components/context";
import { Jargon, TermScope } from "../glossary/Term";
import { OutputBar, TierMark } from "./TierMark";
import { findItem, itemForTool } from "./catalog";
import { upgradeCost, upgradesTo } from "@aitower/content";
import { CATEGORY_LABEL, lockReason, type Stat } from "./plain";
import { SealNotes } from "../soul/SealNotes";

function StatRow({ s }: { s: Stat }) {
	return (
		<div className="bld-stat">
			<span className="bld-stat-ic" aria-hidden="true">
				{s.icon === "$" ? "$" : <Icon name={s.icon} size={12} />}
			</span>
			<span className="bld-stat-text">
				<span className="bld-stat-label">
					<Jargon text={s.label} />
				</span>
				<span className="bld-stat-sub">
					<Jargon text={s.sub} />
				</span>
			</span>
			<span className={`bld-stat-val ${s.tone ? `is-${s.tone}` : ""}`}>
				<Jargon text={s.value} />
			</span>
		</div>
	);
}

/**
 * The persistent Inspector beside the catalog. Hovering a card previews it; the picked item shows when nothing is hovered
 * and stays while the player places it. Replaces the old floating spec card.
 */
export function BuildInspector({ content, state, ui, setUi }: PanelProps) {
	const { view, tool } = state;
	const picked = itemForTool(tool, content);
	const hovered = findItem(ui.buildHover, content);
	const item = hovered ?? picked;
	if (!item) return null; // nothing hovered or picked: keep the screen clear
	const isPicked = !!picked && picked.key === item.key;
	const missing = item.def ? item.cost - view.cash : 0;
	const reason = item.def ? lockReason(item.def, view, content) : null;
	const lock = reason?.level !== undefined ? `Opens at Level ${reason.level}` : null;
	const from = item.def?.upgradesFrom ? content.facilities[item.def.upgradesFrom] : undefined;
	const next = item.def ? upgradesTo(content, item.def.id) : [];
	const openEntry = (): void => setUi({ drawer: "handbook", encyId: item.entry, paletteOpen: false, buildHover: null });
	return (
		<TermScope key={item.key}>
		<aside className={`bld-insp ui-panel ${item.tier ? `${item.tier.className} is-tier` : ""}`} aria-label="Build inspector" data-help="build-inspector" data-tut="build-inspector">
			<div className="bld-kicker">
				{isPicked ? "Picked" : "Preview"} · {CATEGORY_LABEL[item.category]}
			</div>
			{item.tier && <TierMark t={item.tier} />}
			<h2 className="bld-h">{item.name}</h2>
			{lock && <p className="bld-lock-why">{lock}</p>}
			{item.tier?.note && <p className="bld-note">{item.tier.note}. The next rack down the line costs more per PFLOPS.</p>}
			{item.tier?.output && <OutputBar t={item.tier} labelled />}
			<p className="bld-blurb">
				<Jargon text={item.blurb} />
			</p>
			{from && item.def && (
				<p className="bld-upgrade">
					Upgrades from {from.name}: place it on top of one and it swaps in place for {fmtMoney(upgradeCost(from, item.def))} (the new price less half of the old).
				</p>
			)}
			{next.length > 0 && <p className="bld-upgrade">Next down this line: {next.map((d) => d.name).join(", ")}.</p>}
			<SealNotes def={item.def} />
			<div className="bld-stats">
				{item.stats.map((s) => (
					<StatRow key={`${s.label}${s.sub}`} s={s} />
				))}
			</div>
			{missing > 0 && <p className="bld-warn">You need {fmtMoney(missing)} more cash to build this.</p>}
			{item.entry && (
				<div className="bld-links">
					<button type="button" className="bld-q" onClick={openEntry}>
						? What is {item.name.toLowerCase().startsWith("a") ? "an" : "a"} {item.name}
					</button>
				</div>
			)}
			<div className="bld-act">
				<p className="bld-placing">
					{isPicked
						? tool.kind === "demolish"
							? "Click or drag over the tower to remove things. Esc to stop."
							: "Click the tower to put it down. Keep clicking to place more. Esc to stop."
						: "Click the card to pick it."}
				</p>
			</div>
			<FlavorLine flavor={item.def?.flavor} />
		</aside>
		</TermScope>
	);
}
