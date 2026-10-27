import type { GameStore, Selection, Tool } from "@aitower/shared";
import type { MenuController } from "./menuController";

export type EscapeStep = "closeMenu" | "closeResearch" | "closeAudit" | "closeTrees" | "closeDrawer" | "cancelTool" | "clearSelection" | "openMenu";

/** A sheet that Esc can close (the research sheet, the audit sheet and the Trees panel). */
export interface Closable {
	isOpen(): boolean;
	close(): void;
}

/**
 * Esc order: close the menu, else the research sheet, else the audit sheet, else the Trees panel, else cancel the armed tool (before any panel closes), else the open
 * drawer or build catalog, else clear the selection, else open the menu.
 */
export function escapeStep(ctx: { menuOpen: boolean; researchOpen?: boolean; auditOpen?: boolean; treesOpen?: boolean; drawerOpen?: boolean; tool: Tool; selection: Selection }): EscapeStep {
	if (ctx.menuOpen) return "closeMenu";
	if (ctx.researchOpen) return "closeResearch";
	if (ctx.auditOpen) return "closeAudit";
	if (ctx.treesOpen) return "closeTrees";
	if (ctx.tool.kind !== "select") return "cancelTool";
	if (ctx.drawerOpen) return "closeDrawer";
	if (ctx.selection) return "clearSelection";
	return "openMenu";
}

/** Run one Esc press against the store and the menu controller. Returns the step taken. */
export function applyEscape(store: GameStore, menu: MenuController, sheets: { research?: Closable; audit?: Closable; trees?: Closable; drawer?: Closable } = {}): EscapeStep {
	const s = store.get();
	const step = escapeStep({ menuOpen: menu.isOpen(), researchOpen: sheets.research?.isOpen(), auditOpen: sheets.audit?.isOpen(), treesOpen: sheets.trees?.isOpen(), drawerOpen: sheets.drawer?.isOpen(), tool: s.tool, selection: s.selection });
	switch (step) {
		case "closeMenu":
			menu.close();
			break;
		case "closeResearch":
			sheets.research?.close();
			break;
		case "closeTrees":
			sheets.trees?.close();
			break;
		case "closeDrawer":
			sheets.drawer?.close();
			break;
		case "closeAudit":
			sheets.audit?.close();
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
