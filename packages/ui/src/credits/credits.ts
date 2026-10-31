import type { ContentDB, Flavor } from "@aitower/content";
import { CHAPTER_FLAVOR } from "../handbook/chapters";

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
