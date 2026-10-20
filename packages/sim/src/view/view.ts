/**
 * Read-only SimView. Grid typed arrays are the live state arrays (reused, don't mutate);
 * entity arrays are rebuilt small each call.
 */
import type { BotDef, ContentDB } from "@aitower/content";
import type { BotState, BotView, FacilityView, JobView, MemoView, SimView } from "../api";
import type { Bot, SimState } from "../core/state";
import { GensetMode } from "../core/state";
import { dayOf, energyPriceAt, minuteOfDay } from "../core/time";
import { loanMax } from "../economy/credit";
import { facilityContamination } from "../bio/index";
import { leadingEnding } from "../bio/path";
import { eventDef } from "../ministry/memos";
import { modFactor } from "../ministry/modifiers";
import { getDef } from "../world/defs";
import { facilityStatus } from "./status";
import { clerkUnlocked, foremanUnlocked, perk } from "../research/research";
import { cloneAutomation } from "../automation/policy";
import { isDrought } from "../green/weather";
import { affinityShares } from "../progression/affinity";

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

function memoViews(state: SimState, content: ContentDB): MemoView[] {
	const out: MemoView[] = [];
	for (const m of state.memos) {
		const def = eventDef(content, m.eventId);
		if (!def) continue;
		out.push({
			id: m.id,
			eventId: m.eventId,
			category: def.category,
			title: def.title,
			body: def.body,
			choices: def.choices.map((c) => ({ id: c.id, label: c.label, hint: c.hint })),
			defaultChoice: def.defaultChoice,
			issuedAt: m.issuedAt,
			expiresAt: m.expiresAt,
		});
	}
	return out;
}

export function buildView(state: SimState, content: ContentDB): SimView {
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
		endingProgress: leadingEnding(state, content.balance.endings),
		affinity: affinityShares(state),
		pathScore: state.path === "greentech" ? state.greenScore : state.path === "synthetic" ? state.refinement : state.corruption,
		greenScore: state.greenScore,
		refinement: state.refinement,
		drought: isDrought(state),
		sandbox: state.sandbox,
		automation: { policy: cloneAutomation(state.automation), foremanUnlocked: foremanUnlocked(state, content) },
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
		workOrders: state.workOrders.map((w) => ({
			id: w.id,
			facilityId: w.facilityId,
			botId: w.botId >= 0 ? w.botId : null,
			createdAt: w.createdAt,
		})),
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
		memos: memoViews(state, content),
		memoHistory: state.memoHistory.map((h) => ({ ...h })),
		modifiers: state.modifiers
			.filter((m) => m.endsAt > state.tick)
			.map((m) => ({ label: m.label, kind: m.kind, value: m.value, endsAt: m.endsAt })),
		standing: state.standing,
		standingLog: state.standingLog.map((e) => ({ ...e })),
		uptimeTarget: content.balance.tiers.uptime[state.tier - 1] ?? 0,
		researchPoints: state.researchPoints,
		techResearched: state.techResearched.slice(),
		clerk: { unlocked: clerkUnlocked(state, content), policy: { ...state.clerkPolicy, kinds: state.clerkPolicy.kinds.slice() }, acceptedTotal: state.clerkAccepted },
		loan: { principal: state.loanPrincipal, max: loanMax(state, content), dailyRate: content.balance.loans.dailyRate },
		reports: state.reports.map((r) => ({ ...r })),
		stats: { ...state.stats },
		gameOver: state.gameOver ? { ...state.gameOver } : null,
	};
}
