/**
 * Read-only SimView. Grid typed arrays are the live state arrays (reused, don't mutate);
 * entity arrays are rebuilt small each call.
 */
import type { BotDef, ContentDB, SceneLine } from "@aitower/content";
import { currentStepIndex, lessonAllowed, lessonMetrics } from "../lesson/lesson";
import type { BotState, BotView, FacilityView, JobView, MaintenanceView, DecisionView, LessonView, SimView, SoulView, WorkOrderView } from "../api";
import { MIN_POWERED_SATISFACTION } from "../core/constants";
import { cellCount, findById } from "../core/grid";
import { createNav, type Nav, reachableRuns, runAtTile } from "../logistics/routing";
import type { Bot, SimState } from "../core/state";
import { GensetMode } from "../core/state";
import { dayOf, energyPriceAt, minuteOfDay } from "../core/time";
import { loanMax } from "../economy/credit";
import { facilityContamination } from "../bio/index";
import { commitBlock, sealOf } from "../progression/soul";
import { eventDef } from "../ministry/decisions";
import { modFactor } from "../ministry/modifiers";
import { getDef, serviceTile } from "../world/defs";
import { facilityStatus } from "./status";
import { clerkUnlocked, foremanPerHour, foremanUnlocked, perk, researchedCount } from "../research/research";
import { cloneAutomation } from "../automation/policy";
import { foremanStatusOf } from "../automation/status";
import { isDrought } from "../green/weather";
import { affinityShares } from "../progression/affinity";

function lessonView(state: SimState, content: ContentDB): LessonView | null {
	const ls = state.lesson;
	const def = ls ? content.lessons.find((l) => l.id === ls.id) : undefined;
	if (!ls || !def) return null;
	const m = lessonMetrics(state, content);
	return {
		id: ls.id,
		status: ls.status,
		stepsDone: [...ls.stepsDone],
		current: currentStepIndex(def, ls),
		beatsFired: [...ls.beatsFired],
		holdTicks: ls.holdTicks,
		holdGoal: def.win.holdTicks,
		minHeadroom: ls.minHeadroom,
		downTicks: ls.downTicks,
		stars: ls.stars,
		allowed: ls.status === "active" ? lessonAllowed(def, ls) : [],
		loadKw: m.demandKw,
		capacityKw: m.supplyKw,
		headroomPct: m.headroomPct,
		startTick: ls.startTick,
		endTick: ls.endTick,
	};
}

function botState(b: Bot, def: BotDef | undefined): BotState {
	if (def?.flying && b.leg === "walk" && b.floor !== b.goalFloor && (b.task === "depot" || b.task === "target" || b.task === "charger")) return "flying";
	if (b.leg === "ride") return "riding";
	if (b.leg === "waitLift") return "waitingLift";
	switch (b.task) {
		case "depot":
			return "toDepot";
		case "target":
			return "toTarget";
		case "repair":
			return "repairing";
		case "charger":
			return "toCharger";
		case "charge":
			return "charging";
		default:
			return "idle";
	}
}

function decisionView(state: SimState, content: ContentDB): DecisionView | null {
	const d = state.decision;
	if (!d || d.hiddenUntil > 0) return null;
	const def = eventDef(content, d.eventId);
	if (!def) return null;
	const name = d.subject !== undefined && Object.hasOwn(content.facilities, d.subject) ? content.facilities[d.subject].name : undefined;
	const sub = (t: string): string => (name === undefined ? t : t.replaceAll("{item}", name));
	const lines = (ls: readonly SceneLine[] | undefined): SceneLine[] | undefined => ls?.map((l) => ({ ...l, text: sub(l.text) }));
	const v: DecisionView = {
		id: d.id,
		eventId: d.eventId,
		advisor: def.advisor,
		category: def.category,
		title: def.title,
		body: sub(def.body),
		choices: def.choices.map((c) => (c.reply ? { id: c.id, label: sub(c.label), hint: sub(c.hint), reply: lines(c.reply) } : { id: c.id, label: sub(c.label), hint: sub(c.hint) })),
		recommended: def.recommended,
		votes: def.votes?.map((v) => ({ ...v })),
		issuedAt: d.issuedAt,
		canDefer: !d.deferred && def.category !== "story",
	};
	if (def.lines) v.lines = lines(def.lines);
	if (def.backdrop) v.backdrop = def.backdrop;
	if (def.location) v.location = def.location;
	if (name !== undefined && d.subject !== undefined) v.subject = { defId: d.subject, name };
	return v;
}

function soulView(state: SimState, content: ContentDB): SoulView {
	const s = content.balance.soul;
	return {
		sp: { ...state.sp },
		spTarget: s.spTarget,
		seal: { biotech: sealOf(state, "biotech"), greentech: sealOf(state, "greentech") },
		sealMax: s.sealMax,
		bonds: { ...state.bonds },
		bondReveal: s.bondReveal,
		bondCommit: s.bondCommit,
		bondEpilogue: s.bondEpilogue,
		sealedOut: [...state.sealedOut],
		commitBlock: { synthetic: null, biotech: commitBlock(state, content, "biotech"), greentech: commitBlock(state, content, "greentech") },
	};
}

function tierNeed(state: SimState, content: ContentDB): SimView["tierNeed"] {
	const t = content.balance.tiers;
	const i = state.tier; // index of the next tier's requirement
	if (i >= t.pflops.length) return null;
	return { tier: i + 1, pflops: t.pflops[i], uptime: t.uptime[i], techs: t.techs?.[i] ?? 0, techsDone: researchedCount(state, content) };
}

/** Where the maintenance view caches its reach search (one per tick; owned by the sim). */
export interface ReachCache {
	tick: number;
	rev: number;
	runs: Set<number> | null;
}

function maintenanceViews(state: SimState, content: ContentDB, nav: Nav, cache: ReachCache, spareParts: number): { orders: WorkOrderView[]; summary: MaintenanceView } {
	let partsCapacity = 0;
	for (const f of state.facilities) if (getDef(content, f.defId).kind === "depot") partsCapacity += getDef(content, f.defId).logistics?.capacity ?? 0;
	if (state.workOrders.length > 0 && (cache.tick !== state.tick || cache.rev !== state.topologyRev)) {
		cache.runs = reachableRuns(state, content, nav);
		cache.tick = state.tick;
		cache.rev = state.topologyRev;
	}
	let queue = 0;
	let noRoute = 0;
	const orders = state.workOrders.map((w): WorkOrderView => {
		const rack = findById(state.facilities, w.facilityId);
		let route: WorkOrderView["route"] = "ok";
		if (state.bots.length === 0) route = "noBots";
		else if (rack && cache.runs !== null && !cache.runs.has(runAtTile(nav, state, rack.floor, serviceTile(rack)))) route = "noRoute";
		if (route === "noRoute") noRoute++;
		return { id: w.id, facilityId: w.facilityId, botId: w.botId >= 0 ? w.botId : null, createdAt: w.createdAt, queuePos: w.botId >= 0 ? null : ++queue, route };
	});
	let busy = 0;
	for (const b of state.bots) if (b.workOrderId >= 0 || b.task === "depot" || b.task === "target" || b.task === "repair") busy++;
	return { orders, summary: { parts: spareParts, partsCapacity, botsTotal: state.bots.length, botsBusy: busy, botsIdle: state.bots.length - busy, waiting: queue, noRoute } };
}

export function buildView(state: SimState, content: ContentDB, nav: Nav = createNav(cellCount(state)), cache: ReachCache = { tick: -1, rev: -1, runs: null }): SimView {
	const m = state.metrics;
	const facilities: FacilityView[] = state.facilities.map((f) => {
		const d = getDef(content, f.defId);
		const v: FacilityView = {
			id: f.id,
			defId: f.defId,
			floor: f.floor,
			x: f.x,
			width: f.width,
			enabled: f.enabled,
			status: facilityStatus(f, d, state.storageUtil),
			tempC: f.tempC,
			clock: d.kind === "rack" ? f.clock : 1,
			health: f.health,
			powerKw: f.powerKw,
			heatKw: f.heatKw,
			jobId: f.jobId >= 0 ? f.jobId : null,
			powerNet: f.powerNet >= 0 ? f.powerNet : null,
			coolantNet: f.coolantNet >= 0 ? f.coolantNet : null,
			nutrientNet: f.nutrientNet >= 0 ? f.nutrientNet : null,
			grown: f.grown,
			contamination: facilityContamination(state, f),
		};
		if (d.kind === "genset") v.running = f.gensetMode === GensetMode.Running;
		if (d.kind === "ups") v.charge = (d.power?.storageKwh ?? 0) > 0 ? f.storedKwh / (d.power?.storageKwh ?? 1) : 0;
		if (d.kind === "depot") v.stored = f.stored;
		return v;
	});
	const bots: BotView[] = state.bots.map((b) => ({
		id: b.id,
		defId: b.defId,
		x: b.x,
		floor: b.floor,
		state: botState(b, content.bots[b.defId]),
		battery: b.battery,
		carrying: b.carrying,
		workOrderId: b.workOrderId >= 0 ? b.workOrderId : null,
		trait: b.trait,
		parts: b.carrying ? Math.max(1, b.parts) : 0,
	}));
	const jobs: JobView[] = state.jobs.map((j) => ({
		id: j.id,
		contractId: j.contractId,
		clientName: j.spec.clientName,
		kind: j.spec.kind,
		status: j.status,
		progress: j.progress,
		total: j.total,
		deadline: j.deadline,
		pflops: j.pflops,
		rackIds: j.rackIds.slice(),
		payout: j.spec.payout,
		lastCheckpoint: j.lastCheckpoint,
	}));
	let spareParts = 0;
	for (const f of state.facilities) spareParts += f.stored;
	const upkeep = maintenanceViews(state, content, nav, cache, spareParts);
	return {
		tick: state.tick,
		day: dayOf(state.tick),
		minuteOfDay: minuteOfDay(state.tick),
		width: state.width,
		floorMin: state.floorMin,
		floorMax: state.floorMax,
		slab: state.slab,
		power: state.power,
		coolant: state.coolant,
		airTemp: state.airTemp,
		powerNetOf: state.powerNetOf,
		coolantNetOf: state.coolantNetOf,
		nutrient: state.nutrient,
		nutrientNetOf: state.nutrientNetOf,
		contamination: state.contamination,
		nutrientNets: state.nutrientNets.map((n) => ({ ...n })),
		corruption: state.corruption,
		contaminatedShare: state.contaminatedShare,
		irreversible: state.irreversible,
		path: state.path,
		organoidPflops: m.organoidPflops,
		soul: soulView(state, content),
		affinity: affinityShares(state),
		pathScore: state.path === "greentech" ? state.greenScore : state.path === "synthetic" ? state.refinement : state.corruption,
		greenScore: state.greenScore,
		refinement: state.refinement,
		drought: isDrought(state),
		sandbox: state.sandbox,
		automation: { policy: cloneAutomation(state.automation), foremanUnlocked: foremanUnlocked(state, content), foremanStatus: foremanStatusOf(state), foremanPerHour: foremanPerHour(state, content) },
		ambientC: state.ambientC,
		facilities,
		lifts: state.lifts.map((l) => ({
			id: l.id,
			x: l.x,
			floorMin: l.floorMin,
			floorMax: l.floorMax,
			carFloor: l.carFloor,
			dir: l.dir,
			doorsOpen: l.doorsOpen,
			riders: l.riders.length,
			powered: l.powerNet >= 0 && l.sat >= MIN_POWERED_SATISFACTION,
		})),
		bots,
		powerNets: state.powerNets.map((n) => ({
			id: n.id,
			supplyKw: n.supplyKw,
			demandKw: n.demandKw,
			satisfaction: n.satisfaction,
			storedKwh: n.storedKwh,
			storageCapacityKwh: n.storageCapacityKwh,
			gridImportKw: n.gridImportKw,
		})),
		coolantNets: state.coolantNets.map((n) => ({ ...n })),
		offers: state.offers.map((o) => ({ ...o.spec, id: o.id, expiresAt: o.expiresAt })),
		jobs,
		workOrders: upkeep.orders,
		maintenance: upkeep.summary,
		cash: state.cash,
		spareParts,
		tier: state.tier,
		energyPrice: energyPriceAt(content.balance, state.tick) * modFactor(state, "energyPrice") * perk(state, content, "energyPrice"),
		pue: m.pue,
		uptime: m.uptime,
		itKw: m.itKw,
		totalKw: m.totalKw,
		pflops: m.pflops,
		ledger: [...state.ledger, state.today],
		history: state.history,
		bankrupt: state.bankrupt,
		decision: decisionView(state, content),
		decisionReturnsAt: state.decision && state.decision.hiddenUntil > 0 ? state.decision.hiddenUntil : null,
		decisionGate: state.decisionGate,
		decisionHistory: state.decisionHistory.map((h) => ({ ...h })),
		advisorTips: [...state.advisorTips],
		lesson: lessonView(state, content),
		modifiers: state.modifiers
			.filter((m) => m.endsAt > state.tick)
			.map((m) => ({ label: m.label, kind: m.kind, value: m.value, endsAt: m.endsAt })),
		standing: state.standing,
		standingLog: state.standingLog.map((e) => ({ ...e })),
		uptimeTarget: content.balance.tiers.uptime[state.tier - 1] ?? 0,
		tierNeed: tierNeed(state, content),
		researchPoints: state.researchPoints,
		techResearched: state.techResearched.slice(),
		clerk: { unlocked: clerkUnlocked(state, content), policy: { ...state.clerkPolicy, kinds: state.clerkPolicy.kinds.slice() }, acceptedTotal: state.clerkAccepted },
		loan: { principal: state.loanPrincipal, max: loanMax(state, content), dailyRate: content.balance.loans.dailyRate },
		reports: state.reports.map((r) => ({ ...r })),
		stats: { ...state.stats },
		gameOver: state.gameOver ? { ...state.gameOver } : null,
	};
}
