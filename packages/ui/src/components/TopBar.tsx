import type { ReactNode } from "react";
import type { Speed } from "@aitower/shared";
import { clock } from "@aitower/shared";
import { fmtMoney, fmtPct, fmtPflops, fmtPower, fmtTemp } from "../format";
import { Icon, Kbd } from "./common";
import type { PanelProps } from "./context";
import { PueGauge } from "./PueGauge";

export const SPEEDS: Speed[] = [0, 1, 3, 10, 30];

function Stat({ label, children, title, className = "" }: { label: string; children: ReactNode; title?: string; className?: string }) {
	return (
		<div className={`ui-stat ${className}`} title={title}>
			<span className="ui-label">{label}</span>
			<span className="ui-big">{children}</span>
		</div>
	);
}

export function TopBar({ store, content, state }: PanelProps) {
	const { view, speed, muted } = state;
	const maxTier = Math.max(1, content.balance.tiers.pflops.length);
	const headroom = view.powerNets.reduce((s, n) => s + n.supplyKw, 0);
	return (
		<header className="ui-topbar ui-panel">
			<div className="ui-brand">
				<span className="ui-brand-mark">▚</span>
				<span>
					AI<b>TOWER</b>
				</span>
			</div>
			<div className="ui-sep" />
			<Stat label={`Day ${view.day}`} className="ui-clock" title="Game day and time (1 tick = 1 minute)">
				{clock(view.minuteOfDay)}
			</Stat>
			<div className="ui-speeds" role="group" aria-label="Simulation speed">
				{SPEEDS.map((s, i) => (
					<button
						key={s}
						type="button"
						className={`ui-btn ui-speed ${speed === s ? "is-on" : ""} ${s === 0 && speed === 0 ? "is-paused" : ""}`}
						onClick={() => store.setSpeed(s)}
						title={`${s === 0 ? "Pause (Space)" : `${s}× speed`} — key ${i + 1}`}
					>
						{s === 0 ? <Icon name="pause" size={11} /> : `${s}×`}
					</button>
				))}
			</div>
			<div className="ui-sep" />
			<Stat label="Cash" className={view.cash < 0 ? "is-neg" : "is-cash"} title={view.bankrupt ? "Bankrupt!" : "Available cash"}>
				{fmtMoney(view.cash)}
			</Stat>
			<div className="ui-sep" />
			<PueGauge pue={view.pue} />
			<Stat label="IT / Total" title={`IT load / total facility draw. Supply capacity ${fmtPower(headroom)}`}>
				{fmtPower(view.itKw)}
				<span className="ui-dim"> / {fmtPower(view.totalKw)}</span>
			</Stat>
			<Stat label="Compute" title="PFLOPS currently delivered">
				{fmtPflops(view.pflops)}
			</Stat>
			<Stat label="Uptime" title="Rolling 24h rack uptime" className={view.uptime < 0.99 ? "is-warn" : ""}>
				{fmtPct(view.uptime, 2)}
			</Stat>
			<div className="ui-stat" title={`Tier ${view.tier} of ${maxTier}`}>
				<span className="ui-label">Tier</span>
				<span className="ui-stars">
					{Array.from({ length: maxTier }, (_, i) => (
						<span key={i} className={i < view.tier ? "on" : ""}>
							<Icon name="star" size={13} />
						</span>
					))}
				</span>
			</div>
			<div className="ui-grow" />
			<Stat label="Outside" title="Outdoor ambient temperature">
				{fmtTemp(view.ambientC, 1)}
			</Stat>
			<Stat label="Grid $/kWh" title="Current energy price" className="ui-hide-narrow">
				{view.energyPrice.toFixed(3)}
			</Stat>
			<button
				type="button"
				className={`ui-btn ui-icon-btn ${muted ? "is-off" : ""}`}
				onClick={() => store.setMuted(!muted)}
				title={`${muted ? "Unmute" : "Mute"} (M)`}
				aria-pressed={muted}
			>
				<Icon name={muted ? "mute" : "sound"} size={16} />
				<Kbd>M</Kbd>
			</button>
		</header>
	);
}
