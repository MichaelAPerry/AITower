import type { FacilityStatus } from "@aitower/sim";
import type { ReactNode } from "react";
import { clamp01 } from "../format";

export type Tone = "good" | "warn" | "error" | "info" | "dim" | "cyan";

export const statusTone: Record<FacilityStatus, Tone> = {
	ok: "good",
	idle: "dim",
	disabled: "dim",
	unpowered: "error",
	brownout: "warn",
	noCoolant: "error",
	throttled: "warn",
	tripped: "error",
	failed: "error",
};

export const statusLabel: Record<FacilityStatus, string> = {
	ok: "online",
	idle: "idle",
	disabled: "disabled",
	unpowered: "no power",
	brownout: "brownout",
	noCoolant: "no coolant",
	throttled: "throttled",
	tripped: "tripped",
	failed: "failed",
};

/**
 * Small stamped tag. `status` marks a true status indicator: with colour-blind mode on it gains a glyph
 * (✓ good, ▲ warn, ✕ error, ○ dim) so it never relies on colour alone.
 */
export function Pill({ tone, children, status = false }: { tone: Tone; children: ReactNode; status?: boolean }) {
	return <span className={`ui-pill tone-${tone} ${status ? "is-status" : ""}`}>{children}</span>;
}

/** Segmented phosphor VU bar, 0..1. */
export function Meter({ value, tone = "cyan", height = 8 }: { value: number; tone?: Tone; height?: number }) {
	return (
		<div className={`ui-meter tone-${tone}`} style={{ height }}>
			<div className="ui-meter-fill" style={{ width: `${clamp01(value) * 100}%` }} />
		</div>
	);
}

/** Inset CRT screen: dark glass, phosphor glow, scanlines and a curved inner shadow. */
export function Crt({ tone = "amber", className = "", children, title }: { tone?: "amber" | "green" | "red"; className?: string; children: ReactNode; title?: string }) {
	return (
		<div className={`ui-crt crt-${tone} ${className}`} title={title}>
			{children}
		</div>
	);
}

/**
 * Round indicator lamp with a glow halo. Status lamps gain a glyph in colour-blind mode (✓ green, ▲ amber,
 * ✕ red, ○ unlit); `plain` lamps (progress or switch indicators) never do.
 */
export function Lamp({ on, tone = "amber", blink = false, plain = false }: { on: boolean; tone?: "amber" | "green" | "red"; blink?: boolean; plain?: boolean }) {
	return <span className={`ui-lamp lamp-${tone} ${on ? "is-lit" : ""} ${on && blink ? "is-blink" : ""} ${plain ? "is-plain" : ""}`} aria-hidden="true" />;
}

/** Mechanical bat-handle toggle switch with ON/OFF engraving. Lever up = on. */
export function Toggle({
	on,
	onClick,
	label,
	title,
	role = "switch",
	lamp,
	className = "",
	children,
}: {
	on: boolean;
	onClick: () => void;
	label?: ReactNode;
	title?: string;
	role?: "switch" | "radio";
	lamp?: "amber" | "green" | "red";
	className?: string;
	children?: ReactNode;
}) {
	return (
		// biome-ignore lint/a11y/useAriaPropsSupportedByRole: role is switch or radio (both support aria-checked); the lint cannot see through the prop
		<button type="button" role={role} aria-checked={on} className={`ui-toggle ${on ? "is-on" : "is-off"} ${className}`} onClick={onClick} title={title}>
			{lamp && <Lamp on={on} tone={lamp} plain />}
			<span className="ui-toggle-plate" aria-hidden="true">
				<span className="ui-toggle-eng on">ON</span>
				<span className="ui-toggle-nut" />
				<span className="ui-toggle-lever" />
				<span className="ui-toggle-eng off">OFF</span>
			</span>
			{label !== undefined && <span className="ui-toggle-label">{label}</span>}
			{children}
		</button>
	);
}

/** Rubber-stamp impression. */
export function Stamp({ tone = "red", children, className = "" }: { tone?: "red" | "green" | "amber" | "ink"; children: ReactNode; className?: string }) {
	return <span className={`ui-stamp stamp-${tone} ${className}`}>{children}</span>;
}

/** Mechanical drum counter: each character on its own wheel. */
export function Counter({ text, className = "" }: { text: string; className?: string }) {
	return (
		// biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-label on a text span reads the whole counter as one string; the per-character wheels are decorative
		<span className={`ui-counter ${className}`} aria-label={text}>
			{Array.from(text).map((ch, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: characters are positional wheels with no identity beyond their index
				<span key={i} className={/[0-9]/.test(ch) ? "d" : "s"}>
					{ch}
				</span>
			))}
		</span>
	);
}

/** Typewritten form-title strip riveted onto a housing, e.g. "FORM AT-7 · CONTRACT REQUISITION". */
export function FormLabel({ form, children }: { form?: string; children: ReactNode }) {
	return (
		<span className="ui-formlabel">
			{form && <span className="ui-formlabel-no">{form}</span>}
			<span className="ui-formlabel-text">{children}</span>
		</span>
	);
}

/** Facility colour chip (body + accent stripe), the HUD's stand-in for pixel-art icons. */
export function Swatch({ color, accent, size = 22 }: { color: string; accent: string; size?: number }) {
	return (
		<span className="ui-swatch" style={{ width: size, height: size, background: color }}>
			<span style={{ background: accent }} />
			<span style={{ background: accent }} />
			<span style={{ background: accent }} />
		</span>
	);
}

export function Row({ k, children }: { k: string; children: ReactNode }) {
	return (
		<div className="ui-row">
			<span className="ui-k">{k}</span>
			<span className="ui-v">{children}</span>
		</div>
	);
}

type IconName = "lock" | "close" | "chevUp" | "chevDown" | "sound" | "mute" | "pause" | "play" | "slab" | "bolt" | "drop" | "lift" | "demolish" | "pointer" | "star";

const paths: Record<IconName, ReactNode> = {
	lock: (
		<>
			<rect x="3" y="7" width="10" height="7" rx="1" />
			<path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" />
		</>
	),
	close: <path d="M4 4l8 8M12 4l-8 8" fill="none" />,
	chevUp: <path d="M4 10l4-4 4 4" fill="none" />,
	chevDown: <path d="M4 6l4 4 4-4" fill="none" />,
	sound: (
		<>
			<path d="M2 6h3l4-3v10l-4-3H2z" />
			<path d="M11 5.5a3.5 3.5 0 0 1 0 5M12.5 3.5a6 6 0 0 1 0 9" fill="none" />
		</>
	),
	mute: (
		<>
			<path d="M2 6h3l4-3v10l-4-3H2z" />
			<path d="M11 6l4 4M15 6l-4 4" fill="none" />
		</>
	),
	pause: (
		<>
			<rect x="4" y="3" width="3" height="10" />
			<rect x="9" y="3" width="3" height="10" />
		</>
	),
	play: <path d="M5 3l8 5-8 5z" />,
	slab: (
		<>
			<rect x="1" y="9" width="14" height="3" />
			<path d="M3 9V5h10v4" fill="none" />
		</>
	),
	bolt: <path d="M9 1L3 9h4l-1 6 6-8H8z" />,
	drop: <path d="M8 1.5C8 1.5 3 7 3 10a5 5 0 0 0 10 0c0-3-5-8.5-5-8.5z" />,
	lift: (
		<>
			<rect x="3" y="1.5" width="10" height="13" fill="none" />
			<path d="M8 4l2 2.5H6zM8 12l2-2.5H6z" />
		</>
	),
	demolish: <path d="M2 14l6-6M7 3l6 6-2 2-6-6zM10 2l4 4" fill="none" />,
	pointer: <path d="M3 2l9 5-4 1.2L10.5 13 9 13.8 6.6 9 3 11z" />,
	star: <path d="M8 1.5l1.9 4.1 4.5.5-3.4 3 1 4.4L8 11.3l-4 2.2 1-4.4-3.4-3 4.5-.5z" />,
};

export function Icon({ name, size = 14 }: { name: IconName; size?: number }) {
	return (
		<svg
			className="ui-icon"
			width={size}
			height={size}
			viewBox="0 0 16 16"
			fill="currentColor"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			{paths[name]}
		</svg>
	);
}

/** Small "key" hint chip, e.g. <Kbd>H</Kbd>. */
export function Kbd({ children }: { children: ReactNode }) {
	return <kbd className="ui-kbd">{children}</kbd>;
}
