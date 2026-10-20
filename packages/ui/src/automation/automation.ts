/**
 * Pure logic for the Automation drawer: the four standing orders (Research, Parts, Bots, Foreman), the Contract Automation as a
 * fifth one-line toggle, and how an edit becomes a `setAutomation` command built on the policy as it is at that moment.
 */
import type { ContentDB, TechBranch, TechNode } from "@aitower/content";
import type { GameStore } from "@aitower/shared";
import type { AutomationPolicy, ClerkPolicy, CommandResult, SimView } from "@aitower/sim";
import { pushNotice } from "../notices";
import { BRANCHES, techList } from "../research/tech";

export type OrderId = "research" | "parts" | "bots" | "foreman";

export interface OrderInfo {
	id: OrderId;
	label: string;
	/** One line under the name. */
	blurb: string;
}

export const ORDERS: OrderInfo[] = [
	{ id: "research", label: "Research", blurb: "Spends research points on the next node it can afford." },
	{ id: "parts", label: "Spare parts", blurb: "Keeps spare parts stocked so repairs never wait." },
	{ id: "bots", label: "Maintenance bots", blurb: "Buys maintenance bots as rack count grows." },
	{ id: "foreman", label: "Works Foreman", blurb: "Places racks, cooling and spare power on slab you have already laid." },
];

/** Parts and bots are bought in batches; the foreman is rate-limited. These come from `balance.automation`. */
export function automationFacts(content: ContentDB): { partsBatch: number; foremanPerHour: number } {
	const a = content.balance?.automation;
	return { partsBatch: a?.partsBatch ?? 5, foremanPerHour: a?.foremanPerHour ?? 1 };
}

/** The tech node that switches the Foreman on (the one with the `foreman` feature). */
export const foremanNode = (content: ContentDB): TechNode | undefined => techList(content).find((t) => t.effects.some((e) => e.type === "feature" && e.feature === "foreman"));

/** "Research: Works Foreman" while the Foreman is locked. */
export const foremanLockedText = (content: ContentDB): string => `Research: ${foremanNode(content)?.name ?? "Works Foreman"}`;

export const orderOn = (policy: AutomationPolicy, id: OrderId): boolean => policy[id].enabled;

/** Names of the orders that are on, in drawer order (the Clerk last, when it is hired and on). */
export function activeOrders(view: Pick<SimView, "automation" | "clerk">): string[] {
	const on = ORDERS.filter((o) => orderOn(view.automation.policy, o.id) && (o.id !== "foreman" || view.automation.foremanUnlocked)).map((o) => o.label);
	if (view.clerk?.unlocked && view.clerk.policy.enabled) on.push("Contract Automation");
	return on;
}

/** The AUTO lamp in the top strip: any order (or the hired Clerk) is on. */
export const anyAutomation = (view: Pick<SimView, "automation" | "clerk">): boolean => activeOrders(view).length > 0;

/** A deep copy of the policy. */
export const clonePolicy = (p: AutomationPolicy): AutomationPolicy => ({ research: { ...p.research, branches: [...p.research.branches] }, parts: { ...p.parts }, bots: { ...p.bots }, foreman: { ...p.foreman } });

/** A copy of `policy` with `patch` merged into one order. Never mutates its input. */
export function withOrder<K extends OrderId>(policy: AutomationPolicy, id: K, patch: Partial<AutomationPolicy[K]>): AutomationPolicy {
	const next = clonePolicy(policy);
	Object.assign(next[id], patch);
	return next;
}

/** A copy of `policy` with one order switched. */
export function toggleOrder(policy: AutomationPolicy, id: OrderId): AutomationPolicy {
	const next = clonePolicy(policy);
	next[id].enabled = !next[id].enabled;
	return next;
}

/** Toggle a branch in the Research order's priority list. Keeps the canonical branch order; empty means any branch. */
export function toggleBranch(branches: readonly TechBranch[], b: TechBranch): TechBranch[] {
	const order = [...BRANCHES.map((x) => x.id), ...branches.filter((x) => !BRANCHES.some((y) => y.id === x))];
	const next = branches.includes(b) ? branches.filter((x) => x !== b) : order.filter((x) => x === b || branches.includes(x));
	return next;
}

/** "Any branch" or "Power, Cooling" for the Research order. */
export function branchSummary(branches: readonly TechBranch[]): string {
	return branches.length === 0 ? "Any branch" : branches.map((b) => BRANCHES.find((x) => x.id === b)?.label ?? b).join(", ");
}

export const MAX_COUNT = 1_000_000;
export const MAX_RESERVE = 1_000_000_000_000;

/** A whole number from a number box, at least `min` and at most `max`; null for anything the order should not take. */
export function toCount(n: number, min = 0, max = MAX_COUNT): number | null {
	if (!Number.isFinite(n) || n < min) return null;
	return Math.min(max, Math.round(n));
}

/**
 * Send an edit as `setAutomation`, built on the policy as it is right now (the HUD redraws view changes at 10 Hz, so the
 * props can be stale). A refusal is shown as a notice.
 */
export function sendAutomation(store: GameStore, edit: (cur: AutomationPolicy) => AutomationPolicy): CommandResult {
	const r = store.dispatch({ type: "setAutomation", policy: edit(store.get().view.automation.policy) });
	if (!r.ok) pushNotice({ text: r.reason, severity: "warn", key: `auto:${r.reason}` });
	return r;
}

/** Send a Clerk edit as `setClerk`, built on the clerk's policy as it is right now. */
export function sendClerk(store: GameStore, patch: Partial<ClerkPolicy>): CommandResult {
	const cur = store.get().view.clerk.policy;
	const r = store.dispatch({ type: "setClerk", policy: { ...cur, kinds: [...cur.kinds], ...patch } });
	if (!r.ok) pushNotice({ text: r.reason, severity: "warn", key: `clerk:${r.reason}` });
	return r;
}

/** The AUTO lamp's tooltip. */
export const autoLampTitle = (view: Pick<SimView, "automation" | "clerk">): string => {
	const on = activeOrders(view);
	return on.length ? `Standing orders on: ${on.join(", ")}. Click to open the Automation drawer (T)` : "No standing orders are on. Open the Automation drawer (T)";
};
