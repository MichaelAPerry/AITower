import type { ReactNode } from "react";
import type { Speed } from "@aitower/shared";
import { clock } from "@aitower/shared";
import { fmtMoney, fmtPct, fmtPflops, fmtPower, fmtTemp } from "../format";
import { Icon, Lamp, Toggle } from "./common";
import type { PanelProps } from "./context";
import { niceMax } from "./Dial";
import { Gauge, PueGauge } from "./PueGauge";
import { saveLamp } from "../menu/slots";

export const SPEEDS: Speed[] = [0, 1, 3, 10, 30];

/** One labelled readout inside a shared CRT screen. */
function Stat({ label, children, title, className = "" }: { label: string; children: ReactNode; title?: string; className?: string }) {
	return (
		<div className={`ui-stat ${className}`} title={title}>
			<span className="ui-label">{label}</span>
			<span className="ui-big">{children}</span>
		</div>
	);
}

export function TopBar({ store, content, state, openMenu }: PanelProps) {
	const { view, speed, muted } = state;
	const lamp = saveLamp(state.saveStatus);
	const maxTier = Math.max(1, content.balance.tiers.pflops.length);
	const headroom = view.powerNets.reduce((s, n) => s + n.supplyKw, 0);

	// IT load against total facility draw, on a scale sized to the installed supply.
	const itMax = niceMax(Math.max(headroom, view.totalKw, view.itKw, 1) * 1.05);
	// Today's net cash flow (same definition as the Finance tab's Net column).
	const today = view.ledger.find((d) => d.day === view.day) ?? view.ledger[view.ledger.length - 1];
	const net = (d: (typeof view.ledger)[number]): number => d.revenue - d.energy - d.upkeep - d.construction - d.penalties;
	const todayNet = today ? net(today) : 0;
	const flowMax = niceMax(Math.max(1_000, ...view.ledger.slice(-8).map((d) => Math.abs(net(d)))));

	return (
		<header className="ui-topbar ui-panel">
			<div className="ui-brand" title="AItower — Ministry of Computation">
				<span className="ui-brand-plate">
					AI<b>TOWER</b>
				</span>
				<span className="ui-brand-sub">MIN. OF COMPUTATION</span>
			</div>
			<div className="ui-crt crt-amber ui-clock" title="Game day and time (1 tick = 1 minute)">
				<span className="ui-label">DAY {view.day}</span>
				<span className="ui-big">{clock(view.minuteOfDay)}</span>
			</div>
			{/* biome-ignore lint/a11y/useSemanticElements: a div group of buttons; a fieldset would bring unwanted default styling and semantics */}
			<div className="ui-speeds" role="group" aria-label="Simulation speed">
				{SPEEDS.map((s, i) => (
					<button
						key={s}
						type="button"
						className={`ui-speed ${speed === s ? "is-on" : ""} ${s === 0 ? "is-pause" : ""}`}
						onClick={() => store.setSpeed(s)}
						title={`${s === 0 ? "Pause (Space)" : `${s}× speed`} — key ${i + 1}`}
						aria-pressed={speed === s}
					>
						<span className="ui-speed-cap">{s === 0 ? <Icon name="pause" size={12} /> : `${s}×`}</span>
					</button>
				))}
			</div>
			<div
				className={`ui-crt ${view.cash < 0 ? "crt-red" : "crt-amber"} ui-cash ${view.cash < 0 ? "is-neg" : ""}`}
				title={view.bankrupt ? "Bankrupt!" : "Available cash"}
			>
				<span className="ui-label">TREASURY</span>
				<span className="ui-big">{fmtMoney(view.cash)}</span>
			</div>
			<div className="ui-gauges">
				<PueGauge pue={view.pue} />
				<Gauge
					label="IT LOAD"
					min={0}
					max={itMax}
					majors={4}
					minors={5}
					face="kW"
					zones={headroom > 0 && headroom < itMax ? [{ from: headroom, to: itMax, color: "var(--red)" }] : []}
					needles={[{ value: view.totalKw, kind: "ink" }, { value: view.itKw }]}
					title={`Red needle: IT load ${fmtPower(view.itKw)}. Black needle: total facility draw ${fmtPower(view.totalKw)}. Supply capacity ${fmtPower(headroom)} (red band = over capacity).`}
					sub={<>of {fmtPower(view.totalKw)}</>}
				>
					{fmtPower(view.itKw)}
				</Gauge>
				<Gauge
					label="NET TODAY"
					min={-flowMax}
					max={flowMax}
					majors={4}
					minors={4}
					face="$/day"
					ends={["−", "+"]}
					zones={[
						{ from: -flowMax, to: 0, color: "var(--red)" },
						{ from: 0, to: flowMax, color: "var(--green-dim)" },
					]}
					needles={[{ value: todayNet }]}
					title={`Cash flow today: revenue − energy − upkeep − construction − penalties = ${fmtMoney(todayNet)}. Scale ±${fmtMoney(flowMax)}.`}
					tone={todayNet < 0 ? "red" : "green"}
				>
					{todayNet > 0 ? "+" : ""}
					{fmtMoney(todayNet)}
				</Gauge>
			</div>
			<div className="ui-crt crt-amber ui-statbank">
				<Stat label="COMPUTE" title="PFLOPS currently delivered">
					{fmtPflops(view.pflops)}
				</Stat>
				<Stat label="UPTIME" title="Rolling 24h rack uptime" className={view.uptime < 0.99 ? "is-warn" : "is-ok"}>
					{fmtPct(view.uptime, 2)}
				</Stat>
			</div>
			<div className="ui-tier" title={`Clearance tier ${view.tier} of ${maxTier}`}>
				<span className="ui-dymo">CLEARANCE</span>
				<span className="ui-lamps">
					{Array.from({ length: maxTier }, (_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: fixed row of tier lamps; index is the identity
						<Lamp key={i} on={i < view.tier} tone="amber" plain />
					))}
				</span>
			</div>
			<div className="ui-grow" />
			<div className="ui-crt crt-amber ui-statbank ui-env">
				<Stat label="OUTSIDE" title="Outdoor ambient temperature">
					{fmtTemp(view.ambientC, 1)}
				</Stat>
				<Stat label="GRID $/kWh" title="Current energy price" className="ui-hide-narrow">
					{view.energyPrice.toFixed(3)}
				</Stat>
			</div>
			<div className="ui-sysbox">
				<button type="button" className="ui-btn ui-menu-btn" onClick={openMenu} title="System menu (Esc): save, load, settings, controls">
					Menu
				</button>
				<span className={`ui-savelamp tone-${lamp.tone}`} title={state.saveStatus.error ?? "Last successful save"} role="status">
					<Lamp on={lamp.lit} tone={lamp.tone} blink={lamp.blink} />
					<span className="ui-savelamp-text">{lamp.text}</span>
				</span>
			</div>
			<Toggle on={!muted} onClick={() => store.setMuted(!muted)} title={`${muted ? "Unmute" : "Mute"} (M)`} label="AUDIO" className="ui-mute" />
		</header>
	);
}
