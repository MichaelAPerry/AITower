import { Component } from "react";
import { describeError, showCrashOverlay } from "./crash";
/** Catches render errors in the HUD tree and shows the DOM crash overlay. The world canvas keeps its last frame. */
export class ErrorBoundary extends Component {
    state = { failed: false };
    static getDerivedStateFromError() {
        return { failed: true };
    }
    componentDidCatch(error, info) {
        console.error("HUD crashed:", error, info.componentStack);
        showCrashOverlay({ source: "ui", message: describeError(error) });
    }
    render() {
        return this.state.failed ? null : this.props.children;
    }
}
