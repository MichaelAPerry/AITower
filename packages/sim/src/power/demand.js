import { IDLE_RACK_POWER_FRACTION } from "../core/constants";
import { chillerCop } from "../cooling/chiller";
import { getDef, isStorageRack } from "../world/defs";
export function facilityDemandKw(state, content, f) {
    if (!f.enabled)
        return 0;
    const d = getDef(content, f.defId);
    if (d.growth)
        return 0;
    let kw = d.facilityKw;
    switch (d.kind) {
        case "rack": {
            const rack = d.rack;
            if (!rack || f.failed || f.tripped)
                break;
            if (isStorageRack(d))
                kw += rack.powerKw * Math.max(IDLE_RACK_POWER_FRACTION, state.storageUtil);
            else if (f.jobId >= 0)
                kw += rack.powerKw * f.thermalClock;
            else
                kw += rack.powerKw * IDLE_RACK_POWER_FRACTION;
            break;
        }
        case "chiller":
            kw += f.heatKw / chillerCop(d, state.ambientC);
            break;
        case "charger":
            if (f.charging)
                kw += d.logistics?.chargeKw ?? 0;
            break;
        default:
            break;
    }
    return kw;
}
