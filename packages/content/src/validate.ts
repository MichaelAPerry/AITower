/**
 * Hand-written content validation (no schema library). Returns human-readable
 * problems; an empty array means the DB is valid.
 */
import type { AdvisorId, AscensionPath, SceneLine, StoryTrigger, BuildCategory, ContentDB, OrganoidSpec, EventChoice, EventDef, EventEffect, FacilityDef, FacilityKind, JobKind, Scenario, TechBranch, TechLane, TechLine, TechNode } from "./schema";

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
const ENDINGS = ["singularity", "flesh", "garden", "absorbed"];
const SECTORS = ["frontier", "biotech", "finance", "gov", "climate", "media"];
const JOB_KINDS: JobKind[] = ["training", "finetune", "inference"];
const COOLING_MODES = ["air", "dlc", "immersion", "bio"];
const HEX = /^#[0-9a-fA-F]{6}$/;
const TECH_LANES: TechLane[] = ["adm", "log", "pow", "cool", "comp", "wet", "green", "syn"];
const TECH_LINES: TechLine[] = ["air", "liquid", "immersion"];
const TECH_BRANCHES: TechBranch[] = ["compute", "cooling", "power", "logistics", "administration", "wetware"];
const PERK_KINDS = ["failureRate", "energyPrice", "payout", "coolingCapacity", "repairSpeed", "upkeep", "researchRate", "botSpeed"];
const FEATURES = ["contractsClerk", "foreman", "foremanPace", "openDoor"];
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

/** Optional flavour quote: a non-empty quote of at most 200 characters, a non-empty author, an optional source string. */
export function validateFlavor(p: Problems, w: string, f: unknown): void {
	if (f === undefined) return;
	const o = f as { quote?: unknown; author?: unknown; source?: unknown } | null;
	if (typeof o !== "object" || o === null) {
		p.push(`${w}.flavor: expected an object`);
		return;
	}
	if (typeof o.quote !== "string" || o.quote.trim() === "") p.push(`${w}.flavor.quote: expected a non-empty string`);
	else if (o.quote.length > 200) p.push(`${w}.flavor.quote: at most 200 characters`);
	if (typeof o.author !== "string" || o.author.trim() === "") p.push(`${w}.flavor.author: expected a non-empty string`);
	if (o.source !== undefined && (typeof o.source !== "string" || o.source.trim() === "")) p.push(`${w}.flavor.source: expected a non-empty string`);
}

/**
 * The research that unlocks a conduit layer, derived from the content (no hard-coded ids): coolant piping comes with the
 * earliest chiller / CDU, nutrient piping with the earliest nutrient plant. Undefined = never gated (power, or content
 * whose first such facility needs no research).
 */
export function conduitTech(db: ContentDB, layer: "power" | "coolant" | "nutrient"): string | undefined {
	if (layer === "power") return undefined;
	const kinds = layer === "coolant" ? ["chiller", "cdu"] : ["nutrient"];
	// Earliest Level first; at the same Level the cheapest research (a Starter's node comes before a Specialist's).
	const cost = (d: FacilityDef): number => db.tech?.find((t) => t.id === d.tech)?.cost ?? 0;
	const defs = Object.values(db.facilities)
		.filter((d) => kinds.includes(d.kind) && !d.retired)
		.sort((a, b) => a.unlockTier - b.unlockTier || cost(a) - cost(b) || (a.id < b.id ? -1 : 1));
	return defs[0]?.tech;
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

/** Catalogue fields (docs/TREES.md): tier, unlock, line consistency. `upgradesFrom` is checked against the whole table in `validateUpgrades`. */
function validateCatalogue(p: Problems, w: string, d: FacilityDef): void {
	if (d.tier !== undefined && d.tier !== "starter" && d.tier !== "specialist") p.push(`${w}.tier: expected "starter" or "specialist", got ${JSON.stringify(d.tier)}`);
	const treeLine = d.line === "biotech" || d.line === "greentech";
	if (!d.growth && treeLine && d.tier === undefined && !d.unlock?.bond) p.push(`${w}.tier: a ${d.line} item must be a "starter" or a "specialist" (or a signature build)`);
	if (d.tier !== undefined && !treeLine) p.push(`${w}.tier: only Bio and Green line items have a tier`);
	const u = d.unlock;
	if (u === undefined) return;
	if (typeof u !== "object" || u === null) return void p.push(`${w}.unlock: expected an object`);
	const who = (k: string, v: { who: AdvisorId; min: number } | undefined): void => {
		if (v === undefined) return;
		if (!ADVISORS.includes(v.who)) p.push(`${w}.unlock.${k}.who: unknown advisor "${v.who}"`);
		num(p, `${w}.unlock.${k}.min`, v.min, { min: 1, max: 100 });
	};
	who("bond", u.bond);
	who("early", u.early);
	who("preview", u.preview);
	if (u.commit !== undefined && !["biotech", "greentech"].includes(u.commit)) p.push(`${w}.unlock.commit: only biotech or greentech can be committed to`);
	if (u.early) num(p, `${w}.unlock.early.tier`, u.early.tier, { min: 1, max: d.unlockTier, int: true });
	if (u.preview) num(p, `${w}.unlock.preview.max`, u.preview.max, { min: 1, int: true });
	if (d.tier === "starter" && u.commit) p.push(`${w}.unlock.commit: a starter is open to anyone`);
	if (u.preview && !(d.tier === "specialist" || u.commit)) p.push(`${w}.unlock.preview: only a specialist (commit-gated) item has a preview`);
}

/** `upgradesFrom` must name another real, non-retired item and never go back down the Levels or loop. */
function validateUpgrades(p: Problems, db: ContentDB): void {
	for (const [key, d] of Object.entries(db.facilities ?? {})) {
		if (d.upgradesFrom === undefined) continue;
		const w = `facilities.${key}.upgradesFrom`;
		const from = db.facilities[d.upgradesFrom];
		if (!from) {
			p.push(`${w}: unknown facility "${d.upgradesFrom}"`);
			continue;
		}
		if (d.upgradesFrom === key) p.push(`${w}: upgrades itself`);
		if (from.retired || from.growth) p.push(`${w}: "${d.upgradesFrom}" cannot be upgraded`);
		if (from.unlockTier > d.unlockTier) p.push(`${w}: "${d.upgradesFrom}" opens at Level ${from.unlockTier}, after ${key} (Level ${d.unlockTier})`);
		const seen = new Set<string>([key]);
		for (let c: FacilityDef | undefined = from; c; c = c.upgradesFrom ? db.facilities[c.upgradesFrom] : undefined) {
			if (seen.has(c.id)) {
				p.push(`${w}: upgrade loop through "${c.id}"`);
				break;
			}
			seen.add(c.id);
		}
	}
}

function validateFacility(p: Problems, key: string, d: FacilityDef, tierCount: number): void {
	const w = `facilities.${key}`;
	if (d.id !== key) p.push(`${w}: id "${d.id}" does not match key`);
	str(p, `${w}.name`, d.name);
	str(p, `${w}.description`, d.description);
	validateFlavor(p, w, d.flavor);
	if (d.line !== undefined && !["shared", "synthetic", "biotech", "greentech"].includes(d.line)) p.push(`${w}.line: unknown tree line "${d.line}"`);
	validateCatalogue(p, w, d);
	for (const [t, v] of Object.entries(d.seal ?? {})) {
		if (!SEALED.includes(t)) p.push(`${w}.seal.${t}: only biotech or greentech can be sealed`);
		num(p, `${w}.seal.${t}`, v, { min: -50, max: 50 });
	}
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
		const c = d.cooling;
		if (c.holdC !== undefined) num(p, `${w}.cooling.holdC`, c.holdC, { min: 1, max: 60 });
		if (c.bioOnly !== undefined && typeof c.bioOnly !== "boolean") p.push(`${w}.cooling.bioOnly: expected a boolean`);
		if (c.freeAir) {
			num(p, `${w}.cooling.freeAir.fullBelowC`, c.freeAir.fullBelowC);
			num(p, `${w}.cooling.freeAir.hotC`, c.freeAir.hotC);
			num(p, `${w}.cooling.freeAir.hotFactor`, c.freeAir.hotFactor, { min: 0, max: 1 });
			if (isNum(c.freeAir.fullBelowC) && isNum(c.freeAir.hotC) && c.freeAir.hotC <= c.freeAir.fullBelowC) p.push(`${w}.cooling.freeAir: hotC must be above fullBelowC`);
		}
		if (c.failureFactor !== undefined) num(p, `${w}.cooling.failureFactor`, c.failureFactor, { gt: 0, max: 1 });
		if ((c.holdC !== undefined || c.bioOnly || c.freeAir || c.failureFactor !== undefined) && d.kind !== "crah") p.push(`${w}.cooling: holdC, bioOnly, freeAir and failureFactor are for air handlers (crah)`);
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
		for (const k of ["roofOnly", "exteriorOnly", "basementOnly"] as const) if (pl[k] !== undefined && typeof pl[k] !== "boolean") p.push(`${w}.placement.${k}: expected a boolean`);
		if (pl.basementOnly && pl.roofOnly) p.push(`${w}.placement: cannot be both roofOnly and basementOnly`);
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
	if (tr.techs !== undefined) {
		if (!Array.isArray(tr.techs) || tr.techs.length !== n) p.push(`balance.tiers.techs: expected ${n} entries (one per tier)`);
		else {
			const techs = tr.techs;
			techs.forEach((v, i) => {
				num(p, `balance.tiers.techs[${i}]`, v, { min: 0, int: true });
				if (i > 0 && v < techs[i - 1]) p.push(`balance.tiers.techs: must be non-decreasing at ${i}`);
			});
		}
		if (tr.techs?.[0]) p.push("balance.tiers: tier 1 must be free (techs[0] = 0)");
	}
	if (n > 0 && (tr.pflops[0] !== 0 || tr.uptime[0] !== 0)) p.push("balance.tiers: tier 1 must be free (pflops[0] = uptime[0] = 0)");
}

const LESSON_METRICS = ["racks", "racksBusy", "racksDark", "gensets", "headroomPct", "demandKw", "supplyKw", "shortKw", "maxRackC", "uptime", "cash", "pflops", "day"];
const LESSON_OPS = [">=", ">", "<=", "<"];

function validateLessons(p: Problems, db: ContentDB): void {
	const w0 = "lessons";
	if (!Array.isArray(db.lessons)) return void p.push(`${w0}: expected an array`);
	const ids = new Set<string>();
	const conds = (w: string, cs: unknown): void => {
		if (!Array.isArray(cs)) return void p.push(`${w}: expected an array of conditions`);
		cs.forEach((c, i) => {
			const m = (c as { metric?: string })?.metric;
			if (!m || !LESSON_METRICS.includes(m)) p.push(`${w}[${i}].metric: unknown metric '${String(m)}'`);
			if (!LESSON_OPS.includes((c as { op?: string })?.op ?? "")) p.push(`${w}[${i}].op: unknown operator`);
			num(p, `${w}[${i}].value`, (c as { value?: unknown })?.value);
		});
	};
	const effects = (w: string, es: unknown): void => {
		if (!Array.isArray(es)) return void p.push(`${w}: expected an array of effects`);
		es.forEach((e, i) => {
			const t = (e as { type?: string })?.type;
			if (t === "job") {
				num(p, `${w}[${i}].pflops`, (e as { pflops?: unknown }).pflops, { gt: 0 });
				num(p, `${w}[${i}].durationTicks`, (e as { durationTicks?: unknown }).durationTicks, { min: 1, int: true });
				num(p, `${w}[${i}].payout`, (e as { payout?: unknown }).payout, { min: 0 });
			} else if (t === "gridCap" || t === "failureRate") {
				num(p, `${w}[${i}].factor`, (e as { factor?: unknown }).factor, { min: 0 });
				num(p, `${w}[${i}].durationTicks`, (e as { durationTicks?: unknown }).durationTicks, { min: 1, int: true });
				str(p, `${w}[${i}].label`, (e as { label?: unknown }).label);
			} else p.push(`${w}[${i}].type: unknown effect '${String(t)}'`);
		});
	};
	for (const l of db.lessons) {
		const w = `lessons.${l.id}`;
		str(p, `${w}.id`, l.id);
		if (ids.has(l.id)) p.push(`${w}: duplicate id`);
		ids.add(l.id);
		str(p, `${w}.title`, l.title);
		str(p, `${w}.goal`, l.goal);
		str(p, `${w}.learned`, l.learned);
		if (!["cass", "bea", "mel", "luci"].includes(l.advisor)) p.push(`${w}.advisor: unknown advisor`);
		const sc = db.scenarios?.[l.scenario];
		if (!sc) p.push(`${w}.scenario: unknown scenario '${l.scenario}'`);
		else if (sc.lesson !== l.id) p.push(`${w}.scenario: scenario '${l.scenario}' must name lesson '${l.id}'`);
		if (!Array.isArray(l.steps) || l.steps.length === 0) p.push(`${w}.steps: need at least one step`);
		const beatIds = new Set((l.beats ?? []).map((b) => b.id));
		for (const s of l.steps ?? []) {
			conds(`${w}.steps.${s.id}.when`, s.when);
			for (const a of s.allow ?? []) if (!db.facilities[a.defId]) p.push(`${w}.steps.${s.id}.allow: unknown facility '${a.defId}'`);
			if (s.slot && !db.facilities[s.slot.defId]) p.push(`${w}.steps.${s.id}.slot: unknown facility '${s.slot.defId}'`);
			if (!Array.isArray(s.say) || s.say.length === 0) p.push(`${w}.steps.${s.id}.say: the teacher needs a line`);
			if (s.afterBeat && !beatIds.has(s.afterBeat)) p.push(`${w}.steps.${s.id}.afterBeat: unknown beat '${s.afterBeat}'`);
		}
		for (const b of l.beats ?? []) {
			conds(`${w}.beats.${b.id}.when`, b.when);
			effects(`${w}.beats.${b.id}.effects`, b.effects);
		}
		effects(`${w}.setup`, l.setup ?? []);
		conds(`${w}.win.when`, l.win?.when);
		num(p, `${w}.win.holdTicks`, l.win?.holdTicks, { min: 1, int: true });
		conds(`${w}.lose`, l.lose);
		num(p, `${w}.bonus`, l.bonus, { min: 0 });
		if (!Array.isArray(l.commands) || l.commands.length === 0) p.push(`${w}.commands: expected a list of command types`);
	}
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
	if (s.lesson !== undefined) str(p, `${w}.lesson`, s.lesson);
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

const ADVISORS = ["cass", "bea", "mel", "luci"];
const EVENT_CATEGORIES = ["ministry", "environmental", "operational", "client", "horror", "story"];
const SEALED = ["biotech", "greentech"];
const MOODS = ["neutral", "pleased", "displeased", "unsettling"];

function validateLines(p: Problems, w: string, lines: unknown): void {
	if (!Array.isArray(lines) || lines.length === 0) return void p.push(`${w}: expected a non-empty array of lines`);
	lines.forEach((l: SceneLine, i) => {
		if (l?.who !== "narrator" && !ADVISORS.includes(l?.who)) p.push(`${w}[${i}].who: unknown speaker "${String(l?.who)}"`);
		str(p, `${w}[${i}].text`, l?.text);
		if (l?.mood !== undefined && !MOODS.includes(l.mood)) p.push(`${w}[${i}].mood: unknown mood "${l.mood}"`);
	});
}

function validateTrigger(p: Problems, w: string, t: StoryTrigger): void {
	switch (t?.kind) {
		case "tick":
		case "tier":
			num(p, `${w}.atLeast`, t.atLeast, { min: 0, int: true });
			break;
		case "sp":
			if (!PATHS.includes(t.path)) p.push(`${w}.path: unknown path`);
			num(p, `${w}.atLeast`, t.atLeast, { gt: 0, max: 1 });
			break;
		case "seal":
			if (!SEALED.includes(t.path)) p.push(`${w}.path: only biotech or greentech can be sealed`);
			num(p, `${w}.atLeast`, t.atLeast, { gt: 0 });
			break;
		case "sealedOut":
		case "objection":
			if (!SEALED.includes(t.path)) p.push(`${w}.path: only biotech or greentech can be sealed`);
			break;
		default:
			p.push(`${w}.kind: unknown trigger "${String((t as { kind?: unknown })?.kind)}"`);
	}
}
const ID_RE = /^[a-z0-9_]+$/;

function validateEffect(p: Problems, w: string, e: EventEffect): void {
	const dur = (d: unknown): void => num(p, `${w}.durationTicks`, d, { gt: 0, int: true });
	const t = (e as { type?: unknown } | null)?.type;
	switch (t) {
		case "cash":
			num(p, `${w}.amount`, (e as { amount: number }).amount);
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
		case "seal":
			if (!SEALED.includes((e as { path: string }).path)) p.push(`${w}.path: only biotech or greentech can be sealed`);
			num(p, `${w}.amount`, (e as { amount: number }).amount, { min: -100, max: 100 });
			break;
		case "bond":
			if (!ADVISORS.includes((e as { advisor: string }).advisor)) p.push(`${w}.advisor: unknown advisor`);
			num(p, `${w}.amount`, (e as { amount: number }).amount, { min: -100, max: 100 });
			break;
		case "sp":
			if (!PATHS.includes((e as { path: AscensionPath }).path)) p.push(`${w}.path: unknown path`);
			num(p, `${w}.amount`, (e as { amount: number }).amount, { min: -500, max: 500 });
			break;
		case "commitPath":
			if (!PATHS.includes((e as { path: AscensionPath }).path)) p.push(`${w}.path: unknown path`);
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
	if (c.reply !== undefined) validateLines(p, `${w}.reply`, c.reply);
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
	if (!ADVISORS.includes(e.advisor)) p.push(`${w}.advisor: unknown advisor "${e.advisor}"`);
	if (e.category === "story") {
		if (e.trigger === undefined) p.push(`${w}.trigger: story scenes need a trigger`);
		else validateTrigger(p, `${w}.trigger`, e.trigger);
		if (e.lines !== undefined) validateLines(p, `${w}.lines`, e.lines);
	} else if (e.trigger !== undefined) p.push(`${w}.trigger: only story scenes have triggers`);
	if (e.whenPath !== undefined && (!Array.isArray(e.whenPath) || e.whenPath.some((x) => x !== null && !PATHS.includes(x)))) p.push(`${w}.whenPath: expected paths or null`);
	if (e.backdrop !== undefined && e.backdrop !== "title" && !PATHS.includes(e.backdrop)) p.push(`${w}.backdrop: unknown backdrop`);
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
	if (!ids.has(e.recommended)) p.push(`${w}.recommended: "${e.recommended}" is not one of the choices`);
	if (e.votes !== undefined) {
		const who = (e.votes ?? []).map((v) => v.advisor).join(",");
		if (who !== "cass,bea,mel") p.push(`${w}.votes: expected one vote each from cass, bea and mel, in that order`);
		for (const [k, v] of (e.votes ?? []).entries()) {
			if (typeof v.approve !== "boolean") p.push(`${w}.votes[${k}].approve: expected true or false`);
			str(p, `${w}.votes[${k}].line`, v.line);
		}
	}
}

function validateEvents(p: Problems, db: ContentDB): void {
	const b = db.balance;
	if (b?.events) {
		num(p, "balance.events.intervalTicks", b.events.intervalTicks, { min: 1, int: true });
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
		const grades = (key: "cashShareByGrade", lo: number, hi: number): void => {
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
	if (!e?.absorbed) p.push("balance.endings: absorbed is required");
	else num(p, "balance.endings.absorbed.corruption", e.absorbed.corruption, { gt: 0, max: 1 });
	validateSoul(p, b);
}

function validateSoul(p: Problems, b: ContentDB["balance"]): void {
	const s = b.soul;
	if (!s) return void p.push("balance.soul: missing");
	num(p, "balance.soul.spTarget", s.spTarget, { gt: 0 });
	num(p, "balance.soul.spPerPflopHour", s.spPerPflopHour, { gt: 0 });
	num(p, "balance.soul.sealMax", s.sealMax, { gt: 0 });
	num(p, "balance.soul.residuePerDay", s.residuePerDay, { min: 0, max: 1 });
	num(p, "balance.soul.objectionScar", s.objectionScar, { gt: 0 });
	num(p, "balance.soul.starterWeight", s.starterWeight, { min: 0, max: 5 });
	for (const k of ["bondReveal", "bondCommit", "bondEpilogue"] as const) num(p, `balance.soul.${k}`, s[k], { min: 0, max: 100 });
	num(p, "balance.soul.bondFollow", s.bondFollow, { min: 0, max: 20 });
	num(p, "balance.soul.bondOverrule", s.bondOverrule, { min: -20, max: 0 });
	for (const a of ADVISORS) num(p, `balance.soul.bondStart.${a}`, s.bondStart?.[a as AdvisorId], { min: 0, max: 100 });
	for (const path of PATHS) {
		const w = s.spWeights?.[path];
		if (!w) p.push(`balance.soul.spWeights.${path}: missing`);
		else for (const [k, v] of Object.entries(w)) num(p, `balance.soul.spWeights.${path}.${k}`, v, { min: 0 });
	}
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
			if (d.backdrop !== undefined && !PATHS.includes(d.backdrop)) p.push(`${w}.backdrop: unknown path`);
			for (const [a, t] of Object.entries(d.epilogue ?? {})) {
				if (!ADVISORS.includes(a)) p.push(`${w}.epilogue.${a}: unknown advisor`);
				str(p, `${w}.epilogue.${a}`, t);
			}
		});
		for (const id of ENDINGS) if (!seen.has(id)) p.push(`endings: missing "${id}"`);
	}
}

function validateLanes(p: Problems, db: ContentDB): void {
	if (!Array.isArray(db.lanes)) {
		p.push("lanes: expected an array");
		return;
	}
	const seen = new Set<string>();
	db.lanes.forEach((l, i) => {
		const w = `lanes[${i}] (${l?.id})`;
		if (!TECH_LANES.includes(l.id)) p.push(`${w}.id: unknown lane "${l.id}"`);
		if (seen.has(l.id)) p.push(`${w}: duplicate id`);
		seen.add(l.id);
		for (const k of ["name", "short", "advisor", "identity", "signature", "pitch"] as const) str(p, `${w}.${k}`, l[k]);
		if (typeof l.color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(l.color)) p.push(`${w}.color: expected #rrggbb`);
		if (l.path !== undefined && !PATHS.includes(l.path)) p.push(`${w}.path: unknown path "${l.path}"`);
	});
	for (const id of TECH_LANES) if (!seen.has(id)) p.push(`lanes: missing "${id}"`);
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
		validateFlavor(p, w, n.flavor);
		if (!TECH_BRANCHES.includes(n.branch)) p.push(`${w}.branch: unknown "${n.branch}"`);
		if (n.lane === undefined || !TECH_LANES.includes(n.lane)) p.push(`${w}.lane: unknown "${n.lane}"`);
		else if (!(db.lanes ?? []).some((l) => l.id === n.lane)) p.push(`${w}.lane: "${n.lane}" has no entry in lanes`);
		if (n.line !== undefined && !TECH_LINES.includes(n.line)) p.push(`${w}.line: unknown "${n.line}"`);
		if (n.line !== undefined && n.lane !== "cool" && n.lane !== "comp") p.push(`${w}.line: only the cool and comp lanes have equipment lines`);
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
		if (n.requiresCommit !== undefined && !SEALED.includes(n.requiresCommit)) p.push(`${w}.requiresCommit: only biotech or greentech can be committed to`);
		if (n.requiresCommit !== undefined && isNum(db.balance?.ascension?.minTier) && isNum(n.minTier) && n.minTier < db.balance.ascension.minTier) p.push(`${w}.minTier: a commit node cannot come before the commit (Clearance ${db.balance.ascension.minTier})`);
		if (n.earlyTier !== undefined) {
			if (!ADVISORS.includes(n.earlyTier.who)) p.push(`${w}.earlyTier.who: unknown advisor "${n.earlyTier.who}"`);
			num(p, `${w}.earlyTier.min`, n.earlyTier.min, { min: 1, max: 100 });
			num(p, `${w}.earlyTier.tier`, n.earlyTier.tier, { min: 1, max: n.minTier, int: true });
		}
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
const MIN_WIDTH_BY_KIND: Partial<Record<string, number>> = { nutrient: 2, sterilizer: 2, bioreactor: 4, chiller: 4, genset: 4, grid_tie: 4, ups: 3, crah: 2, cdu: 2, solar: 2, wind: 1, heat_export: 2, carbon: 2 };

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
		validateFlavor(p, w, b.flavor);
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
	validateLanes(p, db);
	validateTech(p, db);
	validateUpgrades(p, db);
	validateBioBalance(p, db);
	validatePathsAndEndings(p, db);

	const scenarios = db.scenarios ?? {};
	if (Object.keys(scenarios).length === 0) p.push("scenarios: none defined");
	for (const [key, s] of Object.entries(scenarios)) validateScenario(p, key, s, db);

	validateLessons(p, db);
	if (typeof db.generateContract !== "function") p.push("generateContract: missing");
	return p;
}
