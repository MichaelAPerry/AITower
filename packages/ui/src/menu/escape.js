/**
 * Esc order: close the menu, else the research sheet, else the ascension sheet, else the audit sheet, else the open drawer or palette, else cancel the
 * armed tool, else clear the selection, else open the menu.
 */
export function escapeStep(ctx) {
    if (ctx.menuOpen)
        return "closeMenu";
    if (ctx.researchOpen)
        return "closeResearch";
    if (ctx.ascensionOpen)
        return "closeAscension";
    if (ctx.auditOpen)
        return "closeAudit";
    if (ctx.drawerOpen)
        return "closeDrawer";
    if (ctx.tool.kind !== "select")
        return "cancelTool";
    if (ctx.selection)
        return "clearSelection";
    return "openMenu";
}
/** Run one Esc press against the store and the menu controller. Returns the step taken. */
export function applyEscape(store, menu, sheets = {}) {
    const s = store.get();
    const step = escapeStep({ menuOpen: menu.isOpen(), researchOpen: sheets.research?.isOpen(), ascensionOpen: sheets.ascension?.isOpen(), auditOpen: sheets.audit?.isOpen(), drawerOpen: sheets.drawer?.isOpen(), tool: s.tool, selection: s.selection });
    switch (step) {
        case "closeMenu":
            menu.close();
            break;
        case "closeResearch":
            sheets.research?.close();
            break;
        case "closeAscension":
            sheets.ascension?.close();
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
