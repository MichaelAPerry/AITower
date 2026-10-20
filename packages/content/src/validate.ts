/**
 * Hand-written content validation (no schema library). Returns human-readable
 * problems; an empty array means the DB is valid.
 */
import type { AscensionPath, BuildCategory, ContentDB, OrganoidSpec, EventChoice, EventDef, EventEffect, FacilityDef, FacilityKind, JobKind, Scenario, TechBranch, TechNode } from "./schema";

const KIND_CATEGORY: Record<FacilityKind, BuildCategory> = {
	rack: "rack",
	grid_tie: "power",
	genset: "power",
	ups: "power",
	crah: "cooling",
	chiller: "cooling",
	cdu: "cooling",
	depot: "logistics",
	charger: "logistics",
	nutrient: "bio",
	sterilizer: "bio",
	quarantine: "bio",
	bioreactor: "bio",
	// Greentech (M4): panels and masts are power sources; the exporters and carbon plants sit in the cooling tab.
	solar: "power",
	wind: "power",
	heat_export: "cooling",
	carbon: "cooling",
};
type SpecName = "rack" | "power" | "cooling" | "logistics" | "bio" | "green";
/** Specs a kind requires. `bio` is also allowed (optional) on growth racks; bioreactors need both `power` and `bio`. */
const SPECS_FOR_KIND: Record<FacilityKind, SpecName[]> = {
	rack: ["rack"],
	grid_tie: ["power"],
	genset: ["power"],
	ups: ["power"],
	crah: ["cooling"],
	chiller: ["cooling"],
	cdu: ["cooling"],
	depot: ["logistics"],
	charger: ["logistics"],
	nutrient: ["bio"],
	sterilizer: ["bio"],
	quarantine: [],
	bioreactor: ["power", "bio"],
	solar: ["power"],
	wind: ["power"],
	heat_export: ["green"],
	carbon: ["green"],
};
const PATHS: AscensionPath[] = ["biotech", "greentech", "synthetic"];
const ENDINGS = ["livingTower", "cleanTower", "absorbed", "greenExemplar", "millionMinds"];
const SECTORS = ["frontier", "biotech", "finance", "gov", "climate", "media"];
const JOB_KINDS: JobKind[] = ["training", "finetune", "inference"];
const COOLING_MODES = ["air", "dlc", "immersion", "bio"];
const HEX = /^#[0-9a-fA-F]{6}$/;
const TECH_BRANCHES: TechBranch[] = ["compute", "cooling", "power", "logistics", "administration", "wetware"];
const PERK_KINDS = ["failureRate", "energyPrice", "payout", "coolingCapacity", "repairSpeed", "upkeep", "researchRate", "botSpeed"];
const FEATURES = ["contractsClerk", "foreman"];
/** Letter grades A..E used by `balance.audit`. */
const GRADES = 5;

type Problems = string[];

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function num(p: Problems, where: string, v: unknown, opts: { min?: number; max?: number; gt?: number; int?: boolean } = {}): void {
	if (!isNum(v)) {
		p.push(`${where}: expected a finite number, got ${JSON.stringify(v)}`);
		return;
	}
	if (opts.int && !Number.isInteger(v)) p.push(`${where}: expected an integer, got ${v}`);
	if (opts.gt !== undefined && !(v > opts.gt)) p.push(`${where}: must be > ${opts.gt}, got ${v}`);
	if (opts.min !== undefined && v < opts.min) p.push(`${where}: must be ≥ ${opts.min}, got ${v}`);
	if (opts.max !== undefined && v > opts.max) p.push(`${where}: must be ≤ ${opts.max}, got ${v}`);
}

function str(p: Problems, where: string, v: unknown): void {
	if (typeof v !== "string" || v.trim() === "") p.push(`${where}: expected a non-empty string`);
}

/** Does this facility need a power conduit under it (mirrors the sim's `needsPower` default)? */
export function facilityNeedsPower(def: FacilityDef): boolean {
	if (def.placement?.needsPower !== undefined) return def.placement.needsPower;
	return def.facilityKw > 0 || def.kind === "rack" || KIND_CATEGORY[def.kind] === "power";
}

function validateOrganoid(p: Problems, w: string, o: OrganoidSpec | undefined, plant: boolean): void {
	if (!o) {
		p.push(`${w}: cooling "bio" racks require an organoid spec`);
		return;
	}
	num(p, `${w}.targetC`, o.targetC, { min: 1, max: 60 });
	num(p, `${w}.toleranceC`, o.toleranceC, { gt: 0, max: 20 });
	num(p, `${w}.nutrientUse`, o.nutrientUse, plant ? { gt: 0 } : { min: 0 });
	num(p, `${w}.contamination`, o.contamination, plant ? { gt: 0, max: 1 } : { min: 0, max: 1 });
}

function validateBio(p: Problems, w: string, d: FacilityDef): void {
	const b = d.bio;
	if (!b) return;
	for (const k of ["nutrientCapacity", "nutrientUse", "cleanRate", "radius", "contamination"] as const) {
		if (b[k] !== undefined) num(p, `${w}.${k}`, b[k], { min: 0 });
	}
	if (b.cullsGrowths !== undefined && typeof b.cullsGrowths !== "boolean") p.push(`${w}.cullsGrowths: expected a boolean`);
	if (d.kind === "nutrient") num(p, `${w}.nutrientCapacity`, b.nutrientCapacity, { gt: 0 });
	if (d.kind === "sterilizer") {
		num(p, `${w}.cleanRate`, b.cleanRate, { gt: 0 });
		num(p, `${w}.radius`, b.radius, { gt: 0 });
	}
	if (d.kind === "bioreactor") {
		num(p, `${w}.nutrientUse`, b.nutrientUse, { gt: 0 });
		num(p, `${w}.contamination`, b.contamination, { gt: 0 });
	}
	if (b.cullsGrowths && d.kind !== "sterilizer") p.push(`${w}.cullsGrowths: only a sterilizer can cull`);
	if (d.growth) num(p, `${w}.contamination`, b.contamination, { gt: 0 });
}

function validateGreen(p: Problems, w: string, d: FacilityDef): void {
	const g = d.green;
	if (!g) return;
	for (const k of ["exportKw", "radius", "creditsPerDay"] as const) {
		if (g[k] !== undefined) num(p, `${w}.${k}`, g[k], { min: 0 });
	}
	if (d.kind === "heat_export") {
		num(p, `${w}.exportKw`, g.exportKw, { gt: 0 });
		num(p, `${w}.radius`, g.radius, { gt: 0 });
	}
	if (d.kind === "carbon") num(p, `${w}.creditsPerDay`, g.creditsPerDay, { gt: 0 });
}

function validateFacility(p: Problems, key: string, d: FacilityDef, tierCount: number): void {
	const w = `facilities.${key}`;
	if (d.id !== key) p.push(`${w}: id "${d.id}" does not match key`);
	str(p, `${w}.name`, d.name);
	str(p, `${w}.description`, d.description);
	if (!(d.kind in KIND_CATEGORY)) {
		p.push(`${w}.kind: unknown kind "${d.kind}"`);
		return;
	}
	// Organoid (bio-cooled) racks live in the Wetware tab.
	const wantCategory = d.kind === "rack" && d.rack?.cooling === "bio" ? "bio" : KIND_CATEGORY[d.kind];
	if (d.category !== wantCategory) p.push(`${w}.category: "${d.category}" should be "${wantCategory}" for kind ${d.kind}`);
	num(p, `${w}.width`, d.width, { min: 1, int: true });
	// The renderer draws these bodies at a fixed native width; narrower defs would overflow their tiles.
	const minWidth = MIN_WIDTH_BY_KIND[d.kind];
	if (minWidth !== undefined && isNum(d.width) && d.width < minWidth) p.push(`${w}.width: a ${d.kind} must be at least ${minWidth} tiles wide (art width)`);
	num(p, `${w}.cost`, d.cost, { min: 0 });
	num(p, `${w}.upkeepPerDay`, d.upkeepPerDay, { min: 0 });
	num(p, `${w}.unlockTier`, d.unlockTier, { min: 1, max: Math.max(1, tierCount), int: true });
	num(p, `${w}.facilityKw`, d.facilityKw, { min: 0 });
	if (typeof d.color !== "string" || !HEX.test(d.color)) p.push(`${w}.color: expected #rrggbb`);
	if (typeof d.accent !== "string" || !HEX.test(d.accent)) p.push(`${w}.accent: expected #rrggbb`);

	const specs = SPECS_FOR_KIND[d.kind];
	for (const s of ["rack", "power", "cooling", "logistics", "bio", "green"] as const) {
		if (specs.includes(s) && !d[s]) p.push(`${w}: kind ${d.kind} requires a "${s}" spec`);
		if (!specs.includes(s) && d[s] && !(s === "bio" && d.growth && d.kind === "rack")) p.push(`${w}: unexpected "${s}" spec for kind ${d.kind}`);
	}
	if (d.growth !== undefined && typeof d.growth !== "boolean") p.push(`${w}.growth: expected a boolean`);
	if (d.growth) {
		if (d.tech !== undefined) p.push(`${w}.tech: growths are never researched`);
		if (d.cost !== 0) p.push(`${w}.cost: growths are free (cost 0)`);
		if (d.upkeepPerDay !== 0) p.push(`${w}.upkeepPerDay: growths have no upkeep`);
		if (d.kind !== "rack") p.push(`${w}.kind: a growth must be a rack`);
	}
	if (d.bio) validateBio(p, `${w}.bio`, d);
	if (d.green) validateGreen(p, `${w}.green`, d);
	if ((d.kind === "solar" || d.kind === "wind") && d.placement?.needsPower === false) p.push(`${w}.placement.needsPower: a ${d.kind} source must sit on a power conduit`);
	if (d.placement?.needsNutrient && d.category !== "bio") p.push(`${w}.placement.needsNutrient: only wetware facilities use nutrient`);
	if (d.category === "bio" && !d.growth && ["nutrient", "bioreactor", "rack"].includes(d.kind) && !d.placement?.needsNutrient) {
		p.push(`${w}.placement.needsNutrient: a ${d.kind} must sit on a nutrient pipe`);
	}
	if (d.rack) {
		const r = d.rack;
		if (!COOLING_MODES.includes(r.cooling)) p.push(`${w}.rack.cooling: unknown mode "${r.cooling}"`);
		num(p, `${w}.rack.powerKw`, r.powerKw, { gt: 0 });
		num(p, `${w}.rack.liquidFraction`, r.liquidFraction, { min: 0, max: 1 });
		num(p, `${w}.rack.pflops`, r.pflops, { min: 0 });
		num(p, `${w}.rack.storageTB`, r.storageTB, { min: 0 });
		num(p, `${w}.rack.failurePerDay`, r.failurePerDay, { min: 0 });
		if (r.pflops <= 0 && r.storageTB <= 0) p.push(`${w}.rack: must provide pflops or storageTB`);
		if (r.cooling === "air" && r.liquidFraction !== 0) p.push(`${w}.rack.liquidFraction: air racks must be 0`);
		if (r.cooling === "bio") {
			if (r.liquidFraction !== 0) p.push(`${w}.rack.liquidFraction: organoid racks must be 0`);
			validateOrganoid(p, `${w}.rack.bio`, r.bio, !d.growth);
		} else if (r.bio) p.push(`${w}.rack.bio: only cooling "bio" racks have an organoid spec`);
		if (r.cooling !== "air" && r.cooling !== "bio") {
			if (!(r.liquidFraction > 0)) p.push(`${w}.rack.liquidFraction: liquid-cooled racks need > 0`);
			if (!d.placement?.needsCoolant) p.push(`${w}.placement.needsCoolant: liquid-cooled racks must require coolant`);
		}
	}
	if (d.power) {
		const pw = d.power;
		num(p, `${w}.power.capacityKw`, pw.capacityKw, { gt: 0 });
		if (d.kind === "ups") {
			num(p, `${w}.power.storageKwh`, pw.storageKwh, { gt: 0 });
			num(p, `${w}.power.efficiency`, pw.efficiency, { gt: 0, max: 1 });
		}
		if (d.kind === "genset") {
			num(p, `${w}.power.startDelayTicks`, pw.startDelayTicks, { min: 0, int: true });
			num(p, `${w}.power.costPerKwh`, pw.costPerKwh, { gt: 0 });
		}
	}
	if (d.cooling) {
		num(p, `${w}.cooling.capacityKw`, d.cooling.capacityKw, { gt: 0 });
		if (d.kind === "chiller") num(p, `${w}.cooling.cop`, d.cooling.cop, { gt: 0 });
		if (d.kind === "crah") num(p, `${w}.cooling.radius`, d.cooling.radius, { gt: 0 });
	}
	if (d.logistics) {
		num(p, `${w}.logistics.capacity`, d.logistics.capacity, { min: 1, int: true });
		if (d.kind === "charger") num(p, `${w}.logistics.chargeKw`, d.logistics.chargeKw, { gt: 0 });
	}
	const pl = d.placement;
	if (pl) {
		if (pl.minFloor !== undefined) num(p, `${w}.placement.minFloor`, pl.minFloor, { int: true });
		if (pl.maxFloor !== undefined) num(p, `${w}.placement.maxFloor`, pl.maxFloor, { int: true });
		if (pl.minFloor !== undefined && pl.maxFloor !== undefined && pl.minFloor > pl.maxFloor) {
			p.push(`${w}.placement: minFloor > maxFloor`);
		}
	}
}

function validateBalance(p: Problems, db: ContentDB): void {
	const b = db.balance;
	if (!b) {
		p.push("balance: missing");
		return;
	}
	num(p, "balance.startingCash", b.startingCash, { gt: 0 });
	num(p, "balance.energyPrice", b.energyPrice, { gt: 0 });
	if (!Array.isArray(b.energyPriceByHour) || b.energyPriceByHour.length !== 24) {
		p.push(`balance.energyPriceByHour: expected 24 entries, got ${Array.isArray(b.energyPriceByHour) ? b.energyPriceByHour.length : "none"}`);
	} else {
		b.energyPriceByHour.forEach((m, i) => {
			num(p, `balance.energyPriceByHour[${i}]`, m, { gt: 0 });
		});
	}
	num(p, "balance.ambientMeanC", b.ambientMeanC);
	num(p, "balance.ambientSwingC", b.ambientSwingC, { min: 0 });

	const t = b.thermal;
	if (!t) p.push("balance.thermal: missing");
	else {
		for (const k of [
			"airCellHeatCapacity",
			"airConductance",
			"slabConductance",
			"envelopeConductance",
			"rackDeltaC",
			"tripHysteresisC",
		] as const) {
			num(p, `balance.thermal.${k}`, t[k], { gt: 0 });
		}
		num(p, "balance.thermal.buoyancy", t.buoyancy, { min: 0 });
		num(p, "balance.thermal.rackEase", t.rackEase, { gt: 0, max: 1 });
		num(p, "balance.thermal.minClock", t.minClock, { gt: 0, max: 1 });
		num(p, "balance.thermal.tripCooldownTicks", t.tripCooldownTicks, { min: 0, int: true });
		num(p, "balance.thermal.hazardPerDegree", t.hazardPerDegree, { min: 0 });
		num(p, "balance.thermal.okC", t.okC);
		num(p, "balance.thermal.throttleC", t.throttleC);
		num(p, "balance.thermal.tripC", t.tripC);
		num(p, "balance.thermal.coolantSupplyC", t.coolantSupplyC);
		if (!(t.okC < t.throttleC && t.throttleC < t.tripC)) p.push("balance.thermal: need okC < throttleC < tripC");
		if (!(t.coolantSupplyC < t.okC)) p.push("balance.thermal: coolantSupplyC must be below okC");
		// Explicit-diffusion stability (ARCHITECTURE §4.1): k·dt/C ≤ 0.2 with dt = 60 s.
		const kMax = Math.max(t.airConductance, t.slabConductance + t.buoyancy, t.envelopeConductance);
		if (isNum(t.airCellHeatCapacity) && t.airCellHeatCapacity > 0 && (kMax * 60) / t.airCellHeatCapacity > 0.2) {
			p.push("balance.thermal: conductance·60/airCellHeatCapacity > 0.2 (explicit step may be unstable)");
		}
	}

	const e = b.economy;
	if (!e) p.push("balance.economy: missing");
	else {
		num(p, "balance.economy.slaPenaltyFactor", e.slaPenaltyFactor, { min: 0 });
		num(p, "balance.economy.maxOffers", e.maxOffers, { min: 1, int: true });
		num(p, "balance.economy.offerIntervalTicks", e.offerIntervalTicks, { min: 1, int: true });
		num(p, "balance.economy.offerExpiryTicks", e.offerExpiryTicks, { min: 1, int: true });
	}

	const tr = b.tiers;
	if (!tr || !Array.isArray(tr.pflops) || !Array.isArray(tr.uptime) || !Array.isArray(tr.reward)) {
		p.push("balance.tiers: pflops, uptime and reward arrays are required");
		return;
	}
	const n = tr.pflops.length;
	if (n === 0) p.push("balance.tiers: at least one tier required");
	if (tr.uptime.length !== n || tr.reward.length !== n) {
		p.push(`balance.tiers: arrays differ in length (pflops ${n}, uptime ${tr.uptime.length}, reward ${tr.reward.length})`);
	}
	tr.pflops.forEach((v, i) => {
		num(p, `balance.tiers.pflops[${i}]`, v, { min: 0 });
		if (i > 0 && v < tr.pflops[i - 1]) p.push(`balance.tiers.pflops: must be non-decreasing at ${i}`);
	});
	tr.uptime.forEach((v, i) => {
		num(p, `balance.tiers.uptime[${i}]`, v, { min: 0, max: 1 });
	});
	tr.reward.forEach((v, i) => {
		num(p, `balance.tiers.reward[${i}]`, v, { min: 0 });
	});
	if (n > 0 && (tr.pflops[0] !== 0 || tr.uptime[0] !== 0)) p.push("balance.tiers: tier 1 must be free (pflops[0] = uptime[0] = 0)");
}

function validateScenario(p: Problems, key: string, s: Scenario, db: ContentDB): void {
	const w = `scenarios.${key}`;
	if (s.id !== key) p.push(`${w}: id "${s.id}" does not match key`);
	str(p, `${w}.name`, s.name);
	num(p, `${w}.width`, s.width, { min: 1, int: true });
	num(p, `${w}.floorMin`, s.floorMin, { max: 0, int: true });
	num(p, `${w}.floorMax`, s.floorMax, { min: 0, int: true });
	num(p, `${w}.spareParts`, s.spareParts, { min: 0, int: true });
	if (s.description !== undefined) str(p, `${w}.description`, s.description);
	if (s.startingCash !== undefined) num(p, `${w}.startingCash`, s.startingCash, { min: 0 });
	if (s.startTier !== undefined) num(p, `${w}.startTier`, s.startTier, { min: 1, max: Math.max(1, db.balance?.tiers?.pflops?.length ?? 1), int: true });
	if (s.sandbox !== undefined && typeof s.sandbox !== "boolean") p.push(`${w}.sandbox: expected a boolean`);
	if (!isNum(s.width) || !isNum(s.floorMin) || !isNum(s.floorMax) || s.floorMin > s.floorMax) return;

	const W = s.width;
	const H = s.floorMax - s.floorMin + 1;
	const idx = (x: number, f: number) => (f - s.floorMin) * W + x;
	const inside = (x: number, f: number) => Number.isInteger(x) && Number.isInteger(f) && x >= 0 && x < W && f >= s.floorMin && f <= s.floorMax;
	const slab = new Uint8Array(W * H);
	const conduit = { power: new Uint8Array(W * H), coolant: new Uint8Array(W * H) };
	const occupied = new Int32Array(W * H).fill(-1);

	s.slabs.forEach(([f, x0, x1], i) => {
		if (!inside(x0, f) || !inside(x1, f) || x0 > x1) {
			p.push(`${w}.slabs[${i}]: span [${f}, ${x0}, ${x1}] outside the lot`);
			return;
		}
		for (let x = x0; x <= x1; x++) slab[idx(x, f)] = 1;
	});
	// Above-ground slabs need a slab directly below. Process bottom-up so order in the file doesn't matter.
	for (let f = 1; f <= s.floorMax; f++) {
		for (let x = 0; x < W; x++) {
			if (slab[idx(x, f)] && !slab[idx(x, f - 1)]) {
				p.push(`${w}: slab at floor ${f} x${x} has no support below`);
			}
		}
	}

	s.conduits.forEach(([layer, f, x0, x1], i) => {
		if (layer !== "power" && layer !== "coolant") {
			p.push(`${w}.conduits[${i}]: unknown layer "${layer}"`);
			return;
		}
		if (!inside(x0, f) || !inside(x1, f) || x0 > x1) {
			p.push(`${w}.conduits[${i}]: run [${f}, ${x0}, ${x1}] outside the lot`);
			return;
		}
		for (let x = x0; x <= x1; x++) {
			if (!slab[idx(x, f)]) p.push(`${w}.conduits[${i}]: ${layer} conduit at floor ${f} x${x} has no slab`);
			conduit[layer][idx(x, f)] = 1;
		}
	});

	s.lifts.forEach((l, i) => {
		if (!inside(l.x, l.floorMin) || !inside(l.x, l.floorMax) || l.floorMin >= l.floorMax) {
			p.push(`${w}.lifts[${i}]: shaft outside the lot or spans < 2 floors`);
			return;
		}
		for (let f = l.floorMin; f <= l.floorMax; f++) {
			if (!slab[idx(l.x, f)]) p.push(`${w}.lifts[${i}]: no slab at floor ${f} x${l.x}`);
			if (occupied[idx(l.x, f)] !== -1) p.push(`${w}.lifts[${i}]: overlaps another lift at floor ${f}`);
			occupied[idx(l.x, f)] = -2;
		}
	});

	s.facilities.forEach((pf, i) => {
		const fw = `${w}.facilities[${i}] (${pf.defId})`;
		const def = db.facilities[pf.defId];
		if (!def) {
			p.push(`${fw}: unknown facility def`);
			return;
		}
		if (!inside(pf.x, pf.floor) || !inside(pf.x + def.width - 1, pf.floor)) {
			p.push(`${fw}: does not fit inside the lot at floor ${pf.floor} x${pf.x}`);
			return;
		}
		const pl = def.placement;
		if (pl?.minFloor !== undefined && pf.floor < pl.minFloor) p.push(`${fw}: below minFloor ${pl.minFloor}`);
		if (pl?.maxFloor !== undefined && pf.floor > pl.maxFloor) p.push(`${fw}: above maxFloor ${pl.maxFloor}`);
		let hasPower = false;
		let hasCoolant = false;
		for (let x = pf.x; x < pf.x + def.width; x++) {
			const c = idx(x, pf.floor);
			if (!slab[c]) p.push(`${fw}: no slab under x${x}`);
			if (occupied[c] === -2) p.push(`${fw}: overlaps a lift shaft at x${x}`);
			else if (occupied[c] >= 0) p.push(`${fw}: overlaps facilities[${occupied[c]}] at x${x}`);
			occupied[c] = i;
			if (conduit.power[c]) hasPower = true;
			if (conduit.coolant[c]) hasCoolant = true;
		}
		if (pl?.needsNutrient) p.push(`${fw}: scenarios have no nutrient conduits, so a ${def.kind} cannot be pre-placed`);
		if (def.growth) p.push(`${fw}: growths cannot be pre-placed`);
		if (facilityNeedsPower(def) && !hasPower) p.push(`${fw}: needs a power conduit under one of its cells`);
		if (pl?.needsCoolant && !hasCoolant) p.push(`${fw}: needs a coolant conduit under one of its cells`);
	});

	s.bots.forEach((b, i) => {
		if (!db.bots[b.defId]) p.push(`${w}.bots[${i}]: unknown bot def "${b.defId}"`);
		if (!inside(b.x, b.floor) || !slab[idx(b.x, b.floor)]) p.push(`${w}.bots[${i}]: not standing on a slab inside the lot`);
	});
	if (s.bots.length > 0 && !s.facilities.some((f) => db.facilities[f.defId]?.kind === "charger")) {
		p.push(`${w}: has bots but no charger`);
	}
}

const EVENT_CATEGORIES = ["ministry", "environmental", "operational", "client", "horror"];
const ID_RE = /^[a-z0-9_]+$/;

function validateEffect(p: Problems, w: string, e: EventEffect): void {
	const dur = (d: unknown): void => num(p, `${w}.durationTicks`, d, { gt: 0, int: true });
	const t = (e as { type?: unknown } | null)?.type;
	switch (t) {
		case "cash":
			num(p, `${w}.amount`, (e as { amount: number }).amount);
			break;
		case "standing":
			num(p, `${w}.amount`, (e as { amount: number }).amount, { min: -100, max: 100 });
			break;
		case "ambient":
			num(p, `${w}.deltaC`, (e as { deltaC: number }).deltaC, { min: -40, max: 40 });
			dur((e as { durationTicks: number }).durationTicks);
			break;
		case "gridCap":
			num(p, `${w}.factor`, (e as { factor: number }).factor, { min: 0, max: 1 });
			dur((e as { durationTicks: number }).durationTicks);
			break;
		case "energyPrice":
		case "payout":
		case "failureRate":
			num(p, `${w}.factor`, (e as { factor: number }).factor, { gt: 0 });
			dur((e as { durationTicks: number }).durationTicks);
			break;
		case "failRacks":
			num(p, `${w}.count`, (e as { count: number }).count, { min: 1, int: true });
			break;
		case "spareParts": {
			const c = (e as { count: number }).count;
			num(p, `${w}.count`, c, { int: true });
			if (c === 0) p.push(`${w}.count: must not be 0`);
			break;
		}
		case "affinity":
			if (!PATHS.includes((e as { path: AscensionPath }).path)) p.push(`${w}.path: unknown path "${(e as { path: unknown }).path}"`);
			num(p, `${w}.amount`, (e as { amount: number }).amount, { min: 0 });
			break;
		default:
			p.push(`${w}.type: unknown effect type ${JSON.stringify(t)}`);
	}
}

function validateEventChoice(p: Problems, w: string, c: EventChoice): void {
	str(p, `${w}.id`, c.id);
	str(p, `${w}.label`, c.label);
	str(p, `${w}.hint`, c.hint);
	str(p, `${w}.outcome`, c.outcome);
	if (!Array.isArray(c.effects)) {
		p.push(`${w}.effects: expected an array`);
		return;
	}
	c.effects.forEach((e, i) => {
		validateEffect(p, `${w}.effects[${i}]`, e);
	});
}

function validateEvent(p: Problems, i: number, e: EventDef, tierCount: number, seen: Set<string>): void {
	const w = `events[${i}] (${e?.id})`;
	str(p, `${w}.id`, e.id);
	if (typeof e.id === "string" && !ID_RE.test(e.id)) p.push(`${w}.id: use lowercase letters, digits and underscores`);
	if (seen.has(e.id)) p.push(`${w}: duplicate id`);
	seen.add(e.id);
	if (!EVENT_CATEGORIES.includes(e.category)) p.push(`${w}.category: unknown "${e.category}"`);
	str(p, `${w}.title`, e.title);
	str(p, `${w}.body`, e.body);
	num(p, `${w}.weight`, e.weight, { gt: 0 });
	num(p, `${w}.minTier`, e.minTier, { min: 1, max: Math.max(1, tierCount), int: true });
	if (e.maxTier !== undefined) {
		num(p, `${w}.maxTier`, e.maxTier, { min: 1, int: true });
		if (isNum(e.maxTier) && isNum(e.minTier) && e.maxTier < e.minTier) p.push(`${w}: maxTier is below minTier`);
	}
	if (e.minDay !== undefined) num(p, `${w}.minDay`, e.minDay, { min: 0, int: true });
	num(p, `${w}.cooldownDays`, e.cooldownDays, { min: 0, int: true });
	if (e.minCorruption !== undefined) num(p, `${w}.minCorruption`, e.minCorruption, { min: 0, max: 1 });
	else if (e.category === "horror" && e.path !== "greentech" && e.path !== "synthetic") p.push(`${w}.minCorruption: horror memos must be corruption-gated`);
	if (e.path !== undefined && !PATHS.includes(e.path)) p.push(`${w}.path: unknown path "${e.path}"`);
	if (e.scriptedDay !== undefined) num(p, `${w}.scriptedDay`, e.scriptedDay, { min: 0, int: true });
	num(p, `${w}.timeoutTicks`, e.timeoutTicks, { gt: 0, int: true });
	if (!Array.isArray(e.choices) || e.choices.length < 1) {
		p.push(`${w}.choices: at least one choice required`);
		return;
	}
	const ids = new Set<string>();
	e.choices.forEach((c, k) => {
		validateEventChoice(p, `${w}.choices[${k}]`, c);
		if (ids.has(c.id)) p.push(`${w}.choices[${k}]: duplicate choice id "${c.id}"`);
		ids.add(c.id);
	});
	if (!ids.has(e.defaultChoice)) p.push(`${w}.defaultChoice: "${e.defaultChoice}" is not one of the choices`);
}

function validateEvents(p: Problems, db: ContentDB): void {
	const b = db.balance;
	if (b?.standing) {
		num(p, "balance.standing.start", b.standing.start, { min: 1, max: 100 });
		for (const k of ["dailyGood", "dailyBad", "dailyNearMiss", "jobFailed", "jobCompleted"] as const) num(p, `balance.standing.${k}`, b.standing[k]);
		num(p, "balance.standing.dailyMissSpan", b.standing.dailyMissSpan, { min: 0.001, max: 1 });
	} else p.push("balance.standing: missing");
	if (b?.events) {
		num(p, "balance.events.intervalTicks", b.events.intervalTicks, { min: 1, int: true });
		num(p, "balance.events.maxOpen", b.events.maxOpen, { min: 1, int: true });
		num(p, "balance.events.graceTicks", b.events.graceTicks, { min: 0, int: true });
	} else p.push("balance.events: missing");
	if (!Array.isArray(db.events)) {
		p.push("events: expected an array");
		return;
	}
	const tierCount = b?.tiers?.pflops?.length ?? 1;
	const seen = new Set<string>();
	db.events.forEach((e, i) => {
		validateEvent(p, i, e, tierCount, seen);
	});
}

function validateResearchBalance(p: Problems, db: ContentDB): void {
	const b = db.balance;
	if (!b) return;
	if (!b.research) p.push("balance.research: missing");
	else {
		num(p, "balance.research.pointsPerPflopHour", b.research.pointsPerPflopHour, { gt: 0 });
		num(p, "balance.research.pointsPerJob", b.research.pointsPerJob, { min: 0 });
	}
	if (!b.clerk) p.push("balance.clerk: missing");
	else num(p, "balance.clerk.feeShare", b.clerk.feeShare, { min: 0, max: 1 });
	const tierCount = b.tiers?.pflops?.length ?? 0;
	if (!b.loans) p.push("balance.loans: missing");
	else {
		const m = b.loans.maxByTier;
		if (!Array.isArray(m) || m.length !== tierCount) {
			p.push(`balance.loans.maxByTier: expected ${tierCount} entries (one per tier), got ${Array.isArray(m) ? m.length : "none"}`);
		} else {
			m.forEach((v, i) => {
				num(p, `balance.loans.maxByTier[${i}]`, v, { min: 0 });
				if (i > 0 && isNum(v) && isNum(m[i - 1]) && v < m[i - 1]) p.push(`balance.loans.maxByTier: must be non-decreasing at ${i}`);
			});
		}
		num(p, "balance.loans.dailyRate", b.loans.dailyRate, { min: 0, max: 1 });
	}
	if (!b.tax) p.push("balance.tax: missing");
	else num(p, "balance.tax.profitShare", b.tax.profitShare, { min: 0, max: 1 });
	if (!b.audit) p.push("balance.audit: missing");
	else {
		num(p, "balance.audit.periodDays", b.audit.periodDays, { min: 1, int: true });
		const grades = (key: "standingByGrade" | "cashShareByGrade", lo: number, hi: number): void => {
			const a = b.audit[key];
			if (!Array.isArray(a) || a.length !== GRADES) {
				p.push(`balance.audit.${key}: expected ${GRADES} entries (grades A..E), got ${Array.isArray(a) ? a.length : "none"}`);
				return;
			}
			a.forEach((v, i) => {
				num(p, `balance.audit.${key}[${i}]`, v, { min: lo, max: hi });
				if (i > 0 && isNum(v) && isNum(a[i - 1]) && v > a[i - 1]) p.push(`balance.audit.${key}: a worse grade must not pay more (index ${i})`);
			});
		};
		grades("standingByGrade", -100, 100);
		grades("cashShareByGrade", -1, 1);
	}
}

function validateBioBalance(p: Problems, db: ContentDB): void {
	const b = db.balance;
	if (!b) return;
	const tierCount = b.tiers?.pflops?.length ?? 0;
	if (!b.bio) p.push("balance.bio: missing");
	else {
		const o = b.bio;
		for (const k of ["diffusion", "slabFactor", "decay", "quarantineLeak", "mutationThreshold", "growthThreshold", "growthChancePerDay", "irreversibleShare", "irreversibleCleanFactor"] as const) {
			num(p, `balance.bio.${k}`, o[k], { min: 0, max: 1 });
		}
		// Explicit diffusion over up to 4 horizontal neighbours + 2 vertical stays stable only below this.
		if (isNum(o.diffusion) && isNum(o.slabFactor) && 4 * o.diffusion + 2 * o.diffusion * o.slabFactor > 1) p.push("balance.bio: diffusion is too high to be stable");
		num(p, "balance.bio.hazardPerContamination", o.hazardPerContamination, { min: 0 });
		num(p, "balance.bio.botSlowPerContamination", o.botSlowPerContamination, { min: 0, max: 1 });
		num(p, "balance.bio.mutationExposureTicks", o.mutationExposureTicks, { min: 1, int: true });
		num(p, "balance.bio.nutrientPrice", o.nutrientPrice, { min: 0 });
		if (isNum(o.growthThreshold) && isNum(o.mutationThreshold) && o.growthThreshold < o.mutationThreshold) p.push("balance.bio: growthThreshold must be ≥ mutationThreshold");
	}
	if (!b.ascension) p.push("balance.ascension: missing");
	else num(p, "balance.ascension.minTier", b.ascension.minTier, { min: 1, max: Math.max(1, tierCount), int: true });
	validateGreenBalance(p, b);
	const e = b.endings;
	if (!e?.livingTower || !e.cleanTower || !e.absorbed) {
		p.push("balance.endings: livingTower, cleanTower and absorbed are required");
		return;
	}
	num(p, "balance.endings.livingTower.minCorruption", e.livingTower.minCorruption, { gt: 0, max: 1 });
	num(p, "balance.endings.livingTower.pflops", e.livingTower.pflops, { gt: 0 });
	num(p, "balance.endings.livingTower.days", e.livingTower.days, { min: 1, int: true });
	num(p, "balance.endings.cleanTower.maxCorruption", e.cleanTower.maxCorruption, { min: 0, max: 1 });
	num(p, "balance.endings.cleanTower.pflops", e.cleanTower.pflops, { gt: 0 });
	num(p, "balance.endings.cleanTower.days", e.cleanTower.days, { min: 1, int: true });
	num(p, "balance.endings.absorbed.corruption", e.absorbed.corruption, { gt: 0, max: 1 });
	if (e.cleanTower.maxCorruption >= e.livingTower.minCorruption) p.push("balance.endings: cleanTower.maxCorruption must be below livingTower.minCorruption");
	if (e.absorbed.corruption <= e.livingTower.minCorruption) p.push("balance.endings: absorbed.corruption must be above livingTower.minCorruption");
}

function validateGreenBalance(p: Problems, b: ContentDB["balance"]): void {
	if (!b.green) p.push("balance.green: missing");
	else {
		num(p, "balance.green.heatPrice", b.green.heatPrice, { min: 0 });
		num(p, "balance.green.creditPrice", b.green.creditPrice, { min: 0 });
		num(p, "balance.green.droughtChancePerDay", b.green.droughtChancePerDay, { min: 0, max: 1 });
		num(p, "balance.green.droughtFactor", b.green.droughtFactor, { min: 0, max: 1 });
		num(p, "balance.green.droughtHours", b.green.droughtHours, { gt: 0, int: true });
	}
	if (!b.automation) p.push("balance.automation: missing");
	else {
		num(p, "balance.automation.partsBatch", b.automation.partsBatch, { min: 1, int: true });
		num(p, "balance.automation.foremanPerHour", b.automation.foremanPerHour, { min: 1, int: true });
	}
	const e = b.endings;
	for (const id of ["greenExemplar", "millionMinds"] as const) {
		const x = e?.[id];
		if (x === undefined) continue;
		num(p, `balance.endings.${id}.minScore`, x.minScore, { gt: 0, max: 1 });
		num(p, `balance.endings.${id}.pflops`, x.pflops, { gt: 0 });
		num(p, `balance.endings.${id}.days`, x.days, { min: 1, int: true });
	}
}

function validatePathsAndEndings(p: Problems, db: ContentDB): void {
	if (!Array.isArray(db.paths)) p.push("paths: expected an array");
	else {
		const seen = new Set<string>();
		db.paths.forEach((d, i) => {
			const w = `paths[${i}] (${d?.id})`;
			if (!PATHS.includes(d.id)) p.push(`${w}.id: unknown path`);
			if (seen.has(d.id)) p.push(`${w}: duplicate id`);
			seen.add(d.id);
			str(p, `${w}.name`, d.name);
			str(p, `${w}.description`, d.description);
			if (typeof d.available !== "boolean") p.push(`${w}.available: expected a boolean`);
		});
		for (const id of PATHS) if (!seen.has(id)) p.push(`paths: missing "${id}"`);
		if (!db.paths.some((d) => d.available)) p.push("paths: at least one path must be available");
	}
	if (!Array.isArray(db.endings)) p.push("endings: expected an array");
	else {
		const seen = new Set<string>();
		db.endings.forEach((d, i) => {
			const w = `endings[${i}] (${d?.id})`;
			if (!ENDINGS.includes(d.id)) p.push(`${w}.id: unknown ending`);
			if (seen.has(d.id)) p.push(`${w}: duplicate id`);
			seen.add(d.id);
			str(p, `${w}.title`, d.title);
			str(p, `${w}.body`, d.body);
		});
		for (const id of ENDINGS) if (!seen.has(id)) p.push(`endings: missing "${id}"`);
	}
}

function validateTech(p: Problems, db: ContentDB): void {
	if (!Array.isArray(db.tech)) {
		p.push("tech: expected an array");
		return;
	}
	const tierCount = db.balance?.tiers?.pflops?.length ?? 1;
	const byId = new Map<string, TechNode>();
	db.tech.forEach((n, i) => {
		const w = `tech[${i}] (${n?.id})`;
		str(p, `${w}.id`, n.id);
		if (typeof n.id === "string" && !ID_RE.test(n.id)) p.push(`${w}.id: use lowercase letters, digits and underscores`);
		if (byId.has(n.id)) p.push(`${w}: duplicate id`);
		byId.set(n.id, n);
		str(p, `${w}.name`, n.name);
		str(p, `${w}.description`, n.description);
		if (!TECH_BRANCHES.includes(n.branch)) p.push(`${w}.branch: unknown "${n.branch}"`);
		num(p, `${w}.minTier`, n.minTier, { min: 1, max: Math.max(1, tierCount), int: true });
		num(p, `${w}.cost`, n.cost, { gt: 0 });
		if (!Array.isArray(n.effects)) p.push(`${w}.effects: expected an array`);
		else
			n.effects.forEach((e, k) => {
				const ew = `${w}.effects[${k}]`;
				const t = (e as { type?: unknown } | null)?.type;
				if (t === "perk") {
					const pe = e as { kind: string; factor: number };
					if (!PERK_KINDS.includes(pe.kind)) p.push(`${ew}.kind: unknown perk "${pe.kind}"`);
					num(p, `${ew}.factor`, pe.factor, { gt: 0, max: 2 });
				} else if (t === "feature") {
					const fe = e as { feature: string };
					if (!FEATURES.includes(fe.feature)) p.push(`${ew}.feature: unknown feature "${fe.feature}"`);
				} else p.push(`${ew}.type: unknown effect type ${JSON.stringify(t)}`);
			});
		if (!Array.isArray(n.requires)) p.push(`${w}.requires: expected an array`);
		if (n.path !== undefined && !PATHS.includes(n.path)) p.push(`${w}.path: unknown path "${n.path}"`);
		const ascend = db.balance?.ascension?.minTier;
		if (n.path !== undefined && isNum(ascend) && isNum(n.minTier) && n.minTier < ascend) p.push(`${w}.minTier: a path node cannot come before the path is chosen (Clearance ${ascend})`);
	});
	for (const n of byId.values()) {
		if (!Array.isArray(n.requires)) continue;
		const w = `tech ${n.id}`;
		const seen = new Set<string>();
		for (const r of n.requires) {
			if (seen.has(r)) p.push(`${w}.requires: "${r}" listed twice`);
			seen.add(r);
			if (r === n.id) p.push(`${w}.requires: requires itself`);
			else if (!byId.has(r)) p.push(`${w}.requires: unknown tech "${r}"`);
		}
	}
	// Cycles (depth-first, 0 = unvisited, 1 = on the stack, 2 = done); each cycle is reported once.
	const state = new Map<string, number>();
	const visit = (id: string, path: string[]): void => {
		state.set(id, 1);
		for (const r of byId.get(id)?.requires ?? []) {
			if (!byId.has(r) || r === id) continue;
			const s = state.get(r) ?? 0;
			if (s === 1) p.push(`tech: dependency cycle ${[...path.slice(path.indexOf(r)), id, r].join(" -> ")}`);
			else if (s === 0) visit(r, [...path, id]);
		}
		state.set(id, 2);
	};
	for (const id of byId.keys()) if (!state.get(id)) visit(id, []);

	for (const [key, d] of Object.entries(db.facilities ?? {})) {
		if (d.tech !== undefined && !byId.has(d.tech)) p.push(`facilities.${key}.tech: unknown tech "${d.tech}"`);
		if (d.category === "bio" && !d.growth && d.tech !== undefined && byId.has(d.tech) && byId.get(d.tech)?.branch !== "wetware") {
			p.push(`facilities.${key}.tech: wetware facilities must be gated by a "wetware" tech node`);
		}
		if (d.category === "bio" && !d.growth && d.tech === undefined) p.push(`facilities.${key}.tech: wetware facilities must be gated behind wetware tech`);
	}
	for (const [key, b] of Object.entries(db.bots ?? {})) {
		if (b.tech !== undefined && !byId.has(b.tech)) p.push(`bots.${key}.tech: unknown tech "${b.tech}"`);
	}
}

/** Native art widths (packages/render/src/pixi/facilityArt.ts); wider defs get filler bays. */
const MIN_WIDTH_BY_KIND: Partial<Record<string, number>> = { nutrient: 3, sterilizer: 2, bioreactor: 4, chiller: 4, genset: 4, grid_tie: 4, ups: 3, crah: 2, cdu: 2, solar: 2, wind: 1, heat_export: 2, carbon: 2 };

export function validateContent(db: ContentDB): string[] {
	const p: Problems = [];
	const tierCount = db.balance?.tiers?.pflops?.length ?? 1;

	const facilities = db.facilities ?? {};
	if (Object.keys(facilities).length === 0) p.push("facilities: none defined");
	for (const [key, def] of Object.entries(facilities)) validateFacility(p, key, def, tierCount);

	const bots = db.bots ?? {};
	if (Object.keys(bots).length === 0) p.push("bots: none defined");
	for (const [key, b] of Object.entries(bots)) {
		const w = `bots.${key}`;
		if (b.id !== key) p.push(`${w}: id "${b.id}" does not match key`);
		str(p, `${w}.name`, b.name);
		num(p, `${w}.cost`, b.cost, { min: 0 });
		num(p, `${w}.speed`, b.speed, { gt: 0 });
		num(p, `${w}.batteryTicks`, b.batteryTicks, { gt: 0, int: true });
		num(p, `${w}.repairTicks`, b.repairTicks, { gt: 0, int: true });
		if (typeof b.color !== "string" || !HEX.test(b.color)) p.push(`${w}.color: expected #rrggbb`);
		if (b.carry !== undefined) num(p, `${w}.carry`, b.carry, { min: 1, int: true });
		if (b.flying !== undefined && typeof b.flying !== "boolean") p.push(`${w}.flying: expected a boolean`);
		if (b.tech !== undefined && typeof b.tech !== "string") p.push(`${w}.tech: expected a tech node id`);
	}

	const clients = db.clients ?? [];
	if (clients.length === 0) p.push("clients: none defined");
	const clientIds = new Set<string>();
	clients.forEach((c, i) => {
		const w = `clients[${i}] (${c.id})`;
		str(p, `${w}.id`, c.id);
		if (clientIds.has(c.id)) p.push(`${w}: duplicate id`);
		clientIds.add(c.id);
		str(p, `${w}.name`, c.name);
		if (!SECTORS.includes(c.sector)) p.push(`${w}.sector: unknown "${c.sector}"`);
		num(p, `${w}.weight`, c.weight, { gt: 0 });
		num(p, `${w}.minTier`, c.minTier, { min: 1, max: Math.max(1, tierCount), int: true });
		num(p, `${w}.payMultiplier`, c.payMultiplier, { gt: 0 });
		if (c.needsBio !== undefined && typeof c.needsBio !== "boolean") p.push(`${w}.needsBio: expected a boolean`);
		if (c.needsBio && c.needsLiquid) p.push(`${w}: needsBio and needsLiquid are mutually exclusive`);
		if (!Array.isArray(c.kinds) || c.kinds.length === 0) p.push(`${w}.kinds: at least one job kind required`);
		else
			c.kinds.forEach((k) => {
				if (!JOB_KINDS.includes(k)) p.push(`${w}.kinds: unknown kind "${k}"`);
			});
	});
	if (clients.length > 0 && !clients.some((c) => c.minTier <= 1)) p.push("clients: at least one client must be available at tier 1");

	const st = db.structure;
	if (!st) p.push("structure: missing");
	else {
		for (const k of [
			"slabPerTile",
			"basementSlabPerTile",
			"powerConduitPerTile",
			"coolantConduitPerTile",
			"liftPerFloor",
			"liftBase",
			"sparePart",
		] as const) {
			num(p, `structure.${k}`, st[k], { min: 0 });
		}
	}

	const lift = db.lift;
	if (!lift) p.push("lift: missing");
	else {
		num(p, "lift.speed", lift.speed, { gt: 0, max: 1 });
		num(p, "lift.capacity", lift.capacity, { min: 1, int: true });
		num(p, "lift.dwellTicks", lift.dwellTicks, { min: 0, int: true });
		num(p, "lift.facilityKw", lift.facilityKw, { min: 0 });
	}

	validateBalance(p, db);
	validateEvents(p, db);
	validateResearchBalance(p, db);
	validateTech(p, db);
	validateBioBalance(p, db);
	validatePathsAndEndings(p, db);

	const scenarios = db.scenarios ?? {};
	if (Object.keys(scenarios).length === 0) p.push("scenarios: none defined");
	for (const [key, s] of Object.entries(scenarios)) validateScenario(p, key, s, db);

	if (typeof db.generateContract !== "function") p.push("generateContract: missing");
	return p;
}
