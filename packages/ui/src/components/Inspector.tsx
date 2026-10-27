import type { ReactNode } from "react";
import { type Balance, BRANCH_NAME, type ContentDB, isRetrofittable, retrofitCost, retrofitTarget, treeOf, TREES, upgradeCost, upgradesTo } from "@aitower/content";
import type { GameStore } from "@aitower/shared";
import type { BotState, FacilityView, SimView } from "@aitower/sim";
import { fmtDuration, fmtEnergy, fmtMoney, fmtPct, fmtPflops, fmtPower, fmtTemp } from "../format";
import { pushNotice } from "../notices";
import { bioWords, facilityName, tissueState, traitInfo, organoidBand } from "../bio/bio";
import { rackProblem } from "../objective/diagnose";
import { FormLabel, Icon, Meter, Pill, Row, Swatch, statusLabel, statusTone, Toggle } from "./common";
import type { PanelProps } from "./context";
import { Dial } from "./Dial";
import { TREE_COLOR, TREE_LONG } from "../soul/soul";

const botStateLabel: Record<BotState, string> = {
	idle: "idle",
	toDepot: "fetching part",
	toTarget: "to repair",
	repairing: "repairing",
	toCharger: "to charger",
	charging: "charging",
	waitingLift: "waiting lift",
	riding: "riding lift",
	flying: "flying",
};

/** Dial for organoid tissue: the green band is full speed, amber slows the tissue, red fails it. */
export function OrganoidTemp({ tempC, spec }: { tempC: number; spec: Parameters<typeof organoidBand>[0] }) {
	const b = organoidBand(spec);
	const lo = Math.floor(b.failLo - 4);
	const hi = Math.ceil(b.failHi + 4);
	const t = tissueState(tempC, spec);
	return (
		<div className="ui-tempgauge" title={`full speed ${b.lo}–${b.hi} °C · slowed to ${b.slowLo}–${b.slowHi} °C · fails beyond ${b.failLo}–${b.failHi} °C`}>
			<Dial
				size={64}
				min={lo}
				max={hi}
				majors={4}
				minors={5}
				face="°C"
				ends={[String(lo), String(hi)]}
				zones={[
					{ from: lo, to: b.failLo, color: "var(--bad)" },
					{ from: b.failLo, to: b.lo, color: "var(--warn)" },
					{ from: b.lo, to: b.hi, color: "var(--good)" },
					{ from: b.hi, to: b.failHi, color: "var(--warn)" },
					{ from: b.failHi, to: hi, color: "var(--bad)" },
				]}
				needles={[{ value: tempC }]}
				title={`Tissue temperature: ${fmtTemp(tempC)}`}
			/>
			<div className={`ui-crt crt-${t.kind === "inBand" ? "green" : t.kind === "slow" ? "amber" : "red"} ui-tempgauge-crt`}>
				<span className="ui-label">Tissue temp</span>
				<span className="ui-big">{fmtTemp(tempC)}</span>
				<span className="ui-tempgauge-legend">band {b.lo}–{b.hi}</span>
			</div>
		</div>
	);
}

/** Round temperature dial (ok / throttle / trip bands) with a CRT readout. */
export function TempBar({ tempC, thermal, label = "Die temp" }: { tempC: number; thermal: Balance["thermal"]; label?: string }) {
	const lo = 15;
	const hi = thermal.tripC + 10;
	const tone = tempC >= thermal.tripC ? "red" : tempC >= thermal.okC ? "amber" : "green";
	return (
		<div className="ui-tempgauge" title={`ok ≤ ${thermal.okC}°C · throttle ${thermal.throttleC}°C · trip ${thermal.tripC}°C`}>
			<Dial
				size={64}
				min={lo}
				max={hi}
				majors={4}
				minors={5}
				face="°C"
				ends={[String(lo), String(hi)]}
				zones={[
					{ from: thermal.okC, to: thermal.throttleC, color: "var(--amber)" },
					{ from: thermal.throttleC, to: thermal.tripC, color: "var(--sodium)" },
					{ from: thermal.tripC, to: hi, color: "var(--red)" },
				]}
				needles={[{ value: tempC }]}
				title={`${label}: ${fmtTemp(tempC)}`}
			/>
			<div className={`ui-crt crt-${tone} ui-tempgauge-crt`}>
				<span className="ui-label">{label}</span>
				<span className="ui-big">{fmtTemp(tempC)}</span>
				<span className="ui-tempgauge-legend">
					ok≤{thermal.okC} · thr {thermal.throttleC} · trip {thermal.tripC}
				</span>
			</div>
		</div>
	);
}

function NetSummaries({ view, f }: { view: SimView; f: FacilityView }) {
	const pn = f.powerNet === null ? undefined : view.powerNets.find((n) => n.id === f.powerNet);
	const cn = f.coolantNet === null ? undefined : view.coolantNets.find((n) => n.id === f.coolantNet);
	return (
		<>
			<div className="ui-section ui-crt crt-amber">
				<div className="ui-section-title">
					Power net {pn ? `#${pn.id}` : ""}
					{pn && <Pill status tone={pn.satisfaction >= 1 ? "good" : pn.satisfaction > 0 ? "warn" : "error"}>{fmtPct(pn.satisfaction, 0)}</Pill>}
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
				<div className="ui-section ui-crt crt-amber">
					<div className="ui-section-title">
						Coolant net {cn ? `#${cn.id}` : ""}
						{cn && <Pill status tone={cn.loadKw <= cn.capacityKw ? "good" : "error"}>{fmtPct(cn.capacityKw ? cn.loadKw / cn.capacityKw : 1, 0)}</Pill>}
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

/**
 * Upgrade actions: one button per item this facility upgrades to (`upgradesFrom`), with the price (new cost less half of the old one).
 * The sim decides whether it is open (Level, research, commit, bond, room beside it); its reason is shown when it is not.
 */
export function UpgradeActions({ store, content, f }: { store: GameStore; content: ContentDB; f: FacilityView }) {
	const from = content.facilities[f.defId];
	if (!from || f.grown) return null;
	const targets = upgradesTo(content, f.defId);
	if (targets.length === 0) return null;
	return (
		<div className="ui-upgrade" data-tut="upgrade">
			{targets.map((to) => {
				const cmd = { type: "upgradeFacility", facilityId: f.id, defId: to.id } as const;
				const can = store.canBuild(cmd);
				return (
					<div key={to.id} className="ui-upgrade-row">
						<button
							type="button"
							className="ui-btn"
							disabled={!can.ok}
							title={can.ok ? `Swap in place for ${to.name}` : can.reason}
							onClick={() => {
								const r = store.dispatch(cmd);
								if (!r.ok) pushNotice({ text: r.reason, severity: "warn", key: `upgrade:${r.reason}` });
							}}
						>
							Upgrade to {to.name} · {fmtMoney(upgradeCost(from, to))}
						</button>
						{!can.ok && <p className="ui-upgrade-why">{can.reason}</p>}
					</div>
				);
			})}
		</div>
	);
}

/**
 * Retrofit (docs/REFRAME.md): three branch buttons, one per tree. Each says what the rack becomes, the price (the new rack less half of
 * this one) and, when the sim says no, why (Level, research, the pipe under it, a closed tree, cash). A base rack goes to rung 1 of the
 * branch; a tree rack goes down its own tree; another branch starts again at rung 1.
 */
export function RetrofitSection({ store, content, f, onTrees }: { store: GameStore; content: ContentDB; f: FacilityView; onTrees?: () => void }) {
	const from = content.facilities[f.defId];
	if (!from || f.grown || !isRetrofittable(from)) return null;
	const own = treeOf(from);
	return (
		<div className="ui-retrofit" data-tut="retrofit">
			<div className="ui-retrofit-head">
				<span className="ui-label">Retrofit</span>
				{onTrees && (
					<button type="button" className="ui-link" onClick={onTrees}>
						The three trees
					</button>
				)}
			</div>
			<p className="ui-dim ui-retrofit-note">{own ? `This is a ${BRANCH_NAME[own]} rack, rung ${from.rung}. It scores only for ${TREE_LONG[own]}.` : "A base rack scores for no tree. Retrofit it in place to start scoring."}</p>
			{TREES.map((tree) => {
				const t = retrofitTarget(content, from, tree);
				const name = BRANCH_NAME[tree];
				if (!t) {
					return (
						<div key={tree} className="ui-retrofit-row is-done" data-tree={tree} style={{ ["--tree" as string]: TREE_COLOR[tree] }}>
							<button type="button" className="ui-btn ui-retrofit-btn" disabled>
								{name}
							</button>
							<p className="ui-upgrade-why">Already the last rung of {TREE_LONG[tree]}.</p>
						</div>
					);
				}
				const cmd = { type: "retrofit", facilityId: f.id, tree } as const;
				const can = store.canBuild(cmd);
				const cost = retrofitCost(content, from, t.to);
				return (
					<div key={tree} className={`ui-retrofit-row ${can.ok ? "" : "is-locked"}`} data-tree={tree} style={{ ["--tree" as string]: TREE_COLOR[tree] }}>
						<button
							type="button"
							className="ui-btn ui-retrofit-btn"
							disabled={!can.ok}
							title={can.ok ? `Retrofit in place to ${t.to.name}` : can.reason}
							onClick={() => {
								const r = store.dispatch(cmd);
								if (!r.ok) pushNotice({ text: r.reason, severity: "warn", key: `retrofit:${r.reason}` });
							}}
						>
							<b>{name}</b> → {t.to.name} · {fmtMoney(cost)}
						</button>
						<p className="ui-retrofit-what">
							{t.to.rack ? `${fmtPflops(t.to.rack.pflops)} from ${fmtPower(t.to.rack.powerKw)}` : ""}
							{t.switching ? ` · starts again at rung 1 (a ${BRANCH_NAME[own as NonNullable<typeof own>]} rack loses its rungs)` : ` · rung ${t.to.rung}`}
						</p>
						{!can.ok && <p className="ui-upgrade-why">{can.reason}</p>}
					</div>
				);
			})}
		</div>
	);
}

function FacilityInspector({ store, content, state, setUi, f }: PanelProps & { f: FacilityView }) {
	const { view } = state;
	const def = content.facilities[f.defId];
	const thermal = content.balance.thermal;
	const job = f.jobId === null ? undefined : view.jobs.find((j) => j.id === f.jobId);
	const wo = view.workOrders.find((w) => w.facilityId === f.id);
	const problem = rackProblem(view, content, f);
	const horror = state.settings.horrorIntensity;
	const words = bioWords(horror);
	const organoid = def?.rack?.bio;
	const tissue = organoid ? tissueState(f.tempC, organoid) : null;
	const send = (r: ReturnType<typeof store.dispatch>): void => {
		if (!r.ok) pushNotice({ text: r.reason, severity: "warn", key: `insp:${r.reason}` });
	};
	return (
		<>
			<div className="ui-insp-head">
				{def && <Swatch color={def.color} accent={def.accent} size={28} />}
				<div className="ui-insp-name">
					<span>{facilityName(content, f.defId, f.grown, horror)}</span>
					<span className="ui-dim">
						{f.grown ? `${def?.name ?? f.defId} · ` : ""}#{f.id} · F{f.floor} x{f.x}
						{f.width > 1 ? `–${f.x + f.width - 1}` : ""}
					</span>
				</div>
				<Pill status tone={statusTone[f.status]}>{statusLabel[f.status]}</Pill>
			</div>
			{problem && <p className={`ui-insp-why tone-${statusTone[f.status]}`}>{problem}</p>}
			{organoid ? <OrganoidTemp tempC={f.tempC} spec={organoid} /> : <TempBar tempC={f.tempC} thermal={thermal} label={def?.rack ? "Die temp" : "Air temp"} />}
			{tissue && <p className={`ui-tissue is-${tissue.kind === "inBand" ? "ok" : tissue.kind}`}>{tissue.text}</p>}
			<div className="ui-section ui-crt crt-amber">
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
				{def?.rack && def.rack.pflops > 0 && <Row k="Compute">{fmtPflops(def.rack.pflops * f.clock * (f.status === "ok" || f.status === "throttled" ? 1 : 0))}</Row>}
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
							<button type="button" className="ui-link" onClick={() => setUi({ drawer: "contracts", focusJobId: job.id })}>
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
				{f.contamination > 0.005 && (
					<>
						<Row k={words.contamination}>{fmtPct(f.contamination, 0)}</Row>
						<Meter value={f.contamination} tone={f.contamination > 0.5 ? "error" : "warn"} />
					</>
				)}
				<Row k="Nets">
					<span className="ui-dim">
						power {f.powerNet ?? "—"} · coolant {f.coolantNet ?? "—"}
						{f.nutrientNet !== null ? ` · nutrient ${f.nutrientNet}` : ""}
					</span>
				</Row>
			</div>
			<NetSummaries view={view} f={f} />
			<RetrofitSection store={store} content={content} f={f} onTrees={() => setUi({ trees: true })} />
			<UpgradeActions store={store} content={content} f={f} />
			<div className="ui-insp-actions">
				<Toggle
					on={f.enabled}
					lamp="green"
					label="MAINS"
					title={f.enabled ? "Disable (switch off)" : "Enable (switch on)"}
					onClick={() => send(store.dispatch({ type: "setEnabled", facilityId: f.id, enabled: !f.enabled }))}
				/>
				<button
					type="button"
					className="ui-btn is-danger ui-decom"
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
						<span className="ui-botchip" style={{ background: def?.color ?? "var(--steel)" }} />
						<div className="ui-insp-name">
							<span>{def?.name ?? b.defId}</span>
							<span className="ui-dim">
								#{b.id} · F{Math.round(b.floor)} x{b.x.toFixed(1)}
							</span>
						</div>
						<Pill tone={b.state === "idle" || b.state === "charging" ? "dim" : "cyan"}>{botStateLabel[b.state]}</Pill>
					</div>
					{b.trait && (
						<p className="ui-trait" title={traitInfo(b.trait, state.settings.horrorIntensity).effect}>
							<Pill tone="warn">{traitInfo(b.trait, state.settings.horrorIntensity).label}</Pill> {traitInfo(b.trait, state.settings.horrorIntensity).effect}
						</p>
					)}
					<div className="ui-section ui-crt crt-amber">
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
					<div className="ui-section ui-crt crt-amber">
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
				<FormLabel>Details</FormLabel>
				<button type="button" className="ui-btn ui-icon-btn ui-mini" onClick={() => store.setSelection(null)} title="Close">
					<Icon name="close" size={11} />
				</button>
			</div>
			<div className="ui-insp-body">{body}</div>
		</aside>
	);
}
