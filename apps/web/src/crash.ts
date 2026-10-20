/**
 * Crash overlay: plain DOM, no React, so it still works when the HUD (or the renderer) is dead.
 * Styled as a Compute Authority "SYSTEM FAULT" memo.
 */

export type CrashSource = "sim" | "render" | "ui";

export interface CrashInfo {
	source: CrashSource;
	message: string;
	error: unknown;
}

/** What the overlay buttons do. Wired once by main.tsx. */
export interface CrashActions {
	/** Day of the autosave, or null when there is none (disables the reload button). */
	autosaveDay(): Promise<number | null>;
	/** Current game if it can still be serialised, else the autosave. Null when nothing is exportable. */
	exportText(): Promise<{ text: string; from: "current" | "autosave" } | null>;
}

export function describeError(err: unknown): string {
	if (err instanceof Error) return err.message || err.name;
	if (typeof err === "string") return err;
	try {
		return JSON.stringify(err) ?? String(err);
	} catch {
		return String(err);
	}
}

let actions: CrashActions | null = null;
export function configureCrashOverlay(a: CrashActions) {
	actions = a;
}

const OVERLAY_ID = "aitower-crash";

const CSS = `
#${OVERLAY_ID}{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:rgba(8,6,3,.82);font-family:"VT323",ui-monospace,monospace;color:#ffb000;pointer-events:auto}
#${OVERLAY_ID} .memo{width:min(560px,calc(100vw - 32px));box-sizing:border-box;background:#14100a;border:2px solid #ffb000;box-shadow:0 0 0 4px #14100a,0 0 0 6px #7a5500,0 0 28px #ffb00055;padding:18px 22px 20px}
#${OVERLAY_ID} .org{font-size:16px;letter-spacing:.14em;opacity:.75;border-bottom:1px dashed #7a5500;padding-bottom:6px}
#${OVERLAY_ID} h1{margin:10px 0 2px;font:inherit;font-size:34px;letter-spacing:.12em;color:#ff5a3c;text-shadow:0 0 8px #ff5a3c66}
#${OVERLAY_ID} .form{font-size:15px;opacity:.65;margin-bottom:12px}
#${OVERLAY_ID} p{margin:8px 0;font-size:20px;line-height:1.25}
#${OVERLAY_ID} pre{margin:8px 0 14px;padding:8px 10px;background:#0a0804;border-left:3px solid #ff5a3c;font:inherit;font-size:19px;white-space:pre-wrap;word-break:break-word;max-height:30vh;overflow:auto;color:#ffd27a}
#${OVERLAY_ID} .row{display:flex;flex-wrap:wrap;gap:10px}
#${OVERLAY_ID} button{font:inherit;font-size:20px;color:#ffb000;background:#1d160b;border:2px solid #ffb000;padding:6px 14px;cursor:pointer;letter-spacing:.05em}
#${OVERLAY_ID} button:hover:not(:disabled),#${OVERLAY_ID} button:focus-visible{background:#ffb000;color:#14100a;outline:none}
#${OVERLAY_ID} button:disabled{opacity:.4;cursor:default}
#${OVERLAY_ID} .note{min-height:1.3em;font-size:17px;opacity:.85;margin-top:10px}
`;

function download(text: string, filename: string) {
	const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Reload without ?new/?seed so the page boots from the autosave. */
const reloadClean = (query = "") => {
	location.href = location.pathname + query;
};

/** Show the overlay. Idempotent: the first fault wins (later ones are usually fallout). */
export function showCrashOverlay(info: { source?: CrashSource; message: string }) {
	if (typeof document === "undefined" || document.getElementById(OVERLAY_ID)) return;
	const root = document.createElement("div");
	root.id = OVERLAY_ID;
	root.setAttribute("role", "alertdialog");
	root.setAttribute("aria-modal", "true");
	root.setAttribute("aria-labelledby", `${OVERLAY_ID}-title`);
	const style = document.createElement("style");
	style.textContent = CSS;
	root.appendChild(style);

	const memo = document.createElement("div");
	memo.className = "memo";
	const el = (tag: string, text: string, cls?: string) => {
		const e = document.createElement(tag);
		e.textContent = text;
		if (cls) e.className = cls;
		return e;
	};
	const title = el("h1", "SYSTEM FAULT");
	title.id = `${OVERLAY_ID}-title`;
	const where = info.source === "render" ? "the display subsystem" : info.source === "ui" ? "the instrument panels" : "the simulation";
	memo.append(
		el("div", "COMPUTE AUTHORITY — OFFICE OF CONTINUITY", "org"),
		title,
		el("div", "INCIDENT NOTICE", "form"),
		el("p", `A fault has halted ${where}. The last good picture has been left on screen for your reference.`),
		el("pre", info.message || "Unknown error"),
	);

	const note = el("div", "", "note");
	note.setAttribute("aria-live", "polite");
	const mkButton = (label: string, onClick: () => void | Promise<void>) => {
		const b = document.createElement("button");
		b.type = "button";
		b.textContent = label;
		b.addEventListener("click", () => {
			Promise.resolve(onClick()).catch((err) => {
				console.error(err);
				note.textContent = `That did not work: ${describeError(err)}`;
			});
		});
		return b;
	};
	const reload = mkButton("RELOAD LAST AUTOSAVE", () => reloadClean());
	const exportBtn = mkButton("EXPORT SAVE", async () => {
		const out = await actions?.exportText();
		if (!out) {
			note.textContent = "Nothing could be exported: no readable game or autosave.";
			return;
		}
		download(out.text, `aitower-${out.from === "current" ? "crash" : "autosave"}-${Date.now()}.json`);
		note.textContent = out.from === "current" ? "Current game exported." : "The running game is unreadable; the last autosave was exported instead.";
	});
	const restart = mkButton("RESTART NEW GAME", () => {
		if (window.confirm("Start a new game? The running game will be lost (your autosave file is kept until the next day rolls over).")) reloadClean("?new");
	});
	const row = document.createElement("div");
	row.className = "row";
	row.append(reload, exportBtn, restart);
	memo.append(row, note);
	root.appendChild(memo);
	document.body.appendChild(root);
	reload.focus();

	if (actions) {
		reload.disabled = true;
		actions.autosaveDay().then(
			(day) => {
				reload.disabled = day === null;
				note.textContent = day === null ? "No autosave exists yet." : `Last autosave: day ${day}.`;
			},
			() => {
				reload.disabled = false;
			},
		);
	}
}

/** Log (never display) stray errors; the overlay is reserved for faults from the loop and the HUD tree. */
export function installGlobalErrorLogging(target: Pick<Window, "addEventListener"> = window) {
	target.addEventListener("error", (e) => console.error("window.onerror:", (e as ErrorEvent).error ?? (e as ErrorEvent).message));
	target.addEventListener("unhandledrejection", (e) => console.error("unhandledrejection:", (e as PromiseRejectionEvent).reason));
}
