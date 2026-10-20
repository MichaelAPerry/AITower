import type { Tool } from "@aitower/shared";
import { isSerious, AlertsLog, ContractsDrawer, ResearchDrawer, Telemetry } from "./Panels";
import { FinanceTab } from "../finance/FinanceTab";
import { OverlaySwitcher } from "../components/OverlaySwitcher";
import type { PanelProps } from "../components/context";
import { fmtMoney, fmtPct, fmtPower, fmtPue, fmtTemp } from "../format";
import { AutomationDrawer } from "../automation/AutomationDrawer";
import { ModifierChips } from "../memo/MemoDesk";
import { pushNotice } from "../notices";
import { currentObjective, endingLine, isProblem } from "../objective/objective";
import { toolKey } from "../tools/controller";
import { BuildPalette, defSpecs } from "../components/BuildPalette";
import { SpecCard, type SpecHover, anchorOf } from "../components/SpecCard";
import { AffinityBars } from "../components/AffinityBars";
import { leadingPath } from "../ascension/ascension";
import { hudScale } from "../settings";
import { DRAWER_TABS, type DockPick, dockPicks, feedLines, isRoutine, nextDrawer } from "./calm";
import { Icon, Swatch } from "../components/common";

/** NEXT: one line from the current objective, with the key to press. The detail is its tooltip. */
export function NextChip({ store, content, state, ui, setUi, openAscension }: PanelProps) {
	const obj = currentObjective(state.view, content, (cmd) => store.canBuild(cmd), ui.pathFiled ?? null);
	const ending = endingLine(state.view, content);
	// NEXT is for problems; the Goals card is the everyday guide.
	if (!isProblem(obj) && !ending) return null;
	const go = (): void => {
		if (obj.action === "ascension") openAscension();
		else if (obj.key === "C") setUi({ drawer: "contracts" });
		else if (obj.key === "R") setUi({ drawer: "research" });
	};
	return (
		<section className={`ui-next tone-${isProblem(obj) ? obj.tone : "progress"}`} aria-live="polite" aria-label="Next step">
			{isProblem(obj) && (
				<button type="button" className="ui-next-btn" onClick={go} title={obj.detail}>
					<span className="ui-tag">NEXT</span>
					<span className="ui-next-title">{obj.title}</span>
					{obj.key && <span className="ui-tag is-key">{obj.key}</span>}
					{obj.action === "ascension" && <span className="ui-tag is-key">ASCENSION</span>}
				</button>
			)}
			{ending && (
				<span className="ui-next-ending" title="Days the ending condition has held without a break">
					{ending}
				</span>
			)}
		</section>
	);
}

/** One line at the bottom of the world: the latest events that need a person, a count, and a click into the log. */
export function Ticker({ content, state, ui, setUi }: PanelProps) {
	const { view } = state;
	const items = feedLines(state.log.slice(-300), view, content, state.settings.horrorIntensity, (ev) => !isRoutine(ev, view)).slice(-3);
	const unseen = state.log.filter((e) => e.tick > ui.alertsSeenTick && isSerious(e.event) && !isRoutine(e.event, view)).length;
	const glyph = { good: "✓", info: "·", warn: "▲", error: "✕" } as const;
	return (
		<button type="button" className="ui-ticker" onClick={() => setUi({ drawer: ui.drawer === "log" ? null : "log" })} title="Open the alert log" aria-live="polite">
			<span className={`ui-tag ${unseen ? "is-alert" : ""}`}>{unseen || "LOG"}</span>
			{items.length === 0 && <span className="ui-dim">All quiet</span>}
			{items.map((l) => (
				<span key={l.key} className={`ui-tk sev-${l.severity}`}>
					{glyph[l.severity]} {l.text}
				</span>
			))}
		</button>
	);
}

/** Bottom-left dock: the 3 most useful builds for now (glowing when affordable) and More, which opens the full palette. */
export function BuildDock({ store, content, state, ui, setUi }: PanelProps) {
	const { view, tool } = state;
	const picks = dockPicks(view, content);
	const hover = ui.dockHover ?? null;
	const setHover = (h: SpecHover | null): void => setUi({ dockHover: h });
	const cost = (p: DockPick): number => (p.kind === "parts" ? content.structure.sparePart * 5 : content.facilities[p.defId].cost);
	const run = (p: DockPick): void => {
		if (cost(p) > view.cash) {
			pushNotice({ text: `Need ${fmtMoney(cost(p) - view.cash)} more`, severity: "warn", key: "dock-poor" });
			return;
		}
		if (p.kind === "parts") {
			const r = store.dispatch({ type: "buyParts", count: 5 });
			if (!r.ok) pushNotice({ text: r.reason, severity: "warn", key: `buy:${r.reason}` });
			return;
		}
		const t: Tool = { kind: "place", defId: p.defId };
		store.setGhost(null);
		store.setTool(toolKey(tool) === toolKey(t) ? { kind: "select" } : t);
	};
	return (
		<section className="ui-dock" aria-label="Build dock">
			<div className="ui-dockhead">
				<span className="ui-label">BUILD</span>
				<span className="ui-label">B</span>
			</div>
			{picks.map((p) => {
				const key = p.kind === "parts" ? "parts" : p.defId;
				const def = p.kind === "place" ? content.facilities[p.defId] : null;
				const can = cost(p) <= view.cash;
				const on = p.kind === "place" && toolKey(tool) === toolKey({ kind: "place", defId: p.defId });
				return (
					<button key={key} type="button" data-tut={`dock-${key}`} className={`ui-dockbtn ${can ? "can" : ""} ${on ? "is-on" : ""}`} onClick={() => run(p)}
						onMouseLeave={() => setHover(null)}
						onMouseEnter={(e) => setHover({ anchor: { ...anchorOf(e.currentTarget), right: e.currentTarget.getBoundingClientRect().right + 80 * hudScale(state.settings) }, ...(def ? { title: def.name, body: def.description, specs: defSpecs(def) } : { title: "Spare parts ×5", body: "Replacement parts for maintenance bots. Each repair uses one.", specs: [["Cost", fmtMoney(cost(p))]] }) })}>
						<span className="ui-dock-ic">{def ? <Swatch color={def.color} accent={def.accent} size={22} /> : <Icon name="bolt" size={14} />}</span>
						<span className="ui-dock-name">{def ? def.name : "Spare parts ×5"}</span>
						<span className="ui-dock-cost">{fmtMoney(cost(p))}</span>
					</button>
				);
			})}
			<button type="button" data-tut="dock-more" className={`ui-dockbtn ${ui.paletteOpen ? "is-on" : ""}`} aria-expanded={ui.paletteOpen} onClick={() => setUi({ paletteOpen: !ui.paletteOpen })} title="All builds: structure, racks, power, cooling, logistics, wetware (B)">
				<span className="ui-dock-ic">…</span>
				<span className="ui-dock-name">More</span>
				<span className="ui-dock-cost">▸</span>
			</button>
			{hover && <SpecCard hover={hover} scale={hudScale(state.settings)} />}
		</section>
	);
}

/** The edge tabs: one drawer at a time, each on a hotkey. */
export function DrawerTabs({ ui, setUi }: Pick<PanelProps, "ui" | "setUi">) {
	return (
		<div className="ui-dtabs" role="tablist" aria-label="Drawers">
			{DRAWER_TABS.map((d) => (
				<button key={d.id} type="button" role="tab" data-tut={`dtab-${d.id}`} aria-selected={ui.drawer === d.id} className={`ui-dtab ${ui.drawer === d.id ? "is-on" : ""}`} onClick={() => setUi({ drawer: nextDrawer(ui.drawer, d.id) })} title={`${d.label} (${d.key})`}>
					<span className="ui-dtab-name">{d.label}</span>
					<kbd>{d.key}</kbd>
				</button>
			))}
		</div>
	);
}

function GaugesDrawer(props: PanelProps) {
	const { state } = props;
	const { view } = state;
	const stat = (label: string, value: string, tone = "") => (
		<div key={label} className={`ui-chip ui-gstat ${tone}`}>
			<span className="ui-label">{label}</span>
			<span className="ui-big">{value}</span>
		</div>
	);
	const supply = view.powerNets.reduce((s, n) => s + n.supplyKw, 0);
	return (
		<>
			<h4 className="ui-dh">
				<span>GAUGES</span>
			</h4>
			<div className="ui-gstats">
				{stat("PUE", fmtPue(view.pue))}
				{stat("IT LOAD", fmtPower(view.itKw), supply > 0 && view.totalKw > supply ? "is-bad" : "")}
				{stat("UPTIME", fmtPct(view.uptime, 1), view.uptime < 0.99 ? "is-warn" : "")}
				{stat("OUTSIDE", fmtTemp(view.ambientC, 0))}
				{stat("GRID $/kWh", view.energyPrice.toFixed(3))}
				{stat("COMPUTE", `${Math.round(view.pflops)} PF`)}
			</div>
			<h4 className="ui-dh">
				<span>OVERLAYS</span>
			</h4>
			<OverlaySwitcher {...props} embedded />
			<h4 className="ui-dh">
				<span>PATH AFFINITY</span>
			</h4>
			<AffinityBars affinity={view.affinity} content={props.content} leading={view.path ?? leadingPath(view.affinity)} />
			{view.modifiers.length > 0 && (
				<>
					<h4 className="ui-dh">
						<span>MODIFIERS</span>
					</h4>
					<ModifierChips modifiers={view.modifiers} tick={view.tick} />
				</>
			)}
			<Telemetry {...props} />
		</>
	);
}

/** The open drawer, if any. */
export function Drawer(props: PanelProps) {
	const d = props.ui.drawer;
	if (!d) return null;
	const title = d === "log" ? "ALERT LOG" : DRAWER_TABS.find((t) => t.id === d)?.label.toUpperCase();
	return (
		<section className={`ui-edge ui-glass is-${d}`} aria-label={title} data-drawer={d}>
			<button type="button" className="ui-btn ui-icon-btn ui-drawer-x" aria-label="Close drawer" title="Close (Esc)" onClick={() => props.setUi({ drawer: null })}>
				<Icon name="close" size={11} />
			</button>
			{d === "contracts" && <ContractsDrawer {...props} />}
			{d === "research" && <ResearchDrawer {...props} />}
			{d === "automation" && <AutomationDrawer {...props} />}
			{d === "finance" && <FinanceTab {...props} />}
			{d === "gauges" && <GaugesDrawer {...props} />}
			{d === "log" && <AlertsLog {...props} />}
		</section>
	);
}

/** The full palette as a popover above the dock. */
export function PalettePopover(props: PanelProps) {
	return props.ui.paletteOpen ? <BuildPalette {...props} /> : null;
}
