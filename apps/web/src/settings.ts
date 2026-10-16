import { DEFAULT_SETTINGS, type Settings, normalizeSettings } from "@aitower/shared";
import type { KeyValueStorage } from "./saveBackend";

export const SETTINGS_KEY = "aitower.settings.v1";

/** True when the OS asks for reduced motion. Safe outside a browser. */
export function systemPrefersReducedMotion(): boolean {
	try {
		return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
	} catch {
		return false;
	}
}

/**
 * Read stored settings. Nothing stored (or unreadable garbage) gives the defaults, with `reducedMotion` taken
 * from the OS preference.
 */
export function loadSettings(storage: KeyValueStorage | null, prefersReducedMotion: boolean): Settings {
	let raw: unknown;
	try {
		const text = storage?.getItem(SETTINGS_KEY);
		if (text != null) raw = JSON.parse(text);
	} catch {
		raw = undefined;
	}
	if (raw === undefined || raw === null || typeof raw !== "object") return { ...DEFAULT_SETTINGS, reducedMotion: prefersReducedMotion };
	return normalizeSettings(raw);
}

/** Best-effort write; returns false when storage is unavailable or full. */
export function persistSettings(storage: KeyValueStorage | null, settings: Settings): boolean {
	try {
		storage?.setItem(SETTINGS_KEY, JSON.stringify(settings));
		return storage != null;
	} catch {
		return false;
	}
}

/** Merge a patch (ignoring undefined values) into current settings and normalise. */
export function mergeSettings(current: Settings, patch: Partial<Settings>): Settings {
	const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
	return normalizeSettings({ ...current, ...defined });
}
