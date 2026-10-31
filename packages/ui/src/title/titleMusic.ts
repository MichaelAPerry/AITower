/** Title-screen music: which song plays for what the title shows, the volume, and a small fading player. The mp3 files load only when the first one is needed. */
import type { Settings } from "@aitower/shared";
import type { TitleEndingTree } from "./titleState";

export type SongId = "title" | TitleEndingTree | "tower" | "warm" | "quiet";

/** Song titles are exactly as tagged in the files (owner decision). */
export const SONGS: Record<SongId, { title: string; label: string; load: () => Promise<string> }> = {
	title: { title: "まだ見ぬ世界へ", label: "Title", load: async () => (await import("../music/title.mp3")).default },
	garden: { title: "君の明日が晴れますように", label: "Garden", load: async () => (await import("../music/garden.mp3")).default },
	lattice: { title: "銀のホーム", label: "Lattice", load: async () => (await import("../music/lattice.mp3")).default },
	flesh: { title: "雨のしずく", label: "Flesh", load: async () => (await import("../music/flesh.mp3")).default },
	tower: { title: "深夜のゲーム", label: "Tower", load: async () => (await import("../music/tower.mp3")).default },
	warm: { title: "夕陽のメロディ", label: "Warm scenes", load: async () => (await import("../music/warm.mp3")).default },
	quiet: { title: "Noctune FM", label: "Quiet scenes", load: async () => (await import("../music/quiet.mp3")).default },
};
export const SONG_ORDER: readonly SongId[] = ["title", "garden", "lattice", "flesh", "tower", "warm", "quiet"];
export const MUSIC_CREDIT = "Music: Perry, made with Suno.";

/** The normal title plays the title song; an ending picture plays that tree's song. */
export const songFor = (ending: TitleEndingTree | undefined): SongId => ending ?? "title";

/** 0..1 playback level: master x music, silent when muted. */
export function musicLevel(s: Pick<Settings, "masterVolume" | "musicVolume" | "muted">): number {
	if (s.muted) return 0;
	return Math.min(1, Math.max(0, s.masterVolume * s.musicVolume));
}

const FADE_MS = 600;

/** Plays one looping song at a time with fades. Nothing is fetched or created until `play` is first called (after a user gesture). */
export function createTitleMusic() {
	let el: HTMLAudioElement | null = null;
	let current: SongId | null = null;
	let level = 0;
	let wanted: SongId | null = null;
	let token = 0;
	/** Where each song was left, so a song that fades out and comes back (the tower loop around a scene) resumes instead of restarting. */
	const resume = new Map<SongId, number>();

	const fade = (a: HTMLAudioElement, to: number, ms: number, done?: () => void): void => {
		const from = a.volume;
		const t0 = Date.now();
		const id = setInterval(() => {
			const k = ms <= 0 ? 1 : Math.min(1, (Date.now() - t0) / ms);
			a.volume = Math.min(1, Math.max(0, from + (to - from) * k));
			if (k >= 1) {
				clearInterval(id);
				done?.();
			}
		}, 40);
	};
	const start = (a: HTMLAudioElement): void => {
		try {
			void Promise.resolve(a.play()).catch(() => {});
		} catch {
			/* no audio output here */
		}
	};
	const retire = (a: HTMLAudioElement): void =>
		fade(a, 0, FADE_MS, () => {
			a.pause();
			a.removeAttribute("src");
		});
	/** Follow the volume settings; silent means paused (iOS ignores the volume property). */
	const setLevel = (lvl: number): void => {
		level = lvl;
		const a = el;
		if (!a) return;
		if (lvl <= 0) {
			a.volume = 0;
			a.pause();
		} else {
			if (a.paused) start(a);
			a.volume = lvl;
		}
	};

	return {
		/** Start or switch to a song at the given level. A browser that blocks playback is ignored; the next call retries. */
		async play(song: SongId, lvl: number): Promise<void> {
			wanted = song;
			level = lvl;
			if (typeof Audio === "undefined") return;
			if (current === song && el) {
				setLevel(lvl);
				return;
			}
			const my = ++token;
			let url: string;
			try {
				url = await SONGS[song].load();
			} catch {
				return;
			}
			if (my !== token || wanted !== song) return;
			if (el) {
				if (current) resume.set(current, el.currentTime || 0);
				retire(el);
			}
			const a = new Audio();
			a.loop = true;
			a.preload = "auto";
			a.volume = 0;
			a.src = url;
			const at = resume.get(song) ?? 0;
			if (at > 0)
				a.addEventListener(
					"loadedmetadata",
					() => {
						try {
							a.currentTime = a.duration > 0 ? at % a.duration : at;
						} catch {
							/* not seekable yet */
						}
					},
					{ once: true },
				);
			el = a;
			current = song;
			if (level > 0) {
				start(a);
				fade(a, level, FADE_MS);
			}
		},
		setLevel,
		/** Fade out and release (leaving the title for a game). */
		stop(): void {
			token++;
			wanted = null;
			current = null;
			const a = el;
			el = null;
			if (a) retire(a);
		},
	};
}
