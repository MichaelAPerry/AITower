import { cellIdx, inBounds } from "../core/grid";
import { getDef } from "../world/defs";
/** `Hop.lift` value for "walk straight to the goal". */
export const WALK_DIRECT = -1;
export function createNav(cells) {
    return {
        rev: -1,
        run: new Int32Array(cells),
        liftIds: [],
        liftX: [],
        liftMin: [],
        liftMax: [],
        liftWait: [],
        liftLoad: [],
        liftOffset: [],
        n: 0,
        nodeLift: [],
        nodeFloor: [],
        walkEdges: [],
        dist: new Float64Array(0),
        prev: new Int32Array(0),
        heapKey: [],
        heapNode: [],
        srcFloor: 0,
        srcX: 0,
        srcRun: -1,
        speed: 1,
        depots: [],
        chargers: [],
    };
}
const runAt = (nav, state, floor, x) => {
    const lo = Math.floor(x);
    const hi = Math.ceil(x);
    if (!inBounds(state, lo, floor) || !inBounds(state, hi, floor))
        return -1;
    const a = nav.run[cellIdx(state, lo, floor)];
    return hi === lo || nav.run[cellIdx(state, hi, floor)] === a ? a : -1;
};
/** Rebuild the caches if the topology changed since they were built. */
export function ensureNav(nav, state, content) {
    if (nav.rev === state.topologyRev)
        return;
    nav.rev = state.topologyRev;
    // Slab runs.
    const w = state.width;
    let next = 0;
    for (let fl = state.floorMin; fl <= state.floorMax; fl++) {
        let cur = -1;
        for (let x = 0; x < w; x++) {
            const i = cellIdx(state, x, fl);
            if (state.slab[i]) {
                if (cur < 0)
                    cur = next++;
                nav.run[i] = cur;
            }
            else {
                nav.run[i] = -1;
                cur = -1;
            }
        }
    }
    // Facility indices (id order).
    nav.depots = [];
    nav.chargers = [];
    for (const f of state.facilities) {
        const kind = getDef(content, f.defId).kind;
        if (kind === "depot")
            nav.depots.push(f);
        else if (kind === "charger")
            nav.chargers.push(f);
    }
    // Lift graph.
    const lifts = state.lifts;
    const liftSpeed = Math.max(content.lift.speed, 1e-6);
    nav.liftIds = lifts.map((l) => l.id);
    nav.liftX = lifts.map((l) => l.x);
    nav.liftMin = lifts.map((l) => l.floorMin);
    nav.liftMax = lifts.map((l) => l.floorMax);
    nav.liftWait = lifts.map((l) => content.lift.dwellTicks + (l.floorMax - l.floorMin) / liftSpeed / 2);
    nav.liftOffset = [];
    nav.nodeLift = [];
    nav.nodeFloor = [];
    let n = 0;
    for (let li = 0; li < lifts.length; li++) {
        nav.liftOffset.push(n);
        for (let fl = lifts[li].floorMin; fl <= lifts[li].floorMax; fl++) {
            nav.nodeLift.push(li);
            nav.nodeFloor.push(fl);
            n++;
        }
    }
    nav.n = n;
    nav.walkEdges = Array.from({ length: n }, () => []);
    for (let a = 0; a < lifts.length; a++) {
        for (let b = a + 1; b < lifts.length; b++) {
            const lo = Math.max(lifts[a].floorMin, lifts[b].floorMin);
            const hi = Math.min(lifts[a].floorMax, lifts[b].floorMax);
            for (let fl = lo; fl <= hi; fl++) {
                const ra = nav.run[cellIdx(state, lifts[a].x, fl)];
                if (ra < 0 || ra !== nav.run[cellIdx(state, lifts[b].x, fl)])
                    continue;
                const na = nav.liftOffset[a] + (fl - lifts[a].floorMin);
                const nb = nav.liftOffset[b] + (fl - lifts[b].floorMin);
                const tiles = Math.abs(lifts[a].x - lifts[b].x);
                nav.walkEdges[na].push({ to: nb, tiles });
                nav.walkEdges[nb].push({ to: na, tiles });
            }
        }
    }
    nav.dist = new Float64Array(2 * n);
    nav.prev = new Int32Array(2 * n);
}
// ── binary min-heap on (key, node); ties break on node index for determinism ──
function heapPush(nav, key, node) {
    const hk = nav.heapKey;
    const hn = nav.heapNode;
    let i = hk.length;
    hk.push(key);
    hn.push(node);
    while (i > 0) {
        const p = (i - 1) >> 1;
        if (hk[p] < key || (hk[p] === key && hn[p] < node))
            break;
        hk[i] = hk[p];
        hn[i] = hn[p];
        i = p;
    }
    hk[i] = key;
    hn[i] = node;
}
function heapPop(nav) {
    const hk = nav.heapKey;
    const hn = nav.heapNode;
    const key = hk.pop();
    const node = hn.pop();
    const size = hk.length;
    if (size === 0)
        return;
    let i = 0;
    for (;;) {
        let c = 2 * i + 1;
        if (c >= size)
            break;
        if (c + 1 < size && (hk[c + 1] < hk[c] || (hk[c + 1] === hk[c] && hn[c + 1] < hn[c])))
            c++;
        if (key < hk[c] || (key === hk[c] && node < hn[c]))
            break;
        hk[i] = hk[c];
        hn[i] = hn[c];
        i = c;
    }
    hk[i] = key;
    hn[i] = node;
}
/**
 * Run a shortest-path search from a position, filling the nav buffers. Follow with `routeTo` for each goal of
 * interest (any number); the results stay valid until the next `beginSearch`.
 */
export function beginSearch(nav, state, content, botSpeed, fromFloor, fromX) {
    const speed = Math.max(botSpeed, 1e-6);
    const liftSpeed = Math.max(content.lift.speed, 1e-6);
    const n = nav.n;
    nav.srcFloor = fromFloor;
    nav.srcX = fromX;
    nav.speed = speed;
    nav.srcRun = runAt(nav, state, fromFloor, fromX);
    const capacity = Math.max(1, content.lift.capacity);
    nav.liftLoad.length = nav.liftIds.length;
    nav.liftLoad.fill(0);
    if (nav.liftIds.length > 0) {
        for (const b of state.bots) {
            if (b.liftId < 0 || b.leg === "walk")
                continue;
            const li = nav.liftIds.indexOf(b.liftId);
            if (li >= 0)
                nav.liftLoad[li]++;
        }
    }
    nav.dist.fill(Number.POSITIVE_INFINITY);
    nav.prev.fill(-1);
    nav.heapKey.length = 0;
    nav.heapNode.length = 0;
    if (nav.srcRun < 0 || n === 0)
        return;
    for (let li = 0; li < nav.liftIds.length; li++) {
        if (fromFloor < nav.liftMin[li] || fromFloor > nav.liftMax[li])
            continue;
        if (nav.run[cellIdx(state, nav.liftX[li], fromFloor)] !== nav.srcRun)
            continue;
        const node = nav.liftOffset[li] + (fromFloor - nav.liftMin[li]);
        const cost = Math.abs(fromX - nav.liftX[li]) / speed;
        if (cost < nav.dist[node]) {
            nav.dist[node] = cost;
            heapPush(nav, cost, node);
        }
    }
    const relax = (from, to, cost) => {
        const d = nav.dist[from] + cost;
        if (d < nav.dist[to]) {
            nav.dist[to] = d;
            nav.prev[to] = from;
            heapPush(nav, d, to);
        }
    };
    while (nav.heapKey.length > 0) {
        const key = nav.heapKey[0];
        const u = nav.heapNode[0];
        heapPop(nav);
        if (key > nav.dist[u])
            continue;
        if (u < n) {
            // Landing: board, or walk to another lift's landing on this floor.
            const li = nav.nodeLift[u];
            relax(u, n + u, nav.liftWait[li] * (1 + nav.liftLoad[li] / capacity));
            for (const e of nav.walkEdges[u])
                relax(u, e.to, e.tiles / speed);
        }
        else {
            const land = u - n;
            const li = nav.nodeLift[land];
            const fl = nav.nodeFloor[land];
            relax(u, land, 0);
            if (fl > nav.liftMin[li])
                relax(u, u - 1, 1 / liftSpeed);
            if (fl < nav.liftMax[li])
                relax(u, u + 1, 1 / liftSpeed);
        }
    }
}
/** Cheapest route from the last `beginSearch` position to (toFloor, toX), or null when unreachable. */
export function routeTo(nav, state, toFloor, toX) {
    if (nav.srcRun < 0)
        return null;
    const toRun = runAt(nav, state, toFloor, toX);
    if (toRun < 0)
        return null;
    if (toFloor === nav.srcFloor && toRun === nav.srcRun) {
        return { lift: WALK_DIRECT, exit: toFloor, cost: Math.abs(nav.srcX - toX) / nav.speed };
    }
    let best = -1;
    let bestCost = Number.POSITIVE_INFINITY;
    for (let li = 0; li < nav.liftIds.length; li++) {
        if (toFloor < nav.liftMin[li] || toFloor > nav.liftMax[li])
            continue;
        if (nav.run[cellIdx(state, nav.liftX[li], toFloor)] !== toRun)
            continue;
        const node = nav.liftOffset[li] + (toFloor - nav.liftMin[li]);
        const cost = nav.dist[node] + Math.abs(nav.liftX[li] - toX) / nav.speed;
        if (cost < bestCost) {
            bestCost = cost;
            best = node;
        }
    }
    if (best < 0)
        return null;
    // Walk the predecessor chain back to the source landing, remembering the first alighting.
    const n = nav.n;
    let exit = Number.NaN; // NaN = no alighting seen yet (a basement floor such as -1 is a valid exit)
    let node = best;
    let guard = 2 * n + 2;
    for (;;) {
        const p = nav.prev[node];
        if (p < 0)
            break;
        // Edge p → node is an alighting when p is a car node and node is its landing.
        if (p >= n && node < n && node === p - n)
            exit = nav.nodeFloor[node];
        node = p;
        if (--guard < 0)
            return null;
    }
    if (node >= n || Number.isNaN(exit))
        return null;
    return { lift: nav.liftIds[nav.nodeLift[node]], exit, cost: bestCost };
}
