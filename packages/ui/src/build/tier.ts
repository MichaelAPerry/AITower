/** How a facility's tier looks in the HUD: one class, one badge, same everywhere (build card, Inspector, research, Handbook). */
import { facilityTier, outputOf, outputShare, tierNote, TIER_LABEL, type AscensionPath, type ContentDB, type FacilityDef, type TierInfo } from "@aitower/content";

export const PATH_NAME: Record<AscensionPath, string> = { biotech: "Wetware", greentech: "Green", synthetic: "Synthetic" };

export interface TierView {
	info: TierInfo;
	/** "t-std", "t-adv", "t-fro", "t-bio", "t-green" or "t-syn". */
	className: string;
	/** "Standard", "Advanced", "Frontier" or "Path: Wetware". */
	label: string;
	isPath: boolean;
	/** Output as a 0..1 share of the best of its kind, with the number shown beside the bar. */
	output: { share: number; text: string } | null;
	/** "Air tops out here" where it applies. */
	note?: string;
}

export const tierClassOf = (info: TierInfo): string =>
	info.tier === "path" ? (info.path === "biotech" ? "t-bio" : info.path === "greentech" ? "t-green" : "t-syn") : info.tier === "standard" ? "t-std" : info.tier === "advanced" ? "t-adv" : "t-fro";

export const tierLabelOf = (info: TierInfo): string => (info.tier === "path" && info.path ? `Path: ${PATH_NAME[info.path]}` : TIER_LABEL[info.tier]);

export function tierView(def: FacilityDef, content: ContentDB): TierView {
	const info = facilityTier(def, content);
	const o = outputOf(def);
	const share = outputShare(def, content);
	return {
		info,
		className: tierClassOf(info),
		label: tierLabelOf(info),
		isPath: info.tier === "path",
		output: o && share !== null ? { share, text: o.unit === "PF" ? `${o.value} PF` : o.value >= 1000 ? `${o.value / 1000} MW` : `${o.value} kW` } : null,
		note: tierNote(def),
	};
}
