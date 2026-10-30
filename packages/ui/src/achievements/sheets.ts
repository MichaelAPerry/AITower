import achievementsSheet from "../art/achievement-icons.webp";
import buildCooling from "../art/build-icons-cooling.webp";
import buildPower from "../art/build-icons-power.webp";
import buildRacks from "../art/build-icons-racks.webp";
import buildSupport from "../art/build-icons-support.webp";
import researchCompute from "../art/research-icons-compute_admin.webp";
import researchCooling from "../art/research-icons-cooling_logistics.webp";
import researchPower from "../art/research-icons-power.webp";
import researchWetware from "../art/research-icons-wetware.webp";

/**
 * Image sprite sheets for achievement icons. An achievement row's `icon` may be `{ sheet, col, row }`: one cell of a grid image.
 * Register the sheet here when the owner supplies it (import the file and add an entry); nothing else changes.
 *
 *   import achievementsSheet from "../art/achievement-icons.webp";
import buildCooling from "../art/build-icons-cooling.webp";
import buildPower from "../art/build-icons-power.webp";
import buildRacks from "../art/build-icons-racks.webp";
import buildSupport from "../art/build-icons-support.webp";
 *   ICON_SHEETS.achievements = { url: achievementsSheet, cols: 6, rows: 3 };
 *
 * Make a sheet with `node tools/sprites/slice-sheet.mjs` (detects the plates, crops, downscales, packs a uniform atlas).
 *
 * Cells are equal; the cell is drawn at ICON_SIZE x scale pixels, crisp (pixelated). Locked and hidden looks are made from the
 * cell with CSS (ui.css `.ui-ach-sheet`): locked = dim grey, hidden = black silhouette with a "?".
 */
export interface IconSheet {
	/** URL of the image (an import, or a data URI in tests). */
	url: string;
	cols: number;
	rows: number;
}

/** The registered sheets. A row without an icon shows the "?" plate. */
export const ICON_SHEETS: Record<string, IconSheet | undefined> = {
	achievements: { url: achievementsSheet, cols: 6, rows: 3 },
	// Build menu icons (see build/buildIcons.ts for which facility sits in which cell).
	build_racks: { url: buildRacks, cols: 6, rows: 4 },
	build_power: { url: buildPower, cols: 6, rows: 4 },
	build_cooling: { url: buildCooling, cols: 6, rows: 3 },
	build_support: { url: buildSupport, cols: 5, rows: 3 },
	// Research icons (see research/researchIcons.ts for which technology sits in which cell).
	research_power: { url: researchPower, cols: 6, rows: 4 },
	research_compute_admin: { url: researchCompute, cols: 6, rows: 4 },
	research_cooling_logistics: { url: researchCooling, cols: 6, rows: 3 },
	research_wetware: { url: researchWetware, cols: 5, rows: 3 },
};

export interface SheetCell {
	sheet: string;
	col: number;
	row: number;
}

/** CSS for drawing one cell as a background of a `size` x `size` box, or null when the sheet or the cell does not exist. */
export function sheetCellStyle(cell: SheetCell, size: number, sheets: Record<string, IconSheet | undefined> = ICON_SHEETS): Record<string, string | number> | null {
	const s = sheets[cell.sheet];
	if (!s || !Number.isInteger(cell.col) || !Number.isInteger(cell.row) || s.cols < 1 || s.rows < 1) return null;
	if (cell.col < 0 || cell.col >= s.cols || cell.row < 0 || cell.row >= s.rows) return null;
	const pos = (i: number, n: number): string => `${n > 1 ? (i / (n - 1)) * 100 : 0}%`;
	return {
		width: size,
		height: size,
		backgroundImage: `url("${s.url}")`,
		backgroundSize: `${s.cols * 100}% ${s.rows * 100}%`,
		backgroundPosition: `${pos(cell.col, s.cols)} ${pos(cell.row, s.rows)}`,
		backgroundRepeat: "no-repeat",
	};
}
