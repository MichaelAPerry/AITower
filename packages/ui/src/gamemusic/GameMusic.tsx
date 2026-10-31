import { useEffect, useRef, useState } from "react";
import type { EndingId, GameOverKind } from "@aitower/sim";
import { createTitleMusic } from "../title/titleMusic";
import { useCurrentScene, wantedSong } from "./sceneMusic";

/**
 * Plays the tower loop during the game and crossfades to the open scene's song and back (the player fades one out while the next fades in).
 * Silent while `active` is false (title). On an ending screen (`over`) it plays that ending's song and keeps it through the menu / credits opened on top. `level` is master x music, 0 when muted. Starts on the first click or key.
 */
export function GameMusic({ active, over, level }: { active: boolean; over?: { kind: GameOverKind; ending?: EndingId } | null; level: number }) {
	const sceneId = useCurrentScene();
	const song = wantedSong({ active, sceneId, over });
	const player = useRef<ReturnType<typeof createTitleMusic> | null>(null);
	const levelRef = useRef(level);
	levelRef.current = level;
	const [gesture, setGesture] = useState(false);
	useEffect(() => {
		if (gesture) return;
		const go = () => setGesture(true);
		window.addEventListener("pointerdown", go, true);
		window.addEventListener("keydown", go, true);
		return () => {
			window.removeEventListener("pointerdown", go, true);
			window.removeEventListener("keydown", go, true);
		};
	}, [gesture]);
	useEffect(() => {
		if (!gesture) return;
		if (song === null) {
			player.current?.stop();
			return;
		}
		player.current ??= createTitleMusic();
		void player.current.play(song, levelRef.current);
	}, [gesture, song]);
	useEffect(() => {
		player.current?.setLevel(level);
	}, [level]);
	useEffect(
		() => () => {
			player.current?.stop();
			player.current = null;
		},
		[],
	);
	return null;
}
