/** Index to focus after Tab / Shift+Tab inside a trapped group of `count` focusable elements. `current` is -1 if focus is outside. */
export function nextFocusIndex(count, current, backwards) {
    if (count <= 0)
        return -1;
    if (current < 0)
        return backwards ? count - 1 : 0;
    return backwards ? (current - 1 + count) % count : (current + 1) % count;
}
const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])';
export function focusables(root) {
    return Array.from(root.querySelectorAll(FOCUSABLE)).filter((el) => !el.hasAttribute("hidden") && el.getClientRects().length > 0);
}
