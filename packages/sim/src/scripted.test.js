import { loadContent } from "@aitower/content";
import { describe, expect, it } from "vitest";
import { createSim } from "./sim";
import { minuteOfDay, dayOf } from "./core/time";
import { farmContent } from "./test/m2b";
import { newSim } from "./test/fixture";
const ev = (over) => ({
    id: "scr", category: "ministry", title: "t", body: "b", weight: 1, minTier: 1, cooldownDays: 99, timeoutTicks: 600, defaultChoice: "a",
    choices: [{ id: "a", label: "A", hint: "", outcome: "", effects: [] }], ...over,
});
function issueTicks(sim, ticks, id) {
    const out = [];
    for (let i = 0; i < ticks; i++) {
        const tick = sim.state.tick;
        for (const e of sim.step())
            if (e.type === "memoIssued" && e.eventId === id)
                out.push({ tick, day: dayOf(tick), minute: minuteOfDay(tick) });
    }
    return out;
}
describe("scripted events", () => {
    it("are issued once at 09:00 (minuteOfDay 540) on their day, ignoring maxOpen, grace and cooldown, and never randomly", () => {
        const c = farmContent({ events: { intervalTicks: 10, maxOpen: 0, graceTicks: 1_000_000 } }, [ev({ scriptedDay: 2 })]);
        const sim = newSim(c, "farm", 1);
        const got = issueTicks(sim, 5 * 1440, "scr");
        expect(got).toEqual([{ tick: 2 * 1440 + 180, day: 2, minute: 540 }]);
        expect(sim.state.scriptedIssued).toEqual(["scr"]);
    });
    it("respect tier limits", () => {
        const c = farmContent({}, [ev({ scriptedDay: 1, minTier: 9 })]);
        expect(issueTicks(newSim(c, "farm", 1), 3 * 1440, "scr")).toEqual([]);
    });
    it("real content: first_heat_alarm arrives at 09:00 on day 2", () => {
        const content = loadContent();
        const def = content.events.find((e) => e.scriptedDay !== undefined);
        expect(def).toBeDefined();
        const sim = createSim(content, "starter", 1);
        const got = issueTicks(sim, ((def?.scriptedDay ?? 0) + 1) * 1440, def?.id ?? "");
        expect(got).toHaveLength(1);
        expect(got[0].minute).toBe(540);
        expect(got[0].day).toBe(def?.scriptedDay);
    });
});
