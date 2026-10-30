import type { ContentDB } from "@aitower/content";
import { loadLessonProgress } from "@aitower/shared";
import { ADVISORS } from "../advisors/advisors";
import { lessonsInOrder } from "./lessons";
import "./lessons.css";

/** The lessons that exist: each one starts (or replays) its lesson. Used by the title screen and the menu's Lessons section. */
export function LessonList({ content, onStart }: { content: ContentDB; onStart: (scenarioId: string) => void }) {
	const progress = loadLessonProgress();
	return (
		<ol className="les-list" aria-label="Lessons">
			{lessonsInOrder(content).map((def) => {
				const stars = progress.done[def.id];
				return (
					<li key={def.id} data-lesson-row={def.id}>
						<span className="les-n">{def.number}</span>
						<span>
							<b>{def.title}</b>
							<small>
								{ADVISORS[def.advisor].first} · {def.concept}
							</small>
						</span>
						<button type="button" className="ui-btn" data-start-lesson={def.id} onClick={() => onStart(def.scenario)}>
							{stars ? (def.starred === false ? "Replay ✓" : `Replay ${"★".repeat(stars)}`) : "Start"}
						</button>
					</li>
				);
			})}
		</ol>
	);
}
