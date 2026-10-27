/**
 * Pure helpers for the Soul HUD (docs/SOUL.md, docs/REFRAME.md): the three Singularity bars in the top strip and the Trees panel
 * (one column per tree: points and days to win, the rung ladder, what the next rung needs, the speed factor and the seal).
 */
import { type AdvisorId, type AscensionPath, CHAMPION, type ContentDB, type FacilityDef, treeLadder, TREES } from "@aitower/content";
import type { SimView, SoulView, TreeView } from "@aitower/sim";

export const TREE_NAME: Record<AscensionPath, string> = { synthetic: "LATTICE", biotech: "FLESH", greentech: "GARDEN" };
export const TREE_LONG: Record<AscensionPath, string> = { synthetic: "The Lattice", biotech: "The Flesh", greentech: "The Garden" };
/** The branch word on the Retrofit buttons and in the panel. */
export const TREE_BRANCH: Record<AscensionPath, string> = { synthetic: "Synthetic", biotech: "Bio", greentech: "Green" };
export const TREE_COLOR: Record<AscensionPath, string> = { synthetic: "var(--tree-syn)", biotech: "var(--tree-bio)", greentech: "var(--tree-green)" };
/** The placeholder tint of a tree's racks in the world (hex, for the renderer and the build cards). */
export const TREE_TINT: Record<AscensionPath, string> = { synthetic: "#6fd3ff", biotech: "#ff4f6d", greentech: "#9be564" };

export interface TreeBar {
	tree: AscensionPath;
	label: string;
	/** 0..1 of the target. */
	frac: number;
	/** "active" accrues; "closed" took its seal to the limit: no new retrofits, and its racks stopped scoring. */
	state: "active" | "closed";
	title: string;
}

/** The three bars, in display order. */
export function treeBars(soul: SoulView): TreeBar[] {
	return TREES.map((tree) => {
		const frac = Math.min(1, soul.sp[tree] / soul.spTarget);
		const closed = soul.trees[tree].closed;
		const pts = `${Math.floor(soul.sp[tree])} / ${soul.spTarget} Singularity points`;
		const title = closed
			? `${TREE_LONG[tree]}: ${pts}. Its seal is full: no new retrofits, and its racks have stopped scoring. Click for the Trees panel.`
			: `${TREE_LONG[tree]}: ${pts}. Only ${TREE_BRANCH[tree]} racks fill it. At ${soul.spTarget} the world ends this way. Click for the Trees panel.`;
		return { tree, label: TREE_NAME[tree], frac, state: closed ? "closed" : "active", title };
	});
}

const num = (n: number): string => Math.round(n).toLocaleString("en-US");

/** The unresearched nodes `techId` still needs, prerequisites first (including itself), as "Name (cost RP)". */
export function researchSteps(content: Pick<ContentDB, "tech">, researched: ReadonlySet<string>, techId: string): { id: string; name: string; cost: number }[] {
	const byId = new Map(content.tech.map((n) => [n.id, n]));
	const out: { id: string; name: string; cost: number }[] = [];
	const seen = new Set<string>();
	const visit = (id: string): void => {
		const n = byId.get(id);
		if (!n || researched.has(id) || seen.has(id)) return;
		seen.add(id);
		for (const r of n.requires) visit(r);
		out.push({ id: n.id, name: n.name, cost: n.cost });
	};
	visit(techId);
	return out;
}

/** One rung of a tree's ladder. */
export interface RungRow {
	rung: number;
	defId: string;
	name: string;
	level: number;
	pflops: number;
	/** "held": a rack of this rung or higher stands; "next": the one to work toward; "later". */
	status: "held" | "next" | "later";
}

export interface TreeCard {
	tree: AscensionPath;
	name: string;
	branch: string;
	color: string;
	champion: AdvisorId;
	sp: number;
	target: number;
	frac: number;
	/** "+38 points a day · about 16 days to go", or why there is no rate. */
	rate: string;
	ladder: RungRow[];
	/** "Next: research Event Array (8,000 RP), then retrofit racks to NM-2." */
	next: string;
	/** Factor lines, plainest first. */
	factor: string[];
	/** The seal meter, or null for the Lattice. */
	seal: { value: number; max: number; closed: boolean; hurting: string[] } | null;
	racks: number;
}

function nextStep(view: Pick<SimView, "tier" | "techResearched">, content: ContentDB, tv: TreeView): string {
	if (tv.closed) return `The ${TREE_BRANCH[tv.tree]} branch is closed: its seal is full. No new retrofits.`;
	const ladder = treeLadder(content, tv.tree);
	const rack: FacilityDef | undefined = ladder.find((d) => (d.rung ?? 0) === tv.rung + 1);
	if (!rack) return tv.racks > 0 ? "That is the top rung. Retrofit the rest of your racks." : "No racks on this branch.";
	const done = new Set(view.techResearched);
	const needs: string[] = [];
	if (rack.tech) {
		const steps = researchSteps(content, done, rack.tech);
		if (steps.length) needs.push(`research ${steps.map((s) => `${s.name} (${num(s.cost)} RP)`).join(", then ")}`);
	}
	if (view.tier < rack.unlockTier) needs.push(`reach Level ${rack.unlockTier} (${num(content.balance.tiers.pflops[rack.unlockTier - 1])} petaflops installed)`);
	return needs.length ? `Next: ${needs.join(" and ")}, then retrofit racks to ${rack.name}.` : `Next: retrofit racks to ${rack.name}.`;
}

function factorLines(soul: SoulView, tv: TreeView): string[] {
	const pct = (n: number): string => `${Math.round(n * 100)}%`;
	if (tv.tree === "synthetic") return ["Speed ×1.00. Nothing slows the Lattice."];
	const sealMul = 1 - Math.min(1, (tv.seal ?? 0) / soul.sealMax);
	if (tv.tree === "biotech") return [`Seal ${Math.round(tv.seal ?? 0)} → Flesh speed ×${sealMul.toFixed(2)}.`];
	const g = soul.green;
	const lines = [`Clean power ${pct(g.cleanPower)} → Garden speed ×${g.speed.toFixed(2)}${g.speed < 0.95 ? ": add PV or wind" : ""}`];
	if (sealMul < 1) lines.push(`Seal ${Math.round(tv.seal ?? 0)} takes it down to ×${(g.speed * sealMul).toFixed(2)}.`);
	return lines;
}

function rateText(tv: TreeView): string {
	if (tv.closed) return "Closed. No points are coming in.";
	if (tv.spPerDay <= 0) return tv.racks > 0 ? "No points yet: your racks on this branch are idle or down." : "No points yet. Retrofit a rack to this branch.";
	const days = tv.daysToWin;
	return `+${num(tv.spPerDay)} points a day${days !== null ? ` · about ${num(Math.max(1, days))} days to go` : ""}`;
}

/** Everything the Trees panel shows, from the view and the content. */
export function treeCards(view: Pick<SimView, "soul" | "tier" | "techResearched">, content: ContentDB): TreeCard[] {
	const soul = view.soul;
	return TREES.map((tree) => {
		const tv = soul.trees[tree];
		const ladder: RungRow[] = treeLadder(content, tree).map((d) => ({
			rung: d.rung ?? 0,
			defId: d.id,
			name: d.name,
			level: d.unlockTier,
			pflops: d.rack?.pflops ?? 0,
			status: (d.rung ?? 0) <= tv.rung ? "held" : (d.rung ?? 0) === tv.rung + 1 ? "next" : "later",
		}));
		return {
			tree,
			name: TREE_LONG[tree],
			branch: TREE_BRANCH[tree],
			color: TREE_COLOR[tree],
			champion: CHAMPION[tree],
			sp: tv.sp,
			target: soul.spTarget,
			frac: Math.min(1, tv.sp / soul.spTarget),
			rate: rateText(tv),
			ladder,
			next: nextStep(view, content, tv),
			factor: factorLines(soul, tv),
			seal: tv.seal === null ? null : { value: tv.seal, max: soul.sealMax, closed: tv.closed, hurting: tv.hurting.map((h) => `${h.name}${h.count > 1 ? ` ×${h.count}` : ""}`) },
			racks: tv.racks,
		};
	});
}

/** The advisor with the highest bond, if it is at the epilogue level (the one who speaks at the end). */
export function epilogueAdvisor(soul: Pick<SoulView, "bonds" | "bondEpilogue">): AdvisorId | null {
	let best: AdvisorId | null = null;
	for (const id of ["cass", "bea", "mel", "luci"] as const) if (best === null || soul.bonds[id] > soul.bonds[best]) best = id;
	return best !== null && soul.bonds[best] >= soul.bondEpilogue ? best : null;
}
