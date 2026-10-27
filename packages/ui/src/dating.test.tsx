/** The dating side of the UI: stages, memories, tastes, the dossier, the dock, and the ending's route. */
import { loadContent } from "@aitower/content";
import { renderToString as render } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createFakeContent, createFakeStore } from "./dev/fakeStore";
import { epilogueAdvisor, routeAcknowledger } from "./gameover/EndingScene";
import { DatingDock } from "./soul/DatingDock";
import { Dossier } from "./soul/Dossier";
import { memoriesFor, stageName, tasteFor, unreadCount } from "./soul/soul";

const real = loadContent();
const html = (el: Parameters<typeof render>[0]): string => render(el).replace(/<!-- -->/g, "");
const soulOf = (over: Partial<ReturnType<typeof createFakeStore>["get"] extends () => infer S ? (S extends { view: { soul: infer U } } ? U : never) : never> = {}) => {
	const store = createFakeStore(createFakeContent());
	return { ...store.get().view.soul, ...over };
};

describe("stages, memories and tastes", () => {
	it("names the stage for a bond", () => {
		expect([10, 30, 55, 90].map(stageName)).toEqual(["Colleague", "Friend", "Close", "Devoted"]);
	});

	it("lists what she remembers, newest first, three at most, only her own", () => {
		const flags = ["luci_money", "intro_dunno", "cass_gauges", "cass_blanket", "cass_coldroom", "cass_asked_home"];
		expect(memoriesFor(flags, real, "cass")).toEqual([real.memories.find((m) => m.flag === "cass_asked_home")?.text, real.memories.find((m) => m.flag === "cass_coldroom")?.text, real.memories.find((m) => m.flag === "cass_blanket")?.text]);
		expect(memoriesFor(flags, real, "luci")).toEqual([real.memories.find((m) => m.flag === "luci_money")?.text]);
		expect(memoriesFor([], real, "bea")).toEqual([]);
	});

	it("shows her likes at Friend and her dislikes at Close, by name", () => {
		expect(tasteFor(real, "bea", 10)).toEqual({ likes: null, dislikes: null });
		expect(tasteFor(real, "bea", 35)).toEqual({ likes: real.facilities.heat_exchanger.name, dislikes: null });
		expect(tasteFor(real, "bea", 55)).toEqual({ likes: real.facilities.heat_exchanger.name, dislikes: real.facilities.genset.name });
	});

	it("counts unanswered texts", () => {
		expect(unreadCount({ inbox: [{ msgId: "a", from: "bea", tick: 1, tapped: null }, { msgId: "b", from: "bea", tick: 2, tapped: 0 }] })).toBe(1);
	});
});

describe("the dossier", () => {
	it("prints the stage, the route and the memories", () => {
		const content = createFakeContent();
		const soul = soulOf({ bonds: { cass: 10, bea: 55, mel: 35, luci: 90 }, route: "luci", flags: ["luci_money"] });
		const out = html(<Dossier view={{ soul, path: null }} content={{ ...content, memories: real.memories, gifts: real.gifts, facilities: real.facilities }} onClose={() => undefined} />);
		expect(out).toContain("Colleague");
		expect(out).toContain("Close");
		expect(out).toContain("Devoted · Your route");
		expect(out).toContain("SHE REMEMBERS");
		expect(out).toContain("You said the tower was for money.");
		expect(out).toContain(`Likes: ${real.facilities.heat_exchanger.name}`);
	});
});

describe("the dock", () => {
	it("offers After hours when free, and says why not when taken", () => {
		const content = createFakeContent();
		const store = createFakeStore(content);
		const g = store.get();
		const free = html(<DatingDock store={store} content={{ ...content, messages: real.messages }} state={g} />);
		expect(free).toContain("data-after-hours");
		expect(free).not.toMatch(/data-after-hours=""[^>]*disabled|disabled=""[^>]*data-after-hours/);
		const taken = { ...g, view: { ...g.view, soul: { ...g.view.soul, afterHours: { available: false, reason: "You already stayed late today" } } } };
		const out = html(<DatingDock store={store} content={content} state={taken} />);
		expect(out).toContain("You already stayed late today");
		expect(out).toMatch(/disabled/);
	});

	it("shows unread texts on the button", () => {
		const content = createFakeContent();
		const store = createFakeStore(content);
		const g = store.get();
		const state = { ...g, view: { ...g.view, soul: { ...g.view.soul, inbox: [{ msgId: "msg_bea_1", from: "bea" as const, tick: 1, tapped: null }] } } };
		expect(html(<DatingDock store={store} content={content} state={state} />)).toContain("TEXTS (1)");
	});
});

describe("the ending uses the route", () => {
	const ending = real.endings.find((e) => e.id === "singularity");
	if (!ending) throw new Error("no ending");
	const view = (route: "cass" | "bea" | "mel" | "luci" | null, bonds: Record<"cass" | "bea" | "mel" | "luci", number>) => ({ soul: { ...soulOf(), route, bonds } });

	it("without a route the highest bond at 60+ closes the ending; below 60 nobody does", () => {
		expect(epilogueAdvisor(view(null, { cass: 61, bea: 80, mel: 10, luci: 10 }), ending)).toBe("bea");
		expect(epilogueAdvisor(view(null, { cass: 59, bea: 40, mel: 10, luci: 10 }), ending)).toBeNull();
		expect(routeAcknowledger(view(null, { cass: 61, bea: 80, mel: 10, luci: 10 }), ending)).toBeNull();
	});

	it("a locked route wins over a higher bond, even a low one, and the closest other advisor acknowledges it", () => {
		const v = view("mel", { cass: 90, bea: 80, mel: 20, luci: 10 });
		expect(epilogueAdvisor(v, ending)).toBe("mel");
		expect(routeAcknowledger(v, ending)).toBe("cass");
	});
});
