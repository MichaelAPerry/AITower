// PLACEHOLDER — replaced by agent-ui.
// Contract: export `App` (root React component taking { store, content, children? })
// and `createToolController(store, content)` which turns CellPointerEvents into ghosts/commands.
import type { ContentDB } from "@aitower/content";
import type { CellPointerEvent, GameStore } from "@aitower/shared";

export interface HudProps {
	store: GameStore;
	content: ContentDB;
	/** The canvas host element is rendered by the app; HUD overlays it. */
}

export interface ToolController {
	handle(e: CellPointerEvent): void;
}

export function createToolController(_store: GameStore, _content: ContentDB): ToolController {
	throw new Error("createToolController: not implemented");
}

export function Hud(_props: HudProps): null {
	return null;
}
