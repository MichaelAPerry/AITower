const listeners = new Set();
export function pushNotice(n) {
    for (const l of listeners)
        l(n);
}
export function onNotice(l) {
    listeners.add(l);
    return () => {
        listeners.delete(l);
    };
}
