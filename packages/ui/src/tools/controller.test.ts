import type { CommandResult, SimCommand } from "@aitower/sim";
import type { CellPointerEvent, GameState, GameStore, Ghost, Selection, Tool } from "@aitower/shared";
import { describe, expect, it } from "vitest";
import { createFakeContent, createFakeStore } from "../dev/fakeStore";
import type { Notice } from "../notices";
import { createToolController, liftDragCost } from "./controller";
import { lPath, liftSpan, slabSpan } from "./geometry";
import { pickAt } from "./pick";

const content = createFakeContent();

/** Wrap the dev fake store, recording dispatches/ghosts and optionally forcing a result. */
function harness(tool: Tool, result?: CommandResult, canBuild?: (cmd: SimCommand) => CommandResult) {
	const base = createFakeStore(content);
	const sent: SimCommand[] = [];
	const ghosts: (Ghost | null)[] = [];
	const notices: Notice[] = [];
	const asked: SimCommand[] = [];
	let sel: Selection = null;
	let state: GameState = { ...base.get(), tool, selection: null };
	const store: GameStore = {
		...base,
		get: () => state,
		canBuild: (c) => {
			asked.push(c);
			return canBuild ? canBuild(c) : base.canBuild(c);
		},
		dispatch: (c) => {
			sent.push(c);
			return result ?? { ok: true };
		},
		setTool: (t) => {
			state = { ...state, tool: t };
		},
		setSelection: (s) => {
			sel = s;
		},
		setGhost: (g) => {
			ghosts.push(g);
		},
	};
	const ctl = createToolController(store, content, { notify: (n) => notices.push(n) });
	const ev = (kind: CellPointerEvent["kind"], x: number | null, floor = 0, button = 0): void =>
		ctl.handle({ kind, cell: x === null ? null : { x, floor }, button, shift: false });
	return { store, ctl, ev, sent, ghosts, notices, asked, sel: () => sel, tool: () => state.tool, lastGhost: () => ghosts[ghosts.length - 1] };
}

describe("geometry", () => {
	it("normalises slab spans dragged right→left", () => {
		expect(slabSpan(2, 9, 4)).toMatchObject({ floor: 2, x0: 4, x1: 9 });
		expect(slabSpan(2, 9, 4).cells).toHaveLength(6);
	});
	it("builds an L path horizontal-first without duplicates", () => {
		expect(lPath({ x: 2, floor: 1 }, { x: 4, floor: 3 })).toEqual([
			{ x: 2, floor: 1 },
			{ x: 3, floor: 1 },
			{ x: 4, floor: 1 },
			{ x: 4, floor: 2 },
			{ x: 4, floor: 3 },
		]);
		expect(lPath({ x: 5, floor: 2 }, { x: 3, floor: 0 })).toEqual([
			{ x: 5, floor: 2 },
			{ x: 4, floor: 2 },
			{ x: 3, floor: 2 },
			{ x: 3, floor: 1 },
			{ x: 3, floor: 0 },
		]);
		expect(lPath({ x: 1, floor: 1 }, { x: 1, floor: 1 })).toEqual([{ x: 1, floor: 1 }]);
	});
	it("normalises lift spans", () => {
		expect(liftSpan(3, 4, -1)).toMatchObject({ x: 3, floorMin: -1, floorMax: 4 });
	});
});

describe("tool controller", () => {
	it("select: picks facility, then bot within 1 tile, then lift, else null", () => {
		const h = harness({ kind: "select" });
		h.ev("down", 6, 0); // grid tie spans x6..7
		expect(h.sel()).toEqual({ kind: "facility", id: 1 });
		h.ev("down", 15, 2); // bot #1 at x14.3 F2 (no facility at 15? racks are 8..15) → facility wins
		expect(h.sel()?.kind).toBe("facility");
		h.ev("down", 2, 1); // lift column x2
		expect(h.sel()).toEqual({ kind: "lift", id: 1 });
		h.ev("down", 30, 5);
		expect(h.sel()).toBeNull();
	});

	it("pickAt prefers the nearest bot within one tile", () => {
		const v = createFakeStore(content).get().view;
		expect(pickAt(v, { x: 4, floor: 0 })).toEqual({ kind: "bot", id: 2 }); // bot at x5, F0, no facility at x4
		expect(pickAt(v, { x: 3, floor: 0 })).toBeNull();
	});

	it("place: ghost uses def footprint + canPlace; click dispatches and tool stays", () => {
		const h = harness({ kind: "place", defId: "genset" });
		h.ev("move", 20, 1);
		expect(h.lastGhost()).toMatchObject({ valid: true, defId: "genset", cells: [{ x: 20, floor: 1 }, { x: 21, floor: 1 }, { x: 22, floor: 1 }] });
		h.ev("move", 8, 2); // occupied by racks
		expect(h.lastGhost()).toMatchObject({ valid: false, label: "Space occupied" });
		h.ev("down", 20, 1);
		expect(h.sent).toEqual([{ type: "place", defId: "genset", floor: 1, x: 20 }]);
		expect(h.tool()).toEqual({ kind: "place", defId: "genset" });
	});

	it("place: clicking an already-placed device selects it instead of building (tool stays held)", () => {
		const h = harness({ kind: "place", defId: "genset" });
		h.ev("down", 6, 0); // grid tie (facility 1) spans x6..7
		expect(h.sent).toEqual([]);
		expect(h.sel()).toEqual({ kind: "facility", id: 1 });
		expect(h.tool()).toEqual({ kind: "place", defId: "genset" });
	});

	it("right click (down and up on one cell) drops the build tool", () => {
		const h = harness({ kind: "place", defId: "genset" });
		h.ev("down", 20, 1, 2);
		h.ev("up", 20, 1, 2);
		expect(h.tool()).toEqual({ kind: "select" });
		expect(h.sent).toEqual([]);
	});

	it("slab: drag right→left emits a normalised buildSlab", () => {
		const h = harness({ kind: "slab" });
		h.ev("down", 30, 1);
		h.ev("move", 27, 3); // floor follows the start
		expect(h.lastGhost()?.cells).toHaveLength(4);
		expect(h.lastGhost()?.cells.every((c) => c.floor === 1)).toBe(true);
		h.ev("up", 26, 3);
		expect(h.sent).toEqual([{ type: "buildSlab", floor: 1, x0: 26, x1: 30 }]);
	});

	it("conduit: drag builds an L-shaped path with all cells", () => {
		const h = harness({ kind: "conduit", layer: "coolant" });
		h.ev("down", 2, 1);
		h.ev("move", 4, 3);
		h.ev("up", 4, 3);
		expect(h.sent).toEqual([{ type: "buildConduit", layer: "coolant", cells: lPath({ x: 2, floor: 1 }, { x: 4, floor: 3 }) }]);
	});

	it("lift: vertical drag emits buildLift; single-floor drag is refused", () => {
		const h = harness({ kind: "lift" });
		h.ev("down", 30, 4);
		h.ev("move", 31, 1);
		h.ev("up", 31, 1);
		expect(h.sent).toEqual([{ type: "buildLift", x: 30, floorMin: 1, floorMax: 4 }]);
		h.ev("down", 30, 2);
		h.ev("up", 30, 2);
		expect(h.sent).toHaveLength(1);
		expect(h.notices).toHaveLength(1);
	});

	it("demolish: click = one command, drag = every visited cell once", () => {
		const h = harness({ kind: "demolish" });
		h.ev("down", 5, 0);
		h.ev("up", 5, 0);
		expect(h.sent).toEqual([{ type: "demolish", floor: 0, x: 5 }]);
		h.sent.length = 0;
		h.ev("down", 1, 2);
		h.ev("move", 2, 2);
		h.ev("move", 1, 2);
		h.ev("move", 3, 2);
		expect(h.lastGhost()).toMatchObject({ valid: false, label: "Demolish ×3" });
		h.ev("up", 3, 2);
		expect(h.sent.map((c) => (c.type === "demolish" ? c.x : -1))).toEqual([1, 2, 3]);
	});

	it("surfaces rejection reasons and aggregates demolish failures", () => {
		const h = harness({ kind: "demolish" }, { ok: false, reason: "Nothing here" });
		h.ev("down", 1, 2);
		h.ev("move", 2, 2);
		h.ev("up", 2, 2);
		expect(h.notices).toEqual([expect.objectContaining({ text: "Nothing here (×2)", severity: "warn" })]);
	});

	it("right-click (no drag) returns to select; leave cancels a drag", () => {
		const h = harness({ kind: "slab" });
		h.ev("down", 3, 1);
		h.ev("leave", null);
		h.ev("up", 5, 1);
		expect(h.sent).toHaveLength(0);
		h.ev("down", 3, 1, 2);
		h.ev("up", 3, 1, 2);
		expect(h.tool()).toEqual({ kind: "select" });
	});

	it("ignores out-of-bounds cells and resets drag when the tool changes", () => {
		const h = harness({ kind: "slab" });
		h.ev("down", 99, 1);
		h.ev("up", 99, 1);
		expect(h.sent).toHaveLength(0);
		h.ev("down", 3, 1);
		h.store.setTool({ kind: "lift" });
		h.ev("up", 3, 2);
		expect(h.sent).toHaveLength(0);
	});
});

describe("ghost validity comes from store.canBuild", () => {
	const ok: CommandResult = { ok: true };
	const deny = (reason: string): CommandResult => ({ ok: false, reason });

	it("slab: asks canBuild with the normalised span and shows its verdict with the cost label", () => {
		const h = harness({ kind: "slab" }, undefined, () => ok);
		h.ev("down", 30, 1);
		h.ev("move", 27, 1);
		expect(h.asked.at(-1)).toEqual({ type: "buildSlab", floor: 1, x0: 27, x1: 30 });
		expect(h.lastGhost()).toMatchObject({ valid: true });
		expect(h.lastGhost()?.label).toMatch(/^Slab ×4 · \$/);
	});
	it("slab: a refusal turns the ghost red with the sim's reason, capitalised", () => {
		const h = harness({ kind: "slab" }, undefined, () => deny("no slab below at x=30"));
		h.ev("move", 30, 7);
		expect(h.lastGhost()).toMatchObject({ valid: false, label: "No slab below at x=30" });
	});
	it("does not second-guess canBuild with client-side estimates (cash, support)", () => {
		// 36 new tiles would cost far more than the fixture's cash and floor 7 has no slab below, yet canBuild says ok.
		const h = harness({ kind: "slab" }, undefined, () => ok);
		h.ev("down", 0, 7);
		h.ev("move", 39, 7);
		expect(h.lastGhost()?.valid).toBe(true);
		// ... and the other way round: affordable, supported, but canBuild refuses.
		const r = harness({ kind: "slab" }, undefined, () => deny("insufficient funds (need $5)"));
		r.ev("move", 20, 1);
		expect(r.lastGhost()).toMatchObject({ valid: false, label: "Insufficient funds (need $5)" });
	});
	it("real canBuild rules (fake store): slab above empty floor and already-built slab are red", () => {
		const h = harness({ kind: "slab" });
		h.ev("move", 3, 8);
		expect(h.lastGhost()).toMatchObject({ valid: false });
		expect(h.lastGhost()?.label).toMatch(/slab below/i);
		h.ev("move", 3, 1);
		expect(h.lastGhost()).toMatchObject({ valid: false, label: "Already built" });
		h.ev("move", 30, 5); // floor 5 is slabbed only to x=23; floor 4 below is slabbed to x=35
		expect(h.lastGhost()).toMatchObject({ valid: true });
	});
	it("conduit: asks for the full L path and shows the cost label", () => {
		const h = harness({ kind: "conduit", layer: "power" }, undefined, () => ok);
		h.ev("down", 2, 1);
		h.ev("move", 4, 3);
		expect(h.asked.at(-1)).toEqual({ type: "buildConduit", layer: "power", cells: lPath({ x: 2, floor: 1 }, { x: 4, floor: 3 }) });
		expect(h.lastGhost()?.valid).toBe(true);
		expect(h.lastGhost()?.label).toMatch(/^Power conduit ×5 · \$/);
		const bad = harness({ kind: "conduit", layer: "coolant" }, undefined, () => deny("conduit at (3, 3) needs slab or an adjacent conduit"));
		bad.ev("move", 3, 3);
		expect(bad.lastGhost()).toMatchObject({ valid: false, label: "Conduit at (3, 3) needs slab or an adjacent conduit" });
	});
	it("lift: hover is valid when the cell can pair with the floor above or below", () => {
		const h = harness({ kind: "lift" }, undefined, (c) => (c.type === "buildLift" && c.floorMin === 2 && c.floorMax === 3 ? ok : deny("no slab at floor 3")));
		h.ev("move", 30, 2); // up-span (2,3) ok
		expect(h.lastGhost()).toMatchObject({ valid: true, label: "Drag up/down to size the shaft" });
		h.ev("move", 30, 3); // up (3,4) denied, down (2,3) ok
		expect(h.lastGhost()?.valid).toBe(true);
		h.ev("move", 30, 6); // neither
		expect(h.lastGhost()).toMatchObject({ valid: false, label: "No slab at floor 3" });
	});
	it("lift: dragging asks about the whole shaft and labels the cost", () => {
		const h = harness({ kind: "lift" }, undefined, () => ok);
		h.ev("down", 30, 1);
		h.ev("move", 30, 4);
		expect(h.asked.at(-1)).toEqual({ type: "buildLift", x: 30, floorMin: 1, floorMax: 4 });
		expect(h.lastGhost()).toMatchObject({ valid: true });
		expect(h.lastGhost()?.label).toMatch(/^Lift 4 floors · \$/);
		const d = harness({ kind: "lift" }, undefined, () => deny("lift already at floor 2"));
		d.ev("down", 2, 1);
		d.ev("move", 2, 3);
		expect(d.lastGhost()).toMatchObject({ valid: false, label: "Lift already at floor 2" });
	});
	it("lift (fake store rules): a column on an existing shaft offers to extend it, a free slabbed column is green", () => {
		const h = harness({ kind: "lift" });
		h.ev("move", 2, 1);
		expect(h.lastGhost()).toMatchObject({ valid: true, label: expect.stringContaining("extend this lift") });
		h.ev("move", 30, 1);
		expect(h.lastGhost()?.valid).toBe(true);
	});
	it("place and demolish ghosts are unchanged (canPlace, intentionally red)", () => {
		const h = harness({ kind: "place", defId: "genset" }, undefined, () => deny("should not be asked"));
		h.ev("move", 20, 1);
		expect(h.asked).toHaveLength(0);
		expect(h.lastGhost()).toMatchObject({ valid: true });
	});
});

describe("liftDragCost", () => {
	const st = { liftBase: 100_000, liftPerFloor: 20_000 } as never;
	const view = { lifts: [{ x: 2, floorMin: 1, floorMax: 3 }] };
	it("charges base plus per floor for a new shaft", () => {
		expect(liftDragCost(view, st, 9, 1, 4)).toEqual({ cost: 180_000, extends: false, added: 4 });
	});
	it("charges per added floor only when the drag extends a shaft (overlap or touching)", () => {
		expect(liftDragCost(view, st, 2, 2, 6)).toEqual({ cost: 60_000, extends: true, added: 3 });
		expect(liftDragCost(view, st, 2, 4, 5)).toEqual({ cost: 40_000, extends: true, added: 2 });
		expect(liftDragCost(view, st, 2, 0, 1)).toEqual({ cost: 20_000, extends: true, added: 1 });
	});
});
