import type { GalleryScene as Scene } from "@aitower/content";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { ADVISORS } from "../advisors/advisors";
import { type LockedLook, pagesOf } from "./gallery";
import { LockedHead } from "./LockedHead";
import "../vn/vn.css";
import "./achievements.css";

const TYPE_CPS = 55;
const prefersReduced = (): boolean => {
	try {
		return typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
	} catch {
		return false;
	}
};

export interface GalleryFigure {
	src: string;
	/** A locked frame's bust, dimmed. */
	dim?: boolean;
	/** With `dim`: the head crop (or "hide") a locked portrait is limited to. */
	look?: LockedLook;
	alt: string;
}

/**
 * A short gallery moment: the portrait standing in front of the plain stage, the scene's lines in the dialogue box (click, Enter
 * or Space to go on), and `onClose` after the last. Esc closes it without closing the menu behind.
 */
export function GalleryScene({ scene, figure, onClose }: { scene: Scene; figure?: GalleryFigure; onClose: () => void }) {
	const pages = pagesOf(scene);
	const [i, setI] = useState(0);
	const [shown, setShown] = useState(0);
	const root = useRef<HTMLDivElement>(null);
	const page = pages[i];
	const full = page?.text ?? "";
	const typing = shown < full.length;
	const speaker = page && page.who !== "narrator" ? ADVISORS[page.who] : null;

	useEffect(() => root.current?.focus(), []);
	// biome-ignore lint/correctness/useExhaustiveDependencies: a new page restarts the typewriter
	useEffect(() => setShown(prefersReduced() ? Number.POSITIVE_INFINITY : 0), [i]);
	useEffect(() => {
		if (!typing || prefersReduced()) return;
		const t = setInterval(() => setShown((n) => n + 1), 1000 / TYPE_CPS);
		return () => clearInterval(t);
	}, [typing]);

	const advance = (): void => {
		if (typing) setShown(Number.POSITIVE_INFINITY);
		else if (i + 1 < pages.length) setI(i + 1);
		else onClose();
	};
	const onKey = (e: KeyboardEvent<HTMLDivElement>): void => {
		e.stopPropagation(); // nothing reaches the menu behind or the game hotkeys
		if (e.key === "Escape") {
			e.preventDefault();
			onClose();
		} else if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
			e.preventDefault();
			advance();
		}
	};

	return (
		<div className="vn-stage is-plain gal-scene" ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label={scene.title} data-scene={scene.id} onKeyDown={onKey} onClick={advance}>
			<div className="vn-caption">
				<span>{scene.location}</span>
				<b>{scene.title}</b>
			</div>
			{figure && (
				<div className={`gal-figure ${figure.dim ? "is-dim" : ""} ${figure.dim && figure.look ? "is-head" : ""}`} style={{ ["--adv" as string]: speaker?.color ?? "var(--pc-rule)" }}>
					{figure.dim && figure.look ? <LockedHead src={figure.src} look={figure.look} alt={figure.alt} /> : <img src={figure.src} alt={figure.alt} draggable={false} />}
				</div>
			)}
			{page && (
				<div className="vn-box" style={{ ["--adv" as string]: speaker?.color ?? "var(--pc-rule)" }}>
					<div className={`vn-name ${speaker ? "" : "is-narrator"}`}>{speaker ? speaker.name : `${i + 1} / ${pages.length}`}</div>
					<p className={`vn-text ${speaker ? "" : "is-narrator"}`}>
						{full.slice(0, Number.isFinite(shown) ? shown : full.length)}
						{!typing && (
							<span className="vn-more" aria-hidden="true">
								{i + 1 < pages.length ? "▼" : "■"}
							</span>
						)}
					</p>
				</div>
			)}
		</div>
	);
}
