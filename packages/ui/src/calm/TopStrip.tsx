import { clock, type Speed } from "@aitower/shared";
import { GrowthIndex } from "../bio/GrowthIndex";
import { Icon, Lamp, Toggle } from "../components/common";
import type { PanelProps } from "../components/context";
import { fmtMoney } from "../format";
import { InboxButton, StandingMeter } from "../memo/MemoDesk";
import { saveLamp } from "../menu/slots";
import { clearanceProgress, fmtRateHour, perHour } from "./calm";

export const SPEEDS: Speed[] = [0, 1, 3, 10, 30];

/** The one thin strip: day and clock, speed, treasury, PER HOUR, Clearance bar, standing, inbox, growth index, menu. */
export function TopStrip({ store, content, state, openMenu, ui, setUi }: PanelProps) {
	const { view, speed, muted } = state;
	const lamp = saveLamp(state.saveStatus);
	const rate = perHour(view);
	const cl = clearanceProgress(view, content);
	return (
		<header className="ui-strip" aria-label="Status">
			<div className="ui-chip ui-clock" title="Game day and time (1 tick = 1 minute)">
				<span className="ui-label">DAY {view.day}</span>
				<span className="ui-big">{clock(view.minuteOfDay)}</span>
			</div>
			{/* biome-ignore lint/a11y/useSemanticElements: a div group of buttons; a fieldset would bring unwanted default styling */}
			<div className="ui-speeds" role="group" aria-label="Simulation speed">
				{SPEEDS.map((s, i) => (
					<button key={s} type="button" data-tut={`speed-${s}`} className={`ui-speed ${speed === s ? "is-on" : ""}`} onClick={() => store.setSpeed(s)} title={`${s === 0 ? "Pause (Space)" : `${s}× speed`}: key ${i + 1}`} aria-pressed={speed === s}>
						<span className="ui-speed-cap">{s === 0 ? <Icon name="pause" size={12} /> : `${s}×`}</span>
					</button>
				))}
			</div>
			<div className={`ui-chip ui-cash ${view.cash < 0 ? "is-bad" : ""}`} title={view.bankrupt ? "Bankrupt!" : "Available cash"}>
				<span className="ui-label">TREASURY</span>
				<span className="ui-big">{fmtMoney(view.cash)}</span>
			</div>
			<div className={`ui-chip ui-perhour ${rate !== null && rate < 0 ? "is-bad" : ""}`} data-tut="perhour" title="Operating income per game-hour, averaged over the last six game-hours (construction not counted)">
				<span className="ui-label">PER HOUR</span>
				<span className="ui-big">{fmtRateHour(rate)}</span>
			</div>
			<div className="ui-clearance" data-tut="clearance" title={cl.next ? `${Math.round(cl.have)} of ${cl.need} PFLOPS installed for Clearance ${cl.next}; uptime ${(cl.uptime * 100).toFixed(1)}% (needs ${(cl.uptimeNeed * 100).toFixed(1)}%)` : "Top Clearance reached"}>
				<span className="ui-label">
					<span>CLEARANCE {cl.tier}</span>
					<span className={cl.uptimeOk ? "" : "is-warn"}>{cl.next ? `${Math.round(cl.have)} / ${cl.need} PF · uptime ${cl.uptimeOk ? "ok" : "low"}` : "top"}</span>
				</span>
				<span className="ui-bar" role="progressbar" tabIndex={-1} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(cl.frac * 100)} aria-label="Clearance progress">
					<i style={{ width: `${Math.round(cl.frac * 100)}%` }} />
				</span>
			</div>
			<StandingMeter standing={view.standing} />
			<GrowthIndex view={view} horror={state.settings.horrorIntensity} />
			<InboxButton state={state} ui={ui} setUi={setUi} />
			<div className="ui-sysbox">
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
