import type { ContentDB } from "@aitower/content";
import { achievementContent } from "@aitower/content";
import { type AdvisorKey, type GameState, type Profile, loadProfile, markProfileFlag } from "@aitower/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { epilogueAdvisor } from "../gameover/EndingScene";
import { endingOf } from "../gameover/gameOver";
import { AchIcon } from "./AchIcon";
import { ACHIEVEMENTS, type AchievementDef, type AchievementMoment, type AwardResult, awardFor, bedComplete, type IconRef } from "./achievements";
import { onAwards, publishAwards, resetRunAwards } from "./awardBus";

/** How long the strip stays (spec: 4 seconds; the game keeps running). */
export const ACHIEVEMENT_TOAST_MS = 4000;

// Dev builds expose `window.__aitower`, which can set anything, so nothing is awarded there (spec, "Cheating by dev tools").
const devBuild = (): boolean => !!(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV;
/** Awards are on in production builds only. */
export const awardsAllowed = (): boolean => !devBuild();

/** One strip on screen. A `deferred` one (an off-duty portrait) waits for the pause menu or the ending screen. */
export interface StripItem {
	key: string;
	tag: string;
	name: string;
	text?: string;
	icon?: IconRef;
	deferred?: boolean;
}

const advisorName = (a: AdvisorKey): string => achievementContent.offDuty[a].name;

export const achievementItem = (d: AchievementDef): StripItem => ({ key: `a:${d.id}`, tag: "ACHIEVEMENT", name: d.name, text: d.text, icon: d.icon });
export const portraitItem = (a: AdvisorKey): StripItem => ({ key: `p:${a}`, tag: "OFF DUTY", name: `${advisorName(a)} has a new portrait`, deferred: true });
export const bedItem = (): StripItem => ({ key: "p:bed", tag: "OFF DUTY", name: "The after-hours set is open", text: "Four new portraits.", deferred: true });

/** The strips for what a check just earned. */
export const itemsFor = (r: AwardResult): StripItem[] => [...r.won.map(achievementItem), ...r.portraits.map(portraitItem), ...(r.bed ? [bedItem()] : [])];

/** Portraits already unlocked whose strip was never shown (earned mid-run in an earlier session, or merged in from a file). */
export function untoldItems(profile: Profile, defs: readonly AchievementDef[] = ACHIEVEMENTS): StripItem[] {
	const out: StripItem[] = [];
	for (const a of ["luci", "mel", "bea", "cass"] as const) if (profile.offDuty[a].casual && !profile.told[a]) out.push(portraitItem(a));
	if (bedComplete(profile, defs) && !profile.told.bed) out.push(bedItem());
	return out;
}

/** The moments an event stands for (spec section 1: day close, game over, quarter report, decision resolved). */
export function momentsOf(events: readonly { type: string }[]): AchievementMoment[] {
	const m = new Set<AchievementMoment>();
	for (const e of events) {
		if (e.type === "newDay") m.add("dayClose");
		else if (e.type === "gameOver") m.add("gameOver");
		else if (e.type === "quarterReport") m.add("quarterReport");
		else if (e.type === "decisionResolved") m.add("decisionResolved");
	}
	return ["dayClose", "quarterReport", "decisionResolved", "gameOver"].filter((x) => m.has(x as AchievementMoment)) as AchievementMoment[];
}

/** The advisor whose epilogue the ending screen shows for this game over (null: the narrated fallback). */
function shownEpilogue(view: GameState["view"], content: ContentDB | undefined): AdvisorKey | null {
	const over = view.gameOver;
	const id = over ? endingOf(over) : undefined;
	const def = id ? content?.endings?.find((e) => e.id === id) : undefined;
	return def ? epilogueAdvisor(view, def) : null;
}

/**
 * Runs the achievement checks on the sim's events (day close, game over, quarter report, decision resolved) and shows a top-centre
 * strip for what unlocked. Events already in the log at mount, and a load (tick going backwards), never award on their own.
 * Off-duty portrait strips wait until `deferOk` (the pause menu or the ending screen is open) so they never cover a decision.
 */
export function AchievementToast({ state, content, defs = ACHIEVEMENTS, enabled = awardsAllowed(), deferOk = false }: { state: GameState; content?: ContentDB; defs?: readonly AchievementDef[]; enabled?: boolean; deferOk?: boolean }) {
	const [queue, setQueue] = useState<StripItem[]>([]);
	const cursor = useRef<number | null>(null);
	const add = useCallback((items: StripItem[]): void => {
		if (items.length) setQueue((q) => [...q, ...items.filter((i) => !q.some((x) => x.key === i.key))]);
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the log only, like the toast stack: the view is read at the moment the event is seen
	useEffect(() => {
		const log = state.log;
		const last = log[log.length - 1];
		const c = cursor.current;
		cursor.current = last ? last.tick : -1;
		if (!last || (c !== null && last.tick < c)) resetRunAwards(); // a new game or a load
		if (c === null || !last || last.tick < c || !enabled) return;
		const moments = momentsOf(log.filter((e) => e.tick > c).map((e) => e.event));
		for (const m of moments) {
			const r = awardFor(m, state.view, { defs, content, epilogue: m === "gameOver" ? shownEpilogue(state.view, content) : undefined });
			publishAwards(r);
		}
	}, [state.log]);

	// Whatever is earned (here or by the lesson layer) joins the queue.
	useEffect(() => onAwards((r) => add(itemsFor(r))), [add]);

	// Portrait strips that were never shown come up with the pause menu or the ending screen.
	// biome-ignore lint/correctness/useExhaustiveDependencies: scan when the menu or ending screen opens
	useEffect(() => {
		if (deferOk && enabled) add(untoldItems(loadProfile(), defs));
	}, [deferOk, enabled]);

	const now = queue.find((i) => !i.deferred || deferOk);
	const nowKey = now?.key;
	useEffect(() => {
		if (!nowKey) return;
		const h = setTimeout(() => {
			if (nowKey.startsWith("p:")) markProfileFlag("told", nowKey.slice(2));
			setQueue((q) => q.filter((i) => i.key !== nowKey));
		}, ACHIEVEMENT_TOAST_MS);
		return () => clearTimeout(h);
	}, [nowKey]);

	if (!now) return null;
	return (
		<div className="ui-ach-toast" role="status" aria-live="polite" data-achievement={now.key.startsWith("a:") ? now.key.slice(2) : undefined} data-strip={now.key}>
			<AchIcon icon={now.icon} scale={2} />
			<span className="ui-ach-tag">{now.tag}</span>
			<span className="ui-ach-name">{now.name}</span>
			{now.text && <span className="ui-ach-text">{now.text}</span>}
		</div>
	);
}
