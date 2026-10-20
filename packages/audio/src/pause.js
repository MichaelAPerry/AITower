export function createPauseDetector(thresholdMs = 400) {
    let lastTick = Number.NaN;
    let lastChange = 0;
    return {
        update(tick, nowMs) {
            if (tick !== lastTick) {
                lastTick = tick;
                lastChange = nowMs;
                return false;
            }
            return nowMs - lastChange > thresholdMs;
        },
    };
}
