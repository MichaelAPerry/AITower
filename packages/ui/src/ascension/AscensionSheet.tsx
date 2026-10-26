import type { AscensionPath, ContentDB } from "@aitower/content";
import type { GameStore } from "@aitower/shared";
import type { SimView } from "@aitower/sim";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { Stamp } from "../components/common";
import { focusables, nextFocusIndex } from "../menu/focus";
import { ConfirmBar, StampBtn } from "../menu/parts";
import { AffinityBars } from "../components/AffinityBars";
import { confirmQuestion, filePath, leadingPath, type PathFiled, type PathRow, pathRows, pathToConfirm, preselectedPath } from "./ascension";
import "./ascension.css";
import { BACKDROP } from "../art";
import { champLine } from "../soul/soul";

/** The printed form (no hooks, so tests can walk it): one card per path, then the confirmation bar once one is picked. */
export function AscensionForm({ rows, tier, affinity, content, soul, pending, onPick, onConfirm, onCancel, onClose }: { rows: PathRow[]; tier: number; affinity?: SimView["affinity"]; content?: ContentDB; soul?: SimView["soul"]; pending: AscensionPath | null; onPick: (id: AscensionPath) => void; onConfirm: () => void; onCancel: () => void; onClose: () => void }) {
	const picked = rows.find((r) => r.id === pending);
	return (
		<section className="ui-asc" role="dialog" aria-modal="true" aria-labelledby="asc-title">
			<header className="ui-asc-head">
				<span className="ui-asc-form">FORM A-5</span>
				<h2 id="asc-title">WHICH WAY THE WORLD ENDS</h2>
				<button type="button" className="ui-btn ui-asc-close" onClick={onClose} title="Close without choosing (Esc)">
					Close
				</button>
			</header>
			<p className="ui-asc-intro">
				Level {tier}. Commit the tower to one tree. The Lattice fills whether you sign or not; the Flesh and the Garden only open to a tower they accept, and only with their champion's trust. The election is entered once.
			</p>
			{affinity && !soul && content && <AffinityBars affinity={affinity} content={content} leading={leadingPath(affinity)} />}
			<ul className="ui-asc-paths">
				{rows.map((r) => (
					<li key={r.id} className={`ui-asc-path ${r.available ? "" : "is-soon"} ${r.id === pending ? "is-picked" : ""} ${soul?.commitBlock[r.id] ? "is-blocked" : ""}`} data-path={r.id}>
						<img className="ui-asc-art" src={BACKDROP[r.id]} alt="" draggable={false} />
						<h3 className="ui-asc-name">{r.name}</h3>
						<p className="ui-asc-desc">{r.description}</p>
						{soul && <p className="ui-asc-champ">{champLine(soul, r.id)}</p>}
						{soul?.commitBlock[r.id] && <p className="ui-asc-block">{soul.commitBlock[r.id]}</p>}
						{r.available ? (
							<StampBtn tone="green" rest="Choose" hot="Confirm" onClick={() => onPick(r.id)} disabled={r.id === pending || !!soul?.commitBlock[r.id]} title={`Elect ${r.name} (you will be asked to confirm)`} />
						) : (
							<Stamp tone="ink" className="ui-asc-soon">
								Coming soon
							</Stamp>
						)}
					</li>
				))}
			</ul>
			{picked && <ConfirmBar question={confirmQuestion(picked.name)} yes="Confirm" onYes={onConfirm} onNo={onCancel} />}
		</section>
	);
}

/**
 * Modal ascension sheet. The Hud pauses the game while it is open (like the research sheet); Esc (or Close) shuts it.
 * Choosing a path asks for confirmation; confirming dispatches `choosePath` and reports the filing to the Hud.
 */
export function AscensionSheet({ store, content, view, onClose, onFiled }: { store: GameStore; content: ContentDB; view: SimView; onClose: () => void; onFiled: (f: PathFiled) => void }) {
	const root = useRef<HTMLDivElement>(null);
	const [pending, setPending] = useState<AscensionPath | null>(() => {
		const p = preselectedPath(content, view.affinity);
		return p && !view.soul?.commitBlock[p] ? p : null;
	});
	useEffect(() => {
		const els = root.current ? focusables(root.current) : [];
		(els.find((e) => e.closest(".ui-asc-path:not(.is-soon)")) ?? els[0])?.focus();
	}, []);

	const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
		// Nothing typed in the sheet may reach the game hotkeys or the camera.
		e.stopPropagation();
		if (e.key === "Escape") {
			e.preventDefault();
			onClose();
			return;
		}
		if (e.key !== "Tab" || !root.current) return;
		const els = focusables(root.current);
		const i = nextFocusIndex(els.length, els.indexOf(document.activeElement as HTMLElement), e.shiftKey);
		if (i >= 0) {
			e.preventDefault();
			els[i].focus();
		}
	};
	const confirm = (): void => {
		const filed = pending ? filePath(store, content, pending) : null;
		setPending(null);
		if (filed) onFiled(filed);
	};

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: modal sheet; the key handler implements Esc and the focus loop
		<div className="ui-asc-backdrop" ref={root} onKeyDown={onKeyDown}>
			<AscensionForm rows={pathRows(content, view)} tier={view.tier} affinity={view.affinity} content={content} soul={view.soul} pending={pending} onPick={(id) => setPending(pathToConfirm(content, id))} onConfirm={confirm} onCancel={() => setPending(null)} onClose={onClose} />
		</div>
	);
}
