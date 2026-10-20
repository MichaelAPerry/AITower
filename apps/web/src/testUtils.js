export function memoryStorage(initial = {}) {
    const data = new Map(Object.entries(initial));
    return {
        data,
        getItem: (k) => data.get(k) ?? null,
        setItem: (k, v) => {
            data.set(k, v);
        },
        removeItem: (k) => {
            data.delete(k);
        },
    };
}
export function fakeAudio() {
    const calls = [];
    const audio = {
        resume: async () => { },
        update: () => { },
        setMuted: (m) => calls.push(`muted:${m}`),
        setVolume: (v) => calls.push(`volume:${v}`),
        setMusicVolume: (v) => calls.push(`music:${v}`),
        setHorrorIntensity: (i) => calls.push(`horror:${i}`),
        destroy: () => { },
    };
    return { audio, calls };
}
export function fakeRenderer() {
    const options = [];
    const renderer = {
        draw: () => { },
        setOverlay: () => { },
        pushEvents: () => { },
        setGhost: () => { },
        setSelection: () => { },
        focus: () => { },
        onPointer: () => () => { },
        setOptions: (o) => options.push(o),
        resize: () => { },
        destroy: () => { },
    };
    return { renderer, options };
}
