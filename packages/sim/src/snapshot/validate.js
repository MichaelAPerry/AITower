import { TICKS_PER_DAY } from "../api";
import { automationProblem, shapeAutomation } from "../automation/policy";
import { InvalidSaveError } from "./migrate";
/** Hard cap on grid size so a hostile save cannot make us allocate gigabytes. */
const MAX_CELLS = 2_000_000;
const fail = (reason) => {
    throw new InvalidSaveError(reason);
};
const isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function check(kind, v) {
    switch (kind) {
        case "int":
            return typeof v === "number" && Number.isInteger(v);
        case "num":
            return typeof v === "number" && Number.isFinite(v);
        case "bool":
            return typeof v === "boolean";
        case "str":
            return typeof v === "string";
        case "trait":
            return v === null || v === "fleshed" || v === "tendriled";
    }
}
/** Require every field of `shape` on `o` to have the right primitive type. */
function fields(o, shape, where) {
    if (!isObj(o))
        return fail(`${where} is not an object`);
    for (const [k, kind] of Object.entries(shape)) {
        if (!check(kind, o[k]))
            fail(`${where}.${k} must be ${kind === "int" ? "an integer" : kind === "num" ? "a finite number" : kind === "bool" ? "a boolean" : kind === "trait" ? "null, fleshed or tendriled" : "a string"} (got ${String(o[k])})`);
    }
    return o;
}
// Compile-time completeness: adding a field to an entity makes these tables fail to typecheck until it is covered.
const FACILITY = {
    id: "int", defId: "str", floor: "int", x: "int", width: "int", enabled: "bool", powerNet: "int", coolantNet: "int",
    sat: "num", demandKw: "num", powerKw: "num", heatKw: "num", tempC: "num", busy: "bool", thermalClock: "num", clock: "num",
    pflops: "num", health: "num", jobId: "int", failed: "bool", tripped: "bool", cooldown: "num", throttled: "bool",
    noCoolant: "bool", coolantC: "num", gensetMode: "int", gensetTimer: "num", surplusTicks: "num", storedKwh: "num",
    stored: "num", charging: "bool", nutrientNet: "int", nutrientSat: "num", noNutrient: "bool", tooCold: "bool", grown: "bool", recoverAt: "num",
};
const LIFT = {
    id: "int", x: "int", floorMin: "int", floorMax: "int", powerNet: "int", sat: "num", carFloor: "num", dir: "int",
    doorsOpen: "bool", doorTimer: "num",
};
const BOT = {
    id: "int", defId: "str", x: "num", floor: "num", battery: "num", carrying: "bool", parts: "int", task: "str", leg: "str", goalId: "int",
    goalX: "num", goalFloor: "num", liftId: "int", workOrderId: "int", homeId: "int", timer: "num", exitFloor: "num",
    stuck: "num", retryAt: "num", fails: "num", routeRev: "num", trait: "trait", exposure: "num",
};
const WORK_ORDER = { id: "int", facilityId: "int", botId: "int", createdAt: "num", attempts: "num", retryAt: "num", retryRev: "num" };
const JOB = {
    id: "int", contractId: "int", status: "str", acceptedAt: "num", deadline: "num", progress: "num", total: "num",
    lastCheckpoint: "num", sinceCheckpoint: "num", pflops: "num", earned: "num", clerk: "bool", finishedAt: "num", unreported: "num",
};
const SPEC = {
    clientId: "str", clientName: "str", kind: "str", work: "num", durationTicks: "num", payout: "num", penalty: "num",
    needsLiquid: "bool", storageTB: "num", checkpointTicks: "num",
};
const NET = {
    id: "int", supplyKw: "num", demandKw: "num", satisfaction: "num", storedKwh: "num", storageCapacityKwh: "num",
    gridImportKw: "num", gensetKw: "num",
};
const NUTRIENT_NET = { id: "int", supply: "num", demand: "num", satisfaction: "num" };
const COOLANT_NET = { id: "int", capacityKw: "num", loadKw: "num", supplyTempC: "num" };
const LEDGER_DAY = {
    day: "int", revenue: "num", energy: "num", upkeep: "num", construction: "num", penalties: "num", taxes: "num", interest: "num", fees: "num",
};
const SAMPLE = { tick: "num", pue: "num", itKw: "num", totalKw: "num", pflops: "num", cash: "num", maxRackC: "num" };
const METRIC_NUMS = {
    itKw: "num", totalKw: "num", gridKw: "num", gensetKw: "num", pflops: "num", organoidPflops: "num", energyCost: "num", pue: "num", uptime: "num", maxRackC: "num", greenKw: "num", heatExportKw: "num",
};
const TASKS = ["none", "depot", "target", "repair", "charger", "charge"];
const LEGS = ["walk", "waitLift", "ride"];
const JOB_STATUS = ["queued", "running", "stalled", "completed", "failed"];
const JOB_KINDS = ["training", "finetune", "inference"];
function typed(o, key, ctor, length) {
    const v = o[key];
    if (!(v instanceof ctor))
        return fail(`${key} must be a ${ctor.name}`);
    if (v.length !== length)
        return fail(`${key} has length ${v.length}, expected ${length}`);
    return v;
}
function array(o, key) {
    const v = o[key];
    return Array.isArray(v) ? v : fail(`${key} must be an array`);
}
/** ids strictly ascending and below the allocator's next id. */
function checkIds(list, next, what) {
    let prev = 0;
    for (const e of list) {
        if (e.id <= prev)
            fail(`${what} ids must be positive and strictly ascending (id ${e.id})`);
        prev = e.id;
    }
    if (prev >= next)
        fail(`${what} id ${prev} is not below the next id ${next}`);
}
function ownDef(table, id) {
    return Object.hasOwn(table, id) ? table[id] : undefined;
}
function finiteDeep(v, path, depth = 0) {
    if (depth > 32)
        fail(`${path} is nested too deeply`);
    if (typeof v === "number") {
        if (!Number.isFinite(v))
            fail(`${path} is not a finite number`);
    }
    else if (v instanceof Float32Array || v instanceof Float64Array) {
        for (let i = 0; i < v.length; i++)
            if (!Number.isFinite(v[i]))
                fail(`${path}[${i}] is not a finite number`);
    }
    else if (Array.isArray(v)) {
        for (let i = 0; i < v.length; i++)
            finiteDeep(v[i], `${path}[${i}]`, depth + 1);
    }
    else if (isObj(v)) {
        for (const [k, x] of Object.entries(v))
            finiteDeep(x, `${path}.${k}`, depth + 1);
    }
}
export function validateState(content, raw) {
    if (!Array.isArray(raw.standingLog))
        raw.standingLog = []; // saves written before the reputation log
    const s = fields(raw, {
        scenarioId: "str", seed: "num", tick: "int", width: "int", floorMin: "int", floorMax: "int", powerNetCount: "int",
        coolantNetCount: "int", netsDirty: "bool", topologyRev: "int", storageUtil: "num", nextOfferTick: "num", cash: "num",
        tier: "int", bankrupt: "bool", negativeCashTicks: "num", ambientC: "num", nextMemoTick: "num", standing: "num", researchPoints: "num", clerkAccepted: "int",
        loanPrincipal: "num", nutrientNetCount: "int", contaminatedShare: "num", irreversible: "bool", corruption: "num",
    }, "state");
    if (!Object.hasOwn(content.scenarios, s.scenarioId))
        fail(`unknown scenario '${String(s.scenarioId)}'`);
    if (s.tick < 0)
        fail("tick is negative");
    if (s.tier < 1)
        fail("tier must be at least 1");
    const width = s.width;
    const floorMin = s.floorMin;
    const floorMax = s.floorMax;
    if (width < 1 || floorMax < floorMin)
        fail("grid dimensions are invalid");
    const cells = width * (floorMax - floorMin + 1);
    if (!Number.isSafeInteger(cells) || cells > MAX_CELLS)
        fail(`grid of ${cells} cells is too large`);
    const idx = (x, floor) => (floor - floorMin) * width + x;
    const inGrid = (x, floor) => Number.isInteger(x) && Number.isInteger(floor) && x >= 0 && x < width && floor >= floorMin && floor <= floorMax;
    // ── grid layers ──
    typed(s, "slab", Uint8Array, cells);
    typed(s, "power", Uint8Array, cells);
    typed(s, "coolant", Uint8Array, cells);
    typed(s, "nutrient", Uint8Array, cells);
    const contamination = typed(s, "contamination", Float32Array, cells);
    for (let i = 0; i < cells; i++)
        if (!(contamination[i] >= 0 && contamination[i] <= 1))
            fail(`contamination[${i}] is outside 0..1`);
    const facilityAt = typed(s, "facilityAt", Int32Array, cells);
    const liftAt = typed(s, "liftAt", Int32Array, cells);
    typed(s, "airTemp", Float32Array, cells);
    const powerNetOf = typed(s, "powerNetOf", Int32Array, cells);
    const coolantNetOf = typed(s, "coolantNetOf", Int32Array, cells);
    const nutrientNetOf = typed(s, "nutrientNetOf", Int32Array, cells);
    const pCount = s.powerNetCount;
    const cCount = s.coolantNetCount;
    const nCount = s.nutrientNetCount;
    if (nCount < 0 || nCount > cells)
        fail("nutrient net count is out of range");
    for (let i = 0; i < cells; i++)
        if (nutrientNetOf[i] < -1 || nutrientNetOf[i] >= nCount)
            fail(`nutrientNetOf[${i}] is out of range`);
    if (pCount < 0 || cCount < 0 || pCount > cells || cCount > cells)
        fail("net counts are out of range");
    for (let i = 0; i < cells; i++) {
        if (powerNetOf[i] < -1 || powerNetOf[i] >= pCount)
            fail(`powerNetOf[${i}] is out of range`);
        if (coolantNetOf[i] < -1 || coolantNetOf[i] >= cCount)
            fail(`coolantNetOf[${i}] is out of range`);
    }
    // ── id allocator ──
    const nextId = fields(s.nextId, { facility: "int", lift: "int", bot: "int", contract: "int", job: "int", workOrder: "int", memo: "int" }, "nextId");
    for (const [k, v] of Object.entries(nextId))
        if (v < 1)
            fail(`nextId.${k} must be at least 1`);
    // ── facilities ──
    const facilities = array(s, "facilities");
    const facilityById = new Map();
    let facilityCells = 0;
    for (let n = 0; n < facilities.length; n++) {
        const f = fields(facilities[n], FACILITY, `facilities[${n}]`);
        const def = ownDef(content.facilities, f.defId);
        if (!def)
            fail(`facilities[${n}] uses unknown def '${f.defId}'`);
        if (def && f.width !== def.width)
            fail(`facilities[${n}] width ${f.width} does not match def '${f.defId}' (${def.width})`);
        if (f.width < 1 || !inGrid(f.x, f.floor) || !inGrid(f.x + f.width - 1, f.floor))
            fail(`facilities[${n}] is out of bounds`);
        for (let k = 0; k < f.width; k++)
            if (facilityAt[idx(f.x + k, f.floor)] !== f.id)
                fail(`facilityAt does not match facilities[${n}]`);
        facilityCells += f.width;
        if (f.powerNet < -1 || f.powerNet >= pCount)
            fail(`facilities[${n}].powerNet is out of range`);
        if (f.coolantNet < -1 || f.coolantNet >= cCount)
            fail(`facilities[${n}].coolantNet is out of range`);
        if (f.nutrientNet < -1 || f.nutrientNet >= nCount)
            fail(`facilities[${n}].nutrientNet is out of range`);
        if (f.gensetMode < 0 || f.gensetMode > 2)
            fail(`facilities[${n}].gensetMode is invalid`);
        facilityById.set(f.id, f);
    }
    checkIds(facilities, nextId.facility, "facility");
    let occupied = 0;
    for (let i = 0; i < cells; i++)
        if (facilityAt[i] >= 0)
            occupied++;
    if (occupied !== facilityCells)
        fail("facilityAt has cells that no facility covers");
    // ── lifts ──
    const lifts = array(s, "lifts");
    let liftCells = 0;
    const liftIds = new Set();
    for (let n = 0; n < lifts.length; n++) {
        const l = fields(lifts[n], LIFT, `lifts[${n}]`);
        if (!inGrid(l.x, l.floorMin) || !inGrid(l.x, l.floorMax) || l.floorMax < l.floorMin)
            fail(`lifts[${n}] is out of bounds`);
        for (let fl = l.floorMin; fl <= l.floorMax; fl++)
            if (liftAt[idx(l.x, fl)] !== l.id)
                fail(`liftAt does not match lifts[${n}]`);
        liftCells += l.floorMax - l.floorMin + 1;
        if (l.carFloor < l.floorMin || l.carFloor > l.floorMax)
            fail(`lifts[${n}].carFloor is outside its shaft`);
        if (l.dir !== -1 && l.dir !== 0 && l.dir !== 1)
            fail(`lifts[${n}].dir is invalid`);
        if (l.powerNet < -1 || l.powerNet >= pCount)
            fail(`lifts[${n}].powerNet is out of range`);
        if (!Array.isArray(l.riders) || l.riders.some((r) => !Number.isInteger(r)))
            fail(`lifts[${n}].riders must be an array of bot ids`);
        liftIds.add(l.id);
    }
    checkIds(lifts, nextId.lift, "lift");
    let shaft = 0;
    for (let i = 0; i < cells; i++)
        if (liftAt[i] >= 0)
            shaft++;
    if (shaft !== liftCells)
        fail("liftAt has cells that no lift covers");
    // ── bots ──
    const bots = array(s, "bots");
    const botIds = new Set();
    for (let n = 0; n < bots.length; n++) {
        const b = fields(bots[n], BOT, `bots[${n}]`);
        if (!ownDef(content.bots, b.defId))
            fail(`bots[${n}] uses unknown bot def '${b.defId}'`);
        if (b.x < 0 || b.x > width - 1 || b.floor < floorMin || b.floor > floorMax)
            fail(`bots[${n}] is out of bounds`);
        if (!TASKS.includes(b.task))
            fail(`bots[${n}].task '${String(b.task)}' is invalid`);
        if (!LEGS.includes(b.leg))
            fail(`bots[${n}].leg '${String(b.leg)}' is invalid`);
        if (b.homeId !== -1 && !facilityById.has(b.homeId))
            fail(`bots[${n}].homeId ${b.homeId} does not exist`);
        if (typeof b.carrying !== "boolean")
            fail(`bots[${n}].carrying must be a boolean`);
        botIds.add(b.id);
    }
    checkIds(bots, nextId.bot, "bot");
    for (const l of lifts)
        for (const r of l.riders)
            if (!botIds.has(r))
                fail(`lift ${l.id} carries unknown bot ${r}`);
    // ── work orders ──
    const workOrders = array(s, "workOrders");
    const workOrderIds = new Set();
    for (let n = 0; n < workOrders.length; n++) {
        const w = fields(workOrders[n], WORK_ORDER, `workOrders[${n}]`);
        if (!facilityById.has(w.facilityId))
            fail(`workOrders[${n}] targets unknown facility ${w.facilityId}`);
        if (w.botId !== -1 && !botIds.has(w.botId))
            fail(`workOrders[${n}] is assigned to unknown bot ${w.botId}`);
        workOrderIds.add(w.id);
    }
    checkIds(workOrders, nextId.workOrder, "work order");
    for (const b of bots)
        if (b.workOrderId !== -1 && !workOrderIds.has(b.workOrderId))
            fail(`bot ${b.id} references unknown work order ${b.workOrderId}`);
    // ── jobs & offers ──
    const jobs = array(s, "jobs");
    const jobIds = new Set();
    for (let n = 0; n < jobs.length; n++) {
        const j = fields(jobs[n], JOB, `jobs[${n}]`);
        if (!JOB_STATUS.includes(j.status))
            fail(`jobs[${n}].status is invalid`);
        checkSpec(j.spec, `jobs[${n}].spec`);
        if (!Array.isArray(j.rackIds))
            fail(`jobs[${n}].rackIds must be an array`);
        for (const id of j.rackIds)
            if (!facilityById.has(id))
                fail(`jobs[${n}] uses unknown rack ${id}`);
        jobIds.add(j.id);
    }
    checkIds(jobs, nextId.job, "job");
    for (const f of facilities)
        if (f.jobId !== -1 && !jobIds.has(f.jobId))
            fail(`facility ${f.id} references unknown job ${f.jobId}`);
    const offers = array(s, "offers");
    for (let n = 0; n < offers.length; n++) {
        fields(offers[n], { id: "int", expiresAt: "num" }, `offers[${n}]`);
        checkSpec(offers[n].spec, `offers[${n}].spec`);
    }
    checkIds(offers, nextId.contract, "offer");
    // ── nets, economy, history ──
    const powerNets = array(s, "powerNets");
    powerNets.forEach((n, i) => {
        fields(n, NET, `powerNets[${i}]`);
    });
    const coolantNets = array(s, "coolantNets");
    coolantNets.forEach((n, i) => {
        fields(n, COOLANT_NET, `coolantNets[${i}]`);
    });
    array(s, "nutrientNets").forEach((n, i) => {
        fields(n, NUTRIENT_NET, `nutrientNets[${i}]`);
    });
    const ledger = array(s, "ledger");
    ledger.forEach((d, i) => {
        fields(d, LEDGER_DAY, `ledger[${i}]`);
    });
    fields(s.today, LEDGER_DAY, "today");
    const history = array(s, "history");
    history.forEach((d, i) => {
        fields(d, SAMPLE, `history[${i}]`);
    });
    const m = fields(s.metrics, METRIC_NUMS, "metrics");
    for (const ring of ["ringTotalKwh", "ringItKwh", "ringShouldRun", "ringRunning", "ringGreenKwh", "ringHeatKwh"])
        typed(m, ring, Float64Array, TICKS_PER_DAY);
    fields(s.rng, { contracts: "num", reliability: "num", events: "num", growth: "num", weather: "num" }, "rng");
    validateMinistry(content, s, nextId.memo);
    validateManagement(content, s);
    validateBiotech(s);
    validateGreen(s);
    array(s, "pending");
    // Catch-all: any non-finite number anywhere (including float arrays) is corruption.
    finiteDeep(s, "state");
    return s;
}
const GRADES = ["A", "B", "C", "D", "E"];
const STATS = {
    revenue: "num", pflopHours: "num", jobsCompleted: "int", jobsFailed: "int", peakPflops: "num", facilitiesBuilt: "int", componentFailures: "int",
    repairs: "int", memosAnswered: "int", researchPointsEarned: "num",
};
const REPORT = {
    quarter: "int", fromDay: "int", toDay: "int", revenue: "num", costs: "num", uptime: "num", pue: "num", jobsCompleted: "int", jobsFailed: "int",
    penalties: "num", grade: "str", standingDelta: "num", cashDelta: "num", remark: "str",
};
const AUDIT_DAY = { day: "int", uptime: "num", pue: "num", revenue: "num", costs: "num", penalties: "num" };
/** Research, clerk, loans, audits, stats (snapshot v4). */
function validateManagement(content, s) {
    if (s.researchPoints < 0)
        fail("researchPoints is negative");
    if (s.clerkAccepted < 0)
        fail("clerkAccepted is negative");
    if (s.loanPrincipal < 0)
        fail("loanPrincipal is negative");
    const seen = new Set();
    array(s, "techResearched").forEach((id, i) => {
        if (typeof id !== "string")
            fail(`techResearched[${i}] must be a string`);
        else if (!content.tech.some((t) => t.id === id))
            fail(`techResearched[${i}] names unknown tech '${id}'`);
        else if (seen.has(id))
            fail(`techResearched[${i}] repeats '${id}'`);
        else
            seen.add(id);
    });
    const p = fields(s.clerkPolicy, { enabled: "bool", minPayPerPflopHour: "num", maxPenalty: "num", allowLiquid: "bool" }, "clerkPolicy");
    if (p.minPayPerPflopHour < 0 || p.maxPenalty < 0)
        fail("clerkPolicy numbers must not be negative");
    const kinds = p.kinds;
    if (!Array.isArray(kinds) || kinds.length === 0 || kinds.some((k) => !JOB_KINDS.includes(k)))
        fail("clerkPolicy.kinds must list job kinds");
    const reports = array(s, "reports");
    if (reports.length > 8)
        fail("reports is too long");
    reports.forEach((r, i) => {
        const o = fields(r, REPORT, `reports[${i}]`);
        if (!GRADES.includes(o.grade))
            fail(`reports[${i}].grade is invalid`);
    });
    const a = fields(s.audit, { samples: "num", uptimeSum: "num", pueSum: "num", jobsCompleted: "int", jobsFailed: "int" }, "audit");
    if (a.samples < 0)
        fail("audit.samples is negative");
    if (!Array.isArray(a.days))
        fail("audit.days must be an array");
    else {
        a.days.forEach((d, i) => {
            fields(d, AUDIT_DAY, `audit.days[${i}]`);
        });
    }
    fields(s.stats, STATS, "stats");
    array(s, "scriptedIssued").forEach((id, i) => {
        if (typeof id !== "string")
            fail(`scriptedIssued[${i}] must be a string`);
    });
}
const MODIFIER_KINDS = ["ambient", "gridCap", "energyPrice", "payout", "failureRate"];
const GAME_OVER_KINDS = ["bankrupt", "shutdown", "victory", "absorbed"];
const ENDINGS = ["livingTower", "cleanTower", "absorbed", "greenExemplar", "millionMinds"];
const PATHS = ["biotech", "greentech", "synthetic"];
/** Contamination share, corruption, path, ending counters (snapshot v5). */
function validateBiotech(s) {
    const share = s.contaminatedShare;
    const corruption = s.corruption;
    if (share < 0 || share > 1)
        fail("contaminatedShare is outside 0..1");
    if (corruption < 0 || corruption > 1)
        fail("corruption is outside 0..1");
    if (s.path !== null && !PATHS.includes(s.path))
        fail("path is invalid");
    const d = fields(s.endingDays, { livingTower: "int", cleanTower: "int", greenExemplar: "int", millionMinds: "int" }, "endingDays");
    for (const k of Object.keys(d))
        if (d[k] < 0)
            fail("endingDays must not be negative");
}
/** Automation, weather, scores, sandbox flag (snapshot v6). */
function validateGreen(s) {
    const wind = s.wind;
    if (typeof wind !== "number" || !(wind >= 0 && wind <= 1))
        fail("wind is outside 0..1");
    if (typeof s.droughtUntil !== "number" || !(s.droughtUntil >= 0))
        fail("droughtUntil must be a non-negative number");
    for (const k of ["greenScore", "refinement"]) {
        const v = s[k];
        if (typeof v !== "number" || !(v >= 0 && v <= 1))
            fail(`${k} is outside 0..1`);
    }
    const aff = fields(s.affinity, { biotech: "num", greentech: "num", synthetic: "num" }, "affinity");
    for (const k of Object.keys(aff))
        if (!(aff[k] >= 0))
            fail("affinity must not be negative");
    if (typeof s.sandbox !== "boolean")
        fail("sandbox must be a boolean");
    const shaped = shapeAutomation(s.automation);
    if (!shaped.ok)
        fail(`automation: ${shaped.reason}`);
    else {
        const problem = automationProblem(shaped.policy);
        if (problem)
            fail(`automation: ${problem}`);
    }
}
function validateMinistry(content, s, nextMemo) {
    const standing = s.standing;
    if (standing < 0 || standing > 100)
        fail(`standing ${standing} is outside 0..100`);
    const memos = array(s, "memos");
    memos.forEach((m, i) => {
        fields(m, { id: "int", eventId: "str", issuedAt: "num", expiresAt: "num" }, `memos[${i}]`);
        const def = content.events.find((e) => e.id === m.eventId);
        if (!def)
            fail(`memos[${i}] uses unknown event '${m.eventId}'`);
        else if (!def.choices.some((c) => c.id === def.defaultChoice))
            fail(`memos[${i}] event '${m.eventId}' has no default choice`);
    });
    checkIds(memos, nextMemo, "memo");
    array(s, "memoHistory").forEach((h, i) => {
        fields(h, { memoId: "int", eventId: "str", title: "str", choiceId: "str", outcome: "str", tick: "num", auto: "bool" }, `memoHistory[${i}]`);
    });
    if (s.memoHistory.length > 20)
        fail("memoHistory is too long");
    array(s, "standingLog").forEach((h, i) => {
        fields(h, { tick: "num", delta: "num", cause: "str", detail: "str" }, `standingLog[${i}]`);
    });
    if (s.standingLog.length > 20)
        fail("standingLog is too long");
    array(s, "modifiers").forEach((m, i) => {
        const o = fields(m, { kind: "str", value: "num", endsAt: "num", label: "str" }, `modifiers[${i}]`);
        if (!MODIFIER_KINDS.includes(o.kind))
            fail(`modifiers[${i}].kind is invalid`);
        if (o.kind !== "ambient" && o.value < 0)
            fail(`modifiers[${i}].value must not be negative`);
    });
    const last = s.lastIssuedDay;
    if (!isObj(last))
        fail("lastIssuedDay must be an object");
    else
        for (const [k, v] of Object.entries(last))
            if (!check("int", v))
                fail(`lastIssuedDay.${k} must be an integer`);
    const go = s.gameOver;
    if (go !== null) {
        const o = fields(go, { kind: "str", tick: "num" }, "gameOver");
        if (!GAME_OVER_KINDS.includes(o.kind))
            fail("gameOver.kind is invalid");
        if (o.ending !== undefined && !ENDINGS.includes(o.ending))
            fail("gameOver.ending is invalid");
    }
}
function checkSpec(spec, where) {
    const o = fields(spec, SPEC, where);
    if (!JOB_KINDS.includes(o.kind))
        fail(`${where}.kind is invalid`);
    if (o.sustainedPflops !== undefined && !check("num", o.sustainedPflops))
        fail(`${where}.sustainedPflops must be a finite number`);
}
