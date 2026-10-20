/** Pure per-key rate limiter. Times are in ms and supplied by the caller. */
export const MIN_REPEAT_MS = 300;
export function createRateLimiter(defaultMs = MIN_REPEAT_MS) {
    const last = new Map();
    return {
        allow(key, nowMs, minIntervalMs = defaultMs) {
            const interval = Math.max(MIN_REPEAT_MS, minIntervalMs);
            const prev = last.get(key);
            if (prev !== undefined && nowMs - prev < interval)
                return false;
            last.set(key, nowMs);
            return true;
        },
        reset() {
            last.clear();
        },
    };
}
