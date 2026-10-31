import type { PanelProps } from "../components/context";
import { PixelIcon } from "../icons/PixelIcon";
import type { PixelIconName } from "../icons/pixelIcons";
import { CATEGORY_LABEL, type Tab } from "./plain";

const ICONS: Record<Tab, PixelIconName> = { structure: "structure", rack: "rack", power: "power", cooling: "coolant", logistics: "logistics", supplies: "supplies" };

export const BAR_TABS: Tab[] = ["structure", "rack", "power", "cooling", "logistics", "supplies"];

/** The always-visible category bar. One click on a category opens its catalog; clicking it again closes it. */
export function BuildBar({ ui, setUi, tabs }: Pick<PanelProps, "ui" | "setUi"> & { /** A lesson shows only these categories. */ tabs?: readonly Tab[] | null }) {
	return (
		<nav className="bld-bar" aria-label="Build categories" data-help="build">
			{BAR_TABS.filter((t) => !tabs || tabs.includes(t)).map((id) => {
				const on = ui.paletteOpen && ui.paletteTab === id;
				return (
					<button
						key={id}
						type="button"
						data-tut={`cat-${id}`}
						aria-pressed={on}
						className={`bld-cat ${on ? "is-on" : ""}`}
						title={`${CATEGORY_LABEL[id]} (B opens the last category)`}
						onClick={() => setUi(on ? { paletteOpen: false, buildHover: null } : { paletteOpen: true, paletteTab: id, drawer: null, buildHover: null })}
					>
						<PixelIcon name={ICONS[id]} className="is-lg" />
						<span>{CATEGORY_LABEL[id]}</span>
					</button>
				);
			})}
		</nav>
	);
}
