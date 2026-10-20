/**
 * Pure juice rules (M4): "+$" / "−$" floaters and build puffs. Fixed-size pools (no per-frame allocation, hard caps),
 * coalescing of floaters that land close together in space and time, and the anchor of a job (its racks, or the rack area).
 * `pixi/juice.ts` draws the result.
 */
import { floorTop } from "./camera";
import { FAC_TOP, TILE } from "./constants";
/** Hard cap of simultaneous floaters. */
export const MAX_FLOATERS = 10;
export const MAX_PUFFS = 8;
export const FLOATER_LIFE = 1.6;
/** A new event merges into a floater of the same kind that is younger than this ... */
export const COALESCE_AGE = 0.9;
/** ... and anchored within this many world px. */
export const COALESCE_DIST = 28;
export const FLOAT_RISE = 16;
export const PUFF_LIFE = 0.7;
/** "$950", "$1.2K", "$34K", "$2.5M". */
export const fmtMoney = (n) => {
    const v = Math.abs(Number.isFinite(n) ? n : 0);
    if (v < 1000)
        return `$${Math.round(v)}`;
    if (v < 1e6) {
        const k = v / 1000;
        return `$${k < 10 ? (Math.floor(k * 10) / 10).toFixed(1) : Math.floor(k)}K`;
    }
    const m = v / 1e6;
    return `$${m < 10 ? (Math.floor(m * 10) / 10).toFixed(1) : Math.floor(m)}M`;
};
export const floaterText = (kind, amount) => `${kind === "earned" ? "+" : "−"}${fmtMoney(amount)}`;
const blank = () => ({ active: false, kind: "earned", x: 0, y: 0, amount: 0, age: 0, text: "", count: 0 });
export class FloaterField {
    items = Array.from({ length: MAX_FLOATERS }, blank);
    /** Active floaters. */
    get live() {
        let n = 0;
        for (const f of this.items)
            if (f.active)
                n++;
        return n;
    }
    /**
     * Add an event. It folds into a close, young floater of the same kind; else takes a free slot; else (pool full) folds
     * into the nearest floater of that kind, or replaces the oldest. Zero, negative and non-finite amounts are ignored.
     */
    add(kind, x, y, amount) {
        if (!(amount > 0) || !Number.isFinite(amount) || !Number.isFinite(x) || !Number.isFinite(y))
            return;
        let near = null;
        let nearD = Number.POSITIVE_INFINITY;
        let free = null;
        let oldest = this.items[0];
        for (const f of this.items) {
            if (!f.active) {
                free ??= f;
                continue;
            }
            if (f.age > oldest.age || !oldest.active)
                oldest = f;
            if (f.kind !== kind)
                continue;
            const d = Math.hypot(f.x - x, f.y - y);
            if (d < nearD) {
                nearD = d;
                near = f;
            }
        }
        if (near && nearD <= COALESCE_DIST && near.age <= COALESCE_AGE)
            this.fold(near, amount);
        else if (free)
            this.start(free, kind, x, y, amount);
        else if (near)
            this.fold(near, amount);
        else
            this.start(oldest, kind, x, y, amount);
    }
    fold(f, amount) {
        f.amount += amount;
        f.count++;
        f.text = floaterText(f.kind, f.amount);
        f.age = Math.min(f.age, 0.2); // a fresh contribution keeps it readable
    }
    start(f, kind, x, y, amount) {
        f.active = true;
        f.kind = kind;
        f.x = x;
        f.y = y;
        f.amount = amount;
        f.age = 0;
        f.count = 1;
        f.text = floaterText(kind, amount);
    }
    update(dt) {
        const d = Math.max(0, Math.min(dt, 0.25));
        for (const f of this.items) {
            if (!f.active)
                continue;
            f.age += d;
            if (f.age >= FLOATER_LIFE)
                f.active = false;
        }
    }
}
/** Vertical offset (px, negative = up) of a floater: it rises and eases out; reduced motion keeps it in place. */
export const floatOffset = (age, reduced) => (reduced ? 0 : -FLOAT_RISE * (1 - (1 - Math.min(1, Math.max(0, age / FLOATER_LIFE))) ** 2));
/** Alpha of a floater: quick fade-in, full, then a fade-out over the last 40 % (the only change under reduced motion). */
export const floatAlpha = (age) => {
    const u = Math.min(1, Math.max(0, age / FLOATER_LIFE));
    return Math.min(1, u / 0.08) * (u < 0.6 ? 1 : Math.max(0, 1 - (u - 0.6) / 0.4));
};
export class PuffField {
    items = Array.from({ length: MAX_PUFFS }, () => ({ active: false, x: 0, y: 0, age: 0 }));
    add(x, y) {
        if (!Number.isFinite(x) || !Number.isFinite(y))
            return;
        let slot = null;
        for (const p of this.items) {
            // The same spot puffing twice in a moment is one puff.
            if (p.active && Math.abs(p.x - x) < 6 && Math.abs(p.y - y) < 6 && p.age < 0.3) {
                p.age = 0;
                return;
            }
            if (!p.active)
                slot ??= p;
        }
        if (!slot) {
            slot = this.items[0];
            for (const p of this.items)
                if (p.age > slot.age)
                    slot = p;
        }
        slot.active = true;
        slot.x = x;
        slot.y = y;
        slot.age = 0;
    }
    update(dt) {
        const d = Math.max(0, Math.min(dt, 0.25));
        for (const p of this.items) {
            if (!p.active)
                continue;
            p.age += d;
            if (p.age >= PUFF_LIFE)
                p.active = false;
        }
    }
}
/**
 * Where a job's money shows: the middle of its racks on the first rack's floor, or (no rack runs it any more) the middle of
 * the rack area on the first rack floor. `null` when the building has no rack at all.
 */
export const jobAnchor = (facilities, jobId, isRack) => {
    const pick = (match) => {
        let floor = Number.NaN;
        let sum = 0;
        let n = 0;
        for (const f of facilities) {
            if (!match(f))
                continue;
            if (Number.isNaN(floor))
                floor = f.floor;
            if (f.floor !== floor)
                continue;
            sum += f.x + f.width / 2;
            n++;
        }
        return n > 0 ? { x: sum / n, floor } : null;
    };
    return pick((f) => f.jobId === jobId && isRack(f.defId)) ?? pick((f) => isRack(f.defId));
};
/**
 * Turn sim events into floaters and puffs against the latest view: `earned` = a "+$" floater over the job's racks (or the rack
 * area), `jobFailed` = a red "\u2212$" floater, `autoBuilt` = a puff on the new device. Unknown jobs and ids are skipped.
 */
export const applyEvents = (events, view, field, puffs, isRack) => {
    for (const e of events) {
        if ((e.type === "earned" || e.type === "jobFailed") && e.jobId !== undefined) {
            const a = jobAnchor(view.facilities, e.jobId, isRack);
            if (a)
                field.add(e.type === "earned" ? "earned" : "failed", a.x * TILE, floorTop(view, a.floor) + FAC_TOP - 2, (e.type === "earned" ? e.amount : e.penalty) ?? 0);
        }
        else if (e.type === "autoBuilt") {
            const f = view.facilities.find((q) => q.id === e.facilityId);
            if (f)
                puffs.add((f.x + f.width / 2) * TILE, floorTop(view, f.floor) + FAC_TOP + 14);
        }
    }
};
