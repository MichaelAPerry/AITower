import type { ReactNode } from "react";

/** Rubber-stamp action button for paper forms. `hot` is the stamped wording shown on hover or focus. */
export function StampBtn({
	tone = "green",
	rest,
	hot,
	onClick,
	disabled,
	autoFocus,
	title,
}: {
	tone?: "green" | "red";
	rest: string;
	hot?: string;
	onClick: () => void;
	disabled?: boolean;
	autoFocus?: boolean;
	title?: string;
}) {
	return (
		// biome-ignore lint/a11y/noAutofocus: dialog action buttons deliberately take focus when the dialog opens
		<button type="button" className={`ui-stampbtn stamp-${tone}`} onClick={onClick} disabled={disabled} autoFocus={autoFocus} title={title} aria-label={rest}>
			<span className="rest">{rest}</span>
			<span className="hot">{hot ?? rest}</span>
		</button>
	);
}

/** Brass-knobbed fader in a groove, 0..1 style range input. */
export function Slider({
	value,
	min,
	max,
	step,
	onChange,
	label,
	readout,
}: {
	value: number;
	min: number;
	max: number;
	step: number;
	onChange: (v: number) => void;
	label: string;
	readout: string;
}) {
	return (
		<span className="ui-slider-wrap">
			<input
				type="range"
				className="ui-slider"
				min={min}
				max={max}
				step={step}
				value={value}
				aria-label={label}
				aria-valuetext={readout}
				onChange={(e) => onChange(Number(e.currentTarget.value))}
			/>
			<span className="ui-crt crt-amber ui-slider-read">{readout}</span>
		</span>
	);
}

/** One engraved setting row: label and hint on the left, the control on the right. */
export function SettingRow({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
	return (
		<div className="ui-setting">
			<div className="ui-setting-text">
				<span className="ui-setting-label">{label}</span>
				<span className="ui-setting-hint">{hint}</span>
			</div>
			<div className="ui-setting-ctl">{children}</div>
		</div>
	);
}

/** Inline confirmation bar (no window.confirm). */
export function ConfirmBar({ question, yes, onYes, onNo }: { question: string; yes: string; onYes: () => void; onNo: () => void }) {
	return (
		<div className="ui-confirm" role="alertdialog" aria-label={question}>
			<span className="ui-confirm-q">{question}</span>
			<span className="ui-confirm-acts">
				<StampBtn tone="red" rest={yes} onClick={onYes} autoFocus />
				<StampBtn tone="green" rest="Cancel" hot="Stand down" onClick={onNo} />
			</span>
		</div>
	);
}
