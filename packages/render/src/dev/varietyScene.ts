/**
 * Dev scene for checking art variety and failure feedback by eye (`?scene=variety` in the harness):
 * every facility kind (racks by cooling variant) × `unlockTier` 1–4 × several widths, one row per floor, plus
 * rows for failure states, a blackout floor, a brownout floor, an overloaded coolant net and the new bots.
 * Synthetic defs are added on top of any base content, so it works before the real content lands.
 */
import type { BotDef, ContentDB, FacilityDef } from "@aitower/content";
import type { BotView, CoolantNetView, FacilityStatus, FacilityView, PowerNetView, SimView } from "@aitower/sim";
import { NATIVE_WIDTH } from "../art";
import { createFixture } from "./fixtureView";

type Kind = FacilityDef["kind"];

const COLORS = ["#c9bc9c", "#a8987a", "#5d6243", "#7d6227", "#6f7473", "#4a4335"];
const ACCENTS = ["#33ff66", "#c06a3b", "#ffb000", "#4f9a85", "#c8a248", "#e8dfc6"];

const RACK = { powerKw: 40, liquidFraction: 0, pflops: 20, storageTB: 0, failurePerDay: 0.01 };

export interface VarietyRow {
	label: string;
	kind: Kind;
	/** Rack cooling / storage flavour. */
	flavour?: "air" | "dlc" | "immersion" | "storage";
	widths: number[];
}

const nativeW = (k: Kind, fallback: number): number => NATIVE_WIDTH[k] ?? fallback;

export const VARIETY_ROWS: VarietyRow[] = [
	{ label: "rack air", kind: "rack", flavour: "air", widths: [1, 2, 3, 4] },
	{ label: "rack dlc", kind: "rack", flavour: "dlc", widths: [1, 2, 3, 4] },
	{ label: "rack immersion", kind: "rack", flavour: "immersion", widths: [1, 2, 3, 4] },
	{ label: "rack storage", kind: "rack", flavour: "storage", widths: [1, 2, 3, 4] },
	...(["crah", "chiller", "cdu", "grid_tie", "genset", "ups"] as const).map((kind) => ({ label: kind, kind, widths: [nativeW(kind, 2), nativeW(kind, 2) + 1] })),
	{ label: "depot", kind: "depot", widths: [2, 3] },
	{ label: "charger", kind: "charger", widths: [2, 3] },
];

const CATEGORY: Record<Kind, FacilityDef["category"]> = {
	rack: "rack",
	crah: "cooling",
	chiller: "cooling",
	cdu: "cooling",
	grid_tie: "power",
	genset: "power",
	ups: "power",
	depot: "logistics",
	charger: "logistics",
};

export const varietyId = (row: VarietyRow, tier: number, width: number): string => `var_${row.kind}${row.flavour ? `_${row.flavour}` : ""}_t${tier}_w${width}`;

function makeDef(row: VarietyRow, tier: number, width: number, i: number): FacilityDef {
	const f = row.flavour;
	const rack =
		row.kind !== "rack"
			? undefined
			: f === "storage"
				? { ...RACK, cooling: "air" as const, pflops: 0, storageTB: 2000 }
				: { ...RACK, cooling: f === "air" ? ("air" as const) : f === "dlc" ? ("dlc" as const) : ("immersion" as const), liquidFraction: f === "air" ? 0 : 0.9 };
	return {
		id: varietyId(row, tier, width),
		name: `${row.label} T${tier} w${width}`,
		description: "",
		kind: row.kind,
		category: CATEGORY[row.kind],
		width,
		cost: 0,
		upkeepPerDay: 0,
		unlockTier: tier,
		facilityKw: 0,
		color: COLORS[(i + tier) % COLORS.length],
		accent: ACCENTS[(i * 2 + tier) % ACCENTS.length],
		rack,
		cooling: row.kind === "crah" || row.kind === "chiller" || row.kind === "cdu" ? { capacityKw: 300 } : undefined,
		power: row.kind === "grid_tie" || row.kind === "genset" || row.kind === "ups" ? { capacityKw: 800, storageKwh: 200 } : undefined,
		logistics: row.kind === "depot" || row.kind === "charger" ? { capacity: 10 } : undefined,
	};
}

/** `base` plus one synthetic def per row × tier × width and the two new bots. */
export function varietyContent(base: ContentDB): ContentDB {
	const facilities: Record<string, FacilityDef> = { ...base.facilities };
	VARIETY_ROWS.forEach((row, i) => {
		for (let tier = 1; tier <= 4; tier++) for (const w of row.widths) facilities[varietyId(row, tier, w)] = makeDef(row, tier, w, i);
	});
	const bots: Record<string, BotDef> = {
		...base.bots,
		var_drone: { id: "var_drone", name: "Courier Drone", cost: 1, speed: 0.4, batteryTicks: 400, repairTicks: 20, color: "#a8987a", flying: true },
		var_lifter: { id: "var_lifter", name: "Heavy Lifter", cost: 1, speed: 0.15, batteryTicks: 800, repairTicks: 40, color: "#5d6243", carry: 3 },
		var_rover: { id: "var_rover", name: "Rover", cost: 1, speed: 0.25, batteryTicks: 600, repairTicks: 30, color: "#8a8f8c" },
	};
	return { ...base, facilities, bots } as ContentDB;
}

export interface VarietyScene {
	view: SimView;
	step(): SimView;
}

const GAP = 1;
const TIER_GAP = 2;
const LEFT = 2;

/** Floors: rows first, then the failure row and the three utility-trouble floors. */
export function createVarietyScene(): VarietyScene {
	const base = createFixture(600, 0);
	const rowFloors = VARIETY_ROWS.length;
	const FAIL = rowFloors; // failure statuses
	const DARK = rowFloors + 1; // blackout
	const BROWN = rowFloors + 2; // brownout
	const LEAK = rowFloors + 3; // overloaded coolant net
	const floorMax = LEAK;
	const floorMin = 0;
	const rowsW = VARIETY_ROWS.map((r) => 4 * (r.widths.reduce((a, b) => a + b, 0) + GAP * (r.widths.length - 1)) + TIER_GAP * 3);
	const width = LEFT + Math.max(...rowsW) + 4;
	const n = width * (floorMax - floorMin + 1);
	const idx = (x: number, f: number): number => (f - floorMin) * width + x;
	const slab = new Uint8Array(n);
	const power = new Uint8Array(n);
	const coolant = new Uint8Array(n);
	const airTemp = new Float32Array(n).fill(24);
	const powerNetOf = new Int32Array(n).fill(-1);
	const coolantNetOf = new Int32Array(n).fill(-1);
	for (let f = floorMin; f <= floorMax; f++) {
		for (let x = 0; x < width; x++) {
			slab[idx(x, f)] = 1;
			power[idx(x, f)] = 1;
			powerNetOf[idx(x, f)] = f === DARK ? 1 : f === BROWN ? 2 : 0;
		}
	}
	for (let x = 0; x < width; x++) {
		coolant[idx(x, LEAK)] = 1;
		coolantNetOf[idx(x, LEAK)] = 0;
	}

	let nextId = 1;
	const facilities: FacilityView[] = [];
	const content = varietyContent({ facilities: {}, bots: {} } as unknown as ContentDB);
	const place = (defId: string, floor: number, x: number, status: FacilityStatus = "ok", extra: Partial<FacilityView> = {}): void => {
		const d = content.facilities[defId];
		const isRack = d.kind === "rack";
		facilities.push({
			id: nextId++,
			defId,
			floor,
			x,
			width: d.width,
			enabled: true,
			status,
			tempC: isRack ? 70 : 24,
			clock: status === "ok" ? 1 : 0.5,
			health: status === "failed" ? 0.2 : 1,
			powerKw: status === "ok" ? 30 : 0,
			heatKw: isRack && status === "ok" ? 30 : d.kind === "chiller" || d.kind === "crah" || d.kind === "cdu" ? 120 : 0,
			jobId: status === "ok" ? 1 : null,
			powerNet: powerNetOf[idx(x, floor)],
			coolantNet: coolant[idx(x, floor)] ? 0 : null,
			running: d.kind === "genset" ? true : undefined,
			charge: d.kind === "ups" ? 0.6 : undefined,
			stored: d.kind === "depot" ? 5 : undefined,
			...extra,
		});
	};
	VARIETY_ROWS.forEach((row, r) => {
		let x = LEFT;
		for (let tier = 1; tier <= 4; tier++) {
			for (const w of row.widths) {
				place(varietyId(row, tier, w), r, x);
				x += w + GAP;
			}
			x += TIER_GAP - GAP;
		}
	});

	// Failure statuses (air + immersion racks side by side).
	const air = (w: number): string => varietyId(VARIETY_ROWS[0], 2, w);
	const imm = (w: number): string => varietyId(VARIETY_ROWS[2], 3, w);
	let fx = LEFT;
	const seq: [string, FacilityStatus, Partial<FacilityView>][] = [
		[air(2), "tripped", { tempC: 97 }],
		[imm(2), "tripped", { tempC: 97 }],
		[air(2), "failed", { tempC: 98 }], // hot: fire + smoke
		[imm(2), "failed", { tempC: 98 }],
		[air(2), "failed", { tempC: 60 }], // cool: wrench + sparks only
		[air(2), "noCoolant", { tempC: 91 }],
		[air(2), "unpowered", { tempC: 25 }],
		[air(2), "throttled", { tempC: 88 }],
	];
	for (const [id, st, ex] of seq) {
		place(id, FAIL, fx, st, ex);
		fx += 4;
	}
	// Blackout / brownout floors.
	for (const [fl, st] of [
		[DARK, "unpowered"],
		[BROWN, "brownout"],
	] as const) {
		let bx = LEFT;
		for (let k = 0; k < 4; k++) {
			place(k % 2 ? imm(2) : air(2), fl, bx, st, { tempC: 40 });
			bx += 4;
		}
	}
	// Overloaded coolant net.
	for (let k = 0; k < 3; k++) place(varietyId(VARIETY_ROWS[1], 2, 2), LEAK, LEFT + 2 + k * 6, "noCoolant", { tempC: 90 });

	const bots: BotView[] = [
		{ id: 1, defId: "var_rover", x: LEFT + 3, floor: 0, state: "toTarget", battery: 0.8, carrying: true, workOrderId: 1 },
		{ id: 2, defId: "var_lifter", x: LEFT + 8, floor: 0, state: "toDepot", battery: 0.7, carrying: true, workOrderId: 2 },
		{ id: 3, defId: "var_lifter", x: LEFT + 12, floor: 0, state: "idle", battery: 0.4, carrying: false, workOrderId: null },
		{ id: 4, defId: "var_drone", x: LEFT + 16, floor: 0, state: "flying", battery: 0.9, carrying: true, workOrderId: 3 },
		{ id: 5, defId: "var_drone", x: LEFT + 20, floor: 0, state: "idle", battery: 0.6, carrying: false, workOrderId: null },
		{ id: 6, defId: "var_drone", x: LEFT + 24, floor: 0, state: "repairing", battery: 0.5, carrying: false, workOrderId: 4 },
	];

	const powerNets: PowerNetView[] = [
		{ id: 0, supplyKw: 9000, demandKw: 4000, satisfaction: 1, storedKwh: 0, storageCapacityKwh: 0, gridImportKw: 4000 },
		{ id: 1, supplyKw: 0, demandKw: 200, satisfaction: 0, storedKwh: 0, storageCapacityKwh: 0, gridImportKw: 0 },
		{ id: 2, supplyKw: 100, demandKw: 200, satisfaction: 0.5, storedKwh: 0, storageCapacityKwh: 0, gridImportKw: 0 },
	];
	const coolantNets: CoolantNetView[] = [{ id: 0, capacityKw: 100, loadKw: 320, supplyTempC: 30 }];

	const view: SimView = {
		...base.view,
		tick: 0,
		width,
		floorMin,
		floorMax,
		slab,
		power,
		coolant,
		airTemp,
		powerNetOf,
		coolantNetOf,
		facilities,
		lifts: [],
		bots,
		powerNets,
		coolantNets,
	};
	const drone = bots[3];
	const step = (): SimView => {
		view.tick++;
		// The courier drone shuttles between floors 0 and 3 at a fractional floor.
		const ph = (view.tick % 60) / 60;
		drone.floor = 3 * (ph < 0.5 ? ph * 2 : 2 - ph * 2);
		drone.x = LEFT + 16 + 6 * Math.sin(view.tick * 0.05);
		return view;
	};
	step();
	return { view, step };
}
