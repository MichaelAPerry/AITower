/**
 * Hand-written content validation (no schema library). Returns human-readable
 * problems; an empty array means the DB is valid.
 */
import type { BuildCategory, ContentDB, EventChoice, EventDef, EventEffect, FacilityDef, FacilityKind, JobKind, Scenario } from "./schema";

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
};
const SPEC_FOR_KIND: Record<FacilityKind, "rack" | "power" | "cooling" | "logistics"> = KIND_CATEGORY;
const SECTORS = ["frontier", "biotech", "finance", "gov", "climate", "media"];
const JOB_KINDS: JobKind[] = ["training", "finetune", "inference"];
const COOLING_MODES = ["air", "dlc", "immersion"];
const HEX = /^#[0-9a-fA-F]{6}$/;

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

function validateFacility(p: Problems, key: string, d: FacilityDef, tierCount: number): void {
	const w = `facilities.${key}`;
	if (d.id !== key) p.push(`${w}: id "${d.id}" does not match key`);
	str(p, `${w}.name`, d.name);
	str(p, `${w}.description`, d.description);
	if (!(d.kind in KIND_CATEGORY)) {
		p.push(`${w}.kind: unknown kind "${d.kind}"`);
		return;
	}
	if (d.category !== KIND_CATEGORY[d.kind]) p.push(`${w}.category: "${d.category}" should be "${KIND_CATEGORY[d.kind]}" for kind ${d.kind}`);
	num(p, `${w}.width`, d.width, { min: 1, int: true });
	num(p, `${w}.cost`, d.cost, { min: 0 });
	num(p, `${w}.upkeepPerDay`, d.upkeepPerDay, { min: 0 });
	num(p, `${w}.unlockTier`, d.unlockTier, { min: 1, max: Math.max(1, tierCount), int: true });
	num(p, `${w}.facilityKw`, d.facilityKw, { min: 0 });
	if (typeof d.color !== "string" || !HEX.test(d.color)) p.push(`${w}.color: expected #rrggbb`);
	if (typeof d.accent !== "string" || !HEX.test(d.accent)) p.push(`${w}.accent: expected #rrggbb`);

	const spec = SPEC_FOR_KIND[d.kind];
	for (const s of ["rack", "power", "cooling", "logistics"] as const) {
		if (s === spec && !d[s]) p.push(`${w}: kind ${d.kind} requires a "${s}" spec`);
		if (s !== spec && d[s]) p.push(`${w}: unexpected "${s}" spec for kind ${d.kind}`);
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
		if (r.cooling !== "air") {
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
		for (const k of ["dailyGood", "dailyBad", "jobFailed", "jobCompleted"] as const) num(p, `balance.standing.${k}`, b.standing[k]);
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

	const scenarios = db.scenarios ?? {};
	if (Object.keys(scenarios).length === 0) p.push("scenarios: none defined");
	for (const [key, s] of Object.entries(scenarios)) validateScenario(p, key, s, db);

	if (typeof db.generateContract !== "function") p.push("generateContract: missing");
	return p;
}
