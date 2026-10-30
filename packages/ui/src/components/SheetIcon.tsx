import { ICON_SHEETS, type IconSheet, type SheetCell, sheetCellStyle } from "../achievements/sheets";

export interface SheetIconProps {
	cell: SheetCell;
	/** Edge in CSS pixels. Use an integer multiple of the 64 px cell (64, 128) for crisp pixels; 48 is the achievements size. */
	size: number;
	/** Locked: dim grey. With `hidden` as well: a black "?" plate. The looks are CSS (`.ui-ach-sheet`). */
	locked?: boolean;
	hidden?: boolean;
	className?: string;
	/** Sheet registry (tests pass their own). */
	sheets?: Record<string, IconSheet | undefined>;
}

/** One cell of an image sheet, drawn crisp. Shared by the achievements list and the build menu. Null when the cell does not exist. */
export function SheetIcon({ cell, size, locked = false, hidden = false, className, sheets = ICON_SHEETS }: SheetIconProps) {
	const style = sheetCellStyle(cell, size, sheets);
	if (!style) return null;
	const state = locked ? (hidden ? "is-hidden" : "is-locked") : "";
	return <span className={`${className ?? "ui-sheet-icon"} ui-ach-sheet ${state}`.trim()} style={{ ...style, ["--ach-px" as string]: `${size}px` }} aria-hidden="true" data-icon={`${cell.sheet}:${cell.col},${cell.row}`} data-locked={locked || undefined} />;
}
