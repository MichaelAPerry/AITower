import type { CellPointerEvent } from "@aitower/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Camera } from "../camera";
import { Input, type InputHost } from "./input";

/** Minimal DOM stand-ins: the input code only needs addEventListener, a bounding rect and a style. */
class FakeCanvas extends EventTarget {
	style = { cursor: "" };
	getBoundingClientRect = () => ({ left: 0, top: 0 });
	setPointerCapture() {}
	releasePointerCapture() {}
}

const ptr = (type: string, props: Record<string, unknown>): Event => Object.assign(new Event(type, { cancelable: true }), { button: 0, buttons: 0, pointerId: 1, clientX: 0, clientY: 0, shiftKey: false }, props);

describe("Input screen-space widgets (alert arrows)", () => {
	const g = globalThis as { window?: unknown };
	let canvas: FakeCanvas;
	let events: CellPointerEvent[];
	let pressed: [number, number][];
	let hit: boolean;
	let input: Input;
	const cam: Camera = { cx: 0, cy: 0, zoom: 2, vw: 800, vh: 600 };

	beforeEach(() => {
		g.window = new EventTarget();
		canvas = new FakeCanvas();
		events = [];
		pressed = [];
		hit = false;
		const host: InputHost = {
			camera: () => cam,
			setCamera: () => {},
			grid: () => ({ width: 10, floorMin: 0, floorMax: 3 }),
			press: (x, y) => {
				if (hit) pressed.push([x, y]);
				return hit;
			},
			over: () => hit,
		};
		input = new Input(canvas as unknown as HTMLCanvasElement, host);
		input.subscribe((e) => events.push(e));
	});

	afterEach(() => {
		input.destroy();
		g.window = undefined;
	});

	it("a press on a widget is consumed: no tool events for its down or up", () => {
		hit = true;
		canvas.dispatchEvent(ptr("pointerdown", { clientX: 30, clientY: 40 }));
		canvas.dispatchEvent(ptr("pointerup", { clientX: 30, clientY: 40 }));
		expect(pressed).toEqual([[30, 40]]);
		expect(events).toEqual([]);
	});

	it("a press elsewhere still reaches the tool listeners", () => {
		hit = false;
		canvas.dispatchEvent(ptr("pointerdown", { clientX: 400, clientY: 300 }));
		canvas.dispatchEvent(ptr("pointerup", { clientX: 400, clientY: 300 }));
		expect(events.map((e) => e.kind)).toEqual(["down", "up"]);
	});

	it("only swallows the release of the consumed press, not a later one", () => {
		hit = true;
		canvas.dispatchEvent(ptr("pointerdown", {}));
		canvas.dispatchEvent(ptr("pointerup", {}));
		hit = false;
		canvas.dispatchEvent(ptr("pointerdown", {}));
		canvas.dispatchEvent(ptr("pointerup", {}));
		expect(events.map((e) => e.kind)).toEqual(["down", "up"]);
	});

	it("right-button presses never hit widgets", () => {
		hit = true;
		canvas.dispatchEvent(ptr("pointerdown", { button: 2 }));
		expect(pressed).toEqual([]);
	});

	it("shows a pointer cursor over a widget and clears it elsewhere; moves still reach listeners", () => {
		hit = true;
		canvas.dispatchEvent(ptr("pointermove", { buttons: 0 }));
		expect(canvas.style.cursor).toBe("pointer");
		hit = false;
		canvas.dispatchEvent(ptr("pointermove", { buttons: 0 }));
		expect(canvas.style.cursor).toBe("");
		expect(events.filter((e) => e.kind === "move")).toHaveLength(2);
	});
});
