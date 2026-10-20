/**
 * JSON-safe encoding of SimState: typed arrays become `{ $ta: <ctor>, v: number[] }`, undefined
 * object fields are dropped. Encoding deep-copies, so snapshots never alias live state.
 */
const CTORS = {
    Uint8Array,
    Int32Array,
    Float32Array,
    Float64Array,
};
function typedName(v) {
    if (v instanceof Uint8Array)
        return "Uint8Array";
    if (v instanceof Int32Array)
        return "Int32Array";
    if (v instanceof Float32Array)
        return "Float32Array";
    if (v instanceof Float64Array)
        return "Float64Array";
    return null;
}
export function encode(value) {
    if (value === null || typeof value !== "object")
        return value;
    const t = typedName(value);
    if (t)
        return { $ta: t, v: Array.from(value) };
    if (Array.isArray(value))
        return value.map(encode);
    const out = {};
    for (const [k, v] of Object.entries(value))
        if (v !== undefined)
            out[k] = encode(v);
    return out;
}
export function decode(value) {
    if (value === null || typeof value !== "object")
        return value;
    if (Array.isArray(value))
        return value.map(decode);
    const obj = value;
    if (typeof obj.$ta === "string") {
        if (!Object.hasOwn(CTORS, obj.$ta))
            throw new Error(`unknown typed array '${obj.$ta}'`);
        const v = obj.v;
        if (!Array.isArray(v))
            throw new Error(`typed array '${obj.$ta}' has no data`);
        // JSON turns NaN / Infinity into null; typed arrays would silently coerce those (and strings) to 0.
        for (let i = 0; i < v.length; i++)
            if (typeof v[i] !== "number" || !Number.isFinite(v[i]))
                throw new Error(`typed array '${obj.$ta}' has a non-numeric entry at ${i}`);
        return new CTORS[obj.$ta](v);
    }
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
        if (k === "__proto__")
            throw new Error("forbidden key '__proto__'");
        out[k] = decode(v);
    }
    return out;
}
