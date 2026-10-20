import type { BuildCategory, ContentDB, FacilityDef } from "@aitower/content";
import type { SimCommand, SimView } from "@aitower/sim";
import type { Tool } from "@aitower/shared";
import { type MouseEvent, useRef, useState } from "react";
import { fmtMoney, fmtPflops, fmtPower } from "../format";
import { pushNotice } from "../notices";
import { techGate } from "../research/tech";
import { hudScale } from "../settings";
import { conduitUnitCost, toolKey } from "../tools/controller";
import { bandText } from "../bio/bio";
import { Icon, Swatch } from "./common";
import { SpecCard, type SpecHover, type SpecInfo, anchorOf } from "./SpecCard";
import type { PanelProps } from "./context";

export type Tab = "structure" | BuildCategory;
const TABS: { id: Tab; label: string }[] = [
	{ id: "structure", label: "Build" },
	{ id: "rack", label: "Racks" },
	{ id: "power", label: "Power" },
	{ id: "cooling", label: "Cool" },
	{ id: "logistics", label: "Logis" },
	{ id: "bio", label: "Wetware" },
];

/** One-line headline numbers for a facility card. */
export function defHeadline(def: FacilityDef): string {
	const parts: string[] = [];
	if (def.rack) {
		parts.push(fmtPower(def.rack.powerKw));
		if (def.rack.pflops) parts.push(fmtPflops(def.rack.pflops));
		if (def.rack.storageTB) parts.push(`${def.rack.storageTB} TB`);
		parts.push(def.rack.cooling.toUpperCase());
		if (def.rack.bio) parts.push(bandText(def.rack.bio));
	} else if (def.power) {
		parts.push(`${fmtPower(def.power.capacityKw)} out`);
		if (def.power.storageKwh) parts.push(`${def.power.storageKwh} kWh`);
	} else if (def.cooling) {
		parts.push(`${fmtPower(def.cooling.capacityKw)} heat`);
		if (def.cooling.radius) parts.push(`r${def.cooling.radius}`);
		if (def.cooling.cop) parts.push(`COP ${def.cooling.cop}`);
	} else if (def.logistics) {
		parts.push(`cap ${def.logistics.capacity}`);
	}
	if (def.bio && !def.rack) {
		if (def.bio.nutrientCapacity) parts.push(`${def.bio.nutrientCapacity} nutrient/tick`);
		if (def.bio.radius) parts.push(`r${def.bio.radius}`);
	}
	if (def.facilityKw) parts.push(`+${fmtPower(def.facilityKw)} aux`);
	return parts.join(" · ");
}

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
	const gate = techGate(def.tech, view, content);
	const parts = [gate ? gate.replace("Requires research: ", "") : null, def.unlockTier > view.tier ? `Clearance ${def.unlockTier}` : null].filter(Boolean);
	return parts.length ? `Locked: ${parts.join(" · ")}` : null;
}

/** A tab's rows: unlocked first, each group by unlock tier, then cost. */
export function paletteDefs(content: ContentDB, view: SimView, cat: BuildCategory): FacilityDef[] {
	return Object.values(content.facilities)
		.filter((d) => d.category === cat && !d.growth)
		.map((d) => ({ d, locked: lockText(d, view, content) !== null }))
		.sort((a, b) => Number(a.locked) - Number(b.locked) || a.d.unlockTier - b.d.unlockTier || a.d.cost - b.d.cost || a.d.id.localeCompare(b.d.id))
		.map((x) => x.d);
}

export function BuildPalette({ store, content, state, ui, setUi }: PanelProps) {
	const tab = ui.paletteTab as Tab;
	const [hover, setHover] = useState<SpecHover | null>(null);
	const root = useRef<HTMLElement>(null);
	const { view, tool } = state;
	const active = toolKey(tool);
	const st = content.structure;

	const pick = (t: Tool): void => {
		store.setGhost(null);
		store.setTool(active === toolKey(t) ? { kind: "select" } : t);
	};
	const hoverAt = (e: MouseEvent<HTMLElement>, h: SpecInfo): void => setHover({ ...h, anchor: anchorOf(e.currentTarget, root.current) });

	const structure: { tool: Tool; icon: "slab" | "bolt" | "drop" | "leaf" | "lift" | "demolish"; name: string; cost: string; hint: string; body: string }[] = [
		{ tool: { kind: "slab" }, icon: "slab", name: "Floor slab", cost: `${fmtMoney(st.slabPerTile)}/tile`, hint: `basement ${fmtMoney(st.basementSlabPerTile)}/tile`, body: "Drag horizontally along one floor. Floors above ground need slab underneath." },
		{ tool: { kind: "conduit", layer: "power" }, icon: "bolt", name: "Power conduit", cost: `${fmtMoney(st.powerConduitPerTile)}/tile`, hint: "drag an L-shaped run", body: "Busway linking power sources, UPS and loads into one net. Vertical runs become risers." },
		{ tool: { kind: "conduit", layer: "coolant" }, icon: "drop", name: "Coolant conduit", cost: `${fmtMoney(st.coolantConduitPerTile)}/tile`, hint: "drag an L-shaped run", body: "Liquid loop piping between chillers, CDUs and liquid-cooled racks." },
		{ tool: { kind: "conduit", layer: "nutrient" }, icon: "leaf", name: "Nutrient conduit", cost: `${fmtMoney(conduitUnitCost(content, "nutrient"))}/tile`, hint: "drag an L-shaped run", body: "Feed line from a nutrient plant to organoid racks and bioreactors. Vertical runs join floors." },
		{ tool: { kind: "lift" }, icon: "lift", name: "Service lift", cost: `${fmtMoney(st.liftBase)}+${fmtMoney(st.liftPerFloor)}/fl`, hint: "drag vertically", body: "Lets bots change floors. Every floor in the span needs slab at that column." },
		{ tool: { kind: "demolish" }, icon: "demolish", name: "Demolish", cost: "50% refund", hint: "click or drag", body: "Removes the top-most thing in a cell: facility ▸ lift ▸ conduit ▸ slab." },
	];

	const defs = tab === "structure" ? [] : paletteDefs(content, view, tab);

	const bots = Object.values(content.bots);
	const buy = (cmd: SimCommand): void => {
		const r = store.dispatch(cmd);
		if (!r.ok) pushNotice({ text: r.reason, severity: "warn", key: `buy:${r.reason}` });
	};

	return (
		<aside ref={root} className="ui-palette ui-panel" onMouseLeave={() => setHover(null)}>
			<div className="ui-panel-title">
				<span className="ui-panel-name">Build</span>
				<button
					type="button"
					className={`ui-btn ui-icon-btn ui-select-btn ${tool.kind === "select" ? "is-on" : ""}`}
					onClick={() => pick({ kind: "select" })}
					title="Select / inspect (Esc)"
					aria-label="Select"
				>
					<Icon name="pointer" size={13} />
				</button>
			</div>
			<div className="ui-tabs ui-tabs-6" role="tablist">
				{TABS.map((t) => (
					<button key={t.id} type="button" role="tab" data-tut={`tab-${t.id}`} aria-selected={tab === t.id} className={`ui-tab ${tab === t.id ? "is-on" : ""}`} onClick={() => {
							setUi({ paletteTab: t.id });
							setHover(null);
						}}>
						{t.label}
					</button>
				))}
			</div>
			<div className="ui-palette-list">
				{tab === "structure" &&
					structure.map((s) => (
						<button
							key={s.name}
							type="button"
							data-tut={`card-${s.icon}${s.tool.kind === "conduit" ? `-${s.tool.layer}` : ""}`}
							className={`ui-item ui-card ${active === toolKey(s.tool) ? "is-on" : ""} ${s.icon === "demolish" ? "is-danger" : ""}`}
							onClick={() => pick(s.tool)}
							onMouseLeave={() => setHover(null)}
							onMouseEnter={(e) => hoverAt(e, { title: s.name, body: s.body, specs: [["Cost", s.cost], ["How", s.hint]] })}
						>
							<span className={`ui-item-icon ic-${s.icon}`}>
								<Icon name={s.icon} size={15} />
							</span>
							<span className="ui-item-main">
								<span className="ui-item-name">{s.name}</span>
								<span className="ui-item-foot">
									<span className="ui-item-sub">{s.hint}</span>
									<span className="ui-item-cost">{s.cost}</span>
								</span>
							</span>
						</button>
					))}
				{tab !== "structure" && defs.length === 0 && <div className="ui-empty">Nothing in this category yet.</div>}
				{tab !== "structure" &&
					defs.map((d) => {
						const lock = lockText(d, view, content);
						const locked = lock !== null;
						const poor = view.cash < d.cost;
						const t: Tool = { kind: "place", defId: d.id };
						return (
							<button
								key={d.id}
								type="button"
								data-tut={`card-${d.id}`}
								aria-disabled={locked || poor}
								className={`ui-item ui-card ${active === toolKey(t) ? "is-on" : ""} ${locked ? "is-locked" : poor ? "is-poor" : ""}`}
								onClick={() => {
									if (!locked && !poor) pick(t);
								}}
								onMouseLeave={() => setHover(null)}
								onMouseEnter={(e) =>
									hoverAt(e, {
										title: d.name,
										body: d.description,
										specs: defSpecs(d),
										warn: lock ? lock : poor ? `Need ${fmtMoney(d.cost - view.cash)} more` : undefined,
									})
								}
							>
								<Swatch color={d.color} accent={d.accent} />
								<span className="ui-item-main">
									<span className="ui-item-name">
										{d.name}
									</span>
									<span className="ui-item-foot">
										<span className={`ui-item-sub ${locked ? "is-lock" : ""}`}>
											{locked && <Icon name="lock" size={10} />} {lock ?? defHeadline(d)}
										</span>
										<span className={`ui-item-cost ${poor ? "is-short" : ""}`}>{fmtMoney(d.cost)}</span>
									</span>
								</span>
							</button>
						);
					})}
			</div>
			<div className="ui-supplies">
				<span className="ui-dymo ui-supplies-title">SUPPLIES</span>
				<div className="ui-supply">
					<span className="ui-k">Spare parts</span>
					<span className="ui-v ui-crt crt-amber">{view.spareParts}</span>
					<button
						type="button"
						className="ui-btn ui-mini"
						disabled={view.cash < st.sparePart * 5}
						onClick={() => buy({ type: "buyParts", count: 5 })}
						title={`Buy 5 spare parts for ${fmtMoney(st.sparePart * 5)}`}
					>
						+5 · {fmtMoney(st.sparePart * 5)}
					</button>
				</div>
				{bots.map((bot) => {
					const gate = techGate(bot.tech, view, content);
					const many = bots.length > 1;
					return (
						<div key={bot.id} className="ui-supply">
							<span className="ui-k">{many ? bot.name : "Bots"}</span>
							<span className="ui-v ui-crt crt-amber">{many ? view.bots.filter((b) => b.defId === bot.id).length : view.bots.length}</span>
							<button
								type="button"
								className="ui-btn ui-mini"
								disabled={!!gate || view.cash < bot.cost}
								onClick={() => buy({ type: "buyBot", defId: bot.id })}
								title={gate ?? `Buy a ${bot.name} for ${fmtMoney(bot.cost)}${bot.flying ? " (flies between floors, no lift needed)" : ""}`}
							>
								{gate ? "Research" : `+1 · ${fmtMoney(bot.cost)}`}
							</button>
							{gate && <span className="ui-supply-gate">{gate}</span>}
						</div>
					);
				})}
				{bots.length === 0 && (
					<div className="ui-supply">
						<span className="ui-k">Bots</span>
						<span className="ui-v ui-crt crt-amber">{view.bots.length}</span>
						<button type="button" className="ui-btn ui-mini" disabled title="No bot types available">
							+1 · —
						</button>
					</div>
				)}
			</div>
			{hover && (
				<SpecCard hover={hover} scale={hudScale(state.settings)} />
			)}
		</aside>
	);
}
