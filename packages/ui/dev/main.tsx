import { createRoot } from "react-dom/client";
import { Hud } from "../src/Hud";
import { createFakeContent, createFakeStore, type FakeStoreWithEmit } from "../src/dev/fakeStore";

const content = createFakeContent();
const store = createFakeStore(content) as FakeStoreWithEmit;
const q = new URLSearchParams(location.search);
if (q.get("tool")) store.setTool({ kind: "place", defId: q.get("tool") ?? "" });
if (q.get("overlay")) store.setOverlay(q.get("overlay") as "heat");
if (q.get("tab") || q.get("sel")) {
	const sel = q.get("sel");
	if (sel === "none") store.setSelection(null);
	else if (sel === "bot") store.setSelection({ kind: "bot", id: 1 });
	else if (sel === "lift") store.setSelection({ kind: "lift", id: 1 });
	else if (sel) store.setSelection({ kind: "facility", id: Number(sel) });
}
createRoot(document.getElementById("hud") as HTMLElement).render(<Hud store={store} content={content} />);

// Keep the HUD alive: advance the fake clock and drop a few events for toasts.
setInterval(() => store.advance(store.get().speed), 250);
setTimeout(() => store.emit([{ type: "rackTripped", facilityId: 9 }]), 400);
setTimeout(() => store.emit([{ type: "jobCompleted", jobId: 7, payout: 520_000 }]), 700);
setTimeout(() => store.emit([{ type: "commandRejected", command: { type: "buyBot", defId: "techbot" }, reason: "All bot docks are full" }]), 900);

// Click a bottom tab via ?tab=jobs (harness convenience for screenshots).
const tab = q.get("tab");
if (tab) setTimeout(() => (document.querySelectorAll<HTMLButtonElement>(".ui-bottom-tabs .ui-tab")).forEach((b) => b.textContent?.toLowerCase().startsWith(tab) && b.click()), 50);
