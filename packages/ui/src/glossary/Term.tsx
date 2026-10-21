import { createContext, type ReactNode, useCallback, useContext, useId, useMemo, useRef, useState } from "react";
import { termById, type TermDef } from "./terms";
import "./term.css";

/** Where the Primer shows a term: its chapter (scrolled to the word) or, for reference-only words, the Words list. */
export const termTarget = (t: TermDef): string => (t.at === "words" ? `glossary:${t.id}` : `${t.at}#${t.id}`);

type Opener = (target: string) => void;
const OpenCtx = createContext<Opener | null>(null);
const ScopeCtx = createContext<Map<string, string> | null>(null);

/** Supplies "More in the Primer": the HUD passes a function that opens the Primer at a target. */
export function TermProvider({ open, children }: { open: Opener; children: ReactNode }) {
	return <OpenCtx.Provider value={open}>{children}</OpenCtx.Provider>;
}

/**
 * One panel's worth of terms: only the first <Term> of each id inside it is underlined, so a panel stays calm.
 * Give it a `key` that changes when the panel's subject changes (a new selection, a new tab).
 */
export function TermScope({ children }: { children: ReactNode }) {
	const seen = useRef(new Map<string, string>());
	return <ScopeCtx.Provider value={seen.current}>{children}</ScopeCtx.Provider>;
}

/** A jargon word with a dotted underline; hover or focus shows the one-line definition and a link to the Primer. */
export function Term({ id, children }: { id: string; children?: ReactNode }) {
	const def = termById(id);
	const openPrimer = useContext(OpenCtx);
	const scope = useContext(ScopeCtx);
	const uid = useId();
	const [on, setOn] = useState(false);
	const [side, setSide] = useState("");
	const ref = useRef<HTMLSpanElement>(null);
	const show = useCallback(() => {
		const r = ref.current?.getBoundingClientRect();
		if (r) setSide(`${r.left + 280 > window.innerWidth ? " is-right" : ""}${r.bottom + 170 > window.innerHeight ? " is-above" : ""}`);
		setOn(true);
	}, []);
	if (!def) return <>{children}</>;
	if (scope) {
		if (!scope.has(id)) scope.set(id, uid);
		if (scope.get(id) !== uid) return <>{children ?? def.name}</>;
	}
	return (
		// biome-ignore lint/a11y/useSemanticElements: an inline word with a tooltip; a button would be wrong inside running text
		<span
			ref={ref}
			className="ui-term"
			data-term={id}
			role="button"
			tabIndex={0}
			aria-describedby={on ? `${uid}-tip` : undefined}
			onMouseEnter={show}
			onMouseLeave={() => setOn(false)}
			onFocus={show}
			onBlur={() => setOn(false)}
			onClick={() => (on ? setOn(false) : show())}
			onKeyDown={(e) => {
				if (e.key === "Escape" && on) {
					e.stopPropagation();
					setOn(false);
				}
			}}
		>
			{children ?? def.name}
			{on && (
				<span id={`${uid}-tip`} role="tooltip" className={`ui-term-tip${side}`}>
					<span className="ui-term-card">
						<b className="ui-term-name">{def.name}</b>
						<span className="ui-term-def">{def.def}</span>
						{openPrimer && (
							<button type="button" className="ui-term-more" onClick={(e) => { e.stopPropagation(); setOn(false); openPrimer(termTarget(def)); }}>
								More in the Primer
							</button>
						)}
					</span>
				</span>
			)}
		</span>
	);
}

/** How words appear in game copy → the term they stand for. Abbreviations are case-sensitive on purpose. */
const SURFACE: Record<string, string> = {
	PUE: "pue", SLA: "sla", SLO: "slo", "IT load": "it-load", PFLOPS: "pflops", PF: "pflops", kWh: "kwh", kW: "kw", MW: "mw", CDU: "cdu", CRAH: "crah", CRAC: "crac", UPS: "ups", TDP: "tdp", DLC: "dlc", COP: "cop", PDU: "pdu", MTBF: "mtbf", "N+1": "redundancy",
	inference: "inference", Inference: "inference", training: "training", Training: "training",
	checkpointing: "checkpointing", checkpoint: "checkpointing", checkpoints: "checkpointing", Checkpoint: "checkpointing",
	"rack density": "rack-density", chiller: "chiller", Chiller: "chiller", immersion: "immersion", Immersion: "immersion",
};
const SURFACE_RX = new RegExp(`(?<![\\w+])(${Object.keys(SURFACE).sort((a, b) => b.length - a.length).map((s) => s.replace(/[+]/g, "\\+")).join("|")})(?![\\w])`, "g");

/** Split plain copy into text and <Term>s for the words it knows. (Only the first of each, per TermScope, is underlined.) */
export function Jargon({ text }: { text: string }) {
	const parts = useMemo(() => {
		const out: ReactNode[] = [];
		let last = 0;
		for (const m of text.matchAll(SURFACE_RX)) {
			const i = m.index ?? 0;
			if (i > last) out.push(text.slice(last, i));
			out.push(
				<Term key={i} id={SURFACE[m[0]]}>
					{m[0]}
				</Term>,
			);
			last = i + m[0].length;
		}
		if (last < text.length) out.push(text.slice(last));
		return out;
	}, [text]);
	return <>{parts}</>;
}
