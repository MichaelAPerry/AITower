import type { AscensionPath, ContentDB } from "@aitower/content";
import type { GameStore } from "@aitower/shared";
import type { SimView } from "@aitower/sim";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { Stamp } from "../components/common";
import { focusables, nextFocusIndex } from "../menu/focus";
import { ConfirmBar, StampBtn } from "../menu/parts";
import { confirmQuestion, filePath, type PathFiled, type PathRow, pathRows, pathToConfirm } from "./ascension";
import "./ascension.css";

/** The printed form (no hooks, so tests can walk it): one card per path, then the confirmation bar once one is picked. */
export function AscensionForm({ rows, tier, pending, onPick, onConfirm, onCancel, onClose }: { rows: PathRow[]; tier: number; pending: AscensionPath | null; onPick: (id: AscensionPath) => void; onConfirm: () => void; onCancel: () => void; onClose: () => void }) {
	const picked = rows.find((r) => r.id === pending);
	return (
		<section className="ui-asc" role="dialog" aria-modal="true" aria-labelledby="asc-title">
			<header className="ui-asc-head">
				<span className="ui-asc-form">FORM A-5 · CLEARANCE REVIEW BOARD</span>
				<h2 id="asc-title">FORM A-5: ASCENSION</h2>
				<button type="button" className="ui-btn ui-asc-close" onClick={onClose} title="Close the form without filing it (Esc)">
					Close
				</button>
			</header>
			<p className="ui-asc-intro">
				Clearance {tier} entitles the tower to commit to one path of Ascension. The election is entered once. It cannot be amended, withdrawn or appealed, and the Board will not be reminded of it.
			</p>
			<ul className="ui-asc-paths">
				{rows.map((r) => (
					<li key={r.id} className={`ui-asc-path ${r.available ? "" : "is-soon"} ${r.id === pending ? "is-picked" : ""}`} data-path={r.id}>
						<h3 className="ui-asc-name">{r.name}</h3>
						<p className="ui-asc-desc">{r.description}</p>
						{r.available ? (
							<StampBtn tone="green" rest="Choose" hot="File it" onClick={() => onPick(r.id)} disabled={pending !== null} title={`Elect ${r.name} (you will be asked to confirm)`} />
						) : (
							<Stamp tone="ink" className="ui-asc-soon">
								Coming soon
							</Stamp>
						)}
					</li>
				))}
			</ul>
			{picked && <ConfirmBar question={confirmQuestion(picked.name)} yes="File it" onYes={onConfirm} onNo={onCancel} />}
		</section>
	);
}

/**
 * Modal ascension sheet. The Hud pauses the game while it is open (like the research sheet); Esc (or Close) shuts it.
 * Choosing a path asks for confirmation; confirming dispatches `choosePath` and reports the filing to the Hud.
 */
export function AscensionSheet({ store, content, view, onClose, onFiled }: { store: GameStore; content: ContentDB; view: SimView; onClose: () => void; onFiled: (f: PathFiled) => void }) {
	const root = useRef<HTMLDivElement>(null);
	const [pending, setPending] = useState<AscensionPath | null>(null);
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
			<AscensionForm rows={pathRows(content, view)} tier={view.tier} pending={pending} onPick={(id) => setPending(pathToConfirm(content, id))} onConfirm={confirm} onCancel={() => setPending(null)} onClose={onClose} />
		</div>
	);
}
