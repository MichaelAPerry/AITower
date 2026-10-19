import type { FacilityDef } from "@aitower/content";
import { describe, expect, it } from "vitest";
import { NATIVE_WIDTH, annexTiles, artSpec, artTier, bodyArt, bodyWidth, cabinetDetail, rackVariant, stripHeight, trimDetail, widthClass } from "./art";

type RackDef = Pick<FacilityDef, "rack">;
const rack = (cooling: "air" | "dlc" | "immersion" | "bio", pflops = 20, storageTB = 0): RackDef => ({
	rack: { cooling, powerKw: 40, liquidFraction: 0, pflops, storageTB, failurePerDay: 0 },
});

describe("rackVariant", () => {
	it("picks air, dlc, immersion and storage from the rack spec", () => {
		expect(rackVariant(rack("air"))).toBe("air");
		expect(rackVariant(rack("dlc"))).toBe("dlc");
		expect(rackVariant(rack("immersion"))).toBe("immersion");
		expect(rackVariant(rack("air", 0, 2000))).toBe("storage");
		expect(rackVariant(rack("immersion", 0, 2000))).toBe("storage"); // storage-only wins
		expect(rackVariant(rack("immersion", 5, 2000))).toBe("immersion"); // compute + storage is still compute
	});

	it("falls back to air without a rack spec", () => {
		expect(rackVariant({})).toBe("air");
	});
});

describe("artTier", () => {
	it("clamps unlockTier to 1..4", () => {
		expect([0, 1, 2, 3, 4, 5, 9].map(artTier)).toEqual([1, 1, 2, 3, 4, 4, 4]);
	});
});

describe("cabinetDetail", () => {
	const rows = (tier: 1 | 2 | 3 | 4, n: number) => Array.from({ length: n }, (_, i) => cabinetDetail(tier, i, n));
	const count = (r: ReturnType<typeof rows>, k: keyof ReturnType<typeof cabinetDetail>) => r.filter((d) => d[k]).length;

	it("tier 1 is plain for every width", () => {
		for (let n = 1; n <= 6; n++) for (const d of rows(1, n)) expect(Object.values(d).some(Boolean)).toBe(false);
	});

	it("brass grows monotonically with tier for every width", () => {
		const score = (t: 1 | 2 | 3 | 4, n: number) => rows(t, n).reduce((s, d) => s + Object.values(d).filter(Boolean).length, 0);
		for (let n = 1; n <= 6; n++) {
			expect(score(2, n)).toBeGreaterThan(score(1, n));
			expect(score(3, n)).toBeGreaterThan(score(2, n));
			expect(score(4, n)).toBeGreaterThan(score(3, n));
		}
	});

	it("tier 2: cornice on every cabinet, one gauge, no hopper", () => {
		for (let n = 1; n <= 4; n++) {
			const r = rows(2, n);
			expect(count(r, "cornice")).toBe(n);
			expect(count(r, "gauge")).toBe(1);
			expect(count(r, "hopper")).toBe(0);
		}
	});

	it("tier 3: hopper on the first cabinet (and last when n >= 3), gauges on first and last", () => {
		expect(count(rows(3, 1), "hopper")).toBe(1);
		expect(count(rows(3, 2), "hopper")).toBe(1);
		expect(count(rows(3, 3), "hopper")).toBe(2);
		expect(count(rows(3, 4), "hopper")).toBe(2);
		expect(count(rows(3, 1), "gauge")).toBe(1);
		expect(count(rows(3, 4), "gauge")).toBe(2);
		expect(rows(3, 3)[0].hopper && rows(3, 3)[2].hopper).toBe(true);
	});

	it("tier 4: pilasters and gauges everywhere, one crest on the second cabinet only when n >= 2", () => {
		for (let n = 1; n <= 5; n++) {
			const r = rows(4, n);
			expect(count(r, "pilasters")).toBe(n);
			expect(count(r, "gauge")).toBe(n);
			expect(count(r, "crest")).toBe(n >= 2 ? 1 : 0);
			if (n >= 2) expect(r[1].crest).toBe(true);
		}
		expect(count(rows(4, 4), "hopper")).toBe(3); // first, middle, last
	});

	it("a crest never shares a cabinet with the pneumatic receiver (first cabinet)", () => {
		for (let n = 1; n <= 6; n++) expect(rows(4, n)[0].crest).toBe(false);
	});
});

describe("widths and specs", () => {
	it("classifies widths", () => {
		expect([1, 2, 3, 4, 5].map(widthClass)).toEqual(["narrow", "standard", "standard", "wide", "wide"]);
	});

	it("artSpec: variant, tier, immersion flag and width class", () => {
		const s = artSpec({ kind: "rack", width: 3, unlockTier: 3, ...rack("immersion") });
		expect(s).toEqual({ kind: "rack", body: "rack", variant: "immersion", tier: 3, width: 3, widthClass: "standard", immersion: true });
		const c = artSpec({ kind: "chiller", width: 4, unlockTier: 2 });
		expect(c).toMatchObject({ variant: null, tier: 2, immersion: false, widthClass: "wide" });
	});

	it("only immersion racks get the tank art", () => {
		for (const cooling of ["air", "dlc"] as const) expect(artSpec({ kind: "rack", width: 2, unlockTier: 1, ...rack(cooling) }).immersion).toBe(false);
	});

	it("non-rack bodies keep native width and annex the rest", () => {
		expect(NATIVE_WIDTH.chiller).toBe(4);
		expect(bodyWidth({ kind: "chiller", width: 5 })).toBe(4);
		expect(annexTiles({ kind: "chiller", width: 5 })).toBe(1);
		expect(annexTiles({ kind: "chiller", width: 4 })).toBe(0);
		expect(annexTiles({ kind: "depot", width: 6 })).toBe(0); // scales freely
		expect(annexTiles({ kind: "rack", width: 4 })).toBe(0);
	});

	it("trim grows with tier; finials need room", () => {
		expect(Object.values(trimDetail(1, 4)).some(Boolean)).toBe(false);
		expect(trimDetail(2, 4)).toEqual({ topRail: true, plinth: true, pilasters: false, finials: false });
		expect(trimDetail(3, 4).pilasters).toBe(true);
		expect(trimDetail(4, 4).finials).toBe(true);
		expect(trimDetail(4, 1).finials).toBe(false);
	});
});

describe("wetware art selection", () => {
	it("bio racks: organoid incubator, DNA vault (storage-only or by name), neural pit (by name or 5+ tiles)", () => {
		expect(rackVariant({ ...rack("bio"), id: "rack_organoid", width: 2 })).toBe("organoid");
		expect(rackVariant({ ...rack("bio", 0, 500), id: "x", width: 2 })).toBe("dna");
		expect(rackVariant({ ...rack("bio"), id: "dna_vault", width: 2 })).toBe("dna");
		expect(rackVariant({ ...rack("bio"), id: "neural_pit", width: 3 })).toBe("neural");
		expect(rackVariant({ ...rack("bio"), id: "big", width: 5 })).toBe("neural");
		expect(rackVariant({ ...rack("bio"), id: "big", width: 4 })).toBe("organoid");
		// Non-bio racks never turn into wetware, even with those names.
		expect(rackVariant({ ...rack("air"), id: "neural", width: 6 })).toBe("air");
	});

	it("body art: growth overrides the kind, the culling room is a sterilizer that kills growths", () => {
		expect(bodyArt({ kind: "rack", growth: true })).toBe("growth");
		expect(bodyArt({ kind: "nutrient" }, true)).toBe("growth");
		expect(bodyArt({ kind: "sterilizer" })).toBe("sterilizer");
		expect(bodyArt({ kind: "sterilizer", bio: { cullsGrowths: true } })).toBe("culling_room");
		expect(bodyArt({ kind: "quarantine" })).toBe("quarantine");
		expect(bodyArt({ kind: "bioreactor" })).toBe("bioreactor");
		expect(bodyArt({ kind: "chiller" })).toBe("chiller");
	});

	it("the status light strip gets taller with the tier", () => {
		expect([1, 2, 3, 4].map((t) => stripHeight(t as 1 | 2 | 3 | 4))).toEqual([10, 14, 18, 22]);
	});
});
