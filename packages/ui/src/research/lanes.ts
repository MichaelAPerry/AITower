/** Lanes of the research data: which lane a node is in, lane metadata, and the HUD names of the three trees. Pure. */
import type { ContentDB, LaneDef, TechLane, TechNode } from "@aitower/content";

/** Lane of a branch, for hand-built content that has no `lane` on its nodes. */
export const BRANCH_LANE: Record<TechNode["branch"], TechLane> = { administration: "adm", logistics: "log", power: "pow", cooling: "cool", compute: "comp", wetware: "wet" };
export const laneOf = (n: TechNode): TechLane => n.lane ?? BRANCH_LANE[n.branch];

const FALLBACK: LaneDef[] = [
	{ id: "adm", name: "Administration", short: "Admin", color: "#c9b98f" },
	{ id: "log", name: "Logistics", short: "Logistics", color: "#e8955a" },
	{ id: "pow", name: "Power", short: "Power", color: "#f0d24a" },
	{ id: "cool", name: "Cooling", short: "Cooling", color: "#5fb6ff" },
	{ id: "comp", name: "Compute", short: "Compute", color: "#8fd1b0" },
	{ id: "wet", name: "Flesh", short: "Flesh", color: "#ff7aa8" },
	{ id: "green", name: "Garden", short: "Garden", color: "#9be564" },
	{ id: "syn", name: "Lattice", short: "Lattice", color: "#a99cff" },
].map((l) => ({ advisor: "", identity: "", signature: "", pitch: "", ...l }) as LaneDef);

/** Lane metadata in display order; falls back to plain names when the content carries none (test fixtures). */
export const lanesOf = (content: ContentDB): LaneDef[] => (content.lanes?.length ? content.lanes : FALLBACK);

/** Player-facing lane names. The three trees use their HUD names, never the code names. */
const HUD_LANE: Partial<Record<TechLane, string>> = { syn: "Lattice", wet: "Flesh", green: "Garden" };
export const laneName = (lane: TechLane, content: ContentDB): string => HUD_LANE[lane] ?? lanesOf(content).find((l) => l.id === lane)?.name ?? lane;
