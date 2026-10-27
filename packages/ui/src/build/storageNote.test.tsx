import { loadContent } from "@aitower/content";
import type { SimView } from "@aitower/sim";
import { describe, expect, it } from "vitest";
import { storageNote } from "../components/BuildPalette";
import { describeEvent } from "../events";
import { createFakeContent, createFakeStore } from "../dev/fakeStore";

const content = loadContent();
const view = (over: Partial<SimView>): SimView => ({ ...createFakeStore(createFakeContent()).get().view, ...over }) as SimView;

describe("storage on the build cards and the stall notice", () => {
	it("storage and tape cards say what the jobs need against what the racks hold", () => {
		const v = view({ storageNeedTB: 2400, storageCapacityTB: 2000 });
		expect(storageNote(content.facilities.rack_storage, v)).toBe("Jobs need storage: 2,400 TB in use of 2,000 TB");
		expect(storageNote(content.facilities.rack_storage2, v)).toBe("Jobs need storage: 2,400 TB in use of 2,000 TB");
	});
	it("compute racks and other items get no storage line", () => {
		expect(storageNote(content.facilities.rack_air_gpu, view({ storageNeedTB: 1, storageCapacityTB: 1 }))).toBeNull();
		expect(storageNote(undefined, view({}))).toBeNull();
	});
	it("a storage stall toasts the fixed notice", () => {
		const d = describeEvent({ type: "jobStalledStorage", jobId: 3, needTB: 1500, capacityTB: 0 }, view({}), content);
		expect(d.text).toBe("Job stalled: not enough storage. Build a Storage Array or Tape Library.");
		expect(d.toast).toBe(true);
	});
});
