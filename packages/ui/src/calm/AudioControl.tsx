import { useEffect, useRef, useState } from "react";
import type { PanelProps } from "../components/context";
import { PixelIcon } from "../icons/PixelIcon";

const pct = (v: number): string => `${Math.round(v * 100)}%`;

function Range({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
	return (
		<span className="ui-audio-ctl">
			<input type="range" className="ui-audio-range" min={0} max={1} step={0.05} value={value} aria-label={label} aria-valuetext={pct(value)} onChange={(e) => onChange(Number(e.currentTarget.value))} />
			<span className="ui-audio-read">{pct(value)}</span>
		</span>
	);
}

/**
 * The top strip's audio control: one icon button that mutes (key M), and a small arrow beside it that opens a popover with the three
 * volume sliders. It replaces the old AUDIO switch, which had no room at 1280 wide.
 */
export function AudioControl({ store, state }: Pick<PanelProps, "store" | "state">) {
	const { muted, settings } = state;
	const [open, setOpen] = useState(false);
	const root = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (!open) return;
		const onDown = (e: PointerEvent): void => {
			if (root.current && e.target instanceof Node && !root.current.contains(e.target)) setOpen(false);
		};
		// Capture phase: Esc closes the popover and goes no further (it must not also open the system menu).
		const onKey = (e: KeyboardEvent): void => {
			if (e.key !== "Escape") return;
			e.stopImmediatePropagation();
			setOpen(false);
		};
		document.addEventListener("pointerdown", onDown, true);
		window.addEventListener("keydown", onKey, true);
		return () => {
			document.removeEventListener("pointerdown", onDown, true);
			window.removeEventListener("keydown", onKey, true);
		};
	}, [open]);
	const set = (patch: Partial<typeof settings>): void => store.setSettings(patch);
	return (
		<div className="ui-audio" ref={root}>
			<button type="button" className={`ui-btn ui-audio-btn ${muted ? "is-muted" : ""}`} aria-pressed={!muted} aria-label={muted ? "Sound is off. Turn it on (M)" : "Sound is on. Mute (M)"} title={muted ? "Sound off. Click to unmute (M)" : "Sound on. Click to mute (M)"} onClick={() => store.setMuted(!muted)}>
				<PixelIcon name={muted ? "mute" : "sound"} />
			</button>
			<button type="button" className="ui-btn ui-audio-more" aria-expanded={open} aria-haspopup="true" aria-label="Volume" title="Volume" onClick={() => setOpen((o) => !o)}>
				<span aria-hidden="true">{open ? "▴" : "▾"}</span>
			</button>
			{open && (
				<fieldset className="ui-audio-pop ui-glass" aria-label="Volume">
					<div className="ui-audio-row">
						<span className="ui-label">MASTER</span>
						<Range label="Master volume" value={settings.masterVolume} onChange={(v) => set({ masterVolume: v })} />
					</div>
					<div className="ui-audio-row">
						<span className="ui-label">MUSIC</span>
						<Range label="Music volume" value={settings.musicVolume} onChange={(v) => set({ musicVolume: v })} />
					</div>
					<div className="ui-audio-row">
						<span className="ui-label">EFFECTS</span>
						<Range label="Effects volume" value={settings.sfxVolume} onChange={(v) => set({ sfxVolume: v })} />
					</div>
				</fieldset>
			)}
		</div>
	);
}
