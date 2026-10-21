/** Pure content for the Level-up "What changed" card: what a Level opens, from content. */
import type { ContentDB } from "@aitower/content";
import { levelUnlocks } from "@aitower/content";
import { type TierView, tierView } from "../build/tier";

export interface LevelUpItem {
	id: string;
	name: string;
	tier: TierView;
}

export interface LevelUpInfo {
	level: number;
	/** Core-ladder items (Standard, Advanced, Frontier), cheapest first. */
	items: LevelUpItem[];
	/** Path items this Level opens (named only once their path is in play, so nothing is spoiled). */
	pathItems: number;
	/** Research nodes whose Level requirement this Level meets. */
	nodes: number;
}

export function levelUpInfo(content: ContentDB, level: number): LevelUpInfo {
	const all = levelUnlocks(content, level).map((d) => ({ id: d.id, name: d.name, tier: tierView(d, content) }));
	return {
		level,
		items: all.filter((i) => !i.tier.isPath),
		pathItems: all.filter((i) => i.tier.isPath).length,
		nodes: content.tech.filter((t) => t.minTier === level).length,
	};
}
