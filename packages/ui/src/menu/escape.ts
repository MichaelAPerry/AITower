import type { GameStore, Selection, Tool } from "@aitower/shared";
import type { MenuController } from "./menuController";

export type EscapeStep = "closeMenu" | "cancelTool" | "clearSelection" | "openMenu";

/** Esc order: close the menu, else cancel the armed tool, else clear the selection, else open the menu. */
export function escapeStep(ctx: { menuOpen: boolean; tool: Tool; selection: Selection }): EscapeStep {
	if (ctx.menuOpen) return "closeMenu";
	if (ctx.tool.kind !== "select") return "cancelTool";
	if (ctx.selection) return "clearSelection";
	return "openMenu";
}

/** Run one Esc press against the store and the menu controller. Returns the step taken. */
export function applyEscape(store: GameStore, menu: MenuController): EscapeStep {
	const s = store.get();
	const step = escapeStep({ menuOpen: menu.isOpen(), tool: s.tool, selection: s.selection });
	switch (step) {
		case "closeMenu":
			menu.close();
			break;
		case "cancelTool":
			store.setGhost(null);
			store.setTool({ kind: "select" });
			break;
		case "clearSelection":
			store.setGhost(null);
			store.setSelection(null);
			break;
		case "openMenu":
			store.setGhost(null);
			menu.open();
			break;
	}
	return step;
}
