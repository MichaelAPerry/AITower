/**
 * A scripted "competent player" for balance runs (docs/TREES.md section 5): it builds, researches, commits and answers decisions
 * through the public command API only, so nothing it does is something a player could not do by hand. One policy per tree:
 *
 *   synthetic : the default path. Liquid and immersion halls, plant on the basement floor, gas and grid power.
 *   biotech   : shared racks to Level 3, commit to The Flesh, then organoid halls with nutrient, sterile bays and perfusion.
 *   greentech : shared racks to Level 3, commit to The Garden, then neuromorphic / photonic halls with PV, wind and heat export.
 *
 * Bond pace: once a game day the player stays late with the tree's champion (the real `visitAdvisor` command: +3 bond, then the
 * scene's first choice, a warm +1), which is the pace the balance in docs/TREES.md section 5.1 depends on.
 */
import {
	access,
	CHAMPION,
	facilityNeedsPower,
	type AdvisorId,
	type AscensionPath,
	type ContentDB,
	type EventDef,
	type FacilityDef,
	type TechNode,
} from "@aitower/content";
import type { ContractView, Sim, SimCommand, SimView } from "@aitower/sim";
import { AUTO_ACCEPT_MARGIN, bestMemoChoice, PERMISSIVE_CLERK, shouldAccept } from "./run";

export type Tree = AscensionPath;

/** Research the policy wants first, in order; anything not listed is bought cheapest-first when the list is blocked. */
const SHARED_START = ["contracts_clerk", "desk_fan_standard", "batch_cards", "rear_door_drawings", "substation_licence", "reading_room", "tape_silo"];
export const PRIORITY: Record<Tree, string[]> = {
	synthetic: [
		"contracts_clerk",
		"desk_fan_standard",
		"chilled_loop",
		"batch_cards",
		"rear_door_drawings",
		"substation_licence",
		"inference_foundry",
		"cold_plate_gen3",
		"reading_room",
		"tower_hydraulics",
		"gas_concession",
		"rear_door_exchanger",
		"manifold_blade",
		"two_phase_immersion",
		"feeder_treaty",
		"cryo_core_dossier",
		"immersion_vault",
		"mind_lattice_dossier",
		"grid_autonomy",
	],
	biotech: [
		"contracts_clerk",
		"desk_fan_standard",
		"batch_cards",
		"rear_door_drawings",
		"culture_media",
		"culture_bench",
		"substation_licence",
		"wetware_annex",
		"reading_room",
		"inference_foundry",
		"sterile_protocols",
		"perfusion_baths",
		"organoid_vats",
		"nutrient_works",
		"quarantine_doctrine",
		"tissue_scaffolds",
		"perfusion_manifold",
		"bioreactor_permit",
		"dna_archive_charter",
		"neural_pit_dossier",
		"vascular_plant",
	],
	greentech: [
		"contracts_clerk",
		"desk_fan_standard",
		"batch_cards",
		"rear_door_drawings",
		"reading_room",
		"pit_crew",
		"inference_foundry",
		"solar_charter",
		"economizer",
		"event_array",
		"chilled_loop",
		"district_heat_accord",
		"wind_permit",
		"canopy_array",
		"adiabatic_cooling",
		"photonic_bench",
		"hydrogen_cell",
		"photonic_mesh",
	],
};

/** What a careful Bio / Green player counts a permanent scar on her own tree as worth, per seal point. */
const SCAR_COST: Record<Tree, number> = { synthetic: 0, biotech: 60_000, greentech: 80_000 };

const isRack = (d: FacilityDef): boolean => d.kind === "rack" && !!d.rack && d.rack.pflops > 0 && !d.growth && !d.retired;
const coolMult = (d: FacilityDef): number => (d.rack?.cooling === "air" ? 1.25 : d.rack?.cooling === "bio" ? 1.35 : 1.4);

interface Spot {
	floor: number;
	x: number;
}

export class Player {
	/** What the policy built, for the report. */
	readonly log: string[] = [];
	private day = -1;

	constructor(
		private readonly sim: Sim,
		private readonly content: ContentDB,
		readonly tree: Tree,
		private readonly opts: { reserveDays?: number } = {},
	) {}

	// ─── Reading the world ──────────────────────────────────────────────────────────────────────────────────────

	private idx(v: SimView, x: number, f: number): number {
		return (f - v.floorMin) * v.width + x;
	}

	private floorsWithSlab(v: SimView): number[] {
		const out: number[] = [];
		for (let f = v.floorMin; f <= v.floorMax; f++) {
			for (let x = 0; x < v.width; x++) {
				if (v.slab[this.idx(v, x, f)]) {
					out.push(f);
					break;
				}
			}
		}
		return out;
	}

	private span(v: SimView, f: number): { x0: number; x1: number } | null {
		let x0 = -1;
		let x1 = -1;
		for (let x = 0; x < v.width; x++) {
			if (v.slab[this.idx(v, x, f)]) {
				if (x0 < 0) x0 = x;
				x1 = x;
			}
		}
		return x0 < 0 ? null : { x0, x1 };
	}

	private researched(v: SimView): Set<string> {
		return new Set(v.techResearched);
	}

	/** Purchase price plus the scar it leaves on this policy's own tree. */
	private priced(d: FacilityDef): number {
		const seal = this.tree === "biotech" ? d.seal?.biotech : this.tree === "greentech" ? d.seal?.greentech : 0;
		return d.cost + Math.max(0, seal ?? 0) * SCAR_COST[this.tree];
	}

	/** May the player place `d` now (Level, research, commit, bond rules; cash aside)? */
	usable(d: FacilityDef, v: SimView): boolean {
		if (d.growth || d.retired) return false;
		const acc = access(d, { path: v.path, tier: v.tier, bonds: v.soul.bonds, sealedOut: v.soul.sealedOut, owned: (id) => v.facilities.filter((f) => f.defId === id).length });
		if (acc.block || acc.tier > v.tier) return false;
		return acc.preview || d.tech === undefined || this.researched(v).has(d.tech);
	}

	private occupancy(v: SimView): Uint8Array {
		const occ = new Uint8Array(v.slab.length);
		for (const f of v.facilities) for (let k = 0; k < f.width; k++) occ[this.idx(v, f.x + k, f.floor)] = 1;
		for (const l of v.lifts) for (let f = l.floorMin; f <= l.floorMax; f++) occ[this.idx(v, l.x, f)] = 1;
		return occ;
	}

	// ─── Placement ─────────────────────────────────────────────────────────────────────────────────────────────

	private ok(cmd: SimCommand): boolean {
		const r = this.sim.canBuild(cmd);
		return r.ok || r.reason.startsWith("insufficient funds");
	}

	private submit(cmd: SimCommand): boolean {
		return this.sim.submit(cmd).ok;
	}

	/** Candidate spots for `d` on the given floors, best (lowest score) first. `occ` is updated by `claim`. */
	private spots(v: SimView, d: FacilityDef, floors: number[], occ: Uint8Array, score: (s: Spot) => number): Spot[] {
		const out: { s: Spot; sc: number }[] = [];
		const p = d.placement ?? {};
		const wantsPower = facilityNeedsPower(d);
		for (const floor of floors) {
			for (let x = 0; x + d.width <= v.width; x++) {
				let fine = true;
				let power = false;
				let cool = false;
				let nut = false;
				for (let k = 0; k < d.width && fine; k++) {
					const i = this.idx(v, x + k, floor);
					if (!v.slab[i] || occ[i]) fine = false;
					if (v.power[i]) power = true;
					if (v.coolant[i]) cool = true;
					if (v.nutrient[i]) nut = true;
				}
				if (!fine) continue;
				if (wantsPower && !power) continue;
				if (p.needsCoolant && !cool) continue;
				if (p.needsNutrient && !nut) continue;
				const s = { floor, x };
				out.push({ s, sc: score(s) });
			}
		}
		return out.sort((a, b) => a.sc - b.sc || a.s.floor - b.s.floor || a.s.x - b.s.x).map((o) => o.s);
	}

	private claim(v: SimView, occ: Uint8Array, d: FacilityDef, s: Spot): void {
		for (let k = 0; k < d.width; k++) occ[this.idx(v, s.x + k, s.floor)] = 1;
	}

	/** Place `d` at the best spot that the sim accepts. Returns the spot or null. */
	private place(v: SimView, occ: Uint8Array, d: FacilityDef, floors: number[], score: (s: Spot) => number): Spot | null {
		if (d.cost > this.remaining) return null; // everything queued this hour is paid from one purse
		for (const s of this.spots(v, d, floors, occ, score)) {
			const cmd: SimCommand = { type: "place", defId: d.id, floor: s.floor, x: s.x };
			if (this.ok(cmd) && this.submit(cmd)) {
				this.remaining -= d.cost;
				this.claim(v, occ, d, s);
				this.log.push(`${d.id}@${s.floor}:${s.x}`);
				return s;
			}
		}
		return null;
	}

	// ─── Floors, conduits ──────────────────────────────────────────────────────────────────────────────────────

	/** A new top floor (slab, power conduit, lift stop), as the Foreman's expandUp does. Returns true when something was added. */
	private addFloor(v: SimView, direction: "up" | "down"): boolean {
		const floors = this.floorsWithSlab(v);
		const edge = direction === "up" ? floors.at(-1) : floors[0];
		if (edge === undefined) return false;
		const next = direction === "up" ? edge + 1 : edge - 1;
		if (next > v.floorMax || next < v.floorMin) return false;
		const sp = this.span(v, edge);
		if (!sp) return false;
		if (!this.submit({ type: "buildSlab", floor: next, x0: sp.x0, x1: sp.x1 })) return false;
		const cells = [];
		for (let x = sp.x0; x <= sp.x1; x++) cells.push({ x, floor: next });
		this.submit({ type: "buildConduit", layer: "power", cells });
		const lift = v.lifts[0];
		if (lift) this.submit({ type: "buildLift", x: lift.x, floorMin: Math.min(lift.floorMin, next), floorMax: Math.max(lift.floorMax, next) });
		this.log.push(`floor ${next}`);
		return true;
	}

	/** Pipe a layer ("coolant" | "nutrient") along the plant floor, up a riser and along the hall floor. */
	private pipeHall(v: SimView, layer: "coolant" | "nutrient", plantFloor: number, hallFloor: number): void {
		const grid = layer === "coolant" ? v.coolant : v.nutrient;
		const cells: { x: number; floor: number }[] = [];
		const add = (x: number, floor: number): void => {
			if (!grid[this.idx(v, x, floor)] && !cells.some((c) => c.x === x && c.floor === floor)) cells.push({ x, floor });
		};
		const pSpan = this.span(v, plantFloor);
		const hSpan = this.span(v, hallFloor);
		if (!pSpan || !hSpan) return;
		const riser = Math.min(pSpan.x1, hSpan.x1) - 1; // east edge: clear of the lift and the first racks
		for (let x = pSpan.x0; x <= pSpan.x1; x++) add(x, plantFloor);
		const lo = Math.min(plantFloor, hallFloor);
		const hi = Math.max(plantFloor, hallFloor);
		for (let f = lo; f <= hi; f++) add(riser, f);
		for (let x = hSpan.x0; x <= hSpan.x1; x++) add(x, hallFloor);
		if (cells.length) this.submit({ type: "buildConduit", layer, cells });
	}

	// ─── Money ─────────────────────────────────────────────────────────────────────────────────────────────────

	private reserve(v: SimView): number {
		const last = v.ledger[Math.max(0, v.ledger.length - 2)];
		const running = last ? last.energy + last.upkeep + last.fees + last.interest : 0;
		return Math.max(250_000, (this.opts.reserveDays ?? 1.5) * running);
	}

	// ─── Decisions and research ────────────────────────────────────────────────────────────────────────────────

	/** The choice a trusting, careful player makes: advisors she trusts first, never a commit to the wrong tree, no new seal on her own tree. */
	chooseDecision(def: EventDef): string {
		const champ: AdvisorId = CHAMPION[this.tree];
		const score = (c: EventDef["choices"][number]): number => {
			let s = 0;
			for (const e of c.effects) {
				if (e.type === "cash") s += e.amount;
				if (e.type === "commitPath" && e.path !== this.tree) s -= 1e9;
				if (e.type === "seal" && e.path === this.tree) s -= e.amount * 3e4;
				if (e.type === "sp") s += (e.path === this.tree ? 1 : e.path === "synthetic" ? -0.3 : 0) * e.amount * 5e4;
				if (e.type === "bond" && e.advisor === champ) s += e.amount * 5e4;
			}
			if (c.id === def.recommended && (def.advisor === champ || def.advisor === "cass")) s += 2e5;
			return s;
		};
		return [...def.choices].sort((a, b) => score(b) - score(a))[0].id;
	}

	private research(v: SimView): void {
		const done = this.researched(v);
		const bonds = v.soul.bonds;
		const open = (n: TechNode): boolean => {
			if (done.has(n.id) || !n.requires.every((r) => done.has(r))) return false;
			if (n.requiresCommit && v.path !== n.requiresCommit) return false;
			const tier = n.earlyTier && bonds[n.earlyTier.who] >= n.earlyTier.min ? Math.min(n.minTier, n.earlyTier.tier) : n.minTier;
			return v.tier >= tier;
		};
		const byId = new Map(this.content.tech.map((n) => [n.id, n]));
		const mine = PRIORITY[this.tree].map((id) => byId.get(id)).filter((n): n is TechNode => !!n && open(n));
		const need = v.tierNeed;
		const installed = v.facilities.reduce((n, f) => n + (this.content.facilities[f.defId].rack?.pflops ?? 0), 0);
		// Fill with cheap nodes only when the node count is what holds the next Level back.
		const short = need ? need.techs > need.techsDone && installed >= need.pflops : false;
		let pick = mine[0];
		// Waiting on an expensive node while the next Level wants more nodes: fill with the cheapest open ones.
		if (!pick || (v.researchPoints < pick.cost && short)) {
			const cheap = this.content.tech.filter((n) => open(n) && !(n.requiresCommit && n.requiresCommit !== this.tree)).sort((a, b) => a.cost - b.cost);
			if (!pick) pick = cheap[0];
			else if (cheap[0] && cheap[0].cost <= v.researchPoints) pick = cheap[0];
		}
		if (pick && v.researchPoints >= pick.cost) {
			const r = this.sim.submit({ type: "research", techId: pick.id });
			if (process.env.SOULDEBUG && !r.ok) this.log.push(`research ${pick.id} refused: ${r.reason}`);
		}
	}

	private commit(v: SimView): void {
		if (this.tree === "synthetic" || v.path !== null || v.tier < this.content.balance.ascension.minTier) return;
		if (v.soul.commitBlock[this.tree] === null) this.submit({ type: "choosePath", path: this.tree });
	}

	// ─── Racks ─────────────────────────────────────────────────────────────────────────────────────────────────

	/** Value of a rack to this policy: PFLOPS (revenue 0.5 + Singularity weight for the tree it is chasing) per dollar with its plant. */
	private value(d: FacilityDef, v: SimView): number {
		const w = this.content.balance.soul;
		const line = d.line ?? "shared";
		const starter = d.tier === "starter";
		const committed = v.path === this.tree && this.tree !== "synthetic";
		let sp: number;
		if (committed) {
			const table = w.spWeights[this.tree];
			sp = starter && line === this.tree ? w.starterWeight : (table[line] ?? 0);
			if (this.tree === "greentech") sp *= 0.55; // the green score, as played
			sp -= 0.25 * (w.spWeights.synthetic[starter ? "shared" : line] ?? 0); // it also feeds the Lattice
		} else sp = w.spWeights.synthetic[starter ? "shared" : line] ?? 0;
		return ((d.rack?.pflops ?? 0) * (0.5 + Math.max(0, sp))) / (this.priced(d) * coolMult(d) + 1);
	}

	private pickRack(v: SimView, budget: number): FacilityDef | null {
		let cands = Object.values(this.content.facilities).filter((d) => isRack(d) && this.usable(d, v));
		// A committed Bio / Green tower builds its own line (shared racks only scar it and feed the Lattice) once it has one.
		if (this.tree !== "synthetic" && v.path === this.tree) {
			// ...and until it has one a Green tower builds nothing new (every shared item scars it; the research is first in line).
			// Bio is not scarred by shared racks, so it keeps growing on them meanwhile.
			const own = cands.filter((d) => d.line === this.tree);
			if (own.length || this.tree === "greentech") cands = own;
		}
		const afford = cands.filter((d) => d.cost * 1.3 <= budget);
		return afford.sort((a, b) => this.value(b, v) - this.value(a, v))[0] ?? null;
	}

	private airCapacity(v: SimView, floor: number): { cap: number; load: number } {
		let cap = 0;
		let load = 0;
		for (const f of v.facilities) {
			const d = this.content.facilities[f.defId];
			if (f.floor !== floor || !f.enabled) continue;
			if (d.kind === "crah" && !d.cooling?.bioOnly) cap += (d.cooling?.capacityKw ?? 0) * (d.cooling?.freeAir ? 0.6 : 1);
			if (d.kind === "rack" && d.rack) load += d.rack.powerKw * (1 - d.rack.liquidFraction);
		}
		return { cap, load };
	}

	private pending = { power: 0, air: new Map<number, number>(), liquid: 0, nutrient: 0 };

	/** Add generation when the net cannot take `kw` more. Returns true when it queued something. */
	private ensurePower(v: SimView, occ: Uint8Array, kw: number, budget: number): boolean {
		const net = v.powerNets.reduce((a, n) => ({ supply: a.supply + n.supplyKw, demand: a.demand + n.demandKw }), { supply: 0, demand: 0 });
		const free = net.supply * 0.92 - Math.max(net.demand, this.installedKw(v) * 0.8) - this.pending.power;
		if (free >= kw) return true;
		const need = kw - free;
		const defs = Object.values(this.content.facilities)
			.filter((d) => (d.kind === "grid_tie" || d.kind === "genset") && !d.cooling && this.usable(d, v) && (d.power?.costPerKwh ?? 0) < 20 && d.cost <= budget)
			.sort((a, b) => this.priced(a) / (a.power?.capacityKw ?? 1) - this.priced(b) / (b.power?.capacityKw ?? 1));
		const enough = defs.filter((d) => (d.power?.capacityKw ?? 0) >= need);
		const order = enough.length ? enough.sort((a, b) => this.priced(a) - this.priced(b)) : defs.sort((a, b) => (b.power?.capacityKw ?? 0) - (a.power?.capacityKw ?? 0));
		const floors = [0, -1, -2, -3].filter((f) => f >= v.floorMin);
		for (const d of order) {
			if (this.place(v, occ, d, floors, (s) => -s.floor * 100 + s.x)) {
				this.pending.power += d.power?.capacityKw ?? 0;
				return true;
			}
		}
		// No room: dig a basement and try next hour.
		this.addFloor(v, "down");
		return false;
	}

	private installedKw(v: SimView): number {
		let kw = 0;
		for (const f of v.facilities) {
			const d = this.content.facilities[f.defId];
			if (d.kind === "rack" && d.rack && f.enabled) kw += d.rack.powerKw;
		}
		return kw;
	}

	/** Hall floors: built floors from 1 up, leaving the roof deck free for a Green policy. */
	private hallFloors(v: SimView): number[] {
		const floors = this.floorsWithSlab(v).filter((f) => f >= 1);
		return this.tree === "greentech" && floors.length > 1 ? floors.slice(0, -1) : floors;
	}

	private plantFloors(v: SimView): number[] {
		return this.floorsWithSlab(v).filter((f) => f <= 0 && f >= -3).sort((a, b) => b - a);
	}

	/** Make room for one more `d` on a hall floor with its air support; returns the floor, or null if nothing can be done yet. */
	private prepareFloor(v: SimView, occ: Uint8Array, d: FacilityDef, budget: number): number | null {
		const floors = this.hallFloors(v);
		const plant = this.plantFloors(v)[0] ?? 0;
		for (const floor of floors) {
			const free = this.spots(v, d, [floor], occ, () => 0).length;
			const needPipe = d.placement?.needsCoolant ? "coolant" : d.placement?.needsNutrient ? "nutrient" : null;
			const piped = needPipe === null || this.floorHasLayer(v, floor, needPipe);
			if (free === 0 && piped) continue;
			if (!piped && needPipe) {
				this.pipeHall(v, needPipe, plant, floor);
				return null; // the pipe lands next tick; place then
			}
			return floor;
		}
		if (this.floorsWithSlab(v).length && budget > 200_000) this.addFloor(v, "up");
		return null;
	}

	private floorHasLayer(v: SimView, floor: number, layer: "coolant" | "nutrient"): boolean {
		const grid = layer === "coolant" ? v.coolant : v.nutrient;
		const sp = this.span(v, floor);
		if (!sp) return false;
		for (let x = sp.x0; x <= sp.x1; x++) if (!grid[this.idx(v, x, floor)]) return false;
		return true;
	}

	/** Air handlers for the heat `d` adds to `floor`; true when capacity is there (or was just ordered). */
	private ensureAir(v: SimView, occ: Uint8Array, d: FacilityDef, floor: number, budget: number): boolean {
		const heat = d.rack ? d.rack.powerKw * (1 - d.rack.liquidFraction) + d.facilityKw : 0;
		if (heat <= 0) return true;
		const { cap, load } = this.airCapacity(v, floor);
		const pend = this.pending.air.get(floor) ?? 0;
		if (cap >= (load + pend + heat) * 1.25) {
			this.pending.air.set(floor, pend + heat);
			return true;
		}
		const defs = Object.values(this.content.facilities)
			.filter((c) => c.kind === "crah" && !c.cooling?.bioOnly && c.cooling?.failureFactor === undefined && !c.unlock?.bond && this.usable(c, v) && c.cost <= budget)
			.sort((a, b) => this.priced(a) / ((a.cooling?.capacityKw ?? 1) * (a.cooling?.freeAir ? 0.6 : 1)) - this.priced(b) / ((b.cooling?.capacityKw ?? 1) * (b.cooling?.freeAir ? 0.6 : 1)));
		// The cheapest per kW whose reach covers a good share of the floor.
		const racks = v.facilities.filter((f) => f.floor === floor && this.content.facilities[f.defId].kind === "rack");
		const mid = racks.length ? racks.reduce((s, f) => s + f.x, 0) / racks.length : 14;
		for (const c of defs) {
			const s = this.place(v, occ, c, [floor], (p) => Math.abs(p.x - mid));
			if (s) {
				// The new capacity counts at once, as a credit against this hour's heat.
				const added = (c.cooling?.capacityKw ?? 0) * (c.cooling?.freeAir ? 0.6 : 1);
				this.pending.air.set(floor, pend - added / 1.25 + heat);
				return true;
			}
		}
		return false;
	}

	private ensureCoolant(v: SimView, occ: Uint8Array, d: FacilityDef, budget: number): boolean {
		const liquid = (d.rack?.powerKw ?? 0) * (d.rack?.liquidFraction ?? 0);
		if (liquid <= 0) return true;
		let cap = 0;
		let load = 0;
		let chill = 0;
		let cdu = 0;
		for (const n of v.coolantNets) {
			cap += n.capacityKw;
			load += n.loadKw;
		}
		for (const f of v.facilities) {
			const c = this.content.facilities[f.defId];
			if (c.kind === "chiller") chill += c.cooling?.capacityKw ?? 0;
			else if (c.kind === "cdu") cdu += c.cooling?.capacityKw ?? 0;
		}
		const needTotal = load + this.pending.liquid + liquid;
		if (cap >= needTotal) {
			this.pending.liquid += liquid;
			return true;
		}
		// Grow both sides of the loop to the load (the loop carries the smaller of the two), a pair at a time.
		let spent = 0;
		for (const kind of ["chiller", "cdu"] as const) {
			let have = kind === "chiller" ? chill : cdu;
			while (have < needTotal) {
				const defs = Object.values(this.content.facilities)
					.filter((c) => c.kind === kind && this.usable(c, v) && c.cost + spent <= budget)
					.sort((a, b) => a.cost / (a.cooling?.capacityKw ?? 1) - b.cost / (b.cooling?.capacityKw ?? 1));
				const gap = needTotal - have;
				const one = defs.find((c) => (c.cooling?.capacityKw ?? 0) >= gap) ?? defs.at(-1);
				if (!one || !this.place(v, occ, one, this.plantFloors(v), (s) => s.x + (s.floor === -1 ? 0 : 100))) return false;
				spent += one.cost;
				have += one.cooling?.capacityKw ?? 0;
			}
		}
		this.pending.liquid += liquid;
		return true;
	}

	private ensureNutrient(v: SimView, occ: Uint8Array, d: FacilityDef, budget: number): boolean {
		const use = d.rack?.bio?.nutrientUse ?? 0;
		if (use <= 0) return true;
		let sup = 0;
		let dem = 0;
		for (const n of v.nutrientNets) {
			sup += n.supply;
			dem += n.demand;
		}
		if (sup - dem - this.pending.nutrient >= use) {
			this.pending.nutrient += use;
			return true;
		}
		const defs = Object.values(this.content.facilities)
			.filter((c) => c.kind === "nutrient" && this.usable(c, v) && c.cost <= budget)
			.sort((a, b) => b.cost / (b.bio?.nutrientCapacity ?? 1) - a.cost / (a.bio?.nutrientCapacity ?? 1));
		const best = defs.sort((a, b) => a.cost / (a.bio?.nutrientCapacity ?? 1) - b.cost / (b.bio?.nutrientCapacity ?? 1))[0];
		if (best) this.place(v, occ, best, this.plantFloors(v), (s) => s.x + (s.floor === -1 ? 0 : 100));
		return false;
	}

	/** Datasets sit on storage racks: running jobs stall when the powered storage is full. */
	private ensureStorage(v: SimView, occ: Uint8Array, budget: number): void {
		let tb = 0;
		let pf = 0;
		for (const f of v.facilities) {
			const d = this.content.facilities[f.defId];
			if (d.kind !== "rack" || !d.rack || f.status === "failed") continue;
			tb += d.rack.storageTB;
			pf += d.rack.pflops;
		}
		if (tb >= Math.min(60_000, Math.max(4000, 25 * pf))) return;
		const defs = Object.values(this.content.facilities)
			.filter((d) => d.kind === "rack" && d.rack && d.rack.pflops === 0 && d.rack.storageTB > 0 && !d.growth && !d.retired && !d.line?.match(/biotech|greentech/) && d.rack.cooling === "air" && this.usable(d, v) && d.cost <= budget)
			.sort((a, b) => a.cost / (a.rack?.storageTB ?? 1) - b.cost / (b.rack?.storageTB ?? 1));
		const d = defs.find((c) => c.line !== "synthetic") ?? defs[0];
		if (!d) return;
		const floor = this.hallFloors(v)[0] ?? 1;
		this.ensureAir(v, occ, d, floor, budget);
		this.place(v, occ, d, this.hallFloors(v), (s) => s.x);
	}

	/** Wetware halls need clean air: a sterile bay in reach of every organoid rack, a culling room once growths appear. */
	private cleanHall(v: SimView, occ: Uint8Array, budget: number): void {
		const bays = Object.values(this.content.facilities).filter((c) => c.kind === "sterilizer" && !c.bio?.cullsGrowths && this.usable(c, v)).sort((a, b) => a.cost - b.cost);
		const bay = bays[0];
		if (!bay) return;
		const radius = bay.bio?.radius ?? 4;
		type Cover = { floor: number; x0: number; x1: number; r: number };
		const covers: Cover[] = v.facilities
			.filter((s) => this.content.facilities[s.defId].kind === "sterilizer")
			.map((s) => ({ floor: s.floor, x0: s.x, x1: s.x + s.width - 1, r: this.content.facilities[s.defId].bio?.radius ?? 0 }));
		const reaches = (c: Cover, r: { floor: number; x: number; width: number }): boolean => c.floor === r.floor && Math.max(0, r.x - c.x1, c.x0 - (r.x + r.width - 1)) <= c.r;
		const bios = v.facilities.filter((f) => this.content.facilities[f.defId].rack?.cooling === "bio" && !f.grown);
		let ordered = 0;
		// One bay at a time, placed where it reaches the most racks that nothing cleans yet.
		while (ordered < 2 && bay.cost <= Math.max(budget, this.remaining * 0.5)) {
			const bare = bios.filter((r) => !covers.some((c) => reaches(c, r)));
			if (bare.length === 0) break;
			const floor = bare[0].floor;
			const here = bare.filter((r) => r.floor === floor);
			const gain = (x: number): number => here.filter((r) => reaches({ floor, x0: x, x1: x + bay.width - 1, r: radius }, r)).length;
			const spot = this.place(v, occ, bay, [floor], (s) => -gain(s.x) * 100 + Math.abs(s.x - here[0].x));
			if (!spot) break;
			covers.push({ floor, x0: spot.x, x1: spot.x + bay.width - 1, r: radius });
			ordered++;
		}
		if (v.facilities.some((f) => f.grown)) {
			const cull = Object.values(this.content.facilities).find((c) => c.bio?.cullsGrowths && this.usable(c, v));
			if (cull && !v.facilities.some((f) => f.defId === cull.id) && cull.cost <= budget) this.place(v, occ, cull, this.hallFloors(v), (s) => s.x);
		}
	}

	/** Green: heat export and panels / masts until the green score is where a careful gardener keeps it. */
	private greenPower(v: SimView, occ: Uint8Array, budget: number): void {
		if (this.tree !== "greentech" || v.path !== "greentech") return;
		const itKw = this.installedKw(v);
		const hx = Object.values(this.content.facilities).find((d) => d.kind === "heat_export" && this.usable(d, v) && d.cost <= budget);
		const hxCount = v.facilities.filter((f) => this.content.facilities[f.defId].kind === "heat_export").length;
		if (hx && itKw > 200 && hxCount < Math.min(2, Math.ceil(itKw / 700))) {
			const racks = v.facilities.filter((f) => this.content.facilities[f.defId].kind === "rack");
			const floor = racks.length ? racks.reduce((m, f) => (f.floor > m ? f.floor : m), 1) : 1;
			if (this.place(v, occ, hx, [floor], (s) => s.x)) return;
		}
		let gen = 0;
		for (const f of v.facilities) {
			const d = this.content.facilities[f.defId];
			if (d.kind === "solar" || d.kind === "wind") gen += d.power?.capacityKw ?? 0;
		}
		const load = Math.max(v.totalKw, itKw * 1.25);
		if (v.greenScore >= 0.55 || gen >= 1.8 * load) return;
		const avg = (d: FacilityDef): number => (d.power?.capacityKw ?? 1) * (d.kind === "wind" ? 0.6 : 0.37);
		const defs = Object.values(this.content.facilities)
			.filter((d) => (d.kind === "solar" || d.kind === "wind") && this.usable(d, v) && !d.unlock?.bond && d.cost <= budget)
			.sort((a, b) => a.cost / avg(a) - b.cost / avg(b));
		const floorsAll = this.floorsWithSlab(v);
		const roof = floorsAll.at(-1) ?? 1;
		for (const d of defs) {
			const floors = d.placement?.exteriorOnly ? floorsAll.filter((f) => f >= 0) : [roof];
			if (this.place(v, occ, d, floors, (s) => s.x)) return;
		}
		// The deck is full: the next floor up becomes the roof (the old one turns into a hall floor).
		if (defs.length && this.remaining > 400_000) this.addFloor(v, "up");
	}

	private upgrades(v: SimView, occ: Uint8Array, budget: number): void {
		void occ;
		let left = budget;
		let n = 0;
		const racks = v.facilities
			.filter((f) => !f.grown && isRack(this.content.facilities[f.defId]))
			.sort((a, b) => (this.content.facilities[a.defId].rack?.pflops ?? 0) - (this.content.facilities[b.defId].rack?.pflops ?? 0));
		for (const f of racks) {
			const from = this.content.facilities[f.defId];
			const targets = Object.values(this.content.facilities)
				.filter((d) => d.upgradesFrom === from.id && isRack(d) && this.usable(d, v) && this.value(d, v) >= this.value(from, v))
				// A committed Bio / Green tower stops scarring its own tree: it only upgrades along its own line.
				.filter((d) => this.tree === "synthetic" || v.path !== this.tree || d.line === this.tree)
				.sort((a, b) => this.value(b, v) - this.value(a, v));
			for (const to of targets) {
				const price = Math.max(0, to.cost - 0.5 * from.cost);
				if (price * 1.2 > left || price > this.remaining || n >= 2) continue;
				// Only where its plant is there: a liquid rack needs its loop to have room, which `canBuild` knows nothing about.
				if (to.rack && to.rack.liquidFraction > 0 && from.rack?.liquidFraction === 0) continue;
				const cmd: SimCommand = { type: "upgradeFacility", facilityId: f.id, defId: to.id };
				if (this.ok(cmd) && this.submit(cmd)) {
					left -= price;
					this.remaining -= price;
					n++;
					this.log.push(`upgrade ${from.id}->${to.id}`);
					break;
				}
			}
		}
	}

	/**
	 * Sell back the weakest racks. A training job takes at most 8 racks, the first idle ones in build order, so a hall with many
	 * weak old racks at the front cannot start the big offers (and a Singularity bar fed by shared racks gains nothing from them).
	 * Retire a rack that is idle and under 40% of the strongest one, once at least 8 strong racks stand; the demolish refund is 50%.
	 */
	private retire(v: SimView, best: FacilityDef | null): void {
		const racks = v.facilities.filter((f) => !f.grown && isRack(this.content.facilities[f.defId]));
		const pf = (f: { defId: string }): number => this.content.facilities[f.defId].rack?.pflops ?? 0;
		const top = racks.reduce((m, f) => Math.max(m, pf(f)), 0);
		const strong = racks.filter((f) => pf(f) >= 0.4 * top).length;
		const bv = best ? this.value(best, v) : 0;
		const weak = racks
			.filter((f) => f.jobId === null && pf(f) < 0.4 * top && (strong >= 8 || this.value(this.content.facilities[f.defId], v) < 0.4 * bv))
			.sort((a, b) => pf(a) - pf(b) || a.id - b.id)
			.slice(0, 3);
		for (const f of weak) if (this.submit({ type: "demolish", floor: f.floor, x: f.x })) this.log.push(`retire ${f.defId}`);
	}

	private savingHours = 0;
	/** Cash this hour's orders may still spend (cash minus the reserve, less what is already queued). */
	private remaining = 0;

	// ─── The hourly turn ───────────────────────────────────────────────────────────────────────────────────────

	/** Called once a game-hour (at :30). */
	hour(): void {
		const v = this.sim.view();
		if (v.gameOver) return;
		this.pending = { power: 0, air: new Map(), liquid: 0, nutrient: 0 };
		this.research(v);
		this.commit(v);
		const occ = this.occupancy(v);
		const budget = v.cash - this.reserve(v);
		this.remaining = budget;
		if (budget <= 0) return;
		// Idle compute is dead money: do not build more while a quarter of it waits for work.
		const racks = v.facilities.filter((f) => isRack(this.content.facilities[f.defId]) && f.enabled);
		const installed = racks.reduce((s, f) => s + (this.content.facilities[f.defId].rack?.pflops ?? 0), 0);
		const idle = racks.filter((f) => f.jobId === null && f.status !== "failed").reduce((s, f) => s + (this.content.facilities[f.defId].rack?.pflops ?? 0), 0);
		const saturated = installed > 0 && idle / installed > 0.3;
		let left = budget;
		this.ensureStorage(v, occ, left * 0.25);
		this.greenPower(v, occ, left * 0.6);
		if (v.tier >= 3 && this.tree === "biotech") this.cleanHall(v, occ, left * 0.4);
		// Saving: when a much better rack exists but is not affordable yet, do not spend on the lesser one.
		const best = this.pickRack(v, Number.POSITIVE_INFINITY);
		const now = this.pickRack(v, left);
		const wantSave = !!best && (!now || this.value(best, v) > 1.35 * this.value(now, v)) && left > 0.2 * best.cost * 1.4;
		this.savingHours = wantSave ? this.savingHours + 1 : 0;
		const saving = wantSave && this.savingHours <= 150;
		if (saving) return;
		this.upgrades(v, occ, left * 0.5);
		this.retire(v, best);
		for (let i = 0; i < 4 && !saturated; i++) {
			const d = this.pickRack(v, left);
			if (!d) break;
			if (best && this.value(d, v) < 0.6 * this.value(best, v)) break; // not worth building while the good ones wait on cash or room
			const floor = this.prepareFloor(v, occ, d, left);
			if (floor === null) break;
			if (!this.ensurePower(v, occ, (d.rack?.powerKw ?? 0) + d.facilityKw, left * 0.5)) break;
			if (!this.ensureAir(v, occ, d, floor, left * 0.4)) break;
			if (d.rack?.cooling === "dlc" || d.rack?.cooling === "immersion") if (!this.ensureCoolant(v, occ, d, left * 0.5)) break;
			if (d.rack?.cooling === "bio") if (!this.ensureNutrient(v, occ, d, left * 0.4)) break;
			const racksHere = v.facilities.filter((f) => f.floor === floor && this.content.facilities[f.defId].kind === "rack");
			const mid = racksHere.length ? racksHere.reduce((s, f) => s + f.x, 0) / racksHere.length : 20;
			const s = this.place(v, occ, d, [floor], (p) => Math.abs(p.x - mid));
			if (!s) break;
			left -= d.cost;
			if (left < d.cost * 0.3) break;
		}
		// Spare parts and bots through the standing orders (set once), the clerk once it exists.
		if (v.clerk.unlocked && !v.clerk.policy.enabled) this.submit({ type: "setClerk", policy: PERMISSIVE_CLERK });
	}

	/** Called at the start of each game day: the After-hours visit with the tree's champion, through the real command. */
	dayStart(day: number): void {
		if (day === this.day) return;
		this.day = day;
		const r = this.sim.submit({ type: "visitAdvisor", advisor: CHAMPION[this.tree] });
		if (!r.ok) return; // a decision is open, or the lesson forbids it: skip today
		this.sim.flush();
		const d = this.sim.view().decision;
		if (d) this.submit({ type: "resolveDecision", decisionId: d.id, choiceId: d.choices[0].id });
	}

	/** Accept an offer the way the harness always does (clerk off) or leave it to the clerk. */
	acceptOffer(offer: ContractView, v: SimView): boolean {
		return !v.clerk.policy.enabled && shouldAccept(offer, v, this.content, AUTO_ACCEPT_MARGIN);
	}
}

export { bestMemoChoice };
