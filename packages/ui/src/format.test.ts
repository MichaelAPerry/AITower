import { describe, expect, it } from "vitest";
import { fmtDuration, fmtMoney, fmtPct, fmtPflops, fmtPower, fmtTemp } from "./format";
import { keyAction } from "./keyboard";

describe("format", () => {
	it("money with k/M/B suffixes and sign", () => {
		expect(fmtMoney(950)).toBe("$950");
		expect(fmtMoney(1_000)).toBe("$1k");
		expect(fmtMoney(12_345)).toBe("$12.3k");
		expect(fmtMoney(250_400)).toBe("$250k");
		expect(fmtMoney(2_500_000)).toBe("$2.50M");
		expect(fmtMoney(12_500_000)).toBe("$12.5M");
		expect(fmtMoney(3.2e9)).toBe("$3.20B");
		expect(fmtMoney(-800)).toBe("−$800");
		expect(fmtMoney(Number.NaN)).toBe("—");
	});
	it("power kW/MW", () => {
		expect(fmtPower(8.25)).toBe("8.3 kW");
		expect(fmtPower(5)).toBe("5 kW");
		expect(fmtPower(640.4)).toBe("640 kW");
		expect(fmtPower(1250)).toBe("1.25 MW");
		expect(fmtPower(12_340)).toBe("12.3 MW");
	});
	it("temperature, percent, pflops, duration", () => {
		expect(fmtTemp(41.26)).toBe("41.3 °C");
		expect(fmtTemp(41.26, 0)).toBe("41 °C");
		expect(fmtPct(0.9951)).toBe("99.5%");
		expect(fmtPflops(0.5)).toBe("0.50 PF");
		expect(fmtPflops(12.34)).toBe("12.3 PF");
		expect(fmtPflops(250)).toBe("250 PF");
		expect(fmtDuration(45)).toBe("45m");
		expect(fmtDuration(200)).toBe("3h 20m");
		expect(fmtDuration(3000)).toBe("2d 2h");
		expect(fmtDuration(-5)).toBe("0m");
	});
});

describe("keyboard map", () => {
	it("maps speeds, overlays and escape; leaves WASD/arrows alone", () => {
		expect(keyAction(" ")).toEqual({ type: "togglePause" });
		expect(keyAction("1")).toEqual({ type: "speed", speed: 0 });
		expect(keyAction("5")).toEqual({ type: "speed", speed: 30 });
		expect(keyAction("E")).toEqual({ type: "overlay", mode: "heat" });
		expect(keyAction("o")).toEqual({ type: "overlay", mode: "coolant" });
		expect(keyAction("u")).toEqual({ type: "overlay", mode: "nutrient" });
		expect(keyAction("g")).toEqual({ type: "overlay", mode: "contamination" });
		expect(keyAction("c")).toEqual({ type: "drawer", id: "contracts" });
		expect(keyAction("R")).toEqual({ type: "drawer", id: "research" });
		expect(keyAction("f")).toEqual({ type: "drawer", id: "insights" });
		expect(keyAction("i")).toEqual({ type: "drawer", id: "insights" });
		expect(keyAction("b")).toEqual({ type: "palette" });
		expect(keyAction("Escape")).toEqual({ type: "escape" });
		for (const k of ["w", "a", "s", "d", "ArrowLeft"]) expect(keyAction(k)).toBeNull();
	});
});
