import { createNav } from "../logistics/routing";
export function createScratch(cells) {
    return {
        tempA: new Float64Array(cells),
        tempB: new Float64Array(cells),
        parent: new Int32Array(cells),
        label: new Int32Array(cells),
        nav: createNav(cells),
        power: { buckets: [], gensetOut: [] },
        bio: { rev: -1, plants: [], consumers: [], emitters: [], sterilizers: [], quarantines: [], reactors: [], growthDefs: [], mask: new Uint8Array(cells) },
    };
}
