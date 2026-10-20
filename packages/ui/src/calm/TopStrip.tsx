import { clock, type Speed } from "@aitower/shared";
import { anyAutomation, autoLampTitle } from "../automation/automation";
import { GrowthIndex } from "../bio/GrowthIndex";
import { Icon, Lamp, Toggle } from "../components/common";
import type { PanelProps } from "../components/context";
import { fmtMoney } from "../format";
import { InboxButton, StandingMeter } from "../memo/MemoDesk";
import { saveLamp } from "../menu/slots";
import { PathGauge } from "../paths/PathGauge";
import { droughtChip, SANDBOX_TITLE } from "../paths/paths";
import { currentObjective, isProblem } from "../objective/objective";
import { clearanceProgress, fmtRateHour, nextDrawer, perHour } from "./calm";

export const SPEEDS: Speed[] = [0, 1, 3, 10, 30];

/**
 * The one thin strip: day and clock, speed, treasury, PER HOUR, Level bar, reputation, then the badges that appear when they
 * apply (SANDBOX, AUTO, the drought chip), the path gauge and growth index, inbox, menu.
 */
export function TopStrip({ store, content, state, openMenu, ui, setUi }: PanelProps) {
	const { view, speed, muted } = state;
	const lamp = saveLamp(state.saveStatus);
	const rate = perHour(view);
	const cl = clearanceProgress(view, content);
	const drought = droughtChip(view, content);
	const auto = anyAutomation(view);
	// Before the first contract the red figure is only upkeep: say so, in words.
	// ...and the hint yields the top centre to a NEXT alert.
	const nextShown = isProblem(currentObjective(view, content, (cmd) => store.canBuild(cmd), ui.pathFiled ?? null));
	const idleCost = rate !== null && rate < 0 && !view.jobs.some((j) => j.status === "running") && !nextShown;
	return (
		<header className="ui-strip">
			<div className="ui-chip ui-clock" data-help="day">
				<span className="ui-label">DAY {view.day}</span>
				<span className="ui-big">{clock(view.minuteOfDay)}</span>
			</div>
			{/* biome-ignore lint/a11y/useSemanticElements: a div group of buttons; a fieldset would bring unwanted default styling */}
			<div className="ui-speeds" role="group" aria-label="Simulation speed" data-help="speed">
				{SPEEDS.map((s, i) => (
					<button key={s} type="button" data-tut={`speed-${s}`} className={`ui-speed ${speed === s ? "is-on" : ""}`} onClick={() => store.setSpeed(s)} aria-label={`${s === 0 ? "Pause" : `${s}× speed`} (key ${i + 1})`} aria-pressed={speed === s}>
						<span className="ui-speed-cap">{s === 0 ? <Icon name="pause" size={12} /> : `${s}×`}</span>
					</button>
				))}
			</div>
			<div className={`ui-chip ui-cash ${view.cash < 0 ? "is-bad" : ""}`} data-help="treasury">
				<span className="ui-label">TREASURY</span>
				<span className="ui-big">{fmtMoney(view.cash)}</span>
			</div>
			<div className={`ui-chip ui-perhour ${rate !== null && rate < 0 ? "is-bad" : ""}`} data-tut="perhour" data-help="perhour">
				<span className="ui-label">PER HOUR</span>
				<span className="ui-big">{fmtRateHour(rate)}</span>
				{idleCost && <span className="ui-hint">Upkeep. Accept a contract to earn.</span>}
			</div>
			<div className="ui-clearance" data-tut="clearance" data-help="level" title={cl.next ? `${Math.round(cl.have)} of ${cl.need} PF compute installed for Level ${cl.next}; uptime ${(cl.uptime * 100).toFixed(1)}% (needs ${(cl.uptimeNeed * 100).toFixed(1)}%)` : "Top level reached"}>
				<span className="ui-label">
					<span>LEVEL {cl.tier}</span>
					<span className={cl.uptimeOk ? "" : "is-warn"}>{cl.next ? `${Math.round(cl.have)} / ${cl.need} PF compute · uptime ${cl.uptimeOk ? "ok" : "low"}` : "top"}</span>
				</span>
				<span className="ui-bar" role="progressbar" tabIndex={-1} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(cl.frac * 100)} aria-label="Level progress">
					<i style={{ width: `${Math.round(cl.frac * 100)}%` }} />
				</span>
			</div>
			<StandingMeter standing={view.standing} />
			{view.sandbox && (
				<div className="ui-chip ui-sandbox" title={SANDBOX_TITLE} role="status">
					SANDBOX
				</div>
			)}
			{auto && (
				<button type="button" className="ui-chip ui-autolamp is-on" data-tut="auto-lamp" aria-pressed={ui.drawer === "automation"} onClick={() => setUi({ drawer: nextDrawer(ui.drawer, "automation") })} title={autoLampTitle(view)}>
					<Lamp on tone="green" />
					AUTO
				</button>
			)}
			{drought && (
				<div className="ui-chip ui-drought is-warn" title={drought.title} role="status">
					<span className="ui-label">{drought.label}</span>
					<span className="ui-big">{drought.value}</span>
				</div>
			)}
			<PathGauge view={view} content={content} />
			<GrowthIndex view={view} horror={state.settings.horrorIntensity} />
			<InboxButton state={state} ui={ui} setUi={setUi} />
			<div className="ui-sysbox">
				<button type="button" className={`ui-btn ui-help-btn ${ui.help ? "is-on" : ""}`} data-help="help" aria-pressed={!!ui.help} aria-label="Help mode (? or F1)" onClick={() => setUi({ help: !ui.help })}>
					?
				</button>
				<button type="button" className="ui-btn ui-menu-btn" onClick={openMenu} title="System menu (Esc): save, load, settings, controls">
					Menu
				</button>
				<span className={`ui-savelamp tone-${lamp.tone}`} title={state.saveStatus.error ?? "Last successful save"} role="status">
					<Lamp on={lamp.lit} tone={lamp.tone} blink={lamp.blink} />
				</span>
			</div>
			<Toggle on={!muted} onClick={() => store.setMuted(!muted)} title={`${muted ? "Unmute" : "Mute"} (M)`} label="AUDIO" className="ui-mute" />
		</header>
	);
}
