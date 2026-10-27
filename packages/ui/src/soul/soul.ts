/** Pure helpers for the Soul HUD (docs/SOUL.md): the three Singularity bars and what each advisor's trust reveals. */
import { type AdvisorId, type AscensionPath, bondStage, type ContentDB, type SealedTree } from "@aitower/content";
import type { SoulView } from "@aitower/sim";

export const TREE_NAME: Record<AscensionPath, string> = { synthetic: "LATTICE", biotech: "FLESH", greentech: "GARDEN" };
export const TREE_LONG: Record<AscensionPath, string> = { synthetic: "The Singularity", biotech: "The Flesh", greentech: "The Garden" };
export const TREE_COLOR: Record<AscensionPath, string> = { synthetic: "var(--tree-syn)", biotech: "var(--tree-bio)", greentech: "var(--tree-green)" };

export interface TreeBar {
	tree: AscensionPath;
	label: string;
	/** 0..1 of the target. */
	frac: number;
	/** "active" accrues now; "dormant" needs the commitment; "sealed" is closed for good. */
	state: "active" | "dormant" | "sealed";
	title: string;
}

/** The three bars, in display order: the Lattice first (it always fills). */
export function treeBars(soul: SoulView, path: AscensionPath | null): TreeBar[] {
	return (["synthetic", "biotech", "greentech"] as const).map((tree) => {
		const frac = Math.min(1, soul.sp[tree] / soul.spTarget);
		const sealed = tree !== "synthetic" && soul.sealedOut.includes(tree);
		const state = sealed ? "sealed" : tree === "synthetic" || path === tree ? "active" : "dormant";
		const pts = `${Math.floor(soul.sp[tree])} / ${soul.spTarget} Singularity points`;
		const title =
			tree === "synthetic"
				? `The Lattice: ${pts}. Every running rack that is not on the Bio or Green line feeds it. At ${soul.spTarget} the world ends this way.`
				: sealed
					? `${TREE_LONG[tree]} rejected this tower. It is closed for good.`
					: state === "dormant"
						? `${TREE_LONG[tree]}: ${pts}. It only grows after you commit to it on FORM A-5 (Level 3), with its champion's trust.`
						: `${TREE_LONG[tree]}: ${pts}.`;
		return { tree, label: TREE_NAME[tree], frac, state, title };
	});
}

/** What an advisor tells you about the hidden seal, given her bond (null = she says nothing). */
export function revealedSeal(soul: SoulView, advisor: AdvisorId): { tree: SealedTree; value: number }[] | null {
	if (soul.bonds[advisor] < soul.bondReveal) return null;
	const trees: SealedTree[] = advisor === "bea" ? ["greentech"] : advisor === "mel" ? ["biotech"] : advisor === "cass" ? ["greentech", "biotech"] : [];
	return trees.map((tree) => ({ tree, value: soul.seal[tree] }));
}

/** The words for a tree's seal on FORM A-5 and in the dossier: never the number unless trust allows it. */
export function sealWords(soul: SoulView, tree: SealedTree): string {
	if (soul.sealedOut.includes(tree) || soul.seal[tree] >= soul.sealMax) return "closed to you";
	const f = soul.seal[tree] / soul.sealMax;
	return f < 0.25 ? "open" : f < 0.5 ? "marked" : f < 0.75 ? "scarred" : "nearly closed";
}

/** A facility's secret numbers as shown on a build card, by the advisors who trust you enough to say (Luci only ever mentions money). */
export function sealNotes(soul: SoulView, seal: Partial<Record<SealedTree, number>> | undefined): { advisor: AdvisorId; tree: SealedTree; value: number }[] {
	const out: { advisor: AdvisorId; tree: SealedTree; value: number }[] = [];
	for (const tree of ["greentech", "biotech"] as const) {
		const v = seal?.[tree] ?? 0;
		if (v === 0) continue;
		const champ: AdvisorId = tree === "greentech" ? "bea" : "mel";
		if (soul.bonds[champ] >= soul.bondReveal) out.push({ advisor: champ, tree, value: v });
		else if (soul.bonds.cass >= soul.bondReveal) out.push({ advisor: "cass", tree, value: v });
	}
	return out;
}

/** The champion's line on FORM A-5 for her tree, in her voice. */
export function champLine(soul: SoulView, tree: AscensionPath): string {
	if (tree === "synthetic") return "Luci: “Sign here. It's already filling, darling. It always was.”";
	const who = tree === "biotech" ? "Mel" : "Bea";
	const champ = tree === "biotech" ? "mel" : "bea";
	const words = sealWords(soul, tree);
	if (words === "closed to you") return tree === "biotech" ? "Mel: “It said no. I didn't know it could.”" : "Bea: “Nothing grows on the roof any more. You did that.”";
	if (soul.bonds[champ] < soul.bondCommit) return tree === "biotech" ? `${who}: “I don't know you well enough to let you in. Not yet.”` : `${who}: “Prove you mean it. Then ask me again.”`;
	return tree === "biotech" ? `${who}: “The tissue is ${words}. It will have you. So will I.”` : `${who}: “The ground is ${words}. We can still do this. Together.”`;
}

// ─── The dating side ──────────────────────────────────────────────────────────


/** "Friend", "Close"... for a bond. */
export const stageName = (bond: number): string => bondStage(bond).name;

/** What `advisor` remembers about you, newest first, at most `max` lines (from the flags your choices set). */
export function memoriesFor(flags: readonly string[], content: Pick<ContentDB, "memories">, advisor: AdvisorId, max = 3): string[] {
	const out: string[] = [];
	for (let i = flags.length - 1; i >= 0 && out.length < max; i--) {
		const m = content.memories.find((x) => x.flag === flags[i] && x.advisor === advisor);
		if (m) out.push(m.text);
	}
	return out;
}

/** Her taste in gifts, shown as she warms to you: liked at Friend (30), disliked at Close (50). Names only, never the numbers. */
export function tasteFor(content: Pick<ContentDB, "gifts" | "facilities">, advisor: AdvisorId, bond: number): { likes: string | null; dislikes: string | null } {
	const g = content.gifts.find((x) => x.advisor === advisor);
	if (!g) return { likes: null, dislikes: null };
	return { likes: bond >= 30 ? (content.facilities[g.liked]?.name ?? null) : null, dislikes: bond >= 50 ? (content.facilities[g.disliked]?.name ?? null) : null };
}

/** Texts not yet answered. */
export const unreadCount = (soul: Pick<SoulView, "inbox">): number => soul.inbox.filter((m) => m.tapped === null).length;
