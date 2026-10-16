import { it } from "vitest";
import { SimImpl } from "./sim";
import { createState } from "./world/init";
import { towerContent } from "./test/tower";
import { deepClone } from "./snapshot/clone";
it("dbg", () => {
	const content = towerContent();
	const sim = new SimImpl(content, createState(content, "tower", 7));
	for (let i = 0; i < 300; i++) sim.step();
	const t0 = performance.now();
	for (let i = 0; i < 20; i++) deepClone(sim.state);
	console.log("clone ms", (performance.now() - t0) / 20);
	const t1 = performance.now();
	sim.submit({ type: "buyParts", count: 1 });
	console.log("first submit ms", performance.now() - t1);
	const t2 = performance.now();
	for (let i = 0; i < 100; i++) sim.canBuild({ type: "place", defId: "rack_air_gpu", floor: 3, x: 62 });
	console.log("canBuild x100 ms", performance.now() - t2);
});
