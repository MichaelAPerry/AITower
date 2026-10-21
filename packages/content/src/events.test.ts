import { describe, expect, it } from "vitest";
import { loadContent, validateContent } from "./load";
import type { ContentDB, EventDef, EventEffect } from "./schema";

const money = (a: number): string => `${a >= 0 ? "+" : "-"}$${Math.abs(a) / 1000}k`;

describe("events.json", () => {
	const db = loadContent();

	it("has about two dozen memos with 7 horror memos, every memo having exactly two choices", () => {
		const by = (c: string): number => db.events.filter((e) => e.category === c).length;
		expect(db.events).toHaveLength(24);
		expect(by("horror")).toBe(7);
		expect(by("ministry")).toBe(7);
		for (const c of ["environmental", "operational", "client"]) expect(by(c), c).toBeGreaterThan(0);
		for (const e of db.events) expect(e.choices, e.id).toHaveLength(2);
	});

	it("most choices carry an affinity effect, spread over all three paths", () => {
		const all = db.events.flatMap((e) => e.choices);
		const aff = all.filter((c) => c.effects.some((f) => f.type === "affinity"));
		expect(aff.length).toBeGreaterThan(all.length * 0.45);
		for (const p of ["biotech", "greentech", "synthetic"]) expect(aff.some((c) => c.effects.some((f) => f.type === "affinity" && f.path === p && f.amount >= 2 && f.amount <= 6)), p).toBe(true);
		for (const c of aff) for (const f of c.effects) if (f.type === "affinity") expect(f.amount).toBeLessThanOrEqual(6);
	});

	it("uses the Compute Authority voice (no Ministry, steam, brass or punch cards)", () => {
		const text = [
			...db.events.flatMap((e) => [e.title, e.body, ...e.choices.flatMap((c) => [c.label, c.hint, c.outcome])]),
			...db.tech.flatMap((t) => [t.name, t.description]),
			...Object.values(db.facilities).flatMap((f) => [f.name, f.description ?? ""]),
			...Object.values(db.bots).map((b) => b.name),
			...db.clients.map((c) => c.name),
			...db.paths.map((p) => p.description),
			...db.endings.flatMap((e) => [e.title, e.body]),
		].join("\n");
		expect(text).not.toMatch(/ministry|steam|brass|punch|triplicate|riveted|zip-tied|superintendent/i);
	});

	it("spaces memos about 2-3 game days apart", () => {
		expect(db.balance.events.intervalTicks).toBeGreaterThanOrEqual(2 * 1440);
		expect(db.balance.events.intervalTicks).toBeLessThanOrEqual(3 * 1440 + 720);
	});

	it("validates (unique ids, defaults, effects, durations, weights)", () => {
		expect(validateContent(db)).toEqual([]);
	});

	it("covers the required scenarios", () => {
		const ids = db.events.map((e) => e.id).join(" ");
		for (const re of [/heatwave/, /brownout/, /price_spike/, /recall/, /ransom/, /audit/, /subsidy/, /levy/]) expect(ids).toMatch(re);
	});

	it("has exactly one scripted first emergency: a day-2 heat event whose choices trade cash against risk", () => {
		const scripted = db.events.filter((e) => e.scriptedDay !== undefined);
		expect(scripted.map((e) => e.id)).toEqual(["first_heat_alarm"]);
		const e = scripted[0];
		expect(e.scriptedDay).toBe(2);
		expect(e.category).toBe("operational");
		expect(e.minTier).toBe(1);
		const spike = (c: (typeof e.choices)[number]): number => c.effects.reduce((m, f) => (f.type === "ambient" ? Math.max(m, f.deltaC) : m), 0);
		const cash = (c: (typeof e.choices)[number]): number => c.effects.reduce((s, f) => (f.type === "cash" ? s + f.amount : s), 0);
		expect(e.choices.every((c) => spike(c) > 0 && c.effects.some((f) => f.type === "ambient" && f.durationTicks <= 720))).toBe(true);
		// The default (do nothing) is free and the hottest; paying cash buys a smaller spike.
		const ride = e.choices.find((c) => c.effects.every((f) => f.type !== "cash"));
		const paid = e.choices.filter((c) => cash(c) < 0);
		expect(ride && cash(ride)).toBe(0);
		expect(paid.length).toBeGreaterThan(0);
		for (const c of paid) expect(spike(c)).toBeLessThan(spike(ride as never));
	});

	it("the memos added for tiers 2-4 touch loans, the levy, audits and research", () => {
		const text = db.events.filter((e) => e.minTier >= 2).map((e) => `${e.title} ${e.body}`).join(" ").toLowerCase();
		for (const w of ["levy", "audit", "research"]) expect(text, w).toContain(w);
	});

	it("scriptedDay events are never picked randomly: they carry a positive weight but are unique per day", () => {
		const days = db.events.filter((e) => e.scriptedDay !== undefined).map((e) => e.scriptedDay);
		expect(new Set(days).size).toBe(days.length);
	});

	it("every memo has 2-3 choices, a default among them and unique ids/labels/hints", () => {
		for (const e of db.events) {
			expect(e.choices.length, e.id).toBeGreaterThanOrEqual(2);
			expect(e.choices.length, e.id).toBeLessThanOrEqual(3);
			expect(e.choices.map((c) => c.id), e.id).toContain(e.recommended);
			expect(new Set(e.choices.map((c) => c.id)).size, e.id).toBe(e.choices.length);
			expect(new Set(e.choices.map((c) => c.hint)).size, e.id).toBe(e.choices.length);
			expect(e.body.split("\n\n").length, e.id).toBeLessThanOrEqual(3);
			for (const c of e.choices) expect(c.effects.length, `${e.id}/${c.id}`).toBeGreaterThan(0);
		}
	});

	it("each hint states the real numbers of its effects", () => {
		for (const e of db.events) {
			for (const c of e.choices) {
				for (const fx of c.effects) {
					const w = `${e.id}/${c.id}`;
					switch (fx.type) {
						case "cash":
							expect(c.hint, w).toContain(money(fx.amount));
							break;
						case "standing":
							expect(c.hint, w).toContain(`standing ${fx.amount >= 0 ? "+" : "-"}${Math.abs(fx.amount)}`);
							break;
						case "ambient":
							expect(c.hint, w).toContain(`${fx.deltaC >= 0 ? "+" : "-"}${Math.abs(fx.deltaC)}°C`);
							break;
						case "failRacks":
							expect(c.hint, w).toContain(`${fx.count} rack`);
							break;
						case "spareParts":
							expect(c.hint, w).toContain(`${fx.count >= 0 ? "+" : "-"}${Math.abs(fx.count)} spare parts`);
							break;
						case "affinity":
							break; // the hint names the lean in words; no fixed format
						case "gridCap":
							expect(c.hint, w).toMatch(fx.factor === 0 ? /grid offline/ : new RegExp(`x${fx.factor}\\b`));
							break;
						default:
							expect(c.hint, w).toContain(`x${fx.factor}`);
					}
					if ("durationTicks" in fx) expect(c.hint, w).toMatch(/for \d+[hd]/);
				}
			}
		}
	});

	it("is a real trade-off: no choice is at least as good as every other on cash and standing with no extra cost", () => {
		const score = (effects: EventEffect[]) => {
			let cash = 0;
			let standing = 0;
			let other = 0;
			for (const f of effects) {
				if (f.type === "cash") cash += f.amount;
				else if (f.type === "standing") standing += f.amount;
				else other++;
			}
			return { cash, standing, other };
		};
		for (const e of db.events) {
			for (const c of e.choices) {
				const s = score(c.effects);
				const dominated = e.choices.some((o) => {
					if (o === c) return false;
					const t = score(o.effects);
					return t.cash >= s.cash && t.standing >= s.standing && t.other === 0 && s.other === 0 && (t.cash > s.cash || t.standing > s.standing);
				});
				expect(dominated, `${e.id}/${c.id} is strictly worse than another choice`).toBe(false);
			}
		}
	});

	it("every decision has an owner advisor, a recommended choice and a short, number-bearing body", () => {
		for (const e of db.events) {
			expect(["cass", "bea", "mel", "lucien"], e.id).toContain(e.advisor);
			expect(e.choices.some((c) => c.id === e.recommended), e.id).toBe(true);
			expect(e.body.split(/\s+/).length, e.id).toBeLessThanOrEqual(45);
			expect(e.body, e.id).toMatch(/\d/);
			expect(e).not.toHaveProperty("timeoutTicks");
		}
		for (const a of ["cass", "bea", "mel", "lucien"]) expect(db.events.filter((e) => e.advisor === a).length, a).toBeGreaterThanOrEqual(3);
	});

	it("MAGI votes: Cass, Bea and Mel each vote with a line, on a handful of multi-area decisions", () => {
		const voted = db.events.filter((e) => e.votes);
		expect(voted.length).toBeGreaterThanOrEqual(6);
		for (const e of voted) {
			expect(e.votes?.map((v) => v.advisor), e.id).toEqual(["cass", "bea", "mel"]);
			for (const v of e.votes ?? []) expect(v.line.length, e.id).toBeGreaterThan(5);
		}
		const bad = loadContent();
		const x = bad.events.find((v) => v.votes);
		if (x?.votes) x.votes = x.votes.slice(1);
		expect(validateContent(bad).join("\n")).toMatch(/votes/);
	});

	it("uses only valid tiers and sane magnitudes", () => {
		const tiers = db.balance.tiers.pflops.length;
		for (const e of db.events) {
			expect(e.minTier, e.id).toBeLessThanOrEqual(tiers);
			for (const c of e.choices) for (const f of c.effects) if (f.type === "standing") expect(Math.abs(f.amount), e.id).toBeLessThanOrEqual(10);
		}
	});
});

describe("economy retune", () => {
	const db = loadContent();

	it("tier rewards are about 5x the M1 values", () => {
		expect(db.balance.tiers.reward).toEqual([0, 1_250_000, 3_750_000, 10_000_000, 25_000_000]);
	});

	it("DLC racks deliver about 1.6x the air PFLOPS per dollar once their cooling plant is counted", () => {
		const f = db.facilities;
		const air = f.rack_air_gpu;
		const dlc = f.rack_dlc_gpu;
		const crahPerKw = f.crah_unit.cost / f.crah_unit.cooling!.capacityKw;
		const cduPerKw = f.cdu.cost / f.cdu.cooling!.capacityKw;
		const chillerPerKw = f.chiller.cost / f.chiller.cooling!.capacityKw;
		const airTotal = air.cost + crahPerKw * air.rack!.powerKw;
		const liquidKw = dlc.rack!.powerKw * dlc.rack!.liquidFraction;
		const dlcTotal = dlc.cost + (cduPerKw + chillerPerKw) * liquidKw + crahPerKw * (dlc.rack!.powerKw - liquidKw);
		const ratio = dlc.rack!.pflops / dlcTotal / (air.rack!.pflops / airTotal);
		expect(ratio).toBeGreaterThan(1.5);
		expect(ratio).toBeLessThan(1.8);
	});
});

describe("validateContent: events", () => {
	const broken = (mutate: (db: ContentDB) => void): string => {
		const db = loadContent();
		mutate(db);
		return validateContent(db).join("\n");
	};
	const first = (db: ContentDB): EventDef => db.events[0];

	it("flags duplicate ids, bad ids and a missing default choice", () => {
		expect(broken((db) => db.events.push({ ...first(db) }))).toMatch(/duplicate id/);
		expect(broken((db) => (first(db).id = "Bad Id"))).toMatch(/lowercase/);
		expect(broken((db) => (first(db).recommended = "nope"))).toMatch(/recommended/);
		expect(broken((db) => first(db).choices.push({ ...first(db).choices[0] }))).toMatch(/duplicate choice id/);
		expect(broken((db) => (first(db).choices = []))).toMatch(/at least one choice/);
	});

	it("flags bad effect types and fields", () => {
		const fx = (db: ContentDB): EventEffect[] => first(db).choices[0].effects;
		expect(broken((db) => fx(db).push({ type: "teleport" } as never))).toMatch(/unknown effect type/);
		expect(broken((db) => fx(db).push({ type: "cash", amount: Number.NaN }))).toMatch(/amount/);
		expect(broken((db) => fx(db).push({ type: "standing", amount: 500 }))).toMatch(/amount/);
		expect(broken((db) => fx(db).push({ type: "affinity", path: "nope" as never, amount: 3 }))).toMatch(/unknown path/);
		expect(broken((db) => fx(db).push({ type: "affinity", path: "biotech", amount: -1 }))).toMatch(/amount/);
		expect(broken((db) => fx(db).push({ type: "affinity", path: "biotech", amount: 3 }))).toBe("");
		expect(broken((db) => fx(db).push({ type: "failRacks", count: 0 }))).toMatch(/count/);
		expect(broken((db) => fx(db).push({ type: "failRacks", count: 1.5 }))).toMatch(/count/);
		expect(broken((db) => fx(db).push({ type: "spareParts", count: 0 }))).toMatch(/count/);
		expect(broken((db) => fx(db).push({ type: "gridCap", factor: 1.5, durationTicks: 10 }))).toMatch(/factor/);
		expect(broken((db) => fx(db).push({ type: "energyPrice", factor: 0, durationTicks: 10 }))).toMatch(/factor/);
		expect(broken((db) => fx(db).push({ type: "ambient", deltaC: 5, durationTicks: 0 }))).toMatch(/durationTicks/);
		expect(broken((db) => fx(db).push({ type: "payout", factor: 2, durationTicks: -5 }))).toMatch(/durationTicks/);
		expect(broken((db) => fx(db).push({ type: "failureRate", factor: 2, durationTicks: 1.5 }))).toMatch(/durationTicks/);
	});

	it("flags non-positive weights, bad advisors, tiers and categories", () => {
		expect(broken((db) => (first(db).weight = 0))).toMatch(/weight/);
		expect(broken((db) => ((first(db) as { advisor: string }).advisor = "ned"))).toMatch(/advisor/);
		expect(broken((db) => (first(db).cooldownDays = -1))).toMatch(/cooldownDays/);
		expect(broken((db) => (first(db).minTier = 0))).toMatch(/minTier/);
		expect(broken((db) => {
			first(db).minTier = 2;
			first(db).maxTier = 1;
		})).toMatch(/maxTier is below minTier/);
		expect(broken((db) => (first(db).minDay = -1))).toMatch(/minDay/);
		expect(broken((db) => ((first(db) as { category: string }).category = "weather"))).toMatch(/category/);
		expect(broken((db) => (first(db).title = ""))).toMatch(/title/);
		expect(broken((db) => (first(db).choices[0].hint = " "))).toMatch(/hint/);
	});

	it("flags bad standing/events balance", () => {
		expect(broken((db) => (db.balance.standing.start = 0))).toMatch(/standing\.start/);
		expect(broken((db) => (db.balance.standing.dailyBad = Number.NaN))).toMatch(/dailyBad/);
		expect(broken((db) => (db.balance.events.intervalTicks = 0))).toMatch(/intervalTicks/);
		expect(broken((db) => (db.balance.events.graceTicks = -1))).toMatch(/graceTicks/);
	});

	it("loadContent throws listing every problem when events.json is invalid (via validateContent)", () => {
		const db = loadContent();
		db.events[0].recommended = "x";
		db.events[1].weight = -1;
		expect(validateContent(db).length).toBe(2);
	});
});
