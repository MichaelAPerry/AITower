import { type BuildCategory, type ContentDB, type FacilityDef, isRetrofitOnly } from "@aitower/content";
import type { SimCommand, SimView } from "@aitower/sim";
import { fmtMoney, fmtPflops, fmtPower } from "../format";
import { pushNotice } from "../notices";
import { techGate, techName } from "../research/tech";
import { bandText } from "../bio/bio";
import { Icon, Swatch } from "./common";
import { SheetIcon } from "./SheetIcon";
import { buildIcon } from "../build/buildIcons";
import { findItem, structure } from "../build/catalog";
import { CATEGORY_LABEL, type CatalogItem, type Tab, lockReason, lockedSummary, structureGate } from "../build/plain";
import { OutputBar, TierMark } from "../build/TierMark";
import { allowedIds } from "../lessons/lessons";
import { toolKey } from "../tools/controller";
import type { PanelProps } from "./context";

export type { Tab };

export function defSpecs(def: FacilityDef): [string, string][] {
	const s: [string, string][] = [
		["Cost", fmtMoney(def.cost)],
		["Upkeep", `${fmtMoney(def.upkeepPerDay)}/day`],
		["Width", `${def.width} tile${def.width === 1 ? "" : "s"}`],
	];
	if (def.facilityKw) s.push(["Aux draw", fmtPower(def.facilityKw)]);
	if (def.rack) {
		s.push(["IT draw", fmtPower(def.rack.powerKw)], ["Cooling", def.rack.cooling]);
		if (def.rack.pflops) s.push(["Compute", fmtPflops(def.rack.pflops)]);
		if (def.rack.storageTB) s.push(["Storage", `${def.rack.storageTB} TB`]);
		if (def.rack.liquidFraction) s.push(["To liquid", `${Math.round(def.rack.liquidFraction * 100)}%`]);
		s.push(["Fail rate", `${(def.rack.failurePerDay * 100).toFixed(1)}%/day`]);
	}
	if (def.power) {
		s.push(["Capacity", fmtPower(def.power.capacityKw)]);
		if (def.power.storageKwh) s.push(["Storage", `${def.power.storageKwh} kWh`]);
		if (def.power.startDelayTicks) s.push(["Start delay", `${def.power.startDelayTicks} min`]);
		if (def.power.costPerKwh) s.push(["Fuel", `$${def.power.costPerKwh}/kWh`]);
		if (def.power.efficiency) s.push(["Efficiency", `${Math.round(def.power.efficiency * 100)}%`]);
	}
	if (def.cooling) {
		s.push(["Capacity", fmtPower(def.cooling.capacityKw)]);
		if (def.cooling.cop) s.push(["COP @20°C", String(def.cooling.cop)]);
		if (def.cooling.radius) s.push(["Reach", `${def.cooling.radius} tiles`]);
	}
	if (def.logistics) {
		s.push(["Capacity", String(def.logistics.capacity)]);
		if (def.logistics.chargeKw) s.push(["Charge", fmtPower(def.logistics.chargeKw)]);
	}
	if (def.rack?.bio) {
		const o = def.rack.bio;
		s.push(["Tissue band", bandText(o)], ["Nutrient use", `${o.nutrientUse}/tick`]);
	}
	if (def.bio) {
		const b = def.bio;
		if (b.nutrientCapacity) s.push(["Nutrient out", `${b.nutrientCapacity}/tick`]);
		if (b.nutrientUse) s.push(["Nutrient use", `${b.nutrientUse}/tick`]);
		if (b.cleanRate) s.push(["Cleans", `${b.cleanRate}/tick, reach ${b.radius ?? 0} tiles`]);
		if (b.cullsGrowths) s.push(["Culls", "growths in reach"]);
	}
	const p = def.placement;
	if (p?.needsCoolant) s.push(["Needs", "coolant conduit"]);
	if (p?.needsNutrient) s.push(["Needs", "nutrient conduit"]);
	if (p?.minFloor !== undefined || p?.maxFloor !== undefined) s.push(["Floors", `${p?.minFloor ?? "…"} to ${p?.maxFloor ?? "…"}`]);
	return s;
}

/** The line a locked row shows (tier first, then research), or null when the row is available. */
export function lockText(def: FacilityDef, view: SimView, content: ContentDB): string | null {
	const r = lockReason(def, view, content);
	if (!r) return null;
	const gate = r.tech ? techGate(def.tech, view, content) : null;
	const parts = [gate ? gate.replace("Requires research: ", "") : null, r.level !== undefined ? `Level ${r.level}` : null].filter(Boolean);
	return parts.length ? `Locked: ${parts.join(" · ")}` : null;
}

/** Storage racks (Storage Array, Tape Library) say how much dataset the running jobs need against what the racks hold. */
export function storageNote(def: FacilityDef | undefined, view: SimView): string | null {
	if (!def?.rack || !(def.rack.storageTB > 0) || def.rack.pflops > 0) return null;
	const tb = (n: number) => `${Math.round(n).toLocaleString("en-US")} TB`;
	return `Jobs need storage: ${tb(view.storageNeedTB ?? 0)} in use of ${tb(view.storageCapacityTB ?? 0)}`;
}

/** A tab's rows: unlocked first, each group by unlock tier, then cost. */
export function paletteDefs(content: ContentDB, view: SimView, cat: BuildCategory): FacilityDef[] {
	return Object.values(content.facilities)
		.filter((d) => d.category === cat && !d.growth && !d.retired && !isRetrofitOnly(d))
		.map((d) => ({ d, locked: lockText(d, view, content) !== null }))
		.sort((a, b) => Number(a.locked) - Number(b.locked) || a.d.unlockTier - b.d.unlockTier || a.d.cost - b.d.cost || a.d.id.localeCompare(b.d.id))
		.map((x) => x.d);
}


/** The picture on a card: the owner's icon (64 px, 1:1 with the sheet cell), or the colour swatch when a facility has none. */
function FacilityThumb({ d, locked }: { d: FacilityDef; locked: boolean }) {
	const cell = buildIcon(d.id);
	return (cell && <SheetIcon cell={cell} size={64} locked={locked} className="bld-icon" />) || <Swatch color={d.color} accent={d.accent} size={34} />;
}

/** A card in the catalog grid (a plain function, not a hook user). Hover previews it in the Inspector; click picks it. */
function Card({ item, picked, poor, lock, note, onPick, onHover, plain }: { plain?: boolean; item: CatalogItem; picked: boolean; poor: boolean; lock?: string; note?: string | null; onPick: () => void; onHover: (key: string | null) => void }) {
	const d = item.def;
	return (
		<button
			key={item.key}
			type="button"
			data-tut={plain ? undefined : `card-${d ? d.id : item.key}`}
			aria-pressed={picked}
			aria-disabled={lock ? true : undefined}
			className={["bld-card", picked ? "is-on" : "", item.tier ? `${item.tier.className} is-tier` : "", poor ? "is-poor" : "", lock ? "is-locked" : "", item.danger ? "is-danger" : ""].filter(Boolean).join(" ")}
			onClick={onPick}
			onMouseEnter={() => onHover(item.key)}
			onMouseLeave={() => onHover(null)}
			onFocus={() => onHover(item.key)}
			onBlur={() => onHover(null)}
		>
			<span className="bld-thumb">{d ? <FacilityThumb d={d} locked={!!lock} /> : <Icon name={item.icon === "$" || !item.icon ? "slab" : item.icon} size={22} />}</span>
			{item.tier && !item.tier.isPath && <TierMark t={item.tier} />}
			<span className="bld-name">{item.name}</span>
			{item.tier?.output && <OutputBar t={item.tier} />}
			{item.tier?.note && <span className="bld-note">{item.tier.note}</span>}
			{note && <span className="bld-note">{note}</span>}
			{lock ? <span className="bld-lock">{lock}</span> : <span className={`bld-cost ${poor ? "is-short" : ""}`}>{item.costText}</span>}
		</button>
	);
}

/**
 * The build catalog: a grid of item cards for the category chosen on the build bar. Hovering a card fills the Inspector
 * (BuildInspector); clicking it arms the tool and the card stays selected.
 */
export function BuildPalette({ store, content, state, ui, setUi }: PanelProps) {
	const tab = ui.paletteTab as Tab;
	const { view, tool } = state;
	const active = toolKey(tool);

	const hover = (key: string | null): void => {
		if ((ui.buildHover ?? null) !== key) setUi({ buildHover: key });
	};
	const pick = (item: CatalogItem): void => {
		store.setGhost(null);
		store.setTool(active === toolKey(item.tool) ? { kind: "select" } : item.tool);
	};
	// Called as a plain function (no hooks), so tests can walk the returned element tree.
	const card = (item: CatalogItem, plain = false) =>
		Card({ plain, item, picked: active === toolKey(item.tool), poor: !!item.def && view.cash < item.cost, note: storageNote(item.def, view), onPick: () => pick(item), onHover: hover });

	let cards: CatalogItem[] = [];
	let lockedLines: string[] = [];
	if (tab === "structure" && !allowedIds(view)) {
		// Coolant and nutrient piping wait for the research that brings liquid cooling / wetware: a "Coming at" row instead of a card.
		const all = structure(content);
		cards = all.filter((i) => !structureGate(i, view, content));
		lockedLines = all
			.filter((i) => structureGate(i, view, content))
			.map((i) => `Research "${techName(content, structureGate(i, view, content) as string)}" to unlock ${i.name}`);
	}
	else if (tab !== "supplies") {
		const defs = Object.values(content.facilities)
			.filter((d) => d.category === tab && !d.growth && !d.retired && !isRetrofitOnly(d))
			.sort((a, b) => a.unlockTier - b.unlockTier || a.cost - b.cost || a.id.localeCompare(b.id));
		// A lesson shows only what it teaches: the rest is not even listed.
		const lesson = allowedIds(view);
		const shelf = (d: FacilityDef): boolean => !lesson || lesson.has(d.id);
		const open = defs.filter((d) => !lockReason(d, view, content) && shelf(d));
		cards = open.map((d) => findItem(d.id, content) as CatalogItem);
		lockedLines = lesson ? [] : lockedSummary(defs.filter((d) => lockReason(d, view, content)), view, content);
	}

	const buy = (cmd: SimCommand): void => {
		const r = store.dispatch(cmd);
		if (!r.ok) pushNotice({ text: r.reason, severity: "warn", key: `buy:${r.reason}` });
	};
	const bots = Object.values(content.bots);
	const st = content.structure;

	return (
		<aside className="bld-catalog ui-panel" data-help="catalog" aria-label={`${CATEGORY_LABEL[tab]} catalog`}>
			<div className="bld-head">
				<span className="bld-title">{CATEGORY_LABEL[tab]}</span>
				<button type="button" className="ui-btn ui-icon-btn" aria-label="Close catalog" title="Close (B)" onClick={() => setUi({ paletteOpen: false, buildHover: null })}>
					<Icon name="close" size={11} />
				</button>
			</div>
			<div className="bld-scroll">
				{tab !== "supplies" && <div className="bld-grid">{cards.map((i) => card(i))}</div>}
				{tab !== "supplies" && cards.length === 0 && lockedLines.length === 0 && <div className="ui-empty">Nothing in this category yet.</div>}
				{lockedLines.length > 0 && (
					<div className="bld-locked" data-tut="locked-row">
						<Icon name="lock" size={11} />
						<div>
							{lockedLines.map((l) => (
								<p key={l}>{l}</p>
							))}
						</div>
					</div>
				)}
				{tab === "supplies" && (
					<div className="bld-supplies">
						<div className="bld-supply">
							<span className="bld-supply-name">Spare parts <b>{view.spareParts}</b></span>
							<span className="bld-supply-sub">Repair bots use one part per fix.</span>
							<button type="button" className="ui-btn" disabled={view.cash < st.sparePart * 5} onClick={() => buy({ type: "buyParts", count: 5 })}>
								Buy 5 · {fmtMoney(st.sparePart * 5)}
							</button>
						</div>
						{bots.map((bot) => {
							const gate = techGate(bot.tech, view, content);
							const n = view.bots.filter((b) => b.defId === bot.id).length;
							return (
								<div key={bot.id} className="bld-supply">
									<span className="bld-supply-name">{bot.name} <b>{n}</b></span>
									<span className="bld-supply-sub">{gate ? gate : bot.flying ? "Flies between floors, no lift needed." : "Walks to broken racks and fixes them."}</span>
									<button type="button" className="ui-btn" disabled={!!gate || view.cash < bot.cost} onClick={() => buy({ type: "buyBot", defId: bot.id })}>
										{gate ? "Research first" : `Buy 1 · ${fmtMoney(bot.cost)}`}
									</button>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</aside>
	);
}

