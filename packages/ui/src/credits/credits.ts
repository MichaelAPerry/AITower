import { achievementContent, type ContentDB, type Flavor } from "@aitower/content";
import type { EndingId } from "@aitower/sim";
import { ENDING_SONGS } from "../gamemusic/sceneMusic";
import { CHAPTER_FLAVOR } from "../handbook/chapters";
import { MUSIC_CREDIT, SONG_ORDER, SONGS, type SongId } from "../title/titleMusic";

export interface CreditQuote {
	/** Where it appears: "Facility", "Research", "Bot" or "Handbook". */
	kind: string;
	/** The item it belongs to (a facility, tech node or bot name; a chapter id for the Handbook). */
	item: string;
	flavor: Flavor;
}

/** Every quote the game shows, read from the content data (and the Handbook epigraphs), so the credits never drift from the game. */
export function creditQuotes(content: ContentDB): CreditQuote[] {
	const out: CreditQuote[] = [];
	for (const d of Object.values(content.facilities)) if (d.flavor) out.push({ kind: "Facility", item: d.name, flavor: d.flavor });
	for (const n of content.tech) if (n.flavor) out.push({ kind: "Research", item: n.name, flavor: n.flavor });
	for (const b of Object.values(content.bots)) if (b.flavor) out.push({ kind: "Bot", item: b.name, flavor: b.flavor });
	for (const [id, flavor] of Object.entries(CHAPTER_FLAVOR)) out.push({ kind: "Handbook", item: id.replace(/^ch:/, ""), flavor });
	return out;
}

/** "Author, Source" for one quote. */
export const citation = (f: Flavor): string => (f.source ? `${f.author}, ${f.source}` : f.author);

/** The who-made-it lines, in order. The one source for the credits section and the ending roll. */
export function creditLines(): string[] {
	const U = achievementContent.ui;
	return [U.creditsDesign, U.creditsCode, U.creditsArt, U.creditsInspired, U.creditsFonts, U.creditsQuotes];
}

/** The who-made-it lines for the ending roll: the same as `creditLines()` minus the line about quotes, since the roll shows none. */
export function rollCreditLines(): string[] {
	const U = achievementContent.ui;
	return creditLines().filter((l) => l !== U.creditsQuotes);
}

/** The music lines: the credit, then one "Label: title" per song. */
export function musicCreditLines(): { id: SongId | null; text: string }[] {
	return [{ id: null, text: MUSIC_CREDIT }, ...SONG_ORDER.map((id) => ({ id, text: `${SONGS[id].label}: ${SONGS[id].title}` }))];
}

/** "Ending theme: <title as tagged>". */
export const endingThemeLine = (song: SongId): string => `Ending theme: ${SONGS[song].title}`;

/** The roll after a success ending: that tree's picture and ending song. Null for Absorbed, Bankrupt and anything else. */
export function rollFor(ending: EndingId): { tree: "lattice" | "flesh" | "garden"; song: SongId } | null {
	const song = ENDING_SONGS[ending];
	return song === "lattice" || song === "flesh" || song === "garden" ? { tree: song, song } : null;
}
