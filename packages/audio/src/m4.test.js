import { describe, expect, it } from "vitest";
import { AMBIENCE, ambienceMix } from "./ambience";
import { createPathNotes, dueNotes, noteVoices, PATH_TUNING, pathLevels, pathTargets, SYNTH_GRID_S, ZERO_LEVELS } from "./pathLayers";
import { createRateLimiter } from "./rateLimit";
import { automationToggles, eventToSound, SOUNDS, soundPlays } from "./sounds";
import { CENTRE, eventSpot, listenerFromView, SPATIAL, spatialForEvent, spatialParams } from "./spatial";
const fac = (o) => ({ id: 1, defId: "rack_air_gpu", floor: 1, x: 4, width: 2, enabled: true, status: "ok", powerKw: 40, ...o });
const asView = (v) => v;
describe("spatial", () => {
    it("is centred and full volume at the listener, and pans toward the side", () => {
        const c = spatialParams({ x: 10, floor: 1 }, { x: 10, floor: 1 });
        expect(c).toEqual({ pan: 0, gain: 1 });
        expect(spatialParams({ x: 24, floor: 1 }, { x: 10, floor: 1 }).pan).toBeCloseTo(SPATIAL.maxPan);
        expect(spatialParams({ x: -50, floor: 1 }, { x: 10, floor: 1 }).pan).toBe(-SPATIAL.maxPan);
        expect(spatialParams({ x: 12, floor: 1 }, { x: 10, floor: 1 }).pan).toBeGreaterThan(0);
    });
    it("attenuates with distance but never below the floor, and survives NaN", () => {
        const near = spatialParams({ x: 10, floor: 1 }, { x: 10, floor: 1 }).gain;
        const far = spatialParams({ x: 10, floor: 6 }, { x: 10, floor: 1 }).gain;
        expect(far).toBeLessThan(near);
        expect(spatialParams({ x: 999, floor: -99 }, { x: 0, floor: 9 }).gain).toBe(SPATIAL.minGain);
        const n = spatialParams({ x: Number.NaN, floor: 1 }, { x: 0, floor: 1 });
        expect(Number.isFinite(n.pan) && Number.isFinite(n.gain)).toBe(true);
    });
    it("places events from facilities, builds, lifts; unplaced ones are centred", () => {
        const view = { facilities: [fac({ id: 7, x: 10, width: 4, floor: 2 })], lifts: [{ id: 3, x: 20 }] };
        expect(eventSpot({ type: "rackTripped", facilityId: 7 }, view)).toEqual({ x: 12, floor: 2 });
        expect(eventSpot({ type: "autoBuilt", facilityId: 7 }, view)).toEqual({ x: 12, floor: 2 });
        expect(eventSpot({ type: "built", what: "slab", floor: 0, x: 3 }, view)).toEqual({ x: 3, floor: 0 });
        expect(eventSpot({ type: "liftArrived", liftId: 3, floor: 4 }, view)).toEqual({ x: 20, floor: 4 });
        expect(eventSpot({ type: "rackTripped", facilityId: 99 }, view)).toBeNull();
        expect(spatialForEvent({ type: "tierUp", tier: 2, reward: 1 }, view, { x: 0, floor: 0 })).toBe(CENTRE);
        expect(spatialForEvent({ type: "rackTripped", facilityId: 7 }, view, { x: 0, floor: 2 }).pan).toBeGreaterThan(0);
    });
    it("approximates the listener from the facility centroid, else the grid middle", () => {
        expect(listenerFromView(asView({ facilities: [], width: 40, floorMin: -2, floorMax: 6 }))).toEqual({ x: 20, floor: 2 });
        const l = listenerFromView(asView({ facilities: [fac({ x: 0, width: 2, floor: 0 }), fac({ x: 10, width: 2, floor: 2 })], width: 40, floorMin: -2, floorMax: 6 }));
        expect(l).toEqual({ x: 6, floor: 1 });
    });
});
describe("ambience mix", () => {
    const v = (facilities, floorMax = 0) => asView({ facilities, floorMax });
    it("is silent for an empty ground-level tower", () => {
        expect(ambienceMix(v([]))).toEqual({ plant: 0, fans: 0, wind: 0 });
    });
    it("mixes plant, fans and wind by what is built and running", () => {
        const m = ambienceMix(v([fac({ defId: "chiller", floor: -1, powerKw: 100 }), fac({}), fac({ id: 3, defId: "wind_mast", powerKw: 0 })], 4));
        expect(m.plant).toBeGreaterThan(0);
        expect(m.fans).toBeGreaterThan(0);
        expect(m.wind).toBeCloseTo((4 / AMBIENCE.windFullFloors) * AMBIENCE.windHeightMax + AMBIENCE.windPerMast);
    });
    it("ignores disabled and failed machinery, and drops when paused", () => {
        const off = ambienceMix(v([fac({ enabled: false }), fac({ status: "failed" }), fac({ defId: "genset", status: "tripped" })]));
        expect(off.fans + off.plant).toBe(0);
        const run = ambienceMix(v([fac({}), fac({ defId: "genset" })]));
        const paused = ambienceMix(v([fac({}), fac({ defId: "genset" })]), true);
        expect(paused.fans).toBeCloseTo(run.fans * AMBIENCE.pausedFactor);
        expect(paused.plant).toBeLessThan(run.plant);
    });
    it("stays within 0..1 and tolerates junk", () => {
        const m = ambienceMix(v([fac({ powerKw: Number.NaN }), fac({ powerKw: 1e9 }), fac({ defId: "wind_mast" }), fac({ defId: "wind_mast" }), fac({ defId: "wind_mast" }), fac({ defId: "wind_mast" })], 99));
        for (const x of Object.values(m))
            expect(x >= 0 && x <= 1).toBe(true);
    });
});
describe("path layers", () => {
    it("is silent without a path or on biotech", () => {
        expect(pathTargets(null, 0.9)).toEqual(ZERO_LEVELS);
        expect(pathTargets("biotech", 0.9)).toEqual(ZERO_LEVELS);
    });
    it("greentech and synthetic use only their own layers and grow with score", () => {
        const lo = pathTargets("greentech", 0.1);
        const hi = pathTargets("greentech", 1);
        expect(lo.sMusic + lo.shimmer + lo.hollow).toBe(0);
        expect(hi.gMusic).toBeGreaterThan(lo.gMusic);
        expect(hi.water).toBeGreaterThan(lo.water);
        expect(lo.spore).toBe(0);
        expect(hi.spore).toBe(1);
        const s = pathTargets("synthetic", 1);
        expect(s.gMusic + s.rustle + s.water + s.spore).toBe(0);
        expect(s.hollow).toBe(1);
        expect(pathTargets("synthetic", 0.5).hollow).toBe(0);
    });
    it("scales the spore breath and hollow tone by horror intensity", () => {
        expect(pathTargets("greentech", 1, "off").spore).toBe(0);
        expect(pathTargets("greentech", 1, "mild").spore).toBe(0.5);
        expect(pathTargets("synthetic", 1, "off").hollow).toBe(0);
        expect(pathTargets("synthetic", 1, "off").sMusic).toBeGreaterThan(0.9); // the pleasant parts stay
    });
    it("clamps junk scores", () => {
        expect(pathTargets("greentech", Number.NaN).gMusic).toBeCloseTo(0.35);
        expect(pathTargets("greentech", 7).gMusic).toBeCloseTo(1);
    });
    it("smooths: no motion without dt, then exponential toward the target", () => {
        const t = pathTargets("greentech", 1);
        expect(pathLevels("greentech", 1, undefined, undefined)).toEqual(ZERO_LEVELS);
        const one = pathLevels("greentech", 1, ZERO_LEVELS, PATH_TUNING.tauS);
        expect(one.gMusic).toBeCloseTo(t.gMusic * (1 - Math.exp(-1)));
        const far = pathLevels("greentech", 1, ZERO_LEVELS, 1000);
        expect(far.gMusic).toBeCloseTo(t.gMusic);
        // leaving the path decays rather than cutting
        const out = pathLevels(null, 0, far, 1);
        expect(out.gMusic).toBeGreaterThan(0);
        expect(out.gMusic).toBeLessThan(far.gMusic);
    });
});
describe("path notes", () => {
    it("is deterministic and stays in range", () => {
        const a = createPathNotes("greentech", 5);
        const b = createPathNotes("greentech", 5);
        for (let i = 0; i < 50; i++) {
            const n = a.next();
            expect(n).toEqual(b.next());
            expect(n.freq).toBeGreaterThan(200);
            expect(n.freq).toBeLessThan(4000);
            expect(n.gapS).toBeGreaterThan(0);
            expect(["marimba", "flute"]).toContain(n.kind);
        }
    });
    it("synthetic notes are glass on the 0.25 s grid", () => {
        const s = createPathNotes("synthetic", 3);
        for (let i = 0; i < 40; i++) {
            const n = s.next();
            expect(n.kind).toBe("glass");
            expect(Math.abs(n.gapS / SYNTH_GRID_S - Math.round(n.gapS / SYNTH_GRID_S))).toBeLessThan(1e-9);
        }
    });
    it("note voices have valid envelopes (positive freq/duration/gain)", () => {
        for (const path of ["greentech", "synthetic"]) {
            const g = createPathNotes(path, 9);
            for (let i = 0; i < 30; i++)
                for (const v of noteVoices(g.next()))
                    expect(v.freq > 0 && v.dur > 0 && v.gain > 0).toBe(true);
        }
    });
    it("schedules within the horizon, restarts after a long gap, never bursts", () => {
        const g = createPathNotes("greentech", 1);
        const first = dueNotes(g, null, 10, 0.4);
        expect(first.due[0]?.at).toBe(10);
        expect(first.due.every((d) => d.at < 10.4)).toBe(true);
        expect(first.nextS).toBeGreaterThanOrEqual(10.4);
        const again = dueNotes(g, first.nextS, 10.1, 0.4);
        expect(again.due.every((d) => d.at >= first.nextS - 1e-9)).toBe(true);
        const stale = dueNotes(g, 10, 500, 0.4);
        expect(stale.due[0]?.at).toBe(500);
        expect(stale.due.length).toBeLessThanOrEqual(8);
    });
});
describe("event sounds", () => {
    it("maps the M4 events", () => {
        expect(eventToSound({ type: "earned", jobId: 1, amount: 5 })).toBe("till");
        expect(eventToSound({ type: "autoBuilt", facilityId: 1 })).toBe("clunk");
        expect(eventToSound({ type: "droughtStarted" })).toBe("droughtOn");
        expect(eventToSound({ type: "droughtEnded" })).toBe("droughtOff");
        expect(eventToSound({ type: "autoBought", what: "parts", count: 3 })).toBeNull();
    });
    it("keeps the first event per sound for positioning", () => {
        const evs = [
            { type: "autoBuilt", facilityId: 1 },
            { type: "autoBuilt", facilityId: 2 },
            { type: "earned", jobId: 1, amount: 1 },
        ];
        expect(soundPlays(evs)).toEqual([
            { id: "clunk", event: evs[0] },
            { id: "till", event: evs[2] },
        ]);
    });
    it("rate-limits the till chime and the drought sounds", () => {
        const lim = createRateLimiter();
        const till = SOUNDS.till;
        expect(lim.allow("till", 0, till.minIntervalMs)).toBe(true);
        expect(lim.allow("till", 1000, till.minIntervalMs)).toBe(false);
        expect(lim.allow("till", till.minIntervalMs, till.minIntervalMs)).toBe(true);
        expect(SOUNDS.droughtOn.minIntervalMs).toBeGreaterThanOrEqual(3000);
    });
    it("all recipes are well formed", () => {
        for (const s of Object.values(SOUNDS))
            for (const v of s.voices)
                expect(v.freq > 0 && v.dur > 0 && v.gain > 0 && v.start >= 0).toBe(true);
    });
});
describe("automation toggles", () => {
    const p = (r, pa, b, f) => ({ research: { enabled: r }, parts: { enabled: pa }, bots: { enabled: b }, foreman: { enabled: f } });
    it("emits one sound per flipped switch and nothing on first sight or no change", () => {
        expect(automationToggles(undefined, p(true, true, true, true))).toEqual([]);
        expect(automationToggles(p(true, false, false, false), p(true, false, false, false))).toEqual([]);
        expect(automationToggles(p(false, false, false, false), p(true, false, false, false))).toEqual(["toggleOn"]);
        expect(automationToggles(p(true, true, false, false), p(false, true, true, false))).toEqual(["toggleOff", "toggleOn"]);
    });
});
