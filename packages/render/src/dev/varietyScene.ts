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
	flavour?: "air" | "dlc" | "immersion" | "storage" | "organoid" | "dna" | "neural" | "culling";
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
	// Wetware (M3).
	{ label: "rack organoid", kind: "rack", flavour: "organoid", widths: [1, 2, 3] },
	{ label: "rack dna vault", kind: "rack", flavour: "dna", widths: [1, 2, 3] },
	{ label: "rack neural pit", kind: "rack", flavour: "neural", widths: [5, 6] },
	{ label: "nutrient plant", kind: "nutrient", widths: [2, 3] },
	{ label: "sterile bay", kind: "sterilizer", widths: [2, 3] },
	{ label: "culling room", kind: "sterilizer", flavour: "culling", widths: [2, 3] },
	{ label: "quarantine lock", kind: "quarantine", widths: [2, 3] },
	{ label: "bioreactor", kind: "bioreactor", widths: [3, 4] },
	// Greentech kinds (M4).
	{ label: "solar", kind: "solar", widths: [4, 8] },
	{ label: "wind", kind: "wind", widths: [2, 4] },
	{ label: "heat export", kind: "heat_export", widths: [3, 6] },
	{ label: "carbon", kind: "carbon", widths: [4, 6] },
];

/** Widths of the growth defs (not tiered: a growth is tissue whatever the tier). */
export const GROWTH_WIDTHS = [1, 2, 3, 4];
export const growthId = (w: number): string => `var_growth_w${w}`;

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
	// M3 placeholders (M3-T3 adds biotech kinds to the scene).
	nutrient: "bio",
	sterilizer: "bio",
	quarantine: "bio",
	bioreactor: "bio",
	// Greentech (M4).
	solar: "power",
	wind: "power",
	heat_export: "cooling",
	carbon: "cooling",
};

export const varietyId = (row: VarietyRow, tier: number, width: number): string => `var_${row.kind}${row.flavour ? `_${row.flavour}` : ""}_t${tier}_w${width}`;

function makeDef(row: VarietyRow, tier: number, width: number, i: number): FacilityDef {
	const f = row.flavour;
	const bioRack = f === "organoid" || f === "dna" || f === "neural";
	const rack =
		row.kind !== "rack"
			? undefined
			: bioRack
				? { ...RACK, cooling: "bio" as const, pflops: f === "dna" ? 0 : 10, storageTB: f === "dna" ? 500 : 0, bio: { targetC: 37, toleranceC: 2, nutrientUse: 1, contamination: 0.01 } }
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
		power: row.kind === "grid_tie" || row.kind === "genset" || row.kind === "ups" ? { capacityKw: 800, storageKwh: 200 } : row.kind === "solar" || row.kind === "wind" ? { capacityKw: 300 } : undefined,
		green: row.kind === "heat_export" ? { exportKw: 400, radius: 8 } : row.kind === "carbon" ? { creditsPerDay: 1 } : undefined,
		logistics: row.kind === "depot" || row.kind === "charger" ? { capacity: 10 } : undefined,
		bio: row.kind === "nutrient" ? { nutrientCapacity: 10 } : row.kind === "sterilizer" ? { cleanRate: 0.05, radius: 6, cullsGrowths: f === "culling" } : row.kind === "bioreactor" ? { nutrientUse: 2, contamination: 0.01 } : undefined,
		placement: bioRack || row.kind === "bioreactor" ? { needsNutrient: true } : undefined,
	};
}

function makeGrowth(w: number): FacilityDef {
	return {
		id: growthId(w),
		name: `growth w${w}`,
		description: "",
		kind: "rack",
		category: "bio",
		width: w,
		cost: 0,
		upkeepPerDay: 0,
		unlockTier: 1,
		facilityKw: 0,
		color: "#b5877a",
		accent: "#8a8a3a",
		growth: true,
	};
}

/** `base` plus one synthetic def per row × tier × width and the two new bots. */
export function varietyContent(base: ContentDB): ContentDB {
	const facilities: Record<string, FacilityDef> = { ...base.facilities };
	VARIETY_ROWS.forEach((row, i) => {
		for (let tier = 1; tier <= 4; tier++) for (const w of row.widths) facilities[varietyId(row, tier, w)] = makeDef(row, tier, w, i);
	});
	for (const w of GROWTH_WIDTHS) facilities[growthId(w)] = makeGrowth(w);
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
/** Path score at the start of each skin stage (0, 25, 50, 75 and 100 %). */
export const STAGE_SCORE = [0, 0.25, 0.5, 0.75, 1] as const;

export interface VarietyOpts {
	/** Biotech skin stage 0..4 (the scene's `corruption`). */
	stage?: 0 | 1 | 2 | 3 | 4;
	path?: SimView["path"];
	/** A drought is in force (dim flat sky, rotors stopped). */
	drought?: boolean;
	/** Game minutes advanced per `step` (0 = the clock stands still). */
	mpt?: number;
	/** Start minute of the day (default 780: solar at its peak). */
	minute?: number;
}

export function createVarietyScene(opts: VarietyOpts = {}): VarietyScene {
	const base = createFixture(600, 0);
	const rowFloors = VARIETY_ROWS.length;
	const FAIL = rowFloors; // failure statuses
	const DARK = rowFloors + 1; // blackout
	const BROWN = rowFloors + 2; // brownout
	const LEAK = rowFloors + 3; // overloaded coolant net
	const BIO = rowFloors + 4; // growths and the two wetware fault statuses
	const floorMax = BIO;
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
	const nutrient = new Uint8Array(n);
	const nutrientNetOf = new Int32Array(n).fill(-1);
	const contamination = new Float32Array(n);
	const isBioFloor = (f: number): boolean => f === BIO || (f < rowFloors && ["nutrient", "bioreactor"].includes(VARIETY_ROWS[f].kind)) || (f < rowFloors && (VARIETY_ROWS[f].flavour === "organoid" || VARIETY_ROWS[f].flavour === "dna" || VARIETY_ROWS[f].flavour === "neural"));
	for (let f = floorMin; f <= floorMax; f++) {
		if (!isBioFloor(f)) continue;
		for (let x = 0; x < width; x++) {
			nutrient[idx(x, f)] = 1;
			nutrientNetOf[idx(x, f)] = 0;
			// A stippled test field for the contamination overlay.
			contamination[idx(x, f)] = Math.max(0, Math.sin(x * 0.35 + f * 1.3)) ** 2 * 0.9;
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
			heatKw: isRack && status === "ok" ? 30 : d.kind === "heat_export" ? 260 : d.kind === "chiller" || d.kind === "crah" || d.kind === "cdu" ? 120 : 0,
			jobId: status === "ok" ? 1 : null,
			powerNet: powerNetOf[idx(x, floor)],
			coolantNet: coolant[idx(x, floor)] ? 0 : null,
			running: d.kind === "genset" ? true : undefined,
			charge: d.kind === "ups" ? 0.6 : undefined,
			stored: d.kind === "depot" ? 5 : undefined,
			nutrientNet: nutrient[idx(x, floor)] ? 0 : null,
			grown: false,
			contamination: contamination[idx(x, floor)],
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

	// Growths (grown by the sim) and the wetware fault statuses.
	let gx = LEFT;
	for (const w of GROWTH_WIDTHS) {
		place(growthId(w), BIO, gx, "ok", { grown: true, contamination: 0.9 });
		gx += w + 1;
	}
	const orgRow = VARIETY_ROWS.find((r) => r.flavour === "organoid");
	if (orgRow) {
		place(varietyId(orgRow, 3, 2), BIO, gx + 1, "noNutrient", { tempC: 37 });
		place(varietyId(orgRow, 3, 2), BIO, gx + 4, "tooCold", { tempC: 25 });
		place(varietyId(orgRow, 3, 2), BIO, gx + 7, "ok", { tempC: 37 });
	}

	const bots: BotView[] = [
		{ id: 1, defId: "var_rover", x: LEFT + 3, floor: 0, state: "toTarget", battery: 0.8, carrying: true, workOrderId: 1, trait: null },
		{ id: 2, defId: "var_lifter", x: LEFT + 8, floor: 0, state: "toDepot", battery: 0.7, carrying: true, workOrderId: 2, trait: null },
		{ id: 3, defId: "var_lifter", x: LEFT + 12, floor: 0, state: "idle", battery: 0.4, carrying: false, workOrderId: null, trait: null },
		{ id: 4, defId: "var_drone", x: LEFT + 16, floor: 0, state: "flying", battery: 0.9, carrying: true, workOrderId: 3, trait: null },
		{ id: 5, defId: "var_drone", x: LEFT + 20, floor: 0, state: "idle", battery: 0.6, carrying: false, workOrderId: null, trait: null },
		{ id: 6, defId: "var_drone", x: LEFT + 24, floor: 0, state: "repairing", battery: 0.5, carrying: false, workOrderId: 4, trait: null },
		{ id: 7, defId: "var_rover", x: LEFT + 5, floor: 0, state: "idle", battery: 0.7, carrying: false, workOrderId: null, trait: "fleshed" },
		{ id: 8, defId: "var_lifter", x: LEFT + 10, floor: 0, state: "idle", battery: 0.7, carrying: false, workOrderId: null, trait: "tendriled" },
		{ id: 9, defId: "var_drone", x: LEFT + 18, floor: 0, state: "idle", battery: 0.7, carrying: false, workOrderId: null, trait: "fleshed" },
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
		nutrient,
		nutrientNetOf,
		contamination,
		nutrientNets: [{ id: 0, supply: 40, demand: 30, satisfaction: 1 }],
		tier: 3,
		path: opts.path ?? "biotech",
		corruption: (opts.path ?? "biotech") === "biotech" ? STAGE_SCORE[opts.stage ?? 0] : 0,
		pathScore: STAGE_SCORE[opts.stage ?? 0],
		drought: opts.drought === true,
		minuteOfDay: opts.minute ?? 780,
	};
	const drone = bots[3];
	const step = (): SimView => {
		view.tick++;
		if (opts.mpt) view.minuteOfDay = (view.minuteOfDay + opts.mpt) % 1440;
		// The courier drone shuttles between floors 0 and 3 at a fractional floor.
		const ph = (view.tick % 60) / 60;
		drone.floor = 3 * (ph < 0.5 ? ph * 2 : 2 - ph * 2);
		drone.x = LEFT + 16 + 6 * Math.sin(view.tick * 0.05);
		return view;
	};
	step();
	return { view, step };
}
