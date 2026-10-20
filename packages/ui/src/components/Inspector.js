import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { fmtDuration, fmtEnergy, fmtPct, fmtPflops, fmtPower, fmtTemp } from "../format";
import { pushNotice } from "../notices";
import { bioWords, facilityName, tissueState, traitInfo, organoidBand } from "../bio/bio";
import { rackProblem } from "../objective/diagnose";
import { FormLabel, Icon, Meter, Pill, Row, Swatch, statusLabel, statusTone, Toggle } from "./common";
import { Dial } from "./Dial";
const botStateLabel = {
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
export function OrganoidTemp({ tempC, spec }) {
    const b = organoidBand(spec);
    const lo = Math.floor(b.failLo - 4);
    const hi = Math.ceil(b.failHi + 4);
    const t = tissueState(tempC, spec);
    return (_jsxs("div", { className: "ui-tempgauge", title: `full speed ${b.lo}–${b.hi} °C · slowed to ${b.slowLo}–${b.slowHi} °C · fails beyond ${b.failLo}–${b.failHi} °C`, children: [_jsx(Dial, { size: 64, min: lo, max: hi, majors: 4, minors: 5, face: "\u00B0C", ends: [String(lo), String(hi)], zones: [
                    { from: lo, to: b.failLo, color: "var(--bad)" },
                    { from: b.failLo, to: b.lo, color: "var(--warn)" },
                    { from: b.lo, to: b.hi, color: "var(--good)" },
                    { from: b.hi, to: b.failHi, color: "var(--warn)" },
                    { from: b.failHi, to: hi, color: "var(--bad)" },
                ], needles: [{ value: tempC }], title: `Tissue temperature: ${fmtTemp(tempC)}` }), _jsxs("div", { className: `ui-crt crt-${t.kind === "inBand" ? "green" : t.kind === "slow" ? "amber" : "red"} ui-tempgauge-crt`, children: [_jsx("span", { className: "ui-label", children: "Tissue temp" }), _jsx("span", { className: "ui-big", children: fmtTemp(tempC) }), _jsxs("span", { className: "ui-tempgauge-legend", children: ["band ", b.lo, "\u2013", b.hi] })] })] }));
}
/** Round temperature dial (ok / throttle / trip bands) with a CRT readout. */
export function TempBar({ tempC, thermal, label = "Die temp" }) {
    const lo = 15;
    const hi = thermal.tripC + 10;
    const tone = tempC >= thermal.tripC ? "red" : tempC >= thermal.okC ? "amber" : "green";
    return (_jsxs("div", { className: "ui-tempgauge", title: `ok ≤ ${thermal.okC}°C · throttle ${thermal.throttleC}°C · trip ${thermal.tripC}°C`, children: [_jsx(Dial, { size: 64, min: lo, max: hi, majors: 4, minors: 5, face: "\u00B0C", ends: [String(lo), String(hi)], zones: [
                    { from: thermal.okC, to: thermal.throttleC, color: "var(--amber)" },
                    { from: thermal.throttleC, to: thermal.tripC, color: "var(--sodium)" },
                    { from: thermal.tripC, to: hi, color: "var(--red)" },
                ], needles: [{ value: tempC }], title: `${label}: ${fmtTemp(tempC)}` }), _jsxs("div", { className: `ui-crt crt-${tone} ui-tempgauge-crt`, children: [_jsx("span", { className: "ui-label", children: label }), _jsx("span", { className: "ui-big", children: fmtTemp(tempC) }), _jsxs("span", { className: "ui-tempgauge-legend", children: ["ok\u2264", thermal.okC, " \u00B7 thr ", thermal.throttleC, " \u00B7 trip ", thermal.tripC] })] })] }));
}
function NetSummaries({ view, f }) {
    const pn = f.powerNet === null ? undefined : view.powerNets.find((n) => n.id === f.powerNet);
    const cn = f.coolantNet === null ? undefined : view.coolantNets.find((n) => n.id === f.coolantNet);
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "ui-section ui-crt crt-amber", children: [_jsxs("div", { className: "ui-section-title", children: ["Power net ", pn ? `#${pn.id}` : "", pn && _jsx(Pill, { status: true, tone: pn.satisfaction >= 1 ? "good" : pn.satisfaction > 0 ? "warn" : "error", children: fmtPct(pn.satisfaction, 0) })] }), pn ? (_jsxs(_Fragment, { children: [_jsxs(Row, { k: "Demand / supply", children: [fmtPower(pn.demandKw), " / ", fmtPower(pn.supplyKw)] }), _jsx(Meter, { value: pn.supplyKw > 0 ? pn.demandKw / pn.supplyKw : 1, tone: pn.demandKw > pn.supplyKw ? "error" : "cyan" }), _jsx(Row, { k: "Grid import", children: fmtPower(pn.gridImportKw) }), pn.storageCapacityKwh > 0 && (_jsxs(Row, { k: "UPS stored", children: [fmtEnergy(pn.storedKwh), " / ", fmtEnergy(pn.storageCapacityKwh)] }))] })) : (_jsx("div", { className: "ui-empty", children: "Not connected \u2014 lay a power conduit under it." }))] }), (cn || f.coolantNet !== null || f.status === "noCoolant") && (_jsxs("div", { className: "ui-section ui-crt crt-amber", children: [_jsxs("div", { className: "ui-section-title", children: ["Coolant net ", cn ? `#${cn.id}` : "", cn && _jsx(Pill, { status: true, tone: cn.loadKw <= cn.capacityKw ? "good" : "error", children: fmtPct(cn.capacityKw ? cn.loadKw / cn.capacityKw : 1, 0) })] }), cn ? (_jsxs(_Fragment, { children: [_jsxs(Row, { k: "Load / capacity", children: [fmtPower(cn.loadKw), " / ", fmtPower(cn.capacityKw)] }), _jsx(Meter, { value: cn.capacityKw ? cn.loadKw / cn.capacityKw : 1, tone: cn.loadKw > cn.capacityKw ? "error" : "cyan" }), _jsx(Row, { k: "Supply temp", children: fmtTemp(cn.supplyTempC) })] })) : (_jsx("div", { className: "ui-empty", children: "No coolant loop." }))] }))] }));
}
function FacilityInspector({ store, content, state, setUi, f }) {
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
    const send = (r) => {
        if (!r.ok)
            pushNotice({ text: r.reason, severity: "warn", key: `insp:${r.reason}` });
    };
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "ui-insp-head", children: [def && _jsx(Swatch, { color: def.color, accent: def.accent, size: 28 }), _jsxs("div", { className: "ui-insp-name", children: [_jsx("span", { children: facilityName(content, f.defId, f.grown, horror) }), _jsxs("span", { className: "ui-dim", children: [f.grown ? `${def?.name ?? f.defId} · ` : "", "#", f.id, " \u00B7 F", f.floor, " x", f.x, f.width > 1 ? `–${f.x + f.width - 1}` : ""] })] }), _jsx(Pill, { status: true, tone: statusTone[f.status], children: statusLabel[f.status] })] }), problem && _jsx("p", { className: `ui-insp-why tone-${statusTone[f.status]}`, children: problem }), organoid ? _jsx(OrganoidTemp, { tempC: f.tempC, spec: organoid }) : _jsx(TempBar, { tempC: f.tempC, thermal: thermal, label: def?.rack ? "Die temp" : "Air temp" }), tissue && _jsx("p", { className: `ui-tissue is-${tissue.kind === "inBand" ? "ok" : tissue.kind}`, children: tissue.text }), _jsxs("div", { className: "ui-section ui-crt crt-amber", children: [def?.rack && (_jsxs(_Fragment, { children: [_jsx(Row, { k: "Clock", children: fmtPct(f.clock, 0) }), _jsx(Meter, { value: f.clock, tone: f.clock < 0.999 ? "warn" : "good" })] })), _jsx(Row, { k: "Health", children: fmtPct(f.health, 0) }), _jsx(Meter, { value: f.health, tone: f.health < 0.5 ? "error" : f.health < 0.9 ? "warn" : "good" }), _jsx(Row, { k: "Power draw", children: fmtPower(f.powerKw) }), _jsx(Row, { k: def?.cooling ? "Heat removed" : "Heat out", children: fmtPower(f.heatKw) }), def?.rack && def.rack.pflops > 0 && _jsx(Row, { k: "Compute", children: fmtPflops(def.rack.pflops * f.clock * (f.status === "ok" || f.status === "throttled" ? 1 : 0)) }), f.running !== undefined && _jsx(Row, { k: "Genset", children: f.running ? _jsx("span", { className: "is-warn", children: "running" }) : "standby" }), f.charge !== undefined && (_jsxs(_Fragment, { children: [_jsx(Row, { k: "UPS charge", children: fmtPct(f.charge, 0) }), _jsx(Meter, { value: f.charge, tone: f.charge < 0.2 ? "error" : "good" })] })), f.stored !== undefined && _jsx(Row, { k: "Parts stored", children: f.stored }), def?.rack && (_jsx(Row, { k: "Job", children: job ? (_jsxs("button", { type: "button", className: "ui-link", onClick: () => setUi({ drawer: "contracts", focusJobId: job.id }), children: [job.clientName, " \u00B7 ", job.kind] })) : (_jsx("span", { className: "ui-dim", children: "none" })) })), wo && (_jsxs(Row, { k: "Work order", children: ["#", wo.id, " \u00B7 ", wo.botId === null ? "unassigned" : `bot #${wo.botId}`, " \u00B7 ", fmtDuration(view.tick - wo.createdAt), " ago"] })), f.contamination > 0.005 && (_jsxs(_Fragment, { children: [_jsx(Row, { k: words.contamination, children: fmtPct(f.contamination, 0) }), _jsx(Meter, { value: f.contamination, tone: f.contamination > 0.5 ? "error" : "warn" })] })), _jsx(Row, { k: "Nets", children: _jsxs("span", { className: "ui-dim", children: ["power ", f.powerNet ?? "—", " \u00B7 coolant ", f.coolantNet ?? "—", f.nutrientNet !== null ? ` · nutrient ${f.nutrientNet}` : ""] }) })] }), _jsx(NetSummaries, { view: view, f: f }), _jsxs("div", { className: "ui-insp-actions", children: [_jsx(Toggle, { on: f.enabled, lamp: "green", label: "MAINS", title: f.enabled ? "Disable (switch off)" : "Enable (switch on)", onClick: () => send(store.dispatch({ type: "setEnabled", facilityId: f.id, enabled: !f.enabled })) }), _jsxs("button", { type: "button", className: "ui-btn is-danger ui-decom", onClick: () => {
                            const r = store.dispatch({ type: "demolish", floor: f.floor, x: f.x });
                            send(r);
                            if (r.ok)
                                store.setSelection(null);
                        }, children: [_jsx(Icon, { name: "demolish", size: 12 }), " Demolish"] })] })] }));
}
export function Inspector(props) {
    const { store, content, state } = props;
    const { selection: sel, view } = state;
    if (!sel)
        return null;
    let body = null;
    if (sel.kind === "facility") {
        const f = view.facilities.find((f) => f.id === sel.id);
        if (f)
            body = _jsx(FacilityInspector, { ...props, f: f });
    }
    else if (sel.kind === "bot") {
        const b = view.bots.find((b) => b.id === sel.id);
        if (b) {
            const def = content.bots[b.defId];
            const wo = b.workOrderId === null ? undefined : view.workOrders.find((w) => w.id === b.workOrderId);
            const target = wo && view.facilities.find((f) => f.id === wo.facilityId);
            body = (_jsxs(_Fragment, { children: [_jsxs("div", { className: "ui-insp-head", children: [_jsx("span", { className: "ui-botchip", style: { background: def?.color ?? "var(--steel)" } }), _jsxs("div", { className: "ui-insp-name", children: [_jsx("span", { children: def?.name ?? b.defId }), _jsxs("span", { className: "ui-dim", children: ["#", b.id, " \u00B7 F", Math.round(b.floor), " x", b.x.toFixed(1)] })] }), _jsx(Pill, { tone: b.state === "idle" || b.state === "charging" ? "dim" : "cyan", children: botStateLabel[b.state] })] }), b.trait && (_jsxs("p", { className: "ui-trait", title: traitInfo(b.trait, state.settings.horrorIntensity).effect, children: [_jsx(Pill, { tone: "warn", children: traitInfo(b.trait, state.settings.horrorIntensity).label }), " ", traitInfo(b.trait, state.settings.horrorIntensity).effect] })), _jsxs("div", { className: "ui-section ui-crt crt-amber", children: [_jsx(Row, { k: "Battery", children: fmtPct(b.battery, 0) }), _jsx(Meter, { value: b.battery, tone: b.battery < 0.2 ? "error" : b.battery < 0.5 ? "warn" : "good" }), _jsx(Row, { k: "Carrying part", children: b.carrying ? "yes" : "no" }), _jsx(Row, { k: "Work order", children: wo ? (target ? (_jsxs("button", { type: "button", className: "ui-link", onClick: () => store.focus({ x: target.x, floor: target.floor }), children: ["#", wo.id, " \u2192 ", content.facilities[target.defId]?.name ?? target.defId, " F", target.floor] })) : (`#${wo.id}`)) : (_jsx("span", { className: "ui-dim", children: "none" })) })] })] }));
        }
    }
    else {
        const l = view.lifts.find((l) => l.id === sel.id);
        if (l) {
            body = (_jsxs(_Fragment, { children: [_jsxs("div", { className: "ui-insp-head", children: [_jsx("span", { className: "ui-item-icon ic-lift", children: _jsx(Icon, { name: "lift", size: 16 }) }), _jsxs("div", { className: "ui-insp-name", children: [_jsx("span", { children: "Service lift" }), _jsxs("span", { className: "ui-dim", children: ["#", l.id, " \u00B7 column x", l.x] })] }), _jsx(Pill, { tone: l.dir === 0 ? "dim" : "cyan", children: l.dir === 0 ? (l.doorsOpen ? "doors open" : "parked") : l.dir > 0 ? "going up" : "going down" })] }), _jsxs("div", { className: "ui-section ui-crt crt-amber", children: [_jsxs(Row, { k: "Floors", children: ["F", l.floorMin, " \u2013 F", l.floorMax, " (", l.floorMax - l.floorMin + 1, ")"] }), _jsxs(Row, { k: "Car at", children: ["F", l.carFloor.toFixed(1)] }), _jsx("div", { className: "ui-liftshaft", children: Array.from({ length: l.floorMax - l.floorMin + 1 }, (_, i) => {
                                    const fl = l.floorMax - i;
                                    return (_jsx("span", { className: Math.round(l.carFloor) === fl ? "on" : "", children: fl }, fl));
                                }) }), _jsxs(Row, { k: "Riders", children: [l.riders, " / ", content.lift.capacity] })] })] }));
        }
    }
    if (!body)
        return null;
    return (_jsxs("aside", { className: "ui-inspector ui-panel", children: [_jsxs("div", { className: "ui-panel-title", children: [_jsx(FormLabel, { children: "Details" }), _jsx("button", { type: "button", className: "ui-btn ui-icon-btn ui-mini", onClick: () => store.setSelection(null), title: "Close", children: _jsx(Icon, { name: "close", size: 11 }) })] }), _jsx("div", { className: "ui-insp-body", children: body })] }));
}
