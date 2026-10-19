/**
 * Structural validation of untrusted commands (UI, saves, tests). `normalizeCommand` returns a freshly built,
 * correctly typed copy or a rejection reason; it never throws, whatever it is given (null, wrong types,
 * NaN / Infinity, cyclic or exotic objects, huge arrays). Game-rule validation lives in the `plan*` functions.
 */
import type { CellRef, SimCommand } from "../api";

export type Normalized = { ok: true; cmd: SimCommand } | { ok: false; reason: string };

/** Upper bound on `buildConduit.cells`; bigger than any lot, so legitimate drags are never refused. */
export const MAX_CONDUIT_CELLS = 1_000_000;

const bad = (reason: string): Normalized => ({ ok: false, reason: `malformed command: ${reason}` });

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const NUMERIC: Record<string, readonly string[]> = {
	buildSlab: ["floor", "x0", "x1"],
	place: ["floor", "x"],
	buildLift: ["x", "floorMin", "floorMax"],
	demolish: ["floor", "x"],
	setEnabled: ["facilityId"],
	acceptContract: ["contractId"],
	declineContract: ["contractId"],
	cancelJob: ["jobId"],
	buyParts: ["count"],
	buyBot: [],
	resolveMemo: ["memoId"],
	research: [],
	setClerk: [],
	takeLoan: ["amount"],
	repayLoan: ["amount"],
};

/**
 * `setClerk`: only the shape is checked here (so the copy is plain, serialisable data); whether the kinds are real job
 * kinds, the numbers are ≥ 0 and the clerk is unlocked is decided by the plan, with a plain reason.
 */
function normalizeClerk(raw: unknown): Normalized {
	if (!isObj(raw)) return bad("policy must be an object");
	const { enabled, allowLiquid, kinds, minPayPerPflopHour, maxPenalty } = raw;
	if (typeof enabled !== "boolean" || typeof allowLiquid !== "boolean") return bad("policy.enabled and policy.allowLiquid must be booleans");
	if (!Array.isArray(kinds) || kinds.length > 16) return bad("policy.kinds must be a short array");
	if (!isNum(minPayPerPflopHour) || !isNum(maxPenalty)) return bad("policy numbers must be finite");
	const policy = { enabled, kinds: kinds.map((k: unknown) => (typeof k === "string" ? k : "")), minPayPerPflopHour, maxPenalty, allowLiquid };
	return { ok: true, cmd: { type: "setClerk", policy } as unknown as SimCommand };
}

export function normalizeCommand(raw: unknown): Normalized {
	try {
		if (!isObj(raw)) return bad("not an object");
		const type = raw.type;
		if (typeof type !== "string") return bad("missing type");
		if (type === "buildConduit") {
			const layer = raw.layer;
			if (layer !== "power" && layer !== "coolant") return bad("unknown conduit layer");
			const cells = raw.cells;
			if (!Array.isArray(cells)) return bad("cells must be an array");
			if (cells.length > MAX_CONDUIT_CELLS) return bad("too many cells");
			const out: CellRef[] = [];
			for (let i = 0; i < cells.length; i++) {
				const c: unknown = cells[i];
				if (!isObj(c) || !isNum(c.x) || !isNum(c.floor)) return bad(`cells[${i}] needs numeric x and floor`);
				out.push({ x: c.x, floor: c.floor });
			}
			return { ok: true, cmd: { type, layer, cells: out } };
		}
		const keys = Object.hasOwn(NUMERIC, type) ? NUMERIC[type] : undefined;
		if (!keys) return { ok: false, reason: "unknown command type" };
		if ((type === "place" || type === "buyBot") && typeof raw.defId !== "string") return bad("defId must be a string");
		if (type === "resolveMemo" && typeof raw.choiceId !== "string") return bad("choiceId must be a string");
		if (type === "research" && typeof raw.techId !== "string") return bad("techId must be a string");
		if (type === "setClerk") return normalizeClerk(raw.policy);
		const out: Record<string, unknown> = { type };
		for (const k of keys) {
			const v = raw[k];
			if (!isNum(v)) return bad(`${k} must be a finite number`);
			out[k] = v;
		}
		if (type === "place" || type === "buyBot") out.defId = raw.defId;
		if (type === "resolveMemo") out.choiceId = raw.choiceId;
		if (type === "research") out.techId = raw.techId;
		if (type === "demolish") {
			const layer = raw.layer;
			if (layer !== undefined) {
				if (layer !== "power" && layer !== "coolant") return bad("unknown conduit layer");
				out.layer = layer;
			}
		}
		if (type === "setEnabled") {
			if (typeof raw.enabled !== "boolean") return bad("enabled must be a boolean");
			out.enabled = raw.enabled;
		}
		return { ok: true, cmd: out as unknown as SimCommand };
	} catch {
		return bad("unreadable");
	}
}
