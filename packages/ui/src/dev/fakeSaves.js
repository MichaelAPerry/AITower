import { SAVE_SLOTS } from "@aitower/shared";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/** Exported text for the fake world: just enough fields for the menu to show and restore. */
export function exportFake(view) {
    return JSON.stringify({ fakeSave: 1, tick: view.tick, day: view.day, minuteOfDay: view.minuteOfDay, cash: view.cash, tier: view.tier });
}
export function parseFake(json) {
    let raw;
    try {
        raw = JSON.parse(json);
    }
    catch {
        throw new Error("Invalid save: not valid JSON");
    }
    const r = raw;
    if (!r || typeof r !== "object" || r.fakeSave !== 1)
        throw new Error("Invalid save: unrecognised file");
    for (const k of ["tick", "day", "minuteOfDay", "cash", "tier"])
        if (typeof r[k] !== "number" || !Number.isFinite(r[k]))
            throw new Error(`Invalid save: bad ${k}`);
    return r;
}
export function createFakeSaves(ctx, seed = {}) {
    const slots = new Map(Object.entries(seed));
    const status = (patch) => ctx.patchState({ saveStatus: { ...ctx.getState().saveStatus, ...patch } });
    const apply = (json) => {
        const p = parseFake(json);
        ctx.setView({ ...ctx.freshView(), ...p });
    };
    return {
        save: () => exportFake(ctx.getState().view),
        load(json) {
            apply(json);
            status({ error: null });
        },
        newGame(_seed, scenarioId) {
            ctx.setView(ctx.freshView(scenarioId));
        },
        async listSaves() {
            await wait(ctx.delayMs);
            return SAVE_SLOTS.flatMap((id) => (slots.has(id) ? [slots.get(id).info] : [])).sort((a, b) => b.savedAt - a.savedAt);
        },
        async saveTo(slot, name) {
            status({ busy: true });
            await wait(ctx.delayMs);
            const v = ctx.getState().view;
            const savedAt = Date.now();
            slots.set(slot, {
                json: exportFake(v),
                info: { id: slot, name: slot === "auto" ? "Autosave" : name?.trim() || `Day ${v.day}`, savedAt, day: v.day, cash: v.cash, tier: v.tier },
            });
            status({ busy: false, error: null, lastSavedAt: savedAt });
            return { ok: true };
        },
        async loadFrom(slot) {
            status({ busy: true });
            await wait(ctx.delayMs);
            const s = slots.get(slot);
            if (!s) {
                status({ busy: false, error: "That slot is empty" });
                return { ok: false, reason: "That slot is empty" };
            }
            try {
                apply(s.json);
            }
            catch (e) {
                const reason = e instanceof Error ? e.message : String(e);
                status({ busy: false, error: reason });
                return { ok: false, reason };
            }
            status({ busy: false, error: null });
            return { ok: true };
        },
        async deleteSave(slot) {
            await wait(ctx.delayMs);
            slots.delete(slot);
        },
        /** Test/harness hook: put a save straight into a slot. */
        seedSlot(slot, info) {
            slots.set(slot, { info: { id: slot, ...info }, json: JSON.stringify({ fakeSave: 1, tick: info.day * 1440, day: info.day, minuteOfDay: 0, cash: info.cash, tier: info.tier }) });
        },
    };
}
