import { ICON_SIZE, iconRows, iconRuns } from "./icons";

/** A pixel icon drawn as crisp SVG rects at an integer `scale` (1x = 24 px). */
export function AchIcon({ id, scale = 2, locked = false, hidden = false, className }: { id: string; scale?: number; locked?: boolean; hidden?: boolean; className?: string }) {
	const px = ICON_SIZE * Math.max(1, Math.round(scale));
	return (
		<svg className={className ?? "ui-ach-icon"} width={px} height={px} viewBox={`0 0 ${ICON_SIZE} ${ICON_SIZE}`} shapeRendering="crispEdges" aria-hidden="true" data-icon={id} data-locked={locked || undefined}>
			{iconRuns(iconRows(id, locked, hidden)).map((r) => (
				<rect key={`${r.x},${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
			))}
		</svg>
	);
}
