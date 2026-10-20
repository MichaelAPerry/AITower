import { useCallback, useEffect, useRef, useState } from "react";
/** Save-slot list for the menu: loads when mounted and on `reload()`. `saves` is null until the first answer. */
export function useSaves(store, refreshKey) {
    const [saves, setSaves] = useState(null);
    const [error, setError] = useState(null);
    const alive = useRef(true);
    const reload = useCallback(async () => {
        try {
            const s = await store.listSaves();
            if (!alive.current)
                return;
            setSaves(s);
            setError(null);
        }
        catch (e) {
            if (!alive.current)
                return;
            setSaves((prev) => prev ?? []);
            setError(e instanceof Error ? e.message : String(e));
        }
    }, [store]);
    // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only: tracks liveness for the async reload guard; reload is re-created only when the store changes
    useEffect(() => {
        alive.current = true;
        void reload();
        return () => {
            alive.current = false;
        };
    }, [reload, refreshKey]);
    return { saves, error, reload };
}
