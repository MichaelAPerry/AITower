/**
 * The shared panel shell. Every right-hand panel (Contracts now, Research and others next) is built from these:
 * a header, an optional tab row, then a list of cards on one side and an Inspector for the selected card on the other,
 * with ONE big primary button at the bottom of the Inspector. It borrows the Build catalog's look (`bld-*` classes).
 */
import type { ReactNode } from "react";
import type { Fact } from "../contracts/contractText";

export function PanelHead({ title, kicker, aside }: { title: string; kicker?: string; aside?: ReactNode }) {
	return (
		<header className="pnl-head">
			<div>
				{kicker && <div className="bld-kicker">{kicker}</div>}
				<h2 className="pnl-title">{title}</h2>
			</div>
			{aside && <div className="pnl-aside">{aside}</div>}
		</header>
	);
}

export function PanelTabs<T extends string>({ tabs, value, onPick, label }: { tabs: readonly { id: T; label: string; title?: string }[]; value: T; onPick: (id: T) => void; label: string }) {
	return (
		<div className="pnl-tabs" role="tablist" aria-label={label}>
			{tabs.map((t) => (
				<button key={t.id} type="button" role="tab" aria-selected={value === t.id} title={t.title} className={`pnl-tab ${value === t.id ? "is-on" : ""}`} onClick={() => onPick(t.id)}>
					{t.label}
				</button>
			))}
		</div>
	);
}

/** List on one side, Inspector on the other. On a narrow screen they stack with the Inspector first. */
export function SplitPane({ list, inspector }: { list: ReactNode; inspector: ReactNode }) {
	return (
		<div className="pnl-split">
			<div className="pnl-list" role="listbox" aria-label="Choose one">
				{list}
			</div>
			<aside className="pnl-insp" aria-label="Details">
				{inspector}
			</aside>
		</div>
	);
}

export function ListHeading({ children, count }: { children: ReactNode; count?: number }) {
	return (
		<h3 className="pnl-lh">
			<span>{children}</span>
			{count !== undefined && <span className="pnl-count">{count}</span>}
		</h3>
	);
}

export function FactRow({ f }: { f: Fact }) {
	return (
		<div className="bld-stat">
			<span className="bld-stat-ic" aria-hidden="true">
				{f.icon}
			</span>
			<span className="bld-stat-text">
				<span className="bld-stat-label">{f.label}</span>
				<span className="bld-stat-sub">{f.sub}</span>
			</span>
			<span className={`bld-stat-val ${f.tone ? `is-${f.tone}` : ""}`}>{f.value}</span>
		</div>
	);
}

/** The one big button of an Inspector. `why` says in words why it is off. */
export function PrimaryAction({ label, onClick, disabled, why, tut, tone = "go" }: { label: string; onClick: () => void; disabled?: boolean; why?: string | null; tut?: string; tone?: "go" | "danger" }) {
	return (
		<div className="pnl-act">
			<button type="button" className={`ui-btn pnl-primary is-${tone}`} data-tut={tut} disabled={disabled} onClick={onClick}>
				{label}
			</button>
			{disabled && why && <p className="pnl-why">{why}</p>}
		</div>
	);
}
