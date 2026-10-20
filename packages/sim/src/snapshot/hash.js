/**
 * Stable state hash: FNV-1a (two independent 32-bit lanes → 16 hex chars) over a canonical
 * serialisation (sorted object keys, typed arrays as number lists, undefined fields skipped).
 */
class Fnv {
    a = 0x811c9dc5;
    b = 0x01000193 ^ 0x5bd1e995;
    update(s) {
        let a = this.a;
        let b = this.b;
        for (let i = 0; i < s.length; i++) {
            const c = s.charCodeAt(i);
            a = Math.imul(a ^ c, 0x01000193);
            b = Math.imul(b ^ c, 0x01000193) ^ (b >>> 13);
        }
        this.a = a;
        this.b = b;
    }
    digest() {
        return (this.a >>> 0).toString(16).padStart(8, "0") + (this.b >>> 0).toString(16).padStart(8, "0");
    }
}
const num = (n) => (Object.is(n, -0) ? "0" : String(n));
function feed(h, v) {
    if (v === null || v === undefined) {
        h.update("n");
        return;
    }
    switch (typeof v) {
        case "number":
            h.update(`#${num(v)}`);
            return;
        case "boolean":
            h.update(v ? "T" : "F");
            return;
        case "string":
            h.update(`"${v.length}:${v}`);
            return;
        case "object":
            break;
        default:
            throw new Error(`hash: unsupported ${typeof v}`);
    }
    if (ArrayBuffer.isView(v) && !(v instanceof DataView)) {
        const arr = v;
        h.update(`[${arr.length}`);
        for (let i = 0; i < arr.length; i++)
            h.update(`,${num(arr[i])}`);
        h.update("]");
        return;
    }
    if (Array.isArray(v)) {
        h.update(`[${v.length}`);
        for (const e of v) {
            h.update(",");
            feed(h, e);
        }
        h.update("]");
        return;
    }
    const obj = v;
    const keys = Object.keys(obj)
        .filter((k) => obj[k] !== undefined)
        .sort();
    h.update("{");
    for (const k of keys) {
        h.update(`${k}:`);
        feed(h, obj[k]);
    }
    h.update("}");
}
export function hashValue(v) {
    const h = new Fnv();
    feed(h, v);
    return h.digest();
}
