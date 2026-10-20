/**
 * Pure interpolation helpers. The renderer is called every animation frame but
 * views change once per tick; we keep the last two observed samples per entity
 * id and draw `lerp(prev, curr, alpha)` (one tick of latency, no overshoot).
 */
/** Samples further apart than this (in x/y units) snap instead of sliding. */
const DEFAULT_SNAP = 4;
export class Interpolator {
    snapDistance;
    tracks = new Map();
    generation = 0;
    constructor(snapDistance = DEFAULT_SNAP) {
        this.snapDistance = snapDistance;
    }
    /** Record one sample per entity for a new tick; entities not pushed are dropped on `endTick`. */
    beginTick() {
        this.generation++;
    }
    push(id, x, y) {
        const t = this.tracks.get(id);
        if (!t) {
            this.tracks.set(id, { prev: { x, y }, curr: { x, y }, seen: this.generation });
            return;
        }
        const far = Math.abs(x - t.curr.x) > this.snapDistance || Math.abs(y - t.curr.y) > this.snapDistance;
        t.prev = far ? { x, y } : t.curr;
        t.curr = { x, y };
        t.seen = this.generation;
    }
    endTick() {
        for (const [id, t] of this.tracks)
            if (t.seen !== this.generation)
                this.tracks.delete(id);
    }
    /** Interpolated position, or null for unknown ids. */
    get(id, alpha) {
        const t = this.tracks.get(id);
        if (!t)
            return null;
        return lerpSample(t.prev, t.curr, alpha);
    }
    /** Movement delta of the last tick (for facing / wheel animation). */
    velocity(id) {
        const t = this.tracks.get(id);
        return t ? { x: t.curr.x - t.prev.x, y: t.curr.y - t.prev.y } : { x: 0, y: 0 };
    }
    get size() {
        return this.tracks.size;
    }
}
export const lerpSample = (a, b, alpha) => {
    const t = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
};
/**
 * Alpha actually used for drawing. The loop passes alpha=0 while paused, which
 * would freeze entities one tick behind; once no new tick has arrived for
 * `settleMs`, ease to the latest sample instead.
 */
export const effectiveAlpha = (alpha, msSinceTick, settleMs) => msSinceTick > settleMs ? 1 : Math.min(Math.max(alpha, 0), 1);
/** FNV-1a over byte arrays (typed arrays viewed as bytes) for change detection. */
export const hashArrays = (...arrays) => {
    let h = 0x811c9dc5;
    for (const a of arrays) {
        const bytes = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
        for (let i = 0; i < bytes.length; i++) {
            h ^= bytes[i];
            h = Math.imul(h, 0x01000193);
        }
        h ^= 0xff;
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
};
