import type { ContentDB } from "@aitower/content";
import type { GameStore } from "@aitower/shared";
import { useCallback, useEffect, useState } from "react";
import { BottomPanel } from "./components/BottomPanel";
import { BuildPalette } from "./components/BuildPalette";
import type { PanelProps, UiState } from "./components/context";
import { Inspector } from "./components/Inspector";
import { OverlaySwitcher } from "./components/OverlaySwitcher";
import { Toasts } from "./components/Toasts";
import { TopBar } from "./components/TopBar";
import { Tutorial } from "./tutorial/Tutorial";
import { useGameState } from "./hooks";
import { useHudKeyboard } from "./keyboard";
import "./ui.css";

export interface HudProps {
	store: GameStore;
	content: ContentDB;
}

/** The whole HUD, absolutely positioned over the world canvas; empty areas let pointer events through. */
export function Hud({ store, content }: HudProps) {
	const state = useGameState(store);
	const [ui, setUiState] = useState<UiState>({ bottomTab: "contracts", bottomOpen: true, focusJobId: null, alertsSeenTick: -1 });
	const setUi = useCallback((patch: Partial<UiState>) => setUiState((u) => ({ ...u, ...patch })), []);
	useHudKeyboard(
		store,
		useCallback(() => setUiState((u) => ({ ...u, bottomOpen: !u.bottomOpen })), []),
	);

	const alertsOpen = ui.bottomOpen && ui.bottomTab === "alerts";
	const tick = state.view.tick;
	useEffect(() => {
		if (alertsOpen) setUi({ alertsSeenTick: tick });
	}, [alertsOpen, tick, setUi]);

	const props: PanelProps = { store, content, state, ui, setUi };
	return (
		<div className={`aitower-hud ${state.view.bankrupt ? "is-bankrupt" : ""}`}>
			<TopBar {...props} />
			<BuildPalette {...props} />
			<div className="ui-center">
				<OverlaySwitcher {...props} />
				<Toasts content={content} state={state} />
				{state.tool.kind !== "select" && <ToolHint {...props} />}
				<Tutorial store={store} content={content} state={state} />
			</div>
			<div className="ui-right">
				<Inspector {...props} />
			</div>
			<BottomPanel {...props} />
		</div>
	);
}

function ToolHint({ content, state }: PanelProps) {
	const t = state.tool;
	const what =
		t.kind === "place"
			? `Placing ${content.facilities[t.defId]?.name ?? t.defId} — click to build`
			: t.kind === "slab"
				? "Slab — drag along a floor"
				: t.kind === "conduit"
					? `${t.layer === "power" ? "Power" : "Coolant"} conduit — drag across, then up/down`
					: t.kind === "lift"
						? "Lift — drag vertically on a column"
						: t.kind === "demolish"
							? "Demolish — click or drag over cells"
							: "";
	return (
		<div className="ui-toolhint ui-panel">
			<span className="ui-lamp lamp-red is-lit is-blink" />
			<span className="ui-dymo">TOOL ARMED</span>
			{what}
			<span className="ui-dim"> · Esc / right-click to exit</span>
		</div>
	);
}
