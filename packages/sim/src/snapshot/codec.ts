/**
 * JSON-safe encoding of SimState: typed arrays become `{ $ta: <ctor>, v: number[] }`, undefined
 * object fields are dropped. Encoding deep-copies, so snapshots never alias live state.
 */

type TypedArrayName = "Uint8Array" | "Int32Array" | "Float32Array" | "Float64Array";
type AnyTyped = Uint8Array | Int32Array | Float32Array | Float64Array;

const CTORS: Record<TypedArrayName, { new (values: number[]): AnyTyped }> = {
	Uint8Array,
	Int32Array,
	Float32Array,
	Float64Array,
};

function typedName(v: unknown): TypedArrayName | null {
	if (v instanceof Uint8Array) return "Uint8Array";
	if (v instanceof Int32Array) return "Int32Array";
	if (v instanceof Float32Array) return "Float32Array";
	if (v instanceof Float64Array) return "Float64Array";
	return null;
}

export function encode(value: unknown): unknown {
	if (value === null || typeof value !== "object") return value;
	const t = typedName(value);
	if (t) return { $ta: t, v: Array.from(value as AnyTyped) };
	if (Array.isArray(value)) return value.map(encode);
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(value)) if (v !== undefined) out[k] = encode(v);
	return out;
}

export function decode(value: unknown): unknown {
	if (value === null || typeof value !== "object") return value;
	if (Array.isArray(value)) return value.map(decode);
	const obj = value as Record<string, unknown>;
	if (typeof obj.$ta === "string" && Array.isArray(obj.v)) {
		const ctor = CTORS[obj.$ta as TypedArrayName];
		if (!ctor) throw new Error(`snapshot: unknown typed array '${obj.$ta}'`);
		return new ctor(obj.v as number[]);
	}
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(obj)) out[k] = decode(v);
	return out;
}
