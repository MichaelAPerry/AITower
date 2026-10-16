import type { BuildCategory, FacilityDef } from "@aitower/content";
import type { SimCommand } from "@aitower/sim";
import type { Tool } from "@aitower/shared";
import { type MouseEvent, useState } from "react";
import { fmtMoney, fmtPflops, fmtPower } from "../format";
import { pushNotice } from "../notices";
import { hudScale } from "../settings";
import { toolKey } from "../tools/controller";
import { FormLabel, Icon, Stamp, Swatch } from "./common";
import type { PanelProps } from "./context";

type Tab = "structure" | BuildCategory;
const TABS: { id: Tab; label: string }[] = [
	{ id: "structure", label: "Build" },
	{ id: "rack", label: "Racks" },
	{ id: "power", label: "Power" },
	{ id: "cooling", label: "Cool" },
	{ id: "logistics", label: "Logis" },
];

interface Hover {
	top: number;
	title: string;
	body: string;
	specs: [string, string][];
	warn?: string;
}

/** One-line headline numbers for a facility card. */
export function defHeadline(def: FacilityDef): string {
	const parts: string[] = [];
	if (def.rack) {
		parts.push(fmtPower(def.rack.powerKw));
		if (def.rack.pflops) parts.push(fmtPflops(def.rack.pflops));
		if (def.rack.storageTB) parts.push(`${def.rack.storageTB} TB`);
		parts.push(def.rack.cooling.toUpperCase());
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
	if (def.facilityKw) parts.push(`+${fmtPower(def.facilityKw)} aux`);
	return parts.join(" · ");
}

function defSpecs(def: FacilityDef): [string, string][] {
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
	const p = def.placement;
	if (p?.needsCoolant) s.push(["Needs", "coolant conduit"]);
	if (p?.minFloor !== undefined || p?.maxFloor !== undefined) s.push(["Floors", `${p?.minFloor ?? "…"} to ${p?.maxFloor ?? "…"}`]);
	return s;
}

/**
 * `top` for the fixed spec sheet. `rectTop` is a viewport coordinate; the HUD is zoomed by `scale`, so the
 * CSS value is in zoomed pixels: divide the viewport numbers by the scale.
 */
export function tooltipTop(rectTop: number, viewportH: number, scale: number): number {
	return Math.max(60 / scale, Math.min(rectTop, viewportH - 320 * scale) / scale);
}

export function BuildPalette({ store, content, state }: PanelProps) {
	const [tab, setTab] = useState<Tab>("structure");
	const [hover, setHover] = useState<Hover | null>(null);
	const { view, tool } = state;
	const active = toolKey(tool);
	const st = content.structure;

	const pick = (t: Tool): void => {
		store.setGhost(null);
		store.setTool(active === toolKey(t) ? { kind: "select" } : t);
	};
	const hoverAt = (e: MouseEvent<HTMLElement>, h: Omit<Hover, "top">): void => {
		const r = e.currentTarget.getBoundingClientRect();
		setHover({ ...h, top: r.top });
	};

	const structure: { tool: Tool; icon: "slab" | "bolt" | "drop" | "lift" | "demolish"; name: string; cost: string; hint: string; body: string }[] = [
		{ tool: { kind: "slab" }, icon: "slab", name: "Floor slab", cost: `${fmtMoney(st.slabPerTile)}/tile`, hint: `basement ${fmtMoney(st.basementSlabPerTile)}/tile`, body: "Drag horizontally along one floor. Floors above ground need slab underneath." },
		{ tool: { kind: "conduit", layer: "power" }, icon: "bolt", name: "Power conduit", cost: `${fmtMoney(st.powerConduitPerTile)}/tile`, hint: "drag an L-shaped run", body: "Busway linking power sources, UPS and loads into one net. Vertical runs become risers." },
		{ tool: { kind: "conduit", layer: "coolant" }, icon: "drop", name: "Coolant conduit", cost: `${fmtMoney(st.coolantConduitPerTile)}/tile`, hint: "drag an L-shaped run", body: "Liquid loop piping between chillers, CDUs and liquid-cooled racks." },
		{ tool: { kind: "lift" }, icon: "lift", name: "Service lift", cost: `${fmtMoney(st.liftBase)}+${fmtMoney(st.liftPerFloor)}/fl`, hint: "drag vertically", body: "Lets bots change floors. Every floor in the span needs slab at that column." },
		{ tool: { kind: "demolish" }, icon: "demolish", name: "Demolish", cost: "50% refund", hint: "click or drag", body: "Removes the top-most thing in a cell: facility ▸ lift ▸ conduit ▸ slab." },
	];

	const defs = Object.values(content.facilities)
		.filter((d) => d.category === tab)
		.sort((a, b) => a.unlockTier - b.unlockTier || a.cost - b.cost);

	const bot = Object.values(content.bots)[0];
	const buy = (cmd: SimCommand): void => {
		const r = store.dispatch(cmd);
		if (!r.ok) pushNotice({ text: r.reason, severity: "warn", key: `buy:${r.reason}` });
	};

	return (
		<aside className="ui-palette ui-panel" onMouseLeave={() => setHover(null)}>
			<div className="ui-panel-title">
				<FormLabel form="DEPT. OF">Provisioning</FormLabel>
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
			<div className="ui-tabs ui-tabs-5" role="tablist">
				{TABS.map((t) => (
					<button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`ui-tab ${tab === t.id ? "is-on" : ""}`} onClick={() => {
							setTab(t.id);
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
						const locked = d.unlockTier > view.tier;
						const poor = view.cash < d.cost;
						const t: Tool = { kind: "place", defId: d.id };
						return (
							<button
								key={d.id}
								type="button"
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
										warn: locked ? `Unlocks at Tier ${d.unlockTier}` : poor ? `Need ${fmtMoney(d.cost - view.cash)} more` : undefined,
									})
								}
							>
								<Swatch color={d.color} accent={d.accent} />
								<span className="ui-item-main">
									<span className="ui-item-name">
										{d.name}
										{locked && (
											<span className="ui-lock">
												<Icon name="lock" size={10} /> T{d.unlockTier}
											</span>
										)}
									</span>
									<span className="ui-item-foot">
										<span className="ui-item-sub">{defHeadline(d)}</span>
										<span className={`ui-item-cost ${poor ? "is-short" : ""}`}>{fmtMoney(d.cost)}</span>
									</span>
								</span>
								{locked && (
									<Stamp tone="red" className="ui-card-stamp">
										Restricted
									</Stamp>
								)}
							</button>
						);
					})}
			</div>
			<div className="ui-supplies">
				<span className="ui-dymo ui-supplies-title">STORES REQUISITION</span>
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
				<div className="ui-supply">
					<span className="ui-k">Bots</span>
					<span className="ui-v ui-crt crt-amber">{view.bots.length}</span>
					<button
						type="button"
						className="ui-btn ui-mini"
						disabled={!bot || view.cash < bot.cost}
						onClick={() => bot && buy({ type: "buyBot", defId: bot.id })}
						title={bot ? `Buy a ${bot.name} for ${fmtMoney(bot.cost)}` : "No bot types available"}
					>
						+1 · {bot ? fmtMoney(bot.cost) : "—"}
					</button>
				</div>
			</div>
			{hover && (
				<div className="ui-tooltip ui-panel" style={{ top: tooltipTop(hover.top, window.innerHeight, hudScale(state.settings)) }}>
					<div className="ui-tooltip-form">SPECIFICATION SHEET · FORM SP-4</div>
					<div className="ui-tooltip-title">{hover.title}</div>
					<p>{hover.body}</p>
					<div className="ui-tooltip-specs">
						{hover.specs.map(([k, v]) => (
							<div key={k} className="ui-row">
								<span className="ui-k">{k}</span>
								<span className="ui-v">{v}</span>
							</div>
						))}
					</div>
					{hover.warn && <div className="ui-tooltip-warn">{hover.warn}</div>}
				</div>
			)}
		</aside>
	);
}
