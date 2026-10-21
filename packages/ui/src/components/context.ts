import type { ContentDB, TechBranch } from "@aitower/content";
import type { GameState, GameStore } from "@aitower/shared";
import type { QuarterReport } from "@aitower/sim";
import type { PathFiled } from "../ascension/ascension";
import type { DrawerId } from "../calm/calm";

/** Sections of the Finance tab. */
export type FinanceTab = "ledger" | "credit" | "audits" | "record";

export interface UiState {
	/** The edge drawer that is open (one at a time), or null. */
	drawer: DrawerId | null;
	/** The build catalog (opened from the category bar) is open. */
	paletteOpen: boolean;
	/** The clerk's standing-order form is expanded in the Contracts drawer. */
	clerkEdit?: boolean;
	/** The card picked in the Contracts panel (the Inspector shows it). Null/absent = the best offer that fits. */
	contractSel?: { kind: "offer" | "job"; id: number } | null;
	/** Research panel: the node picked and the branch tab shown (null/absent = the best one to start). */
	researchSel?: string | null;
	researchTab?: TechBranch | null;
	/** Research panel: the tree (default) or the plain list kept for keyboard and screen-reader use. */
	researchView?: "tree" | "list";
	/** Section of the Insights panel. */
	insightsTab?: "overview" | "money";
	/** Job highlighted in the Contracts drawer (set by the inspector's job link). */
	focusJobId: number | null;
	/** Serious alerts after this tick count toward the Alerts badge. */
	alertsSeenTick: number;
	/** Build palette tab (lifted so the induction can point at the right one). */
	paletteTab: string;
	/** Catalog item key under the pointer (the build Inspector previews it); null/absent = show the picked item. */
	buildHover?: string | null;
	/** Section of the Finance tab. */
	financeTab: FinanceTab;
	/** Help mode: hover any outlined part of the HUD for a plain-language tooltip. */
	help?: boolean;
	/** Encyclopedia entry to open (set by "More..." links; the drawer consumes it). */
	encyId?: string | null;
	/** The ascension path just filed (the sim applies it on the next tick), so CURRENT ORDERS stops offering FORM A-5 meanwhile. */
	pathFiled?: PathFiled | null;
}

/** Everything a HUD panel needs. Passed explicitly (no React context) to keep panels easy to test. */
export interface PanelProps {
	store: GameStore;
	content: ContentDB;
	state: GameState;
	ui: UiState;
	setUi: (patch: Partial<UiState>) => void;
	/** Open the system menu (pauses the game). */
	openMenu: () => void;
	/** Open the Research panel, optionally on one node (the game keeps running). */
	openResearch: (techId?: string) => void;
	/** Open FORM A-5, the Ascension sheet (pauses the game). */
	openAscension: () => void;
	/** Show a filed quarterly audit on the audit sheet. */
	openAudit: (report: QuarterReport) => void;
}
