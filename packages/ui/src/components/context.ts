import type { ContentDB } from "@aitower/content";
import type { GameState, GameStore } from "@aitower/shared";
import type { QuarterReport } from "@aitower/sim";
import type { PathFiled } from "../ascension/ascension";

export type BottomTab = "contracts" | "jobs" | "telemetry" | "finance" | "alerts";
/** Sections of the Finance tab. */
export type FinanceTab = "ledger" | "credit" | "audits" | "record";

export interface UiState {
	bottomTab: BottomTab;
	bottomOpen: boolean;
	/** Job highlighted in the Jobs tab (set by the inspector's job link). */
	focusJobId: number | null;
	/** Serious alerts after this tick count toward the Alerts badge. */
	alertsSeenTick: number;
	/** Build palette tab (lifted so the induction can point at the right one). */
	paletteTab: string;
	/** Ministry inbox drawer is open. */
	inboxOpen: boolean;
	/** Memos the player has stamped; the sim files them at the next tick, so they are hidden meanwhile. */
	stamped: number[];
	/** Section of the Finance tab. */
	financeTab: FinanceTab;
	/** Memos the player set aside (no slip pops up for them; they stay in the inbox). */
	aside: number[];
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
	/** Open the Department of Research sheet (pauses the game). */
	openResearch: () => void;
	/** Open FORM A-5, the Ascension sheet (pauses the game). */
	openAscension: () => void;
	/** Show a filed quarterly audit on the audit sheet. */
	openAudit: (report: QuarterReport) => void;
}
