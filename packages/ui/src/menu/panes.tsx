import { type GameState, type GameStore, type HorrorIntensity, type SaveSlotInfo, type SaveSlotId, normalizeSettings } from "@aitower/shared";
import { useRef, useState } from "react";
import { fmtMoney } from "../format";
import { pushNotice } from "../notices";
import { Toggle, Kbd } from "../components/common";
import type { ContentDB } from "@aitower/content";
import { LessonList } from "../lessons/LessonList";
import { TEXT_SCALE_MAX, TEXT_SCALE_MIN } from "../settings";
import { CONTROLS } from "./controls";
import { exportSave, importSaveFile } from "./fileIO";
import type { MenuController } from "./menuController";
import { ConfirmBar, SettingRow, Slider, StampBtn } from "./parts";
import { cleanSlotName, slotRows } from "./slots";

export interface Flash {
	tone: "good" | "error";
	text: string;
}

interface PaneProps {
	store: GameStore;
	state: GameState;
	menu: MenuController;
	flash: (f: Flash | null) => void;
	/** Called after a load or import replaced the running game. */
	onReplaced?: () => void;
	/** For the Lessons section. */
	content?: ContentDB;
}

interface SlotPaneProps extends PaneProps {
	saves: SaveSlotInfo[] | null;
	reload: () => Promise<void>;
}

const errText = (e: unknown): string => (e instanceof Error ? e.message : String(e));

function SlotsLoading() {
	return <div className="ui-slot-empty">Reading saves…</div>;
}

export function SavePane({ store, state, flash, saves, reload }: SlotPaneProps) {
	const [names, setNames] = useState<Partial<Record<SaveSlotId, string>>>({});
	const [armed, setArmed] = useState<SaveSlotId | null>(null);
	const [working, setWorking] = useState(false);
	if (!saves) return <SlotsLoading />;
	const busy = working || state.saveStatus.busy;

	const doSave = async (id: SaveSlotId, fallbackName: string | undefined): Promise<void> => {
		setWorking(true);
		setArmed(null);
		flash(null);
		try {
			const r = await store.saveTo(id, cleanSlotName(names[id] ?? "") ?? fallbackName);
			flash(r.ok ? { tone: "good", text: `Saved to ${id === "auto" ? "AUTOSAVE" : id.replace("slot", "SLOT ")}.` } : { tone: "error", text: r.reason });
			if (r.ok) setNames((n) => ({ ...n, [id]: "" }));
		} catch (e) {
			flash({ tone: "error", text: errText(e) });
		} finally {
			setWorking(false);
			await reload();
		}
	};

	return (
		<div className="ui-slots">
			{slotRows(saves).map((row) => (
				<div key={row.id} className={`ui-slot ${row.empty ? "is-empty" : ""}`}>
					<span className="ui-slot-label">{row.label}</span>
					<div className="ui-slot-info">
						{row.manual ? (
							<input
								className="ui-field"
								type="text"
								maxLength={24}
								value={names[row.id] ?? ""}
								placeholder={row.empty ? `Day ${state.view.day}` : row.name}
								aria-label={`Name for ${row.label}`}
								onChange={(e) => {
									const v = e.currentTarget.value;
									setNames((n) => ({ ...n, [row.id]: v }));
								}}
								onKeyDown={(e) => {
									if (e.key === "Enter" && !busy) row.empty ? void doSave(row.id, undefined) : setArmed(row.id);
								}}
							/>
						) : (
							<span className="ui-slot-name">{row.empty ? "No autosave yet" : row.name}</span>
						)}
						<span className="ui-slot-meta">
							{row.summary}
							{!row.empty && <span className="ui-slot-when"> · {row.when}</span>}
						</span>
					</div>
					<div className="ui-slot-act">
						{row.manual ? (
							<StampBtn rest="Save" hot="Saved" disabled={busy} onClick={() => (row.empty ? void doSave(row.id, undefined) : setArmed(row.id))} />
						) : (
							<span className="ui-slot-ro">READ-ONLY</span>
						)}
					</div>
					{armed === row.id && (
						<ConfirmBar
							question={`Overwrite “${row.name}” (day ${row.info?.day}, ${fmtMoney(row.info?.cash ?? 0)})?`}
							yes="Overwrite"
							onYes={() => void doSave(row.id, row.name)}
							onNo={() => setArmed(null)}
						/>
					)}
				</div>
			))}
			<p className="ui-pane-note">The autosave is written at the start of each day and cannot be overwritten by hand.</p>
		</div>
	);
}

export function LoadPane({ store, state, menu, flash, onReplaced, saves, reload }: SlotPaneProps) {
	const [armed, setArmed] = useState<SaveSlotId | null>(null);
	const [working, setWorking] = useState(false);
	const file = useRef<HTMLInputElement>(null);
	if (!saves) return <SlotsLoading />;
	const busy = working || state.saveStatus.busy;

	const doLoad = async (id: SaveSlotId, name: string): Promise<void> => {
		setWorking(true);
		setArmed(null);
		flash(null);
		try {
			const r = await store.loadFrom(id);
			if (r.ok) {
				pushNotice({ text: `Loaded “${name}”.`, severity: "good", key: "loaded" });
				onReplaced?.();
				menu.close();
				return;
			}
			flash({ tone: "error", text: r.reason });
		} catch (e) {
			flash({ tone: "error", text: errText(e) });
		} finally {
			setWorking(false);
			void reload();
		}
	};

	const onFile = async (f: File | undefined): Promise<void> => {
		if (!f) return;
		flash(null);
		setWorking(true);
		const r = await importSaveFile(store, f);
		setWorking(false);
		if (r.ok) {
			pushNotice({ text: `Imported ${f.name}.`, severity: "good", key: "imported" });
			onReplaced?.();
			menu.close();
		} else flash({ tone: "error", text: r.reason });
	};

	return (
		<div className="ui-slots">
			{slotRows(saves).map((row) => (
				<div key={row.id} className={`ui-slot ${row.empty ? "is-empty" : ""}`}>
					<span className="ui-slot-label">{row.label}</span>
					<div className="ui-slot-info">
						<span className="ui-slot-name">{row.empty ? "Empty drawer" : row.name}</span>
						<span className="ui-slot-meta">
							{row.summary}
							{!row.empty && <span className="ui-slot-when"> · {row.when}</span>}
						</span>
					</div>
					<div className="ui-slot-act">
						<StampBtn rest="Load" hot="Retrieved" disabled={busy || row.empty} onClick={() => setArmed(row.id)} />
					</div>
					{armed === row.id && (
						<ConfirmBar question="Replace the running game? Unsaved progress is lost." yes="Load it" onYes={() => void doLoad(row.id, row.name)} onNo={() => setArmed(null)} />
					)}
				</div>
			))}
			<div className="ui-filebox">
				<span className="ui-filebox-title">File</span>
				<div className="ui-filebox-acts">
					<input ref={file} type="file" accept=".json,application/json" hidden onChange={(e) => {
							const input = e.currentTarget;
							const f = input.files?.[0];
							input.value = "";
							void onFile(f);
						}} />
					<button type="button" className="ui-btn" disabled={busy} onClick={() => file.current?.click()} title="Replace the running game with a save file">
						Import from file…
					</button>
					<button
						type="button"
						className="ui-btn"
						onClick={() => {
							const r = exportSave(store, state.view.day);
							flash(r.ok ? { tone: "good", text: `Exported ${r.name}.` } : { tone: "error", text: `Export failed: ${r.reason}` });
						}}
						title="Download the running game as a file"
					>
						Export to file
					</button>
				</div>
			</div>
		</div>
	);
}

const HORROR: { id: HorrorIntensity; label: string }[] = [
	{ id: "full", label: "Full" },
	{ id: "mild", label: "Mild" },
	{ id: "off", label: "Off" },
];

export function SettingsPane({ store, state }: PaneProps) {
	const s = normalizeSettings(state.settings);
	const set = store.setSettings;
	return (
		<div className="ui-settings">
			<SettingRow label="Master volume" hint="All game audio.">
				<Slider label="Master volume" value={s.masterVolume} min={0} max={1} step={0.05} readout={`${Math.round(s.masterVolume * 100)}%`} onChange={(v) => set({ masterVolume: v })} />
			</SettingRow>
			<SettingRow label="Music volume" hint="Background music, on top of the master volume.">
				<Slider label="Music volume" value={s.musicVolume} min={0} max={1} step={0.05} readout={`${Math.round(s.musicVolume * 100)}%`} onChange={(v) => set({ musicVolume: v })} />
			</SettingRow>
			<SettingRow label="Mute" hint="Silence all audio (key M).">
				<Toggle on={s.muted} onClick={() => set({ muted: !s.muted })} label="MUTE" />
			</SettingRow>
			<SettingRow label="Text size" hint="Scales the whole control room, 85% to 150%.">
				<Slider label="Text size" value={s.textScale} min={TEXT_SCALE_MIN} max={TEXT_SCALE_MAX} step={0.05} readout={`${Math.round(s.textScale * 100)}%`} onChange={(v) => set({ textScale: v })} />
			</SettingRow>
			<SettingRow label="Advisor tips" hint="Short tips from the four advisors, once each per game. Decisions always appear, and clicking a portrait still answers.">
				<Toggle on={s.advisorTips} onClick={() => set({ advisorTips: !s.advisorTips })} label="TIPS" />
			</SettingRow>
			<SettingRow label="CRT effects" hint="Scanlines, vignette and screen flicker.">
				<Toggle on={s.crtEffects} onClick={() => set({ crtEffects: !s.crtEffects })} label="CRT" />
			</SettingRow>
			<SettingRow label="Reduced motion" hint="Stops flicker, blinking lamps, needle overshoot and camera easing.">
				<Toggle on={s.reducedMotion} onClick={() => set({ reducedMotion: !s.reducedMotion })} label="CALM" />
			</SettingRow>
			<SettingRow label="Colour-blind mode" hint="Shapes on status lamps and tags (✓ ▲ ✕ ○) and a colour-blind-safe heat ramp.">
				<Toggle on={s.colorBlind} onClick={() => set({ colorBlind: !s.colorBlind })} label="CB" />
			</SettingRow>
			<SettingRow label="Horror intensity" hint="Body-horror presentation (used from later milestones).">
				<span className="ui-choice" role="radiogroup" aria-label="Horror intensity">
					{HORROR.map((h) => (
						// biome-ignore lint/a11y/useSemanticElements: styled button group acts as a radio group; native radio inputs would change the markup and CSS
						<button key={h.id} type="button" role="radio" aria-checked={s.horrorIntensity === h.id} className={`ui-btn ${s.horrorIntensity === h.id ? "is-on" : ""}`} onClick={() => set({ horrorIntensity: h.id })}>
							{h.label}
						</button>
					))}
				</span>
			</SettingRow>
			<SettingRow label="Autosave" hint="Write the autosave slot at the start of each game day.">
				<Toggle on={s.autosave} onClick={() => set({ autosave: !s.autosave })} label="AUTO" />
			</SettingRow>
			<SettingRow label="Desktop notice" hint="Show the “best on desktop” memo on small screens.">
				<Toggle on={s.showDesktopNotice} onClick={() => set({ showDesktopNotice: !s.showDesktopNotice })} label="MEMO" />
			</SettingRow>
		</div>
	);
}

export function ControlsPane() {
	return (
		<div className="ui-controls">
			{CONTROLS.map((g) => (
				<section key={g.title} className="ui-controls-group">
					<h4>{g.title}</h4>
					{g.rows.map((r) => (
						<div key={r.what} className="ui-control">
							<span className="ui-control-keys">
								{r.keys.map((k) => (
									<Kbd key={k}>{k}</Kbd>
								))}
							</span>
							<span className="ui-control-what">{r.what}</span>
						</div>
					))}
				</section>
			))}
		</div>
	);
}

export function NewGamePane({ store, menu, onReplaced }: PaneProps) {
	const [armed, setArmed] = useState(false);
	return (
		<div className="ui-newgame">
			<p>
				A new game discards the running datacenter and starts a fresh one. <b>Unsaved progress is lost.</b> Use the Save drawer first, or export a file.
			</p>
			{armed ? (
				<ConfirmBar
					question="Discard this datacenter and start over?"
					yes="Start over"
					onYes={() => {
						store.newGame();
						onReplaced?.();
						pushNotice({ text: "New datacenter started.", severity: "info", key: "newgame" });
						menu.close();
					}}
					onNo={() => setArmed(false)}
				/>
			) : (
				<div className="ui-newgame-acts">
					<StampBtn tone="red" rest="New game" hot="Condemned" onClick={() => setArmed(true)} />
				</div>
			)}
		</div>
	);
}

/** The Lessons section: the campaign list. Starting one replaces the running game (after a confirmation when there is one). */
export function LessonsPane({ store, menu, onReplaced, fromTitle, content }: PaneProps & { fromTitle?: boolean }) {
	const [armed, setArmed] = useState<string | null>(null);
	const start = (scenario: string): void => {
		store.newGame(undefined, scenario);
		onReplaced?.();
		menu.close();
	};
	if (!content) return <p>Lessons are not available here.</p>;
	return (
		<div className="ui-newgame" data-pane="lessons">
			<p>Short guided scenarios, one real datacenter idea each. Finishing one adds starting cash to every Free Build game.{!fromTitle && <> Starting one replaces the running datacenter, so <b>save first</b> if you want it back.</>}</p>
			{armed ? (
				<ConfirmBar question="Leave this datacenter and start the lesson?" yes="Start lesson" onYes={() => start(armed)} onNo={() => setArmed(null)} />
			) : (
				<LessonList content={content} onStart={(sc) => (fromTitle ? start(sc) : setArmed(sc))} />
			)}
		</div>
	);
}
