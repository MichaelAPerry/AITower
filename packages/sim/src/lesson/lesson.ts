/**
 * Lessons (M6.4). A lesson is a scenario plus a script from content (`LessonDef`): goal checks over values the sim already
 * tracks, scripted beats (a client job, a tripped feeder), a catalog restricted to what the lesson teaches, and stars.
 * Everything here is deterministic and lives in the snapshot (`state.lesson`); the app only presents it.
 */
import { type ContentDB, type LessonCond, type LessonDef, type LessonEffect, type LessonMetric, treeOf } from "@aitower/content";
import { MIN_POWERED_SATISFACTION } from "../core/constants";
import type { Job, LessonState, SimState } from "../core/state";
import { isActive, storageCapacityTB } from "../compute/allocation";
import { getDef, isComputeRack } from "../world/defs";
import { modFactor } from "../ministry/modifiers";
import type { TickCtx } from "../core/context";

/** Tip ids the UI marks (with `markTip`) when the player opens a panel a lesson asked about. */
export const LESSON_TIP = "les:";

/** A tick far beyond any lesson: offers and decisions are parked there. */
export const LESSON_NEVER = 1_000_000_000;

/** The lesson running on this site, or undefined (Free Build, or a finished/failed lesson that no longer restricts anything). */
export function lessonDef(state: SimState, content: ContentDB): LessonDef | undefined {
	const id = state.lesson?.id;
	return id ? content.lessons.find((l) => l.id === id) : undefined;
}

/** Start a lesson on a fresh site: its setup effects (a feeder limit, say) apply from tick 0, before anything is drawn. */
export function startLesson(state: SimState, def: LessonDef): void {
	state.lesson = newLessonState(def, state.tick, state.cash);
	for (const e of def.setup ?? []) if (e.type === "gridCap" || e.type === "failureRate") state.modifiers.push({ kind: e.type, value: e.factor, endsAt: state.tick + e.durationTicks, label: e.label });
}

export function newLessonState(def: LessonDef, tick: number, cash = 0): LessonState {
	return { id: def.id, status: "active", stepsDone: [], beatsFired: [], holdTicks: 0, minHeadroom: 100, downTicks: 0, startTick: tick, endTick: -1, stars: 0, starBits: 0, minCash: cash, drainTicks: 0, stallTicks: 0, foremanTicks: 0, hotTicks: 0, setupDone: true };
}

export type LessonMetrics = Record<LessonMetric, number>;

/** Read the lesson metrics from the tick that was just solved. */
export function lessonMetrics(state: SimState, content: ContentDB): LessonMetrics {
	const ls = state.lesson;
	let racks = 0;
	let busy = 0;
	let dark = 0;
	let gensets = 0;
	let maxRackC = state.ambientC;
	let coolers = 0;
	let storageRacks = 0;
	let parts = 0;
	let treeRacks = 0;
	let cleanPower = 0;
	let batteries = 0;
	let storedKwh = 0;
	let storageKwh = 0;
	let chillers = 0;
	let cdus = 0;
	let liquidRacks = 0;
	let liquidBusy = 0;
	for (const f of state.facilities) {
		const d = getDef(content, f.defId);
		if (d.kind === "genset") gensets++;
		if (d.kind === "crah" || d.kind === "chiller" || d.kind === "cdu") coolers++;
		if (d.kind === "chiller") chillers++;
		if (d.kind === "cdu") cdus++;
		if (d.kind === "depot") parts += f.stored;
		if (d.rack && d.rack.storageTB > 0) storageRacks++;
		if (treeOf(d)) treeRacks++;
		if (d.kind === "solar" || d.kind === "wind") cleanPower++;
		if (d.kind === "ups") {
			batteries++;
			storedKwh += f.storedKwh;
			storageKwh += d.power?.storageKwh ?? 0;
		}
		if (!isComputeRack(d)) continue;
		racks++;
		if (d.rack?.cooling === "dlc") {
			liquidRacks++;
			if (f.busy && f.jobId >= 0 && !f.failed && !f.noCoolant && f.sat >= MIN_POWERED_SATISFACTION) liquidBusy++;
		}
		if (f.busy && f.jobId >= 0 && !f.failed && f.sat >= MIN_POWERED_SATISFACTION) busy++;
		if (f.powerNet < 0 || f.sat < MIN_POWERED_SATISFACTION) dark++;
		if (state.airTemp.length && f.tempC > maxRackC) maxRackC = f.tempC;
	}
	let supply = 0;
	let demand = 0;
	for (const n of state.powerNets) {
		supply += n.supplyKw;
		demand += n.demandKw;
	}
	return {
		racks,
		racksBusy: busy,
		racksDark: dark,
		gensets,
		headroomPct: supply > 0 ? ((supply - demand) / supply) * 100 : -100,
		demandKw: demand,
		supplyKw: supply,
		shortKw: Math.max(0, demand - supply),
		maxRackC,
		uptime: state.metrics.uptime,
		cash: state.cash,
		pflops: state.metrics.pflops,
		day: Math.floor(state.tick / 1440),
		coolers,
		storageRacks,
		jobsLive: state.jobs.filter((j) => j.status === "queued" || j.status === "running" || j.status === "stalled").length,
		jobsStalled: state.jobs.filter((j) => j.status === "stalled").length,
		jobsDone: state.stats.jobsCompleted,
		offers: state.offers.length,
		parts,
		bots: state.bots.length,
		techs: state.techResearched.length,
		rp: state.researchPoints,
		tier: state.tier,
		foreman: state.automation.foreman.enabled ? 1 : 0,
		treeRacks,
		pue: state.metrics.pue,
		cleanPower,
		greenSp: state.sp.greentech,
		tips: state.advisorTips.filter((t) => t.startsWith(LESSON_TIP)).length,
		batteries,
		upsPct: storageKwh > 0 ? (storedKwh / storageKwh) * 100 : 100,
		downTicks: ls?.downTicks ?? 0,
		minHeadroom: ls?.minHeadroom ?? 100,
		minCash: ls ? Math.min(ls.minCash, state.cash) : state.cash,
		drainTicks: ls?.drainTicks ?? 0,
		stallTicks: ls?.stallTicks ?? 0,
		foremanTicks: ls?.foremanTicks ?? 0,
		beats: ls?.beatsFired.length ?? 0,
		gridPct: modFactor(state, "gridCap") * 100,
		coolantTiles: state.coolant.reduce((n, v) => n + v, 0),
		chillers,
		cdus,
		liquidRacks,
		liquidBusy,
		hotTicks: ls?.hotTicks ?? 0,
	};
}

export function condHolds(c: LessonCond, m: LessonMetrics): boolean {
	const v = m[c.metric];
	switch (c.op) {
		case ">=":
			return v >= c.value;
		case ">":
			return v > c.value;
		case "<=":
			return v <= c.value;
		case "<":
			return v < c.value;
	}
}
export const allHold = (cs: readonly LessonCond[], m: LessonMetrics): boolean => cs.every((c) => condHolds(c, m));

/** Index of the first step not yet done (steps.length when all are). */
export const currentStepIndex = (def: LessonDef, ls: LessonState): number => {
	const i = def.steps.findIndex((s) => !ls.stepsDone.includes(s.id));
	return i < 0 ? def.steps.length : i;
};

/** What the player may build right now: the `allow` lists of every step up to and including the current one. */
export function lessonAllowed(def: LessonDef, ls: LessonState): { defId: string; max?: number }[] {
	const upTo = Math.min(def.steps.length - 1, currentStepIndex(def, ls));
	const out = new Map<string, number | undefined>();
	for (let i = 0; i <= upTo; i++) for (const a of def.steps[i].allow) out.set(a.defId, a.max);
	return [...out].map(([defId, max]) => ({ defId, max }));
}

/** Drawers the lesson has opened up to and including the current step. */
export function lessonDrawers(def: LessonDef, ls: LessonState): string[] {
	const upTo = Math.min(def.steps.length - 1, currentStepIndex(def, ls));
	const out = new Set<string>();
	for (let i = 0; i <= upTo; i++) for (const d of def.steps[i].drawers ?? []) out.add(d);
	return [...out];
}

/** True once the lesson has opened the Supplies tab (spare parts, bots). */
export function lessonSupplies(def: LessonDef, ls: LessonState): boolean {
	const upTo = Math.min(def.steps.length - 1, currentStepIndex(def, ls));
	return def.steps.slice(0, upTo + 1).some((s) => s.supplies);
}

/** Refusal text when the active lesson does not allow placing `defId` (or `type` of command), else null. */
export function lessonBlocksPlace(state: SimState, content: ContentDB, defId: string): string | null {
	const def = state.lesson?.status === "active" ? lessonDef(state, content) : undefined;
	if (!def || !state.lesson) return null;
	const a = lessonAllowed(def, state.lesson).find((x) => x.defId === defId);
	if (!a) return "Not part of this lesson yet";
	if (a.max !== undefined && state.facilities.filter((f) => f.defId === defId).length >= a.max) return `This lesson needs only ${a.max}`;
	return null;
}
export function lessonBlocksCommand(state: SimState, content: ContentDB, type: string, techId?: string): string | null {
	const def = state.lesson?.status === "active" ? lessonDef(state, content) : undefined;
	if (!def) return null;
	if (!def.commands.includes(type)) return "Not part of this lesson";
	if (type === "research" && techId !== undefined && !(def.research ?? []).includes(techId)) return "Not part of this lesson";
	return null;
}

function applyEffect(ctx: TickCtx, e: LessonEffect, def: LessonDef): void {
	const { state } = ctx;
	if (e.type === "gridCap" || e.type === "failureRate") {
		state.modifiers.push({ kind: e.type, value: e.factor, endsAt: state.tick + e.durationTicks, label: e.label });
		return;
	}
	if (e.type === "rp") {
		state.researchPoints += e.amount;
		return;
	}
	if (e.type === "offer") {
		const id = state.nextId.contract++;
		const training = e.kind === "training";
		const h = e.durationTicks / 60;
		state.offers.push({
			id,
			spec: {
				clientId: e.client ?? "kestrel_quant",
				clientName: e.client === "helios_labs" ? "Helios Frontier Labs" : "Kestrel Quantitative",
				kind: e.kind,
				work: training ? (e.workPfh ?? Math.round(e.pflops * h * 0.6)) : e.pflops,
				...(training ? {} : { sustainedPflops: e.pflops }),
				durationTicks: e.durationTicks,
				payout: e.payout,
				penalty: 0,
				needsLiquid: false,
				storageTB: e.storageTB ?? 0,
				checkpointTicks: training ? 60 : 0,
			},
			expiresAt: state.tick + 100_000,
		});
		ctx.events.push({ type: "contractOffered", contractId: id });
		return;
	}
	const job: Job = {
		id: state.nextId.job++,
		contractId: 0,
		spec: {
			clientId: "kestrel_quant",
			clientName: "Kestrel Quantitative",
			kind: "inference",
			work: e.pflops,
			sustainedPflops: e.pflops,
			durationTicks: e.durationTicks,
			payout: e.payout,
			penalty: 0,
			needsLiquid: false,
			storageTB: 0,
			checkpointTicks: 0,
		},
		status: "queued",
		acceptedAt: state.tick,
		deadline: state.tick + e.durationTicks,
		progress: 0,
		total: e.durationTicks,
		lastCheckpoint: 0,
		sinceCheckpoint: 0,
		pflops: 0,
		rackIds: [],
		earned: 0,
		clerk: false,
		finishedAt: -1,
		unreported: 0,
	};
	state.jobs.push(job);
	ctx.events.push({ type: "jobStarted", jobId: job.id });
	void def;
}

/** Bonus stars for a finished lesson, tested on its metrics at the win: bit 1 = star 2 held, bit 2 = star 3 held. */
export function lessonStarBits(def: LessonDef, m: LessonMetrics): number {
	return (allHold(def.stars2, m) ? 1 : 0) | (allHold(def.stars3, m) ? 2 : 0);
}

/** Star count for a finished lesson: 1 for passing, plus one for each bonus star. */
export function lessonStars(def: LessonDef, m: LessonMetrics): number {
	const bits = lessonStarBits(def, m);
	return 1 + (bits & 1) + (bits >> 1);
}

/** Tick stage 10b: run the lesson's beats, steps, success and failure. A won or lost lesson stays on the state (for the result screen) but stops restricting. */
export function lessonStep(ctx: TickCtx): void {
	const { state, content } = ctx;
	const ls = state.lesson;
	if (ls?.status !== "active") return;
	const def = lessonDef(state, content);
	if (!def) return;
	const m = lessonMetrics(state, content);
	for (const b of def.beats) {
		if (ls.beatsFired.includes(b.id) || !allHold(b.when, m)) continue;
		ls.beatsFired.push(b.id);
		for (const e of b.effects) applyEffect(ctx, e, def);
	}
	// Steps complete in order and stay done. A step with no conditions is the success day itself.
	for (let i = currentStepIndex(def, ls); i < def.steps.length; i++) {
		const s = def.steps[i];
		if (s.when.length === 0 || !allHold(s.when, m)) break;
		ls.stepsDone.push(s.id);
	}
	// Downtime after the second rack: any tick the racks are dark or the load exceeds capacity.
	if (ls.beatsFired.length > 0 && m.racks > 0 && (m.racksDark > 0 || m.shortKw > 0)) ls.downTicks++;
	// Running tallies the star rules may read.
	if (state.cash < ls.minCash) ls.minCash = state.cash;
	if (m.batteries > 0 && m.upsPct <= 0) ls.drainTicks++;
	// A storage stall: the datasets of the live jobs do not fit in the powered storage.
	if (state.jobs.some((j) => isActive(j) && j.spec.storageTB > 0) && state.jobs.reduce((tb, j) => (isActive(j) ? tb + j.spec.storageTB : tb), 0) > storageCapacityTB(state, content)) ls.stallTicks++;
	if (m.foreman > 0) ls.foremanTicks++;
	if (state.facilities.some((f) => f.throttled || f.tripped)) ls.hotTicks++;
	if (allHold(def.win.when, m)) {
		ls.holdTicks++;
		if (m.headroomPct < ls.minHeadroom) ls.minHeadroom = m.headroomPct;
	} else {
		ls.holdTicks = 0;
		ls.minHeadroom = 100;
	}
	const last = def.steps[def.steps.length - 1];
	if (ls.holdTicks >= def.win.holdTicks && def.steps.slice(0, -1).every((s) => ls.stepsDone.includes(s.id))) {
		if (!ls.stepsDone.includes(last.id)) ls.stepsDone.push(last.id);
		ls.status = "won";
		ls.endTick = state.tick;
		// Tallies include this tick; the win-hold counters above are already settled.
		const end = lessonMetrics(state, content);
		ls.starBits = def.starred === false ? 0 : lessonStarBits(def, end);
		ls.stars = def.starred === false ? 1 : 1 + (ls.starBits & 1) + (ls.starBits >> 1);
	} else if (def.lose.some((c) => condHolds(c, m))) {
		ls.status = "lost";
		ls.endTick = state.tick;
	}
}
