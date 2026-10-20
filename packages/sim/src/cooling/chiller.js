import { CHILLER_COP_DERATE_PER_C, CHILLER_COP_REF_AMBIENT_C, CHILLER_MIN_COP_FRACTION } from "../core/constants";
/** Effective COP: −2 % per °C ambient above 20 °C, floored. */
export function chillerCop(d, ambientC) {
    const nominal = d.cooling?.cop ?? 1;
    const derate = 1 - CHILLER_COP_DERATE_PER_C * Math.max(0, ambientC - CHILLER_COP_REF_AMBIENT_C);
    return nominal * Math.max(CHILLER_MIN_COP_FRACTION, derate);
}
