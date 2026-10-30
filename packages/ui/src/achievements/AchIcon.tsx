import "./achievements.css";
import type { IconRef } from "./achievements";
import { ICON_SIZE, iconRows, iconRuns } from "./icons";
import { ICON_SHEETS, type IconSheet, sheetCellStyle } from "./sheets";

export interface AchIconProps {
	/** A code sprite id, an image-sheet cell, or nothing (the "?" plate). */
	icon?: IconRef;
	scale?: number;
	locked?: boolean;
	hidden?: boolean;
	className?: string;
	/** Sheet registry (tests pass their own). */
	sheets?: Record<string, IconSheet | undefined>;
}

/** A pixel icon at an integer `scale` (1x = 24 px): crisp SVG rects for a code sprite, a CSS-cropped cell for an image sheet. */
export function AchIcon({ icon, scale = 2, locked = false, hidden = false, className, sheets = ICON_SHEETS }: AchIconProps) {
	const px = ICON_SIZE * Math.max(1, Math.round(scale));
	if (icon && typeof icon === "object") {
		const style = sheetCellStyle(icon, px, sheets);
		if (style) {
			const state = locked ? (hidden ? "is-hidden" : "is-locked") : "";
			return <span className={`${className ?? "ui-ach-icon"} ui-ach-sheet ${state}`.trim()} style={{ ...style, ["--ach-px" as string]: `${px}px` }} aria-hidden="true" data-icon={`${icon.sheet}:${icon.col},${icon.row}`} data-locked={locked || undefined} />;
		}
	}
	const id = typeof icon === "string" ? icon : "";
	return (
		<svg className={className ?? "ui-ach-icon"} width={px} height={px} viewBox={`0 0 ${ICON_SIZE} ${ICON_SIZE}`} shapeRendering="crispEdges" aria-hidden="true" data-icon={id || "placeholder"} data-locked={locked || undefined}>
			{iconRuns(iconRows(id, locked, hidden)).map((r) => (
				<rect key={`${r.x},${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
			))}
		</svg>
	);
}
