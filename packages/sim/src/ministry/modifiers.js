/** Product of the active multipliers of `kind` (1 when none). */
export function modFactor(state, kind) {
    let f = 1;
    for (const m of state.modifiers)
        if (m.kind === kind && m.endsAt > state.tick)
            f *= m.value;
    return f;
}
/** Sum of the active ambient offsets, °C. */
export function ambientOffset(state) {
    let d = 0;
    for (const m of state.modifiers)
        if (m.kind === "ambient" && m.endsAt > state.tick)
            d += m.value;
    return d;
}
const fmt = (n) => String(Math.round(n * 100) / 100);
/** Short label shown next to the timer in the HUD. */
export function modifierLabel(kind, value) {
    switch (kind) {
        case "ambient":
            return `${value >= 0 ? "+" : "-"}${fmt(Math.abs(value))}°C ambient`;
        case "gridCap":
            return value === 0 ? "Grid offline" : `Grid import x${fmt(value)}`;
        case "energyPrice":
            return `Energy price x${fmt(value)}`;
        case "payout":
            return `Contract payouts x${fmt(value)}`;
        case "failureRate":
            return `Failure rate x${fmt(value)}`;
    }
}
/** Drop expired modifiers. */
export function expireModifiers(state) {
    if (state.modifiers.some((m) => m.endsAt <= state.tick))
        state.modifiers = state.modifiers.filter((m) => m.endsAt > state.tick);
}
