import type { GameStore, Speed } from "@aitower/shared";

export interface MenuController {
	isOpen(): boolean;
	/** Open the menu and pause the game, remembering the speed. Idempotent. */
	open(): void;
	/** Close the menu and restore the remembered speed. Idempotent. */
	close(): void;
	toggle(): void;
}

/**
 * Menu open/close with pause and restore. Opening sets speed 0 and remembers the previous speed (which
 * may itself be 0). Closing restores it only if the speed is still 0, so a speed the store changed while the
 * menu was open (for example a load that sets its own speed) is respected.
 * `onChange` mirrors the open flag into React state.
 */
export function createMenuController(store: GameStore, onChange: (open: boolean) => void = () => {}): MenuController {
	let open = false;
	let saved: Speed = 1;
	const ctl: MenuController = {
		isOpen: () => open,
		open() {
			if (open) return;
			open = true;
			saved = store.get().speed;
			if (saved !== 0) store.setSpeed(0);
			onChange(true);
		},
		close() {
			if (!open) return;
			open = false;
			if (saved !== 0 && store.get().speed === 0) store.setSpeed(saved);
			onChange(false);
		},
		toggle() {
			if (open) ctl.close();
			else ctl.open();
		},
	};
	return ctl;
}
