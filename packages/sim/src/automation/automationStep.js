import { TICKS_PER_HOUR } from "../core/constants";
import { minuteOfDay } from "../core/time";
import { foremanUnlocked, techGate } from "../research/research";
import { getDef } from "../world/defs";
import { foremanStep } from "./foreman";
import { runCommand } from "./run";
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
/** The next affordable node: by branch priority (a non-empty list also restricts), then cheapest, then id. */
function autoResearch(ctx) {
    const { state, content } = ctx;
    const branches = state.automation.research.branches;
    const rank = (b) => (branches.length === 0 ? 0 : branches.indexOf(b));
    const open = content.tech
        .filter((t) => !state.techResearched.includes(t.id) && rank(t.branch) >= 0 && t.cost <= state.researchPoints)
        .sort((a, b) => rank(a.branch) - rank(b.branch) || a.cost - b.cost || byId(a, b));
    for (const node of open)
        if (runCommand(ctx, { type: "research", techId: node.id }))
            return;
}
function autoParts(ctx) {
    const { state, content, events } = ctx;
    let stock = 0;
    let room = 0;
    for (const f of state.facilities) {
        const d = getDef(content, f.defId);
        if (d.kind !== "depot")
            continue;
        stock += f.stored;
        room += Math.max(0, (d.logistics?.capacity ?? 0) - f.stored);
    }
    if (stock >= state.automation.parts.keep)
        return;
    const count = Math.min(content.balance.automation.partsBatch, room);
    if (count > 0 && runCommand(ctx, { type: "buyParts", count }))
        events.push({ type: "autoBought", what: "parts", count });
}
function autoBots(ctx) {
    const { state, content, events } = ctx;
    const p = state.automation.bots;
    let racks = 0;
    for (const f of state.facilities) {
        const d = getDef(content, f.defId);
        if (d.kind === "rack" && !d.growth)
            racks++;
    }
    if (state.bots.length >= Math.min(p.maxBots, Math.ceil(racks / p.racksPerBot)))
        return;
    // "Best" = the priciest bot type that is unlocked; one purchase per hour.
    const best = Object.values(content.bots)
        .filter((b) => techGate(state, content, b.tech) === null)
        .sort((a, b) => b.cost - a.cost || byId(a, b))[0];
    if (best && runCommand(ctx, { type: "buyBot", defId: best.id }))
        events.push({ type: "autoBought", what: "bot", count: 1 });
}
export function automationStep(ctx) {
    const { state, content } = ctx;
    if (minuteOfDay(state.tick) % TICKS_PER_HOUR !== 0)
        return;
    const a = state.automation;
    if (a.research.enabled)
        autoResearch(ctx);
    if (a.parts.enabled)
        autoParts(ctx);
    if (a.bots.enabled)
        autoBots(ctx);
    if (a.foreman.enabled && foremanUnlocked(state, content))
        foremanStep(ctx);
}
