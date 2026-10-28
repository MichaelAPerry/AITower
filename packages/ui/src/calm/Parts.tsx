import { isSerious, AlertsLog } from "./Panels";
import { ResearchPanel } from "../research/ResearchPanel";
import { ContractsDrawer } from "../contracts/ContractsPanel";
import { InsightsPanel } from "../insights/InsightsPanel";
import type { PanelProps } from "../components/context";
import { AutomationDrawer } from "../automation/AutomationDrawer";
import { currentObjective, endingLine, isProblem } from "../objective/objective";
import { BuildPalette } from "../components/BuildPalette";
import { HandbookDrawer } from "../handbook/HandbookDrawer";
import { useUnreadHandbook } from "../handbook/unread";
import { DRAWER_TABS, type DrawerId, feedLines, isRoutine, nextDrawer } from "./calm";
import { Icon } from "../components/common";

/** NEXT: one line from the current objective, with the key to press. The detail is its tooltip. */
export function NextChip({ store, content, state, setUi }: PanelProps) {
	const obj = currentObjective(state.view, content, (cmd) => store.canBuild(cmd));
	const ending = endingLine(state.view, content);
	// NEXT is for problems; the Goals card is the everyday guide.
	if (!isProblem(obj) && !ending) return null;
	const go = (): void => {
		if (obj.key === "C") setUi({ drawer: "contracts" });
		else if (obj.key === "R") setUi({ drawer: "research" });
	};
	return (
		<section className={`ui-next tone-${isProblem(obj) ? obj.tone : "progress"}`} aria-live="polite" aria-label="Next step" data-help="next">
			{isProblem(obj) && (
				<button type="button" className="ui-next-btn" onClick={go} title={obj.detail}>
					<span className="ui-tag">NEXT</span>
					<span className="ui-next-title">{obj.title}</span>
					{obj.key && <span className="ui-tag is-key">{obj.key}</span>}
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
export function DrawerTabs({ ui, setUi, content, state, only }: Pick<PanelProps, "ui" | "setUi" | "content" | "state"> & { only?: readonly DrawerId[] }) {
	const unreadHandbook = useUnreadHandbook(content, state.view);
	return (
		<div className="ui-dtabs" role="tablist" aria-label="Drawers">
			{DRAWER_TABS.filter((d) => !only || only.includes(d.id)).map((d) => (
				<button key={d.id} type="button" role="tab" data-tut={`dtab-${d.id}`} data-help={`tab-${d.id}`} aria-selected={ui.drawer === d.id} className={`ui-dtab ${ui.drawer === d.id ? "is-on" : ""}`} onClick={() => setUi({ drawer: nextDrawer(ui.drawer, d.id) })} aria-label={`${d.label} (${d.key})`}>
					<span className="ui-dtab-name">{d.label}</span>
					{d.id === "handbook" && unreadHandbook && <span className="pr-dot" role="img" aria-label="New chapter" />}
					<kbd>{d.key}</kbd>
				</button>
			))}
		</div>
	);
}

/** Panels built on the shared shell (list + Inspector) get the wide frame. */
export const WIDE: ReadonlySet<DrawerId> = new Set<DrawerId>(["contracts", "insights", "research", "handbook"]);

/** The open drawer, if any. */
export function Drawer(props: PanelProps) {
	const d = props.ui.drawer;
	if (!d) return null;
	const title = d === "log" ? "ALERT LOG" : DRAWER_TABS.find((t) => t.id === d)?.label.toUpperCase();
	return (
		<section className={`ui-edge ui-glass is-${d} ${WIDE.has(d) ? "is-wide" : ""}`} aria-label={title} data-drawer={d}>
			<button type="button" className="ui-btn ui-icon-btn ui-drawer-x" aria-label="Close drawer" title="Close (Esc)" onClick={() => props.setUi({ drawer: null })}>
				<Icon name="close" size={11} />
			</button>
			{d === "contracts" && <ContractsDrawer {...props} />}
			{d === "research" && <ResearchPanel {...props} />}
			{d === "automation" && <AutomationDrawer {...props} />}
			{d === "insights" && <InsightsPanel {...props} />}
			{d === "handbook" && <HandbookDrawer {...props} />}
			{d === "log" && <AlertsLog {...props} />}
		</section>
	);
}

/** The build catalog beside the category bar, and the Inspector that goes with it. */
export function PalettePopover(props: PanelProps) {
	return props.ui.paletteOpen ? <BuildPalette {...props} /> : null;
}
