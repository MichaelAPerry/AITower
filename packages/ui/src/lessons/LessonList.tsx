import type { ContentDB } from "@aitower/content";
import { loadLessonProgress } from "@aitower/shared";
import { ADVISORS } from "../advisors/advisors";
import { playable, ROADMAP } from "./lessons";
import "./lessons.css";

/** The six lessons: playable ones start (or replay) the lesson, the rest say when they arrive. Used by the title screen and the menu's Lessons section. */
export function LessonList({ content, onStart }: { content: ContentDB; onStart: (scenarioId: string) => void }) {
	const progress = loadLessonProgress();
	return (
		<ol className="les-list" aria-label="Lessons">
			{ROADMAP.map((r) => {
				const def = playable(content, r.id);
				const stars = progress.done[r.id];
				return (
					<li key={r.id} className={def ? "" : "is-locked"} data-lesson-row={r.id}>
						<span className="les-n">{r.n}</span>
						<span>
							<b>{r.title}</b>
							<small>
								{ADVISORS[r.advisor].first} · {r.concept}
							</small>
						</span>
						{def ? (
							<button type="button" className="ui-btn" data-start-lesson={r.id} onClick={() => onStart(def.scenario)}>
								{stars ? `Replay ${"★".repeat(stars)}` : "Start"}
							</button>
						) : (
							<small>Coming soon</small>
						)}
					</li>
				);
			})}
		</ol>
	);
}
