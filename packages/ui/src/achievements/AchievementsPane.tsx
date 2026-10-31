import { achievementContent, type GalleryAdvisor } from "@aitower/content";
import { loadProfile, markProfileFlag } from "@aitower/shared";
import { useEffect, useState } from "react";
import { ADVISORS } from "../advisors/advisors";
import { OFF_DUTY, PORTRAITS } from "../art";
import { AchIcon } from "./AchIcon";
import { GalleryScene } from "./GalleryScene";
import { autoScene, counter, type Frame, frames, listRows, lockedLook, sceneById, sceneIdFor } from "./gallery";
import { LockedHead } from "./LockedHead";
import "./achievements.css";

const U = achievementContent.ui;

type Page = "list" | "offduty";

interface Playing {
	sceneId: string;
	frame?: Frame;
}

/** The achievements list and the off-duty gallery: one section of the system menu (title screen and pause menu). */
export function AchievementsPane() {
	const [page, setPage] = useState<Page>("list");
	const [rev, setRev] = useState(0); // re-read the profile after a scene marks something seen
	const [playing, setPlaying] = useState<Playing | null>(null);
	const profile = loadProfile();
	void rev;

	// Opening the gallery plays its one-time moments: the bed intro when the 18th has landed, else the "nothing yet" line.
	useEffect(() => {
		if (page !== "offduty") return;
		const id = autoScene(loadProfile());
		if (id) setPlaying({ sceneId: id });
	}, [page]);

	const done = (): void => {
		if (playing?.sceneId === "ach_bed_intro" || playing?.sceneId === "ach_gallery_empty") markProfileFlag("scenesSeen", playing.sceneId);
		setPlaying(null);
		setRev((n) => n + 1);
	};

	return (
		<div className="ach-pane" data-pane="achievements">
			<div className="ach-head">
				<div className="ach-tabs" role="tablist" aria-label={U.ariaPages}>
					<button type="button" role="tab" aria-selected={page === "list"} className={`ui-btn ${page === "list" ? "is-go" : ""}`} onClick={() => setPage("list")}>
						{U.tabList}
					</button>
					<button type="button" role="tab" aria-selected={page === "offduty"} className={`ui-btn ${page === "offduty" ? "is-go" : ""}`} onClick={() => setPage("offduty")}>
						{U.tabOffDuty}
					</button>
				</div>
				<span className="ach-count" data-ach-count>
					{counter(profile)}
				</span>
			</div>
			{page === "list" ? <List /> : <Gallery onPlay={(sceneId, frame) => setPlaying({ sceneId, frame })} />}
			<p className="ach-note">{U.note}</p>
			{playing && <Playback playing={playing} onClose={done} />}
		</div>
	);
}

function List() {
	const rows = listRows(loadProfile());
	return (
		<ul className="ach-list" aria-label={U.ariaList}>
			{rows.map((r) => (
				<li key={r.id} className={`ach-row ${r.earned ? "is-earned" : "is-locked"} ${r.hidden ? "is-hidden" : ""}`} data-ach={r.id} data-earned={r.earned || undefined}>
					<AchIcon icon={r.def.icon} scale={2} locked={!r.earned} hidden={r.hidden} />
					<span className="ach-body">
						<b className="ach-name">{r.name}</b>
						<span className="ach-text">{r.text}</span>
					</span>
					<span className="ach-when">{r.earned ? <><span className="ach-check" title={U.earnedMark}>{"✓"}</span> {r.when}</> : ""}</span>
				</li>
			))}
		</ul>
	);
}

export function Gallery({ onPlay }: { onPlay: (sceneId: string, frame: Frame) => void }) {
	const { casual, bed, bedOpen } = frames(loadProfile());
	return (
		<div className="ach-gallery">
			<h3 className="ach-sub">{U.subOffDuty}</h3>
			<div className="ach-frames" data-set="casual">
				{casual.map((f) => (
					<FrameCard key={f.advisor} frame={f} onPlay={onPlay} />
				))}
			</div>
			<h3 className="ach-sub">{U.subAfterHours}</h3>
			<div className="ach-frames" data-set="bed" data-open={bedOpen || undefined}>
				{bed.map((f) => (
					<FrameCard key={f.advisor} frame={f} onPlay={onPlay} />
				))}
			</div>
		</div>
	);
}

function FrameCard({ frame: f, onPlay }: { frame: Frame; onPlay: (sceneId: string, frame: Frame) => void }) {
	const text = achievementContent.offDuty[f.advisor];
	const adv = ADVISORS[f.advisor];
	const style = { ["--adv" as string]: adv.color };
	// The bed set stays four blank frames labelled "???" until the 18th achievement.
	if (f.set === "bed" && !f.unlocked)
		return (
			<div className="ach-frame is-blank" style={style} data-frame={`${f.set}:${f.advisor}`}>
				<span className="ach-blank">{U.hiddenName}</span>
			</div>
		);
	return (
		<button type="button" className={`ach-frame ${f.unlocked ? "is-open" : "is-locked"}`} style={style} data-frame={`${f.set}:${f.advisor}`} data-unlocked={f.unlocked || undefined} onClick={() => onPlay(sceneIdFor(f), f)}>
			{f.unlocked ? <img src={OFF_DUTY[f.advisor][f.set]} alt={`${adv.first}, ${U.altOffDuty}`} draggable={false} /> : <LockedHead src={PORTRAITS[f.advisor].neutral} look={lockedLook(f.advisor)} alt={`${adv.first}, ${U.altLocked}`} />}
			<span className="ach-frame-name">{adv.first}</span>
			{f.set === "casual" && (f.unlocked ? <span className="ach-frame-line">{text.caption}</span> : <span className="ach-frame-line">{text.hint}</span>)}
			{f.showRule && <span className="ach-frame-rule">{text.rule}</span>}
		</button>
	);
}

function Playback({ playing, onClose }: { playing: Playing; onClose: () => void }) {
	const scene = sceneById(playing.sceneId);
	const f = playing.frame;
	const advisor: GalleryAdvisor | undefined = f?.advisor;
	const figure = f && advisor ? { src: f.unlocked ? OFF_DUTY[advisor][f.set] : PORTRAITS[advisor].neutral, dim: !f.unlocked, look: f.unlocked ? undefined : lockedLook(advisor), alt: ADVISORS[advisor].first } : undefined;
	// A casual unlock scene ends on her caption (its last line), in her voice.
	return <GalleryScene scene={scene} figure={figure} onClose={onClose} />;
}
