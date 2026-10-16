import { Component, type ErrorInfo, type ReactNode } from "react";
import { describeError, showCrashOverlay } from "./crash";

/** Catches render errors in the HUD tree and shows the DOM crash overlay. The world canvas keeps its last frame. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
	override state = { failed: false };

	static getDerivedStateFromError() {
		return { failed: true };
	}

	override componentDidCatch(error: unknown, info: ErrorInfo) {
		console.error("HUD crashed:", error, info.componentStack);
		showCrashOverlay({ source: "ui", message: describeError(error) });
	}

	override render() {
		return this.state.failed ? null : this.props.children;
	}
}
