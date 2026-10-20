/** Automation policy: defaults, structural shape check (for `normalizeCommand` and saves) and the `setAutomation` plan. */
import type { TechBranch } from "@aitower/content";
import type { AutomationPolicy } from "../api";
import { type Plan, type PlanCtx, accept, reject } from "../commands/plan";
import { AUTOMATION_MAX_BOTS, AUTOMATION_MAX_PARTS_KEEP } from "../core/constants";
import { foremanUnlocked } from "../research/research";

export const TECH_BRANCHES: readonly TechBranch[] = ["compute", "cooling", "power", "logistics", "administration", "wetware"];

/** Everything off; keep 4 parts; one bot per 12 racks up to 8; Foreman reserve $1M with all three kinds on. */
export function defaultAutomation(): AutomationPolicy {
	return {
		research: { enabled: false, branches: [] },
		parts: { enabled: false, keep: 4 },
		bots: { enabled: false, racksPerBot: 12, maxBots: 8 },
		foreman: { enabled: false, reserve: 1_000_000, racks: true, cooling: true, power: true },
	};
}

export const cloneAutomation = (p: AutomationPolicy): AutomationPolicy => ({
	research: { enabled: p.research.enabled, branches: p.research.branches.slice() },
	parts: { ...p.parts },
	bots: { ...p.bots },
	foreman: { ...p.foreman },
});

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Type-level check of untrusted input: a fresh plain copy, or a reason. Ranges are checked by `automationProblem`. */
export function shapeAutomation(raw: unknown): { ok: true; policy: AutomationPolicy } | { ok: false; reason: string } {
	if (!isObj(raw)) return { ok: false, reason: "policy must be an object" };
	const { research, parts, bots, foreman } = raw;
	if (!isObj(research) || typeof research.enabled !== "boolean" || !Array.isArray(research.branches) || research.branches.length > 32)
		return { ok: false, reason: "policy.research needs enabled and a short branches array" };
	if (!isObj(parts) || typeof parts.enabled !== "boolean" || !isNum(parts.keep)) return { ok: false, reason: "policy.parts needs enabled and a numeric keep" };
	if (!isObj(bots) || typeof bots.enabled !== "boolean" || !isNum(bots.racksPerBot) || !isNum(bots.maxBots))
		return { ok: false, reason: "policy.bots needs enabled, racksPerBot and maxBots" };
	if (
		!isObj(foreman) ||
		typeof foreman.enabled !== "boolean" ||
		typeof foreman.racks !== "boolean" ||
		typeof foreman.cooling !== "boolean" ||
		typeof foreman.power !== "boolean" ||
		!isNum(foreman.reserve)
	)
		return { ok: false, reason: "policy.foreman needs enabled, reserve, racks, cooling and power" };
	return {
		ok: true,
		policy: {
			research: { enabled: research.enabled, branches: research.branches.map((b: unknown) => (typeof b === "string" ? b : "")) as TechBranch[] },
			parts: { enabled: parts.enabled, keep: parts.keep },
			bots: { enabled: bots.enabled, racksPerBot: bots.racksPerBot, maxBots: bots.maxBots },
			foreman: { enabled: foreman.enabled, reserve: foreman.reserve, racks: foreman.racks, cooling: foreman.cooling, power: foreman.power },
		},
	};
}

/** Range check of a well-typed policy; returns a plain reason or null. */
export function automationProblem(p: AutomationPolicy): string | null {
	for (const b of p.research.branches) if (!TECH_BRANCHES.includes(b)) return `unknown research branch '${String(b)}'`;
	if (new Set(p.research.branches).size !== p.research.branches.length) return "research branches must not repeat";
	if (!Number.isInteger(p.parts.keep) || p.parts.keep < 0 || p.parts.keep > AUTOMATION_MAX_PARTS_KEEP) return `parts to keep must be a whole number from 0 to ${AUTOMATION_MAX_PARTS_KEEP}`;
	if (!Number.isInteger(p.bots.racksPerBot) || p.bots.racksPerBot < 1) return "racks per bot must be a whole number of at least 1";
	if (!Number.isInteger(p.bots.maxBots) || p.bots.maxBots < 0 || p.bots.maxBots > AUTOMATION_MAX_BOTS) return `maximum bots must be a whole number from 0 to ${AUTOMATION_MAX_BOTS}`;
	if (p.foreman.reserve < 0) return "the Foreman's reserve must not be negative";
	return null;
}

export function planSetAutomation(ctx: PlanCtx, policy: AutomationPolicy): Plan {
	const { state, content } = ctx;
	const problem = automationProblem(policy);
	if (problem) return reject(problem);
	if (policy.foreman.enabled && !foremanUnlocked(state, content)) return reject("the Foreman is not unlocked: research the Foreman first");
	const next = cloneAutomation(policy);
	return accept(0, () => {
		state.automation = next;
	});
}
