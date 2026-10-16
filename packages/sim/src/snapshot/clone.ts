/** Deep copy of plain data and typed arrays (SimState holds nothing else). */
export function deepClone<T>(value: T): T {
	if (value === null || typeof value !== "object") return value;
	if (ArrayBuffer.isView(value)) return (value as unknown as { slice(): unknown }).slice() as T;
	if (Array.isArray(value)) {
		const out = new Array(value.length);
		for (let i = 0; i < value.length; i++) out[i] = deepClone(value[i]);
		return out as T;
	}
	const out: Record<string, unknown> = {};
	for (const k of Object.keys(value)) out[k] = deepClone((value as Record<string, unknown>)[k]);
	return out as T;
}
