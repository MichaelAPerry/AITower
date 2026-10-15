import type { ReactNode } from "react";
import type { Balance } from "@aitower/content";
import type { BotState, FacilityView, SimView } from "@aitower/sim";
import { clamp01, fmtDuration, fmtEnergy, fmtPct, fmtPflops, fmtPower, fmtTemp } from "../format";
import { pushNotice } from "../notices";
import { Icon, Meter, Pill, Row, Swatch, statusLabel, statusTone } from "./common";
import type { PanelProps } from "./context";

const botStateLabel: Record<BotState, string> = {
	idle: "idle",
	toDepot: "fetching part",
	toTarget: "to repair",
	repairing: "repairing",
	toCharger: "to charger",
	charging: "charging",
	waitingLift: "waiting lift",
	riding: "riding lift",
};

/** Temperature bar with ok / throttle / trip markers. */
export function TempBar({ tempC, thermal }: { tempC: number; thermal: Balance["thermal"] }) {
	const lo = 15;
	const hi = thermal.tripC + 10;
	const pos = (c: number): string => `${clamp01((c - lo) / (hi - lo)) * 100}%`;
	const tone = tempC >= thermal.tripC ? "error" : tempC >= thermal.okC ? "warn" : "good";
	return (
		<div className="ui-tempbar" title={`ok ≤ ${thermal.okC}°C · throttle ${thermal.throttleC}°C · trip ${thermal.tripC}°C`}>
			<div className="ui-tempbar-track">
				<div className="ui-tempbar-zone z-ok" style={{ left: 0, width: pos(thermal.okC) }} />
				<div className="ui-tempbar-zone z-warm" style={{ left: pos(thermal.okC), width: `calc(${pos(thermal.throttleC)} - ${pos(thermal.okC)})` }} />
				<div className="ui-tempbar-zone z-hot" style={{ left: pos(thermal.throttleC), width: `calc(${pos(thermal.tripC)} - ${pos(thermal.throttleC)})` }} />
				<div className="ui-tempbar-zone z-trip" style={{ left: pos(thermal.tripC), right: 0 }} />
				<div className={`ui-tempbar-needle tone-${tone}`} style={{ left: pos(tempC) }} />
			</div>
			<div className="ui-tempbar-ticks">
				<span style={{ left: pos(thermal.okC) }}>{thermal.okC}</span>
				<span style={{ left: pos(thermal.throttleC) }}>{thermal.throttleC}</span>
				<span style={{ left: pos(thermal.tripC) }}>{thermal.tripC}</span>
			</div>
		</div>
	);
}

function NetSummaries({ view, f }: { view: SimView; f: FacilityView }) {
	const pn = f.powerNet === null ? undefined : view.powerNets.find((n) => n.id === f.powerNet);
	const cn = f.coolantNet === null ? undefined : view.coolantNets.find((n) => n.id === f.coolantNet);
	return (
		<>
			<div className="ui-section">
				<div className="ui-section-title">
					Power net {pn ? `#${pn.id}` : ""}
					{pn && <Pill tone={pn.satisfaction >= 1 ? "good" : pn.satisfaction > 0 ? "warn" : "error"}>{fmtPct(pn.satisfaction, 0)}</Pill>}
				</div>
				{pn ? (
					<>
						<Row k="Demand / supply">
							{fmtPower(pn.demandKw)} / {fmtPower(pn.supplyKw)}
						</Row>
						<Meter value={pn.supplyKw > 0 ? pn.demandKw / pn.supplyKw : 1} tone={pn.demandKw > pn.supplyKw ? "error" : "cyan"} />
						<Row k="Grid import">{fmtPower(pn.gridImportKw)}</Row>
						{pn.storageCapacityKwh > 0 && (
							<Row k="UPS stored">
								{fmtEnergy(pn.storedKwh)} / {fmtEnergy(pn.storageCapacityKwh)}
							</Row>
						)}
					</>
				) : (
					<div className="ui-empty">Not connected — lay a power conduit under it.</div>
				)}
			</div>
			{(cn || f.coolantNet !== null || f.status === "noCoolant") && (
				<div className="ui-section">
					<div className="ui-section-title">
						Coolant net {cn ? `#${cn.id}` : ""}
						{cn && <Pill tone={cn.loadKw <= cn.capacityKw ? "good" : "error"}>{fmtPct(cn.capacityKw ? cn.loadKw / cn.capacityKw : 1, 0)}</Pill>}
					</div>
					{cn ? (
						<>
							<Row k="Load / capacity">
								{fmtPower(cn.loadKw)} / {fmtPower(cn.capacityKw)}
							</Row>
							<Meter value={cn.capacityKw ? cn.loadKw / cn.capacityKw : 1} tone={cn.loadKw > cn.capacityKw ? "error" : "cyan"} />
							<Row k="Supply temp">{fmtTemp(cn.supplyTempC)}</Row>
						</>
					) : (
						<div className="ui-empty">No coolant loop.</div>
					)}
				</div>
			)}
		</>
	);
}

function FacilityInspector({ store, content, state, setUi, f }: PanelProps & { f: FacilityView }) {
	const { view } = state;
	const def = content.facilities[f.defId];
	const thermal = content.balance.thermal;
	const job = f.jobId === null ? undefined : view.jobs.find((j) => j.id === f.jobId);
	const wo = view.workOrders.find((w) => w.facilityId === f.id);
	const send = (r: ReturnType<typeof store.dispatch>): void => {
		if (!r.ok) pushNotice({ text: r.reason, severity: "warn", key: `insp:${r.reason}` });
	};
	return (
		<>
			<div className="ui-insp-head">
				{def && <Swatch color={def.color} accent={def.accent} size={28} />}
				<div className="ui-insp-name">
					<span>{def?.name ?? f.defId}</span>
					<span className="ui-dim">
						#{f.id} · F{f.floor} x{f.x}
						{f.width > 1 ? `–${f.x + f.width - 1}` : ""}
					</span>
				</div>
				<Pill tone={statusTone[f.status]}>{statusLabel[f.status]}</Pill>
			</div>
			<div className="ui-section">
				<Row k={def?.rack ? "Die temp" : "Air temp"}>
					<span className={f.tempC >= thermal.tripC ? "is-neg" : f.tempC >= thermal.okC ? "is-warn" : ""}>{fmtTemp(f.tempC)}</span>
				</Row>
				{def?.rack && <TempBar tempC={f.tempC} thermal={thermal} />}
				{def?.rack && (
					<>
						<Row k="Clock">{fmtPct(f.clock, 0)}</Row>
						<Meter value={f.clock} tone={f.clock < 0.999 ? "warn" : "good"} />
					</>
				)}
				<Row k="Health">{fmtPct(f.health, 0)}</Row>
				<Meter value={f.health} tone={f.health < 0.5 ? "error" : f.health < 0.9 ? "warn" : "good"} />
				<Row k="Power draw">{fmtPower(f.powerKw)}</Row>
				<Row k={def?.cooling ? "Heat removed" : "Heat out"}>{fmtPower(f.heatKw)}</Row>
				{def?.rack && def.rack.pflops > 0 && <Row k="Compute">{fmtPflops(def.rack.pflops * f.clock * (f.status === "ok" ? 1 : 0))}</Row>}
				{f.running !== undefined && <Row k="Genset">{f.running ? <span className="is-warn">running</span> : "standby"}</Row>}
				{f.charge !== undefined && (
					<>
						<Row k="UPS charge">{fmtPct(f.charge, 0)}</Row>
						<Meter value={f.charge} tone={f.charge < 0.2 ? "error" : "good"} />
					</>
				)}
				{f.stored !== undefined && <Row k="Parts stored">{f.stored}</Row>}
				{def?.rack && (
					<Row k="Job">
						{job ? (
							<button type="button" className="ui-link" onClick={() => setUi({ bottomTab: "jobs", bottomOpen: true, focusJobId: job.id })}>
								{job.clientName} · {job.kind}
							</button>
						) : (
							<span className="ui-dim">none</span>
						)}
					</Row>
				)}
				{wo && (
					<Row k="Work order">
						#{wo.id} · {wo.botId === null ? "unassigned" : `bot #${wo.botId}`} · {fmtDuration(view.tick - wo.createdAt)} ago
					</Row>
				)}
				<Row k="Nets">
					<span className="ui-dim">
						power {f.powerNet ?? "—"} · coolant {f.coolantNet ?? "—"}
					</span>
				</Row>
			</div>
			<NetSummaries view={view} f={f} />
			<div className="ui-insp-actions">
				<button type="button" className="ui-btn" onClick={() => send(store.dispatch({ type: "setEnabled", facilityId: f.id, enabled: !f.enabled }))}>
					{f.enabled ? "Disable" : "Enable"}
				</button>
				<button
					type="button"
					className="ui-btn is-danger"
					onClick={() => {
						const r = store.dispatch({ type: "demolish", floor: f.floor, x: f.x });
						send(r);
						if (r.ok) store.setSelection(null);
					}}
				>
					<Icon name="demolish" size={12} /> Demolish
				</button>
			</div>
		</>
	);
}

export function Inspector(props: PanelProps) {
	const { store, content, state } = props;
	const { selection: sel, view } = state;
	if (!sel) return null;
	let body: ReactNode = null;
	if (sel.kind === "facility") {
		const f = view.facilities.find((f) => f.id === sel.id);
		if (f) body = <FacilityInspector {...props} f={f} />;
	} else if (sel.kind === "bot") {
		const b = view.bots.find((b) => b.id === sel.id);
		if (b) {
			const def = content.bots[b.defId];
			const wo = b.workOrderId === null ? undefined : view.workOrders.find((w) => w.id === b.workOrderId);
			const target = wo && view.facilities.find((f) => f.id === wo.facilityId);
			body = (
				<>
					<div className="ui-insp-head">
						<span className="ui-botchip" style={{ background: def?.color ?? "#8fd" }} />
						<div className="ui-insp-name">
							<span>{def?.name ?? b.defId}</span>
							<span className="ui-dim">
								#{b.id} · F{Math.round(b.floor)} x{b.x.toFixed(1)}
							</span>
						</div>
						<Pill tone={b.state === "idle" || b.state === "charging" ? "dim" : "cyan"}>{botStateLabel[b.state]}</Pill>
					</div>
					<div className="ui-section">
						<Row k="Battery">{fmtPct(b.battery, 0)}</Row>
						<Meter value={b.battery} tone={b.battery < 0.2 ? "error" : b.battery < 0.5 ? "warn" : "good"} />
						<Row k="Carrying part">{b.carrying ? "yes" : "no"}</Row>
						<Row k="Work order">
							{wo ? (
								target ? (
									<button type="button" className="ui-link" onClick={() => store.focus({ x: target.x, floor: target.floor })}>
										#{wo.id} → {content.facilities[target.defId]?.name ?? target.defId} F{target.floor}
									</button>
								) : (
									`#${wo.id}`
								)
							) : (
								<span className="ui-dim">none</span>
							)}
						</Row>
					</div>
				</>
			);
		}
	} else {
		const l = view.lifts.find((l) => l.id === sel.id);
		if (l) {
			body = (
				<>
					<div className="ui-insp-head">
						<span className="ui-item-icon ic-lift">
							<Icon name="lift" size={16} />
						</span>
						<div className="ui-insp-name">
							<span>Service lift</span>
							<span className="ui-dim">
								#{l.id} · column x{l.x}
							</span>
						</div>
						<Pill tone={l.dir === 0 ? "dim" : "cyan"}>{l.dir === 0 ? (l.doorsOpen ? "doors open" : "parked") : l.dir > 0 ? "going up" : "going down"}</Pill>
					</div>
					<div className="ui-section">
						<Row k="Floors">
							F{l.floorMin} – F{l.floorMax} ({l.floorMax - l.floorMin + 1})
						</Row>
						<Row k="Car at">F{l.carFloor.toFixed(1)}</Row>
						<div className="ui-liftshaft">
							{Array.from({ length: l.floorMax - l.floorMin + 1 }, (_, i) => {
								const fl = l.floorMax - i;
								return (
									<span key={fl} className={Math.round(l.carFloor) === fl ? "on" : ""}>
										{fl}
									</span>
								);
							})}
						</div>
						<Row k="Riders">
							{l.riders} / {content.lift.capacity}
						</Row>
					</div>
				</>
			);
		}
	}
	if (!body) return null;
	return (
		<aside className="ui-inspector ui-panel">
			<div className="ui-panel-title">
				<span>Inspector</span>
				<button type="button" className="ui-btn ui-icon-btn ui-mini" onClick={() => store.setSelection(null)} title="Close">
					<Icon name="close" size={11} />
				</button>
			</div>
			<div className="ui-insp-body">{body}</div>
		</aside>
	);
}
