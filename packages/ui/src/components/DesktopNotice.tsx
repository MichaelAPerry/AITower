import type { GameStore } from "@aitower/shared";
import { Stamp } from "./common";

/** "Best on desktop" memo for small screens. The checkbox turns the setting off for good; Dismiss hides it for this visit. */
export function DesktopNotice({ store, onDismiss }: { store: GameStore; onDismiss: () => void }) {
	return (
		<section className="ui-desknotice" role="note" aria-label="Best on desktop">
			<header className="tut-head">
				<span className="ui-dymo">NOTICE</span>
				<Stamp tone="red" className="ui-desknotice-stamp">
					Notice
				</Stamp>
			</header>
			<h3 className="tut-title">Best viewed on a desktop</h3>
			<p className="tut-body">
				This console is built for a large screen and a mouse. On a window this small the panels crowd the tower. It still runs, but a desktop browser is recommended.
			</p>
			<label className="ui-desknotice-check">
				<input
					type="checkbox"
					onChange={(e) => {
						if (e.currentTarget.checked) {
							store.setSettings({ showDesktopNotice: false });
							onDismiss();
						}
					}}
				/>
				<span>Don’t show this again</span>
			</label>
			<footer className="tut-actions">
				<span className="ui-grow" />
				<button type="button" className="ui-btn is-on" onClick={onDismiss}>
					Understood
				</button>
			</footer>
		</section>
	);
}
