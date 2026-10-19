import type { FacilityDef } from "@aitower/content";
import type { FacilityStatus } from "../api";
import { MIN_POWERED_SATISFACTION } from "../core/constants";
import { type Facility, GensetMode } from "../core/state";
import { isComputeRack, needsPower } from "../world/defs";

/** Precedence: disabled ▸ failed ▸ tripped ▸ unpowered ▸ noCoolant ▸ noNutrient ▸ tooCold ▸ throttled ▸ brownout ▸ idle ▸ ok. */
export function facilityStatus(f: Facility, d: FacilityDef, storageUtil: number): FacilityStatus {
	if (!f.enabled) return "disabled";
	const powered = !needsPower(d) || (f.powerNet >= 0 && f.sat >= MIN_POWERED_SATISFACTION);
	if (d.kind === "rack") {
		if (f.failed) return "failed";
		if (f.tripped) return "tripped";
		if (!powered) return "unpowered";
		if (f.noCoolant) return "noCoolant";
		if (f.noNutrient) return "noNutrient";
		if (f.tooCold) return "tooCold";
		if (f.throttled) return "throttled";
		if (f.sat < 1) return "brownout";
		if (isComputeRack(d) ? f.jobId < 0 : storageUtil <= 0) return "idle";
		return "ok";
	}
	if (!powered) return "unpowered";
	if (f.noNutrient) return "noNutrient";
	if (needsPower(d) && f.sat < 1) return "brownout";
	if (d.kind === "genset" && f.gensetMode === GensetMode.Off) return "idle";
	return "ok";
}
