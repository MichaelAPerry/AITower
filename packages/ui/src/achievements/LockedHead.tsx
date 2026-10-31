import { achievementContent } from "@aitower/content";
import type { CSSProperties } from "react";
import type { LockedLook } from "./gallery";

/**
 * A locked portrait: only the head (a CSS crop of the bust, dimmed, fading out below the neck), never the whole picture.
 * A look of "hide" is a lock tile with no picture at all.
 */
export function LockedHead({ src, look, alt }: { src: string; look: LockedLook; alt: string }) {
	if (look === "hide")
		return (
			<span className="ach-lock-tile" role="img" aria-label={alt} data-crop="hide">
				{achievementContent.ui.hiddenName}
			</span>
		);
	const style = { ["--cx" as string]: look.x, ["--cy" as string]: look.y, ["--cw" as string]: look.w, ["--ch" as string]: look.h, aspectRatio: `${look.w} / ${look.h}` } as CSSProperties;
	return (
		<span className="ach-head" style={style} data-crop="head">
			<img src={src} alt={alt} draggable={false} />
		</span>
	);
}
