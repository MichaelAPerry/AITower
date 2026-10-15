/**
 * DOM input: right/middle drag + WASD/arrows pan, wheel zoom toward cursor,
 * and left-button cell pointer events for tools.
 */
import type { CellPointerEvent } from "@aitower/shared";
import type { Camera, GridDims } from "../camera";
import { panBy, screenToCell, stepZoom, zoomAt } from "../camera";
import { PAN_SPEED } from "../constants";

const PAN_KEYS: Record<string, [number, number]> = {
	KeyW: [0, 1],
	ArrowUp: [0, 1],
	KeyS: [0, -1],
	ArrowDown: [0, -1],
	KeyA: [1, 0],
	ArrowLeft: [1, 0],
	KeyD: [-1, 0],
	ArrowRight: [-1, 0],
};

export interface InputHost {
	camera(): Camera;
	setCamera(cam: Camera): void;
	grid(): GridDims | null;
}

const isTyping = (t: EventTarget | null): boolean => {
	const el = t as HTMLElement | null;
	if (!el || typeof el.tagName !== "string") return false;
	return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
};

export class Input {
	private listeners = new Set<(e: CellPointerEvent) => void>();
	private keys = new Set<string>();
	private drag: { id: number; x: number; y: number } | null = null;
	private off: (() => void)[] = [];
	private wheelAcc = 0;

	constructor(
		private readonly canvas: HTMLCanvasElement,
		private readonly host: InputHost,
	) {
		const on = <K extends keyof HTMLElementEventMap>(
			el: HTMLElement | Window,
			type: K,
			fn: (e: HTMLElementEventMap[K]) => void,
			opts?: AddEventListenerOptions,
		) => {
			el.addEventListener(type, fn as EventListener, opts);
			this.off.push(() => el.removeEventListener(type, fn as EventListener, opts));
		};
		on(canvas, "pointerdown", (e) => this.down(e));
		on(canvas, "pointermove", (e) => this.move(e));
		on(canvas, "pointerup", (e) => this.up(e));
		on(canvas, "pointercancel", (e) => this.up(e));
		on(canvas, "pointerleave", (e) => this.emit("leave", e, null, -1));
		on(canvas, "wheel", (e) => this.wheel(e), { passive: false });
		on(canvas, "contextmenu", (e) => e.preventDefault());
		on(window, "keydown", (e) => {
			if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
			if (e.code in PAN_KEYS) {
				this.keys.add(e.code);
				if (e.code.startsWith("Arrow")) e.preventDefault();
			}
		});
		on(window, "keyup", (e) => this.keys.delete(e.code));
		on(window, "blur", () => this.keys.clear());
	}

	subscribe(cb: (e: CellPointerEvent) => void): () => void {
		this.listeners.add(cb);
		return () => this.listeners.delete(cb);
	}

	/** Apply keyboard panning for a frame of `dt` seconds. */
	tick(dt: number): void {
		if (this.keys.size === 0) return;
		let dx = 0;
		let dy = 0;
		for (const k of this.keys) {
			const v = PAN_KEYS[k];
			if (v) {
				dx += v[0];
				dy += v[1];
			}
		}
		if (dx || dy) this.host.setCamera(panBy(this.host.camera(), dx * PAN_SPEED * dt, dy * PAN_SPEED * dt));
	}

	private local(e: MouseEvent): { x: number; y: number } {
		const r = this.canvas.getBoundingClientRect();
		return { x: e.clientX - r.left, y: e.clientY - r.top };
	}

	private cellAt(e: MouseEvent): CellPointerEvent["cell"] {
		const grid = this.host.grid();
		if (!grid) return null;
		const p = this.local(e);
		return screenToCell(this.host.camera(), grid, p.x, p.y);
	}

	private emit(kind: CellPointerEvent["kind"], e: MouseEvent, cell: CellPointerEvent["cell"], button: number): void {
		const ev: CellPointerEvent = { kind, cell, button, shift: e.shiftKey };
		for (const l of this.listeners) l(ev);
	}

	private down(e: PointerEvent): void {
		if (e.button === 1 || e.button === 2) {
			e.preventDefault();
			this.drag = { id: e.pointerId, ...this.local(e) };
			this.canvas.setPointerCapture?.(e.pointerId);
			return;
		}
		if (e.button === 0) this.emit("down", e, this.cellAt(e), 0);
	}

	private move(e: PointerEvent): void {
		if (this.drag && this.drag.id === e.pointerId) {
			const p = this.local(e);
			this.host.setCamera(panBy(this.host.camera(), p.x - this.drag.x, p.y - this.drag.y));
			this.drag.x = p.x;
			this.drag.y = p.y;
		}
		// `button` on move: 0 while the left button is held, -1 otherwise.
		this.emit("move", e, this.cellAt(e), e.buttons & 1 ? 0 : -1);
	}

	private up(e: PointerEvent): void {
		if (this.drag && this.drag.id === e.pointerId && e.button !== 0) {
			this.drag = null;
			this.canvas.releasePointerCapture?.(e.pointerId);
			return;
		}
		if (e.button === 0) this.emit("up", e, this.cellAt(e), 0);
	}

	private wheel(e: WheelEvent): void {
		e.preventDefault();
		// Accumulate so trackpads (many tiny deltas) step one zoom level at a time.
		this.wheelAcc += e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
		if (Math.abs(this.wheelAcc) < 40) return;
		const dir = this.wheelAcc < 0 ? 1 : -1;
		this.wheelAcc = 0;
		const cam = this.host.camera();
		const z = stepZoom(cam.zoom, dir);
		if (z === cam.zoom) return;
		const p = this.local(e);
		this.host.setCamera(zoomAt(cam, z, p.x, p.y));
	}

	destroy(): void {
		for (const f of this.off) f();
		this.off = [];
		this.listeners.clear();
		this.keys.clear();
	}
}
