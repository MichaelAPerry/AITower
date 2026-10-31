import { ICON_SIZE, iconPaths, type PixelIconName } from "./pixelIcons";
import "./icons.css";

const cache = new Map<PixelIconName, [string, string][]>();
const pathsOf = (name: PixelIconName): [string, string][] => {
	let p = cache.get(name);
	if (!p) {
		p = iconPaths(name);
		cache.set(name, p);
	}
	return p;
};

/**
 * One icon of the shared set (pixelIcons.ts), drawn as crisp SVG rects on a 16x16 grid. The size is CSS (`--ic-size`, default 1.5em, never
 * under 20px), so it follows the UI scale. Decorative by default (next to a text label, aria-hidden); pass `label` for an icon-only
 * control's icon, which then reads as an image with that name.
 */
export function PixelIcon({ name, label, className = "" }: { name: PixelIconName; label?: string; className?: string }) {
	return (
		<span className={`ui-px ${className}`.trim()} data-icon={name} {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}>
			<svg viewBox={`0 0 ${ICON_SIZE} ${ICON_SIZE}`} shapeRendering="crispEdges" focusable="false" aria-hidden="true">
				{pathsOf(name).map(([fill, d]) => (
					<path key={fill} fill={fill} d={d} />
				))}
			</svg>
		</span>
	);
}

/** The same icon inside another SVG (the research orb): a nested <svg> at (x, y), `size` user units wide. Decorative. */
export function PixelIconSvg({ name, x, y, size }: { name: PixelIconName; x: number; y: number; size: number }) {
	return (
		<svg x={x} y={y} width={size} height={size} viewBox={`0 0 ${ICON_SIZE} ${ICON_SIZE}`} shapeRendering="crispEdges" aria-hidden="true" className="orb-ic" data-icon={name}>
			{pathsOf(name).map(([fill, d]) => (
				<path key={fill} fill={fill} d={d} />
			))}
		</svg>
	);
}
