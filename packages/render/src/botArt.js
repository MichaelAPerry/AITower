/** `flying` wins over `carry`; `carry > 1` makes the bulky lifter. */
export const botKind = (def) => def?.flying ? "drone" : (def?.carry ?? 1) > 1 ? "lifter" : "standard";
/** Body box in px (the bot is centred on its tile). */
export const botDims = (kind) => (kind === "lifter" ? { w: 14, h: 12 } : { w: 12, h: 12 });
export const MAX_STACK = 4;
/** Crates drawn on the bot: nothing unless it carries; the lifter stacks one per `carry` slot (up to MAX_STACK). */
export const crateCount = (def, carrying) => {
    if (!carrying)
        return 0;
    return Math.min(MAX_STACK, Math.max(1, Math.floor(def?.carry ?? 1)));
};
/** Rotor spin speed 0..1: full while flying, partial while hovering at work, 0 when landed (idle / charging). */
export const rotorSpeed = (state) => {
    switch (state) {
        case "flying":
            return 1;
        case "toDepot":
        case "toTarget":
        case "toCharger":
        case "waitingLift":
        case "riding":
            return 0.7;
        case "repairing":
            return 0.5;
        default:
            return 0;
    }
};
/** Pixels a drone hovers above its floor: higher in flight, 0 when landed. */
export const hoverOffset = (state) => (state === "flying" ? 3 : rotorSpeed(state) > 0 ? 2 : 0);
