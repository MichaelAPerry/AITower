import { isSerious, AlertsLog, ContractsDrawer, ResearchDrawer, Telemetry } from "./Panels";
import { FinanceTab } from "../finance/FinanceTab";
import { OverlaySwitcher } from "../components/OverlaySwitcher";
import type { PanelProps } from "../components/context";
import { fmtPct, fmtPower, fmtPue, fmtTemp } from "../format";
import { AutomationDrawer } from "../automation/AutomationDrawer";
import { ModifierChips } from "../memo/MemoDesk";
import { currentObjective, endingLine, isProblem } from "../objective/objective";
import { BuildPalette } from "../components/BuildPalette";
import { EncyclopediaDrawer } from "../encyclopedia/EncyclopediaDrawer";
import { AffinityBars } from "../components/AffinityBars";
import { leadingPath } from "../ascension/ascension";
import { DRAWER_TABS, feedLines, isRoutine, nextDrawer } from "./calm";
import { Icon } from "../components/common";

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
		<section className={`ui-next tone-${isProblem(obj) ? obj.tone : "progress"}`} aria-live="polite" aria-label="Next step" data-help="next">
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

/** The edge tabs: one drawer at a time, each on a hotkey. */
export function DrawerTabs({ ui, setUi }: Pick<PanelProps, "ui" | "setUi">) {
	return (
		<div className="ui-dtabs" role="tablist" aria-label="Drawers">
			{DRAWER_TABS.map((d) => (
				<button key={d.id} type="button" role="tab" data-tut={`dtab-${d.id}`} data-help={`tab-${d.id}`} aria-selected={ui.drawer === d.id} className={`ui-dtab ${ui.drawer === d.id ? "is-on" : ""}`} onClick={() => setUi({ drawer: nextDrawer(ui.drawer, d.id) })} aria-label={`${d.label} (${d.key})`}>
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
			{d === "encyclopedia" && <EncyclopediaDrawer {...props} />}
			{d === "log" && <AlertsLog {...props} />}
		</section>
	);
}

/** The build catalog beside the category bar, and the Inspector that goes with it. */
export function PalettePopover(props: PanelProps) {
	return props.ui.paletteOpen ? <BuildPalette {...props} /> : null;
}
