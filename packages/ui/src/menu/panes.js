import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { normalizeSettings } from "@aitower/shared";
import { useRef, useState } from "react";
import { fmtMoney } from "../format";
import { pushNotice } from "../notices";
import { Toggle, Kbd } from "../components/common";
import { TEXT_SCALE_MAX, TEXT_SCALE_MIN } from "../settings";
import { CONTROLS } from "./controls";
import { exportSave, importSaveFile } from "./fileIO";
import { ConfirmBar, SettingRow, Slider, StampBtn } from "./parts";
import { cleanSlotName, slotRows } from "./slots";
const errText = (e) => (e instanceof Error ? e.message : String(e));
function SlotsLoading() {
    return _jsx("div", { className: "ui-slot-empty", children: "Reading saves\u2026" });
}
export function SavePane({ store, state, flash, saves, reload }) {
    const [names, setNames] = useState({});
    const [armed, setArmed] = useState(null);
    const [working, setWorking] = useState(false);
    if (!saves)
        return _jsx(SlotsLoading, {});
    const busy = working || state.saveStatus.busy;
    const doSave = async (id, fallbackName) => {
        setWorking(true);
        setArmed(null);
        flash(null);
        try {
            const r = await store.saveTo(id, cleanSlotName(names[id] ?? "") ?? fallbackName);
            flash(r.ok ? { tone: "good", text: `Saved to ${id === "auto" ? "AUTOSAVE" : id.replace("slot", "SLOT ")}.` } : { tone: "error", text: r.reason });
            if (r.ok)
                setNames((n) => ({ ...n, [id]: "" }));
        }
        catch (e) {
            flash({ tone: "error", text: errText(e) });
        }
        finally {
            setWorking(false);
            await reload();
        }
    };
    return (_jsxs("div", { className: "ui-slots", children: [slotRows(saves).map((row) => (_jsxs("div", { className: `ui-slot ${row.empty ? "is-empty" : ""}`, children: [_jsx("span", { className: "ui-slot-label", children: row.label }), _jsxs("div", { className: "ui-slot-info", children: [row.manual ? (_jsx("input", { className: "ui-field", type: "text", maxLength: 24, value: names[row.id] ?? "", placeholder: row.empty ? `Day ${state.view.day}` : row.name, "aria-label": `Name for ${row.label}`, onChange: (e) => {
                                    const v = e.currentTarget.value;
                                    setNames((n) => ({ ...n, [row.id]: v }));
                                }, onKeyDown: (e) => {
                                    if (e.key === "Enter" && !busy)
                                        row.empty ? void doSave(row.id, undefined) : setArmed(row.id);
                                } })) : (_jsx("span", { className: "ui-slot-name", children: row.empty ? "No autosave yet" : row.name })), _jsxs("span", { className: "ui-slot-meta", children: [row.summary, !row.empty && _jsxs("span", { className: "ui-slot-when", children: [" \u00B7 ", row.when] })] })] }), _jsx("div", { className: "ui-slot-act", children: row.manual ? (_jsx(StampBtn, { rest: "Save", hot: "Saved", disabled: busy, onClick: () => (row.empty ? void doSave(row.id, undefined) : setArmed(row.id)) })) : (_jsx("span", { className: "ui-slot-ro", children: "READ-ONLY" })) }), armed === row.id && (_jsx(ConfirmBar, { question: `Overwrite “${row.name}” (day ${row.info?.day}, ${fmtMoney(row.info?.cash ?? 0)})?`, yes: "Overwrite", onYes: () => void doSave(row.id, row.name), onNo: () => setArmed(null) }))] }, row.id))), _jsx("p", { className: "ui-pane-note", children: "The autosave is written at the start of each day and cannot be overwritten by hand." })] }));
}
export function LoadPane({ store, state, menu, flash, onReplaced, saves, reload }) {
    const [armed, setArmed] = useState(null);
    const [working, setWorking] = useState(false);
    const file = useRef(null);
    if (!saves)
        return _jsx(SlotsLoading, {});
    const busy = working || state.saveStatus.busy;
    const doLoad = async (id, name) => {
        setWorking(true);
        setArmed(null);
        flash(null);
        try {
            const r = await store.loadFrom(id);
            if (r.ok) {
                pushNotice({ text: `Loaded “${name}”.`, severity: "good", key: "loaded" });
                onReplaced?.();
                menu.close();
                return;
            }
            flash({ tone: "error", text: r.reason });
        }
        catch (e) {
            flash({ tone: "error", text: errText(e) });
        }
        finally {
            setWorking(false);
            void reload();
        }
    };
    const onFile = async (f) => {
        if (!f)
            return;
        flash(null);
        setWorking(true);
        const r = await importSaveFile(store, f);
        setWorking(false);
        if (r.ok) {
            pushNotice({ text: `Imported ${f.name}.`, severity: "good", key: "imported" });
            onReplaced?.();
            menu.close();
        }
        else
            flash({ tone: "error", text: r.reason });
    };
    return (_jsxs("div", { className: "ui-slots", children: [slotRows(saves).map((row) => (_jsxs("div", { className: `ui-slot ${row.empty ? "is-empty" : ""}`, children: [_jsx("span", { className: "ui-slot-label", children: row.label }), _jsxs("div", { className: "ui-slot-info", children: [_jsx("span", { className: "ui-slot-name", children: row.empty ? "Empty drawer" : row.name }), _jsxs("span", { className: "ui-slot-meta", children: [row.summary, !row.empty && _jsxs("span", { className: "ui-slot-when", children: [" \u00B7 ", row.when] })] })] }), _jsx("div", { className: "ui-slot-act", children: _jsx(StampBtn, { rest: "Load", hot: "Retrieved", disabled: busy || row.empty, onClick: () => setArmed(row.id) }) }), armed === row.id && (_jsx(ConfirmBar, { question: "Replace the running game? Unsaved progress is lost.", yes: "Load it", onYes: () => void doLoad(row.id, row.name), onNo: () => setArmed(null) }))] }, row.id))), _jsxs("div", { className: "ui-filebox", children: [_jsx("span", { className: "ui-filebox-title", children: "File" }), _jsxs("div", { className: "ui-filebox-acts", children: [_jsx("input", { ref: file, type: "file", accept: ".json,application/json", hidden: true, onChange: (e) => {
                                    const input = e.currentTarget;
                                    const f = input.files?.[0];
                                    input.value = "";
                                    void onFile(f);
                                } }), _jsx("button", { type: "button", className: "ui-btn", disabled: busy, onClick: () => file.current?.click(), title: "Replace the running game with a save file", children: "Import from file\u2026" }), _jsx("button", { type: "button", className: "ui-btn", onClick: () => {
                                    const r = exportSave(store, state.view.day);
                                    flash(r.ok ? { tone: "good", text: `Exported ${r.name}.` } : { tone: "error", text: `Export failed: ${r.reason}` });
                                }, title: "Download the running game as a file", children: "Export to file" })] })] })] }));
}
const HORROR = [
    { id: "full", label: "Full" },
    { id: "mild", label: "Mild" },
    { id: "off", label: "Off" },
];
export function SettingsPane({ store, state }) {
    const s = normalizeSettings(state.settings);
    const set = store.setSettings;
    return (_jsxs("div", { className: "ui-settings", children: [_jsx(SettingRow, { label: "Master volume", hint: "All game audio.", children: _jsx(Slider, { label: "Master volume", value: s.masterVolume, min: 0, max: 1, step: 0.05, readout: `${Math.round(s.masterVolume * 100)}%`, onChange: (v) => set({ masterVolume: v }) }) }), _jsx(SettingRow, { label: "Music volume", hint: "Background music, on top of the master volume.", children: _jsx(Slider, { label: "Music volume", value: s.musicVolume, min: 0, max: 1, step: 0.05, readout: `${Math.round(s.musicVolume * 100)}%`, onChange: (v) => set({ musicVolume: v }) }) }), _jsx(SettingRow, { label: "Mute", hint: "Silence all audio (key M).", children: _jsx(Toggle, { on: s.muted, onClick: () => set({ muted: !s.muted }), label: "MUTE" }) }), _jsx(SettingRow, { label: "Text size", hint: "Scales the whole control room, 85% to 150%.", children: _jsx(Slider, { label: "Text size", value: s.textScale, min: TEXT_SCALE_MIN, max: TEXT_SCALE_MAX, step: 0.05, readout: `${Math.round(s.textScale * 100)}%`, onChange: (v) => set({ textScale: v }) }) }), _jsx(SettingRow, { label: "CRT effects", hint: "Scanlines, vignette and screen flicker.", children: _jsx(Toggle, { on: s.crtEffects, onClick: () => set({ crtEffects: !s.crtEffects }), label: "CRT" }) }), _jsx(SettingRow, { label: "Reduced motion", hint: "Stops flicker, blinking lamps, needle overshoot and camera easing.", children: _jsx(Toggle, { on: s.reducedMotion, onClick: () => set({ reducedMotion: !s.reducedMotion }), label: "CALM" }) }), _jsx(SettingRow, { label: "Colour-blind mode", hint: "Shapes on status lamps and tags (\u2713 \u25B2 \u2715 \u25CB) and a colour-blind-safe heat ramp.", children: _jsx(Toggle, { on: s.colorBlind, onClick: () => set({ colorBlind: !s.colorBlind }), label: "CB" }) }), _jsx(SettingRow, { label: "Horror intensity", hint: "Body-horror presentation (used from later milestones).", children: _jsx("span", { className: "ui-choice", role: "radiogroup", "aria-label": "Horror intensity", children: HORROR.map((h) => (
                    // biome-ignore lint/a11y/useSemanticElements: styled button group acts as a radio group; native radio inputs would change the markup and CSS
                    _jsx("button", { type: "button", role: "radio", "aria-checked": s.horrorIntensity === h.id, className: `ui-btn ${s.horrorIntensity === h.id ? "is-on" : ""}`, onClick: () => set({ horrorIntensity: h.id }), children: h.label }, h.id))) }) }), _jsx(SettingRow, { label: "Autosave", hint: "Write the autosave slot at the start of each game day.", children: _jsx(Toggle, { on: s.autosave, onClick: () => set({ autosave: !s.autosave }), label: "AUTO" }) }), _jsx(SettingRow, { label: "Desktop notice", hint: "Show the \u201Cbest on desktop\u201D memo on small screens.", children: _jsx(Toggle, { on: s.showDesktopNotice, onClick: () => set({ showDesktopNotice: !s.showDesktopNotice }), label: "MEMO" }) })] }));
}
export function ControlsPane() {
    return (_jsx("div", { className: "ui-controls", children: CONTROLS.map((g) => (_jsxs("section", { className: "ui-controls-group", children: [_jsx("h4", { children: g.title }), g.rows.map((r) => (_jsxs("div", { className: "ui-control", children: [_jsx("span", { className: "ui-control-keys", children: r.keys.map((k) => (_jsx(Kbd, { children: k }, k))) }), _jsx("span", { className: "ui-control-what", children: r.what })] }, r.what)))] }, g.title))) }));
}
export function NewGamePane({ store, menu, onReplaced }) {
    const [armed, setArmed] = useState(false);
    return (_jsxs("div", { className: "ui-newgame", children: [_jsxs("p", { children: ["A new game discards the running datacenter and starts a fresh one. ", _jsx("b", { children: "Unsaved progress is lost." }), " Use the Save drawer first, or export a file."] }), armed ? (_jsx(ConfirmBar, { question: "Discard this datacenter and start over?", yes: "Start over", onYes: () => {
                    store.newGame();
                    onReplaced?.();
                    pushNotice({ text: "New datacenter started.", severity: "info", key: "newgame" });
                    menu.close();
                }, onNo: () => setArmed(false) })) : (_jsx("div", { className: "ui-newgame-acts", children: _jsx(StampBtn, { tone: "red", rest: "New game", hot: "Condemned", onClick: () => setArmed(true) }) }))] }));
}
