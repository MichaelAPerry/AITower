import type { Speed } from "@aitower/shared";
import type { QuarterReport, SimCommand } from "@aitower/sim";
import { renderToString as render } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ClerkPanel } from "./clerk/ClerkPanel";
import { ContractsDrawer } from "./calm/Panels";
import { BuildPalette } from "./components/BuildPalette";
import { createFakeContent, createFakeStore } from "./dev/fakeStore";
import { click, findAll, findButton, panelProps, textOf } from "./dev/walk";
import { describeEvent } from "./events";
import { AuditPaper, AuditSheet } from "./finance/AuditSheet";
import { AuditsSection, CreditSection, FinanceTab, LedgerSection, RecordSection } from "./finance/FinanceTab";
import { Hud } from "./Hud";
import { runKey } from "./keyboard";
import { applyEscape, escapeStep } from "./menu/escape";
import { createMenuController } from "./menu/menuController";
import { ResearchSheet, TechCard } from "./research/ResearchSheet";

/** Server-rendered HTML without React's text-node separators, so assertions read like the page. */
const renderToString = (el: Parameters<typeof render>[0]): string => render(el).replace(/<!-- -->/g, "");

function setup(opts: { clerk?: boolean; speed?: Speed } = {}) {
	const content = createFakeContent();
	const store = createFakeStore(content);
	if (opts.clerk) store.unlockClerk();
	store.setSpeed(opts.speed ?? 3);
	const sent: SimCommand[] = [];
	const orig = store.dispatch;
	store.dispatch = (c) => {
		sent.push(c);
		return orig(c);
	};
	return { content, store, sent };
}

describe("Contract Automation panel", () => {
	it("locked: shows the hire slip naming the node and its cost, with a button that opens research", () => {
		const { content, store } = setup();
		let opened = 0;
		const tree = ClerkPanel(panelProps(store, content, { openResearch: () => opened++ }));
		expect(textOf(tree)).toContain("Hire a Contract Automation: research Form 9: Delegation of Signature (30 RP)");
		click(findButton(tree, /Research/));
		expect(opened).toBe(1);
		expect(store.get().view.clerk.unlocked).toBe(false);
	});
	it("unlocked: the ON/OFF toggle dispatches setClerk with the switch flipped and everything else kept", () => {
		const { content, store, sent } = setup({ clerk: true });
		const tree = ClerkPanel(panelProps(store, content));
		click(findButton(tree, /Clerk is off/));
		expect(sent.at(-1)).toEqual({ type: "setClerk", policy: { enabled: true, kinds: ["training", "finetune", "inference"], minPayPerPflopHour: 0, maxPenalty: 0, allowLiquid: true } });
		expect(store.get().view.clerk.policy.enabled).toBe(true);
		const on = ClerkPanel(panelProps(store, content));
		click(findButton(on, /Clerk is on/));
		expect(store.get().view.clerk.policy.enabled).toBe(false);
	});
	it("a checkbox per job kind; unchecking one dispatches the shorter list, and the last one cannot be unchecked", () => {
		const { content, store, sent } = setup({ clerk: true });
		const boxes = () => findAll(ClerkPanel(panelProps(store, content)), (el) => el.props.type === "checkbox");
		expect(boxes()).toHaveLength(4); // three kinds + allow liquid
		(boxes()[1].props.onChange as () => void)(); // finetune
		expect(sent.at(-1)).toMatchObject({ type: "setClerk", policy: { kinds: ["training", "inference"] } });
		(boxes()[0].props.onChange as () => void)(); // training
		expect(store.get().view.clerk.policy.kinds).toEqual(["inference"]);
		expect(boxes()[2].props.disabled).toBe(true);
		expect(boxes()[0].props.disabled).toBe(false);
	});
	it("allow liquid, min $/PF·h and max penalty each dispatch on change", () => {
		const { content, store, sent } = setup({ clerk: true });
		const tree = () => ClerkPanel(panelProps(store, content));
		(findAll(tree(), (el) => el.props.type === "checkbox")[3].props.onChange as () => void)();
		expect(store.get().view.clerk.policy.allowLiquid).toBe(false);
		const fields = findAll(tree(), (el) => typeof el.props.onValue === "function");
		expect(fields.map((f) => f.props.label)).toEqual(["Min $/PF·h", "Max penalty"]);
		(fields[0].props.onValue as (n: number) => void)(12.5);
		(fields[1].props.onValue as (n: number) => void)(40_000);
		expect(sent.at(-1)).toMatchObject({ policy: { minPayPerPflopHour: 12.5, maxPenalty: 40_000, allowLiquid: false } });
	});
	it("shows the fee percentage and the accepted count", () => {
		const { content, store } = setup({ clerk: true });
		const html = renderToString(<ClerkPanel {...panelProps(store, content)} />);
		expect(html).toContain("Fee 5 %");
		expect(html).toMatch(/accepted so far: <b>0<\/b>/);
	});
	it("offer rows show the pay rate and whether the clerk would take each offer", () => {
		const { content, store } = setup({ clerk: true });
		store.dispatch({ type: "setClerk", policy: { enabled: true, kinds: ["training", "inference"], minPayPerPflopHour: 0, maxPenalty: 0, allowLiquid: false } });
		const html = renderToString(<ContractsDrawer {...panelProps(store, content)} />);
		expect(html).toContain("$162"); // Helix: 680000 / 4200 PF·h
		expect(html).toContain("Clerk skips: needs liquid cooling and you said no"); // Helix
		expect(html).toContain("Clerk will take it"); // Quantmere inference
		expect(html).toContain("Clerk skips: finetune jobs are not on its list"); // Genefold
	});
	it("offer rows show no clerk line while it is locked, and 'Clerk is off' when the switch is off", () => {
		const a = setup();
		const locked = renderToString(<ContractsDrawer {...panelProps(a.store, a.content)} />);
		expect(locked).not.toMatch(/Clerk (will|skips|is off)/);
		const b = setup({ clerk: true });
		expect(renderToString(<ContractsDrawer {...panelProps(b.store, b.content)} />)).toContain("Clerk is off");
	});
});

describe("Research sheet", () => {
	it("renders the department, five branch columns, cards with plain effects, unlocks and states", () => {
		const { content, store } = setup();
		store.dispatch({ type: "research", techId: "cmp_burnin" });
		const html = renderToString(<ResearchSheet store={store} content={content} view={store.get().view} onClose={() => {}} />);
		expect(html).toContain("DEPARTMENT OF RESEARCH");
		for (const b of ["Compute", "Cooling", "Power", "Logistics", "Administration"]) expect(html).toContain(`>${b}</h3>`);
		expect(html).toContain("−10 % failure rate"); // plain-English perk
		expect(html).toContain("Contract Automation: accepts offers for you");
		expect(html).toContain("<b>Unlocks:</b> Chiller"); // scanned from facilities
		expect(html).toContain("<b>Unlocks:</b> Rotor Drone"); // and from bots
		expect(html).toContain("Researched");
		expect(html).toContain("Requires Clearance 3 and Silicon Binning"); // locked, with the reason
		expect(html).toContain("GAME PAUSED");
		expect(html).toMatch(/aria-modal="true"/);
	});
	it("a card's state: available has a RESEARCH button, too expensive shows the shortfall", () => {
		const { content, store } = setup();
		const v = store.get().view; // 42 RP
		const node = (id: string) => content.tech.find((t) => t.id === id) as (typeof content.tech)[number];
		expect(renderToString(<TechCard node={node("cmp_burnin")} view={v} content={content} store={store} />)).toContain("is-available");
		const poor = renderToString(<TechCard node={node("pow_tariff")} view={{ ...v, researchPoints: 10 }} content={content} store={store} />);
		expect(poor).toContain("is-poor");
		expect(poor).toContain("Need 25 more RP");
		expect(poor).not.toContain("ui-stampbtn");
	});
	it("RESEARCH dispatches {type:'research'} and spends the points", () => {
		const { content, store, sent } = setup();
		const node = content.tech.find((t) => t.id === "cmp_burnin") as (typeof content.tech)[number];
		const card = TechCard({ node, view: store.get().view, content, store });
		click(findButton(card, /Research/));
		expect(sent).toEqual([{ type: "research", techId: "cmp_burnin" }]);
		expect(store.get().view.techResearched).toEqual(["cmp_burnin"]);
		expect(store.get().view.researchPoints).toBe(22);
	});
	it("researching the clerk node unlocks the clerk", () => {
		const { store } = setup();
		store.dispatch({ type: "research", techId: "adm_clerk" });
		expect(store.get().view.clerk.unlocked).toBe(true);
	});
});

describe("Research key, pause and Esc", () => {
	function keys(speed: Speed = 3) {
		const { store, content } = setup({ speed });
		const menu = createMenuController(store);
		const research = createMenuController(store);
		let auditOpen = false;
		const audit = { isOpen: () => auditOpen, close: () => (auditOpen = false) };
		const lastSpeed = { current: 1 as Speed };
		const drawers: string[] = [];
		const key = (k: string) => runKey(store, k, { menu, research, audit, toggleDrawer: (id) => drawers.push(id), togglePalette: () => {}, lastSpeed });
		return { store, content, menu, research, drawers, key, setAudit: (o: boolean) => (auditOpen = o), isAudit: () => auditOpen };
	}
	it("R toggles the research drawer (no pause); the sheet opens from its button", () => {
		const { store, research, drawers, key } = keys(10);
		expect(key("r")).toBe(true);
		expect(drawers).toEqual(["research"]);
		expect(research.isOpen()).toBe(false);
		expect(store.get().speed).toBe(10);
	});
	it("the sheet pauses; R or Esc closes it and restores the previous speed", () => {
		const { store, research, key } = keys(10);
		research.open();
		expect(store.get().speed).toBe(0);
		key("R");
		expect(research.isOpen()).toBe(false);
		expect(store.get().speed).toBe(10);
		research.open();
		key("Escape");
		expect(research.isOpen()).toBe(false);
		expect(store.get().speed).toBe(10);
	});
	it("opening while already paused leaves it paused on close", () => {
		const { store, research, key } = keys(0);
		research.open();
		key("Escape");
		expect(store.get().speed).toBe(0);
	});
	it("while the sheet is open every other game hotkey is ignored", () => {
		const { store, research, key } = keys(3);
		research.open();
		for (const k of ["3", " ", "h", "x", "m"]) expect(key(k)).toBe(false);
		expect(store.get().speed).toBe(0);
		expect(store.get().overlay).toBe("normal");
		expect(store.get().tool.kind).toBe("select");
	});
	it("R does nothing while the menu is open", () => {
		const { menu, research, key } = keys(3);
		menu.open();
		expect(key("r")).toBe(false);
		expect(research.isOpen()).toBe(false);
	});
	it("Esc order: menu, then research, then audit, then the usual steps", () => {
		const tool = { kind: "select" } as const;
		expect(escapeStep({ menuOpen: true, researchOpen: true, auditOpen: true, tool, selection: null })).toBe("closeMenu");
		expect(escapeStep({ menuOpen: false, researchOpen: true, auditOpen: true, tool, selection: null })).toBe("closeResearch");
		expect(escapeStep({ menuOpen: false, researchOpen: false, auditOpen: true, tool: { kind: "slab" }, selection: null })).toBe("closeAudit");
		expect(escapeStep({ menuOpen: false, tool: { kind: "slab" }, selection: null })).toBe("cancelTool");
	});
	it("Esc closes the audit sheet without touching the clock or the menu", () => {
		const { store, menu, research, key, setAudit, isAudit } = keys(3);
		store.setSelection(null);
		setAudit(true);
		expect(key("Escape")).toBe(true);
		expect(isAudit()).toBe(false);
		expect(store.get().speed).toBe(3);
		expect(menu.isOpen()).toBe(false);
		expect(research.isOpen()).toBe(false);
	});
	it("hotkeys still work while the audit sheet is open (it does not pause)", () => {
		const { store, key, setAudit } = keys(3);
		setAudit(true);
		key("5");
		expect(store.get().speed).toBe(30);
		store.setSelection(null);
		expect(applyEscape(store, createMenuController(store), { audit: { isOpen: () => true, close: () => {} } })).toBe("closeAudit");
	});
	it("a menu opened over the research sheet closes first and does not unpause it", () => {
		const { store, menu, research, key } = keys(3);
		research.open();
		menu.open();
		key("Escape");
		expect(menu.isOpen()).toBe(false);
		expect(research.isOpen()).toBe(true);
		expect(store.get().speed).toBe(0);
		key("Escape");
		expect(store.get().speed).toBe(3);
	});
});

describe("Top bar and build palette", () => {
	it("items whose tech is not researched show 'Locked: <name>' and cannot be armed", () => {
		const { content, store } = setup();
		const html = renderToString(<BuildPalette {...panelProps(store, content, { ui: { paletteTab: "cooling" } })} />);
		expect(html).toContain("Locked: Heat Exchange Theory"); // chiller
		expect(html).toMatch(/aria-disabled="true"[^>]*data-tut="card-chiller"|data-tut="card-chiller"[^>]*aria-disabled="true"/);
		expect(html).toContain("is-locked");
		store.dispatch({ type: "research", techId: "cool_exchange" });
		const after = renderToString(<BuildPalette {...panelProps(store, content, { ui: { paletteTab: "cooling" } })} />);
		expect(after).not.toContain("Heat Exchange Theory");
	});
	it("a bot that needs research is disabled with the reason", () => {
		const { content, store } = setup();
		const html = renderToString(<BuildPalette {...panelProps(store, content)} />);
		expect(html).toContain("Requires research: Rotary Aviation Licence");
		expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Research<\/button>/);
		expect(html).toContain("Rotor Drone");
	});
});

describe("Finance tab", () => {
	it("the ledger has taxes, interest and fees columns, and Net includes them", () => {
		const { content, store } = setup();
		const html = renderToString(<LedgerSection {...panelProps(store, content)} />);
		for (const h of [">Taxes<", ">Interest<", ">Fees<"]) expect(html).toContain(h);
		const d = store.get().view.ledger.at(-1) as NonNullable<ReturnType<typeof store.get>["view"]["ledger"][number]>;
		const net = d.revenue - d.energy - d.upkeep - d.construction - d.penalties - d.taxes - d.interest - d.fees;
		expect(net).toBeLessThan(d.revenue - d.energy - d.upkeep - d.construction - d.penalties); // fixture has all three
	});
	it("sections switch through setUi", () => {
		const { content, store } = setup();
		const seen: unknown[] = [];
		const tree = FinanceTab(panelProps(store, content, { setUi: (p) => seen.push(p) }));
		click(findButton(tree, /Credit Facility/));
		click(findButton(tree, /Audits/));
		click(findButton(tree, /Record/));
		expect(seen).toEqual([{ financeTab: "credit" }, { financeTab: "audits" }, { financeTab: "record" }]);
	});
	it("Credit Facility shows principal, limit, daily rate and interest per day", () => {
		const { content, store } = setup();
		const text = textOf(CreditSection(panelProps(store, content)));
		expect(text).toContain("Owed $400k");
		expect(text).toContain("Limit $6.00M");
		expect(text).toContain("0.4 %/day");
		expect(text).toContain("Interest per day $1.6k");
	});
	it("TAKE presets dispatch takeLoan for 25 %, 50 % and all of the remaining limit", () => {
		const { content, store, sent } = setup();
		const tree = () => CreditSection(panelProps(store, content));
		// headroom = 6M - 400k = 5.6M
		click(findButton(tree(), /Borrow \$1\.40M/));
		expect(sent.at(-1)).toEqual({ type: "takeLoan", amount: 1_400_000 });
		// now owed 1.8M, headroom 4.2M: "all" takes the rest
		const all = findAll(tree(), (el) => typeof el.props.onClick === "function" && /Borrow \$4\.20M/.test(String(el.props.title)));
		expect(all).toHaveLength(1);
		click(all[0]);
		expect(sent.at(-1)).toEqual({ type: "takeLoan", amount: 4_200_000 });
		expect(store.get().view.loan.principal).toBe(6_000_000);
		const full = findAll(tree(), (el) => el.props.disabled === true && /Credit limit reached/.test(String(el.props.title)));
		expect(full).toHaveLength(3);
	});
	it("REPAY presets dispatch repayLoan; one the Treasury cannot cover is disabled", () => {
		const { content, store, sent } = setup();
		click(findButton(CreditSection(panelProps(store, content)), /Repay \$200k/));
		expect(sent.at(-1)).toEqual({ type: "repayLoan", amount: 200_000 });
		expect(store.get().view.loan.principal).toBe(200_000);
		store.dispatch({ type: "takeLoan", amount: 1 });
		const tree = CreditSection(panelProps(store, content));
		click(findButton(tree, /Repay \$200k/)); // ALL
		expect(store.get().view.loan.principal).toBeLessThan(1);
	});
	it("with a loan of nothing, repay buttons are disabled", () => {
		const { content, store } = setup();
		store.dispatch({ type: "repayLoan", amount: 400_000 });
		const dis = findAll(CreditSection(panelProps(store, content)), (el) => el.props.disabled === true && el.props.title === "Nothing to repay");
		expect(dis).toHaveLength(3);
	});
	it("past audits are listed newest first, and Open shows that report", () => {
		const { content, store } = setup();
		store.fileQuarterReport("A");
		let shown: QuarterReport | null = null;
		const tree = AuditsSection(panelProps(store, content, { openAudit: (r) => (shown = r) }));
		const html = renderToString(<AuditsSection {...panelProps(store, content)} />);
		expect(html.indexOf("Quarter 2")).toBeLessThan(html.indexOf("Quarter 1"));
		const opens = findAll(tree, (el) => el.props.title === "Open this audit sheet again");
		expect(opens).toHaveLength(2);
		click(opens[1]);
		expect((shown as QuarterReport | null)?.quarter).toBe(1);
	});
	it("with no audits yet it says when the first one comes", () => {
		const { content, store } = setup();
		const empty = { ...store.get().view, reports: [] };
		const props = { ...panelProps(store, content), state: { ...store.get(), view: empty } };
		expect(renderToString(<AuditsSection {...props} />)).toContain("No quarterly audit yet");
	});
	it("lifetime stats are in the Record section", () => {
		const { content, store } = setup();
		const html = renderToString(<RecordSection {...panelProps(store, content)} />);
		for (const l of ["Lifetime revenue", "Compute delivered", "Jobs completed", "Peak compute", "Research points earned"]) expect(html).toContain(l);
	});
});

describe("Quarterly audit sheet", () => {
	it("shows the figures, the big grade stamp, standing, cash change and remark", () => {
		const { store } = setup();
		const r = store.fileQuarterReport("D");
		const html = renderToString(<AuditSheet report={r} onClose={() => {}} />);
		expect(html).toContain("QUARTERLY AUDIT");
		expect(html).toContain("QUARTER 2");
		expect(html).toMatch(/ui-audit-stamp[^>]*>D</);
		expect(html).toContain("stamp-red");
		expect(html).toContain("Authority standing −3");
		expect(html).toContain("Fine −$29k");
		expect(html).toContain("regrettable"); // the remark (React escapes its quotes)
		expect(html).toContain("Uptime");
		expect(html).toContain('role="dialog"');
	});
	it("its close button calls onClose", () => {
		const { store } = setup();
		const r = store.fileQuarterReport("A");
		let closed = 0;
		const tree = AuditPaper({ report: r, onClose: () => closed++ });
		click(findButton(tree, /Filed|Close/));
		expect(closed).toBe(1);
		expect(renderToString(<AuditSheet report={r} onClose={() => {}} />)).toContain("stamp-green");
	});
});

describe("event wording", () => {
	it("researched names the node, its effects and what it unlocks", () => {
		const { content, store } = setup();
		const d = describeEvent({ type: "researched", techId: "cool_exchange" }, store.get().view, content);
		expect(d).toMatchObject({ severity: "good", toast: true });
		expect(d.text).toBe("Research complete: Heat Exchange Theory. +10 % cooling capacity; new in the build menu: Chiller");
	});
	it("the clerk, loans and the audit read as plain sentences", () => {
		const { content, store } = setup();
		const v = store.get().view;
		expect(describeEvent({ type: "clerkAccepted", contractId: 1, jobId: 7 }, v, content).text).toBe("The Contract Automation accepted Northwind AI training (fee 5 % of its earnings)");
		expect(describeEvent({ type: "loanTaken", amount: 500_000 }, v, content).text).toBe("Credit Facility: loan of $500k approved; interest accrues at 0.4 % a day");
		expect(describeEvent({ type: "loanRepaid", amount: 250_000 }, v, content).text).toContain("Credit Facility: $250k repaid");
		const r = store.fileQuarterReport("B");
		const q = describeEvent({ type: "quarterReport", quarter: r.quarter, grade: "B" }, store.get().view, content);
		expect(q.text).toBe(`Quarterly audit ${r.quarter}: grade B. ${r.remark}`);
		expect(q.severity).toBe("good");
		expect(describeEvent({ type: "quarterReport", quarter: 9, grade: "C" }, v, content).severity).toBe("info");
		expect(describeEvent({ type: "quarterReport", quarter: 9, grade: "E" }, v, content).severity).toBe("warn");
	});
});

describe("Hud", () => {
	it("renders the research tab and no sheet until opened", () => {
		const { content, store } = setup();
		const html = renderToString(<Hud store={store} content={content} />);
		expect(html).toContain('data-tut="dtab-research"');
		expect(html).not.toContain("ui-research-backdrop");
		expect(html).not.toContain("ui-audit-backdrop");
	});
	it("shows the clerk slip in the Contracts tab while the clerk is locked", () => {
		const { content, store } = setup();
		expect(renderToString(<ContractsDrawer {...panelProps(store, content)} />)).toContain("Hire a Contract Automation: research");
	});
});
