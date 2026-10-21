import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PanelProps } from "../components/context";
import { type HelpItem, helpFor } from "./helpText";
import { tipDelay, tipPos } from "./placement";
import "./help.css";

interface Tip {
	item: HelpItem;
	rect: { left: number; top: number; right: number; bottom: number };
}

const HIDE_MS = 220;

/**
 * The help tooltip. Elements opt in with `data-help="<key>"`. In help mode a hover shows the card at once, with a
 * "More..." link into the Encyclopedia; outside help mode only the top-strip stats show it, after a short delay.
 */
export function HelpLayer({ ui, setUi, scale }: Pick<PanelProps, "ui" | "setUi"> & { scale: number }) {
	const [tip, setTip] = useState<Tip | null>(null);
	const helpOn = !!ui.help;
	const helpRef = useRef(helpOn);
	helpRef.current = helpOn;
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const overCard = useRef(false);
	const cardRef = useRef<HTMLDivElement>(null);
	const hideSoon = useCallback((): void => {
		clearTimeout(timer.current);
		timer.current = setTimeout(() => {
			if (!overCard.current) setTip(null);
		}, HIDE_MS);
	}, []);

	useEffect(() => {
		const onOver = (e: MouseEvent): void => {
			const t = e.target;
			if (!(t instanceof Element)) return;
			if (t.closest(".ui-helpcard")) return;
			const el = t.closest("[data-help]");
			const item = el ? helpFor(el.getAttribute("data-help") ?? "") : null;
			if (!el || !item || !el.closest(".aitower-hud")) {
				hideSoon();
				return;
			}
			const inStrip = !!el.closest(".ui-strip");
			if (!helpRef.current && !inStrip) {
				hideSoon();
				return;
			}
			clearTimeout(timer.current);
			const r = el.getBoundingClientRect();
			const show = (): void => setTip({ item, rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom } });
			const d = tipDelay(helpRef.current);
			if (d === 0) show();
			else timer.current = setTimeout(show, d);
		};
		document.addEventListener("mouseover", onOver);
		return () => {
			document.removeEventListener("mouseover", onOver);
			clearTimeout(timer.current);
		};
	}, [hideSoon]);

	// Leaving help mode drops any open card that offered the link.
	useEffect(() => {
		if (!helpOn) setTip(null);
	}, [helpOn]);

	const host = typeof document === "undefined" ? null : document.querySelector(".aitower-hud");
	if (!tip || !host) return null;
	const pos = tipPos(tip.rect, { w: 260, h: cardRef.current?.offsetHeight ?? 90 }, window.innerWidth, window.innerHeight, scale);
	return createPortal(
		<div
			ref={cardRef}
			className="ui-helpcard"
			role="tooltip"
			style={{ left: pos.left, top: pos.top }}
			onMouseEnter={() => {
				overCard.current = true;
				clearTimeout(timer.current);
			}}
			onMouseLeave={() => {
				overCard.current = false;
				hideSoon();
			}}
		>
			<b>{tip.item.title}</b>
			<p>{tip.item.text}</p>
			{helpOn && (
				<button
					type="button"
					onClick={() => {
						setUi({ drawer: "handbook", encyId: tip.item.entry, paletteOpen: false });
						setTip(null);
					}}
				>
					More…
				</button>
			)}
		</div>,
		host,
	);
}
