/** In-game music: which song a visual-novel scene gets, and which song the game wants right now. Pure; docs/MUSIC_MAP.md lists the result. */
import { useEffect, useSyncExternalStore } from "react";
import type { EndingId, GameOverKind } from "@aitower/sim";
import type { SongId } from "../title/titleMusic";

export type SceneTrack = "warm" | "quiet";

/** Exact scene id -> track. Wins over the prefix rules; add a line here to move one scene. */
export const SCENE_OVERRIDES: Readonly<Record<string, SceneTrack>> = {
	ach_bed_intro: "warm", // the 18th achievement lands: a celebration, though the other bed scenes are late-night
};

/** First matching prefix wins. Tense, closing, late-night and empty/unreached -> quiet. */
export const SCENE_RULES: ReadonlyArray<{ prefix: string; track: SceneTrack }> = [
	{ prefix: "obj_", track: "quiet" }, // an advisor objects to a placement
	{ prefix: "seal_", track: "quiet" }, // a tree closes for good
	{ prefix: "tip_seal", track: "quiet" },
	{ prefix: "cass_night_shift", track: "quiet" },
	{ prefix: "ach_bed_", track: "quiet" }, // after hours
	{ prefix: "ach_gallery_empty", track: "quiet" },
	{ prefix: "ach_hint_", track: "quiet" }, // a locked frame: "not there yet"
];
/** Everything else (introduction, retrofit milestones, off-duty portraits) is warm. */
export const DEFAULT_SCENE_TRACK: SceneTrack = "warm";

export function trackForScene(id: string): SceneTrack {
	const o = SCENE_OVERRIDES[id];
	if (o) return o;
	return SCENE_RULES.find((r) => id.startsWith(r.prefix))?.track ?? DEFAULT_SCENE_TRACK;
}

/** Which song each success ending plays (the Lattice tree's ending id is "singularity"). */
export const ENDING_SONGS: Readonly<Partial<Record<EndingId, SongId>>> = { singularity: "lattice", flesh: "flesh", garden: "garden" };

/** The song for a game-over screen: the tree's ending song for a success ending, the quiet scene song for Absorbed and Bankrupt, else silence. */
export function overSong(over: { kind: GameOverKind; ending?: EndingId }): SongId | null {
	const id: EndingId | undefined = over.ending ?? (over.kind === "absorbed" || over.kind === "bankrupt" ? over.kind : undefined);
	if (!id) return null;
	return ENDING_SONGS[id] ?? (id === "absorbed" || id === "bankrupt" ? "quiet" : null);
}

/**
 * The song the game wants: nothing on the title; on a game-over / ending screen its song (kept while the menu or credits open over it);
 * a scene's song while a scene is open; else the tower loop.
 */
export function wantedSong(s: { active: boolean; sceneId: string | null; over?: { kind: GameOverKind; ending?: EndingId } | null }): SongId | null {
	if (!s.active) return null;
	if (s.over) return overSong(s.over);
	return s.sceneId ? trackForScene(s.sceneId) : "tower";
}

// A tiny store of the scenes currently open (a stack: closing one restores the one below).
const open: string[] = [];
const listeners = new Set<() => void>();
const emit = (): void => {
	for (const l of listeners) l();
};
/** Mark a scene as open; returns the function that closes it. */
export function enterScene(id: string): () => void {
	open.push(id);
	emit();
	return () => {
		const i = open.lastIndexOf(id);
		if (i >= 0) open.splice(i, 1);
		emit();
	};
}
export const currentScene = (): string | null => open[open.length - 1] ?? null;
export const useCurrentScene = (): string | null =>
	useSyncExternalStore(
		(cb) => {
			listeners.add(cb);
			return () => listeners.delete(cb);
		},
		currentScene,
		() => null,
	);
/** Call from a scene component: while it is mounted, the scene's song plays. */
export function useSceneMusic(id: string): void {
	useEffect(() => enterScene(id), [id]);
}
