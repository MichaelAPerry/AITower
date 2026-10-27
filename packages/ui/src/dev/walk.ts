/**
 * Test helpers: there is no DOM environment, so component tests call plain function components directly and walk the
 * element tree they return (props, children) to find a control and call its handler.
 */
import type { ContentDB } from "@aitower/content";
import type { GameStore } from "@aitower/shared";
import { Children, type ReactElement, type ReactNode, isValidElement } from "react";
import type { PanelProps, UiState } from "../components/context";

type Props = Record<string, unknown> & { children?: ReactNode };

/** Every element in the tree (depth first) that satisfies `pred`. Function components are not expanded. */
export function findAll(node: ReactNode, pred: (el: ReactElement<Props>) => boolean, out: ReactElement<Props>[] = []): ReactElement<Props>[] {
	for (const child of Children.toArray(node)) {
		if (!isValidElement(child)) continue;
		const el = child as ReactElement<Props>;
		if (pred(el)) out.push(el);
		findAll(el.props.children, pred, out);
	}
	return out;
}

/** The text content of the tree, joined with spaces (string and number children only). */
export function textOf(node: ReactNode): string {
	const parts: string[] = [];
	const walk = (n: ReactNode): void => {
		for (const c of Children.toArray(n)) {
			if (typeof c === "string" || typeof c === "number") parts.push(String(c));
			else if (isValidElement(c)) walk((c as ReactElement<Props>).props.children);
		}
	};
	walk(node);
	return parts.join(" ").replace(/\s+/g, " ").trim();
}

export const hasText = (el: ReactElement<Props>, re: RegExp): boolean => re.test(textOf(el.props.children));

/** A button-like element (native button, or a component with `onClick`) whose own text or title matches. */
export function findButton(node: ReactNode, re: RegExp): ReactElement<Props> {
	const hit = findAll(node, (el) => typeof el.props.onClick === "function" && (hasText(el, re) || re.test(String(el.props.title ?? "")) || re.test(String(el.props.label ?? "")) || re.test(String(el.props.rest ?? ""))))[0];
	if (!hit) throw new Error(`no control matching ${re}`);
	return hit;
}

export const click = (el: ReactElement<Props>): void => (el.props.onClick as () => void)();

export function panelProps(store: GameStore, content: ContentDB, over: { ui?: Partial<UiState>; openResearch?: () => void; openAudit?: PanelProps["openAudit"]; setUi?: PanelProps["setUi"] } = {}): PanelProps {
	const ui: UiState = { drawer: null, paletteOpen: false, focusJobId: null, alertsSeenTick: -1, paletteTab: "structure", financeTab: "ledger", ...over.ui };
	return { store, content, state: store.get(), ui, setUi: over.setUi ?? (() => {}), openMenu: () => {}, openResearch: over.openResearch ?? (() => {}), openAudit: over.openAudit ?? (() => {}) };
}
