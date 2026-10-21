import type { ReactNode } from "react";
import type { PanelProps } from "../components/context";
import { CATEGORY_LABEL, type Tab } from "./plain";

const svg = (children: ReactNode): ReactNode => (
	<svg viewBox="0 0 32 32" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		{children}
	</svg>
);

const ICONS: Record<Tab, ReactNode> = {
	structure: svg(<path d="M3 26h26M6 26V12h20v14M12 26V16h8" />),
	rack: svg(
		<>
			<rect x="9" y="4" width="14" height="24" rx="2" />
			<path d="M12 10h8M12 15h8M12 20h8" />
		</>,
	),
	power: svg(<path d="M18 3 8 18h7l-2 11 11-16h-7z" />),
	cooling: svg(<path d="M16 4c5 7 8 10 8 14a8 8 0 0 1-16 0c0-4 3-7 8-14z" />),
	logistics: svg(
		<>
			<rect x="8" y="12" width="16" height="12" rx="2" />
			<path d="M16 12V6M12 18h2M18 18h2" />
		</>,
	),
	bio: svg(<path d="M16 28V14M16 14c-6 0-8-5-8-9 6 0 8 4 8 9zM16 18c5 0 8-4 8-8-5 0-8 3-8 8z" />),
	supplies: svg(<path d="M6 11h20l-2 15H8zM11 11V8a5 5 0 0 1 10 0v3" />),
};

export const BAR_TABS: Tab[] = ["structure", "rack", "power", "cooling", "logistics", "bio", "supplies"];

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
						{ICONS[id]}
						<span>{CATEGORY_LABEL[id]}</span>
					</button>
				);
			})}
		</nav>
	);
}
