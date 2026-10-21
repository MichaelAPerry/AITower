import { describe, expect, it } from "vitest";
import { FAILURE_GROUP } from "../events";
import type { Notice } from "../notices";
import { addToast, MAX_TOASTS, showCount, type Toast } from "./toastList";

let n = 0;
const next = (): number => ++n;
const add = (list: Toast[], notice: Notice, now = 0): Toast[] => addToast(list, notice, now, next);
const fail = (name: string): Notice => ({ text: `${name} component failed`, severity: "error", key: name, group: FAILURE_GROUP });

describe("toast stack", () => {
	it("merges repeated failures into one toast: 3 racks failed, repairs queued", () => {
		let list: Toast[] = [];
		list = add(list, fail("rack A"));
		expect(list[0].text).toBe("rack A component failed");
		list = add(list, fail("rack B"), 100);
		list = add(list, fail("rack C"), 200);
		expect(list).toHaveLength(1);
		expect(list[0].text).toBe("3 racks failed — repairs queued");
		expect(showCount(list[0])).toBe(false);
		expect(list[0].until).toBeGreaterThan(200);
	});
	it("plain repeats still coalesce by key with a counter", () => {
		let list: Toast[] = [];
		list = add(list, { text: "Not enough cash", severity: "warn", key: "cash" });
		list = add(list, { text: "Not enough cash", severity: "warn", key: "cash" });
		expect(list).toHaveLength(1);
		expect(list[0].count).toBe(2);
		expect(showCount(list[0])).toBe(true);
	});
	it("never shows more than two at once, dropping the least severe, oldest first", () => {
		expect(MAX_TOASTS).toBe(2);
		let list: Toast[] = [];
		list = add(list, { text: "a", severity: "info" });
		list = add(list, { text: "b", severity: "error" });
		list = add(list, { text: "c", severity: "warn" });
		expect(list.map((t) => t.text)).toEqual(["b", "c"]);
		list = add(list, { text: "d", severity: "info" });
		expect(list).toHaveLength(2);
		expect(list.map((t) => t.text)).toContain("b");
		expect(list.map((t) => t.text)).toContain("d");
	});
	it("errors stay longer than the rest", () => {
		const e = add([], { text: "x", severity: "error" }, 0)[0];
		const i = add([], { text: "y", severity: "info" }, 0)[0];
		expect(e.until).toBeGreaterThan(i.until);
	});
});
