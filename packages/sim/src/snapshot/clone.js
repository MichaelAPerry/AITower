/** Deep copy of plain data and typed arrays (SimState holds nothing else). */
export function deepClone(value) {
    if (value === null || typeof value !== "object")
        return value;
    if (ArrayBuffer.isView(value))
        return value.slice();
    if (Array.isArray(value)) {
        const out = new Array(value.length);
        for (let i = 0; i < value.length; i++)
            out[i] = deepClone(value[i]);
        return out;
    }
    const out = {};
    for (const k of Object.keys(value))
        out[k] = deepClone(value[k]);
    return out;
}
