import type { GameStore } from "@aitower/shared";
import { exportFileName, importErrorMessage } from "./slots";

/** Offer `text` as a file download. Browser only. */
export function downloadText(filename: string, text: string, type = "application/json"): void {
	const url = URL.createObjectURL(new Blob([text], { type }));
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.style.display = "none";
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Read a picked file as text with FileReader. Rejects with the reader's error. */
export function readFileText(file: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const r = new FileReader();
		r.onload = () => resolve(String(r.result ?? ""));
		r.onerror = () => reject(r.error ?? new Error("Could not read the file"));
		r.readAsText(file);
	});
}

export type ImportResult = { ok: true } | { ok: false; reason: string };

/** Replace the running game from exported JSON. Never throws: failures come back as "Invalid save: …" and the running game is kept. */
export function importSaveText(store: GameStore, text: string): ImportResult {
	try {
		store.load(text);
		return { ok: true };
	} catch (e) {
		return { ok: false, reason: importErrorMessage(e) };
	}
}

/** Read `file` and import it. Never rejects. */
export async function importSaveFile(store: GameStore, file: Blob): Promise<ImportResult> {
	let text: string;
	try {
		text = await readFileText(file);
	} catch (e) {
		return { ok: false, reason: importErrorMessage(e) };
	}
	return importSaveText(store, text);
}

/** Export the running game as a downloaded file; returns the file name. */
export function exportSave(store: GameStore, day: number): { ok: true; name: string } | { ok: false; reason: string } {
	try {
		const text = store.save();
		const name = exportFileName(day, new Date());
		downloadText(name, text);
		return { ok: true, name };
	} catch (e) {
		return { ok: false, reason: e instanceof Error ? e.message : String(e) };
	}
}
