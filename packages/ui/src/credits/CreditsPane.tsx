import { achievementContent, type ContentDB } from "@aitower/content";
import { citation, creditQuotes } from "./credits";
import { MUSIC_CREDIT, SONG_ORDER, SONGS } from "../title/titleMusic";
import "./credits.css";

const U = achievementContent.ui;

/** The credits: who made the game, then every quote in it with author and source. One section of the system menu; scrolls inside the menu. */
export function CreditsPane({ content }: { content?: ContentDB }) {
	const quotes = content ? creditQuotes(content) : [];
	return (
		<div className="cr-pane" data-pane="credits">
			<ul className="cr-lines">
				{[U.creditsDesign, U.creditsCode, U.creditsArt, U.creditsInspired, U.creditsFonts, U.creditsQuotes].map((l) => (
					<li key={l}>{l}</li>
				))}
			</ul>
			<ul className="cr-lines" data-credit-music>
				<li>{MUSIC_CREDIT}</li>
				{SONG_ORDER.map((id) => (
					<li key={id}>{`${SONGS[id].label}: ${SONGS[id].title}`}</li>
				))}
			</ul>
			<h4 className="cr-head">{U.creditsQuotesHead}</h4>
			<ul className="cr-quotes" data-credit-quotes>
				{quotes.map((q) => (
					<li key={`${q.kind}:${q.item}`} className="cr-quote">
						<blockquote>{`“${q.flavor.quote}”`}</blockquote>
						<p>{`— ${citation(q.flavor)}`}</p>
					</li>
				))}
			</ul>
		</div>
	);
}
