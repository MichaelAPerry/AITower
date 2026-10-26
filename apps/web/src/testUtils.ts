import { type ContentDB, loadContent } from "@aitower/content";
import type { AudioEngine, RenderOptions, Renderer } from "@aitower/shared";
import type { KeyValueStorage } from "./saveBackend";

export function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { data: Map<string, string> } {
	const data = new Map(Object.entries(initial));
	return {
		data,
		getItem: (k) => data.get(k) ?? null,
		setItem: (k, v) => {
			data.set(k, v);
		},
		removeItem: (k) => {
			data.delete(k);
		},
	};
}

export function fakeAudio() {
	const calls: string[] = [];
	const audio: AudioEngine = {
		resume: async () => {},
		update: () => {},
		setMuted: (m) => calls.push(`muted:${m}`),
		setVolume: (v) => calls.push(`volume:${v}`),
		setMusicVolume: (v) => calls.push(`music:${v}`),
		setHorrorIntensity: (i) => calls.push(`horror:${i}`),
		destroy: () => {},
	};
	return { audio, calls };
}

export function fakeRenderer() {
	const options: RenderOptions[] = [];
	const renderer = {
		draw: () => {},
		setOverlay: () => {},
		pushEvents: () => {},
		setGhost: () => {},
		setSelection: () => {},
		focus: () => {},
		onPointer: () => () => {},
		setOptions: (o: RenderOptions) => options.push(o),
		resize: () => {},
		destroy: () => {},
	} satisfies Renderer;
	return { renderer, options };
}

/** The bundled content without story scenes (they pause the clock at their own moments; most app tests are about something else). */
export function contentWithoutStory(): ContentDB {
	const c = loadContent();
	c.events = c.events.filter((e) => e.category !== "story");
	return c;
}
