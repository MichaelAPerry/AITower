export const createLogCursor = () => ({ pos: null });
/**
 * Look at the log and return the report of the newest `quarterReport` event added since the last call, or null.
 * The first call only records where the log stands (entries present at mount never pop a sheet), and a tick going
 * backwards (a load or a new game) resets the cursor. Same scheme the toasts use.
 */
export function auditToShow(cursor, log, reports) {
    const last = log[log.length - 1];
    const countAt = (tick) => log.reduce((n, e) => n + (e.tick === tick ? 1 : 0), 0);
    const c = cursor.pos;
    if (!c || !last || last.tick < c.tick) {
        cursor.pos = last ? { tick: last.tick, n: countAt(last.tick) } : { tick: -1, n: 0 };
        return null;
    }
    let quarter = null;
    let atTick = 0;
    for (const e of log) {
        if (e.tick < c.tick)
            continue;
        if (e.tick === c.tick && ++atTick <= c.n)
            continue;
        if (e.event.type === "quarterReport")
            quarter = e.event.quarter;
    }
    cursor.pos = { tick: last.tick, n: countAt(last.tick) };
    if (quarter === null)
        return null;
    return reports.find((r) => r.quarter === quarter) ?? reports[reports.length - 1] ?? null;
}
