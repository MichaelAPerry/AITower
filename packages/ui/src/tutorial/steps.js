import { perHour } from "../calm/calm";
/** Speed the clock runs at when a step asks for "run". */
export const RUN_SPEED = 3;
export const rackCount = (s, ctx) => s.view.facilities.filter((f) => ctx.content.facilities[f.defId]?.kind === "rack").length;
export const maxJobId = (s) => s.view.jobs.reduce((m, j) => Math.max(m, j.id), -1);
export const baselineOf = (s, ctx) => ({ racks: rackCount(s, ctx), maxJobId: maxJobId(s) });
const t = (id) => `[data-tut="${id}"]`;
/** Blueprint spot just right of the tape archive (x 16–17) on F1, two tiles wide like the cabinet. */
const RACK_SPOT = [
    { x: 18, floor: 1 },
    { x: 19, floor: 1 },
];
const placing = (ui, defId) => ui.tool.kind === "place" && ui.tool.defId === defId;
/** Which of the build steps' four moves the player is on (0 menu, 1 tab, 2 card, 3 blueprint). */
export const buildPhase = (ui) => (placing(ui, "rack_air_gpu") ? 3 : !ui.paletteOpen ? 0 : ui.paletteTab !== "rack" ? 1 : 2);
export const TUTORIAL_STEPS = [
    {
        id: "accept",
        text: (s, ui) => (ui.drawer !== "contracts" ? "Open Contracts to see who wants to rent your racks." : s.view.offers.length > 0 ? "Accept this contract to start earning." : "Waiting for an offer to arrive."),
        targets: (s, ui) => (ui.drawer !== "contracts" ? [t("dtab-contracts")] : s.view.offers.length > 0 ? [t("accept")] : [".ui-drawer"]),
        sides: ["below"],
        clock: "free",
        onEnter: (_store, setUi) => setUi({ drawer: "contracts" }),
        done: (s, b) => maxJobId(s) > b.maxJobId,
    },
    {
        id: "play",
        text: () => "Press play so time passes: 1× is normal speed, 3× is faster.",
        targets: () => [t("speed-1"), t("speed-3")],
        sides: ["below"],
        clock: "free",
        done: (s) => s.speed > 0,
    },
    {
        id: "income",
        text: (s) => (s.speed === 0 ? "Time is stopped. Press play and watch PER HOUR." : "Your racks are working. Wait for PER HOUR to turn green."),
        targets: (s) => (s.speed === 0 ? [t("speed-1")] : [t("perhour")]),
        sides: ["below"],
        clock: "free",
        doneText: "PER HOUR is green: you are earning.",
        linger: 2200,
        done: (s) => (perHour(s.view) ?? -1) > 0,
    },
    {
        id: "build",
        text: (_s, ui) => ["Open the build menu to add a rack.", "Pick the RACKS tab.", "Choose the air-cooled rack.", "Click the blue spot to place it."][buildPhase(ui)],
        targets: (_s, ui) => [[t("dock-more")], [t("tab-rack")], [t("card-rack_air_gpu")], []][buildPhase(ui)],
        sides: ["right", "above"],
        ghost: (_s, ui) => (placing(ui, "rack_air_gpu") ? { cells: RACK_SPOT, valid: true, defId: "rack_air_gpu", label: "CLICK HERE" } : null),
        clock: "pause",
        focus: { x: 19, floor: 1 },
        onEnter: (store) => store.setOverlay("normal"),
        done: (s, b, ctx) => rackCount(s, ctx) > b.racks,
    },
    {
        id: "goals",
        text: () => "Your goals live here. Follow them from now on.",
        targets: () => [t("goals")],
        sides: ["right"],
        clock: "free",
        // Close the build menu and put the tool down so nothing covers the card.
        onEnter: (store, setUi) => {
            store.setTool({ kind: "select" });
            setUi({ paletteOpen: false });
        },
    },
];
export const HINTS = {
    heat: { id: "heat", text: "Too hot: add an air handler nearby.", targets: [], sides: ["above"] },
    memo: { id: "memo", text: "A memo arrived. Answer it here, or open the inbox.", targets: [".ui-memo-pop", t("inbox")], sides: ["left", "below"] },
};
/** The rack that is running hot (slowed down), if any. */
export const hotRack = (s, ctx) => s.view.facilities.find((f) => f.enabled && f.status === "throttled" && ctx.content.facilities[f.defId]?.kind === "rack");
/** The hint to show now: the first one whose moment has come and that the player has not seen. */
export function activeHint(s, seen, ctx) {
    if (!seen.heat && hotRack(s, ctx))
        return "heat";
    if (!seen.memo && s.view.memos.length > 0)
        return "memo";
    return null;
}
