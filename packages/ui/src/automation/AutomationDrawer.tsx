import type { TechBranch } from "@aitower/content";
import type { AutomationPolicy } from "@aitower/sim";
import { AmountField } from "../clerk/ClerkPanel";
import { clerkLockedText } from "../clerk/clerk";
import { Toggle } from "../components/common";
import type { PanelProps } from "../components/context";
import { BRANCHES } from "../research/tech";
import { fmtMoney } from "../format";
import { automationFacts, branchSummary, foremanLockedText, MAX_RESERVE, ORDERS, sendAutomation, sendClerk, toCount, toggleBranch, toggleOrder, withOrder } from "./automation";
import "./automation.css";

/** The Automation drawer (key T; A would pan the camera): one row per standing order with its ON/OFF switch and settings, and the Clerk as a one-liner. */
export function AutomationDrawer({ store, content, state, openResearch }: PanelProps) {
	const { view } = state;
	const { policy, foremanUnlocked } = view.automation;
	const facts = automationFacts(content);
	const edit = <K extends "research" | "parts" | "bots" | "foreman">(id: K, patch: Partial<AutomationPolicy[K]>): void => {
		sendAutomation(store, (cur) => withOrder(cur, id, patch));
	};
	const clerk = view.clerk;
	return (
		<>
			<h4 className="ui-dh">
				<span>STANDING ORDERS</span>
				<span className="ui-dim">checked once per game-hour</span>
			</h4>
			{ORDERS.map((o) => {
				const locked = o.id === "foreman" && !foremanUnlocked;
				const on = policy[o.id].enabled && !locked;
				return (
					<section key={o.id} className={`ui-auto-row ${on ? "is-on" : "is-off"} ${locked ? "is-locked" : ""}`} data-order={o.id} aria-label={`${o.label} standing order`}>
						<div className="ui-auto-head">
							<div className="ui-auto-name">
								<b>{o.label}</b>
								<span className="ui-auto-blurb">{o.blurb}</span>
							</div>
							{locked ? (
								<button type="button" className="ui-btn ui-mini" onClick={() => openResearch()} title="Open the Department of Research (R)">
									{foremanLockedText(content)}
								</button>
							) : (
								<Toggle on={on} onClick={() => sendAutomation(store, (cur) => toggleOrder(cur, o.id))} label={on ? "ON" : "OFF"} title={`${o.label}: ${on ? "on. Click to switch off" : "off. Click to switch on"}`} className="ui-auto-toggle" />
							)}
						</div>
						{!locked && o.id === "research" && (
							<div className="ui-auto-set">
								<span className="ui-auto-k" title="Nodes of the listed branches come first; with none selected it takes any branch, cheapest first">
									Branches first
								</span>
								{/* biome-ignore lint/a11y/useSemanticElements: a row of toggle chips; a fieldset would bring its own box */}
								<span className="ui-auto-chips" role="group" aria-label="Preferred research branches">
									{BRANCHES.map((b) => (
										<button key={b.id} type="button" className={`ui-auto-chip ${policy.research.branches.includes(b.id) ? "is-on" : ""}`} aria-pressed={policy.research.branches.includes(b.id)} onClick={() => edit("research", { branches: toggleBranch(store.get().view.automation.policy.research.branches, b.id as TechBranch) })}>
											{b.label}
										</button>
									))}
								</span>
								<span className="ui-auto-note">{branchSummary(policy.research.branches)}</span>
							</div>
						)}
						{!locked && o.id === "parts" && (
							<div className="ui-auto-set">
								<AmountField label="Keep at least" value={policy.parts.keep} title={`Buys ${facts.partsBatch} spare parts at a time whenever the stock is below this`} onValue={(n) => toCount(n) !== null && edit("parts", { keep: toCount(n) as number })} />
								<span className="ui-auto-note">{facts.partsBatch} per purchase</span>
							</div>
						)}
						{!locked && o.id === "bots" && (
							<div className="ui-auto-set">
								<AmountField label="Racks per bot" value={policy.bots.racksPerBot} title="One bot for every this many racks" onValue={(n) => toCount(n, 1) !== null && edit("bots", { racksPerBot: toCount(n, 1) as number })} />
								<AmountField label="At most" value={policy.bots.maxBots} title="Never buy beyond this many bots" onValue={(n) => toCount(n) !== null && edit("bots", { maxBots: toCount(n) as number })} />
							</div>
						)}
						{!locked && o.id === "foreman" && (
							<div className="ui-auto-set">
								<AmountField label="Keep in reserve" value={policy.foreman.reserve} prefix="$" title="The Foreman never spends the treasury below this" onValue={(n) => toCount(n, 0, MAX_RESERVE) !== null && edit("foreman", { reserve: toCount(n, 0, MAX_RESERVE) as number })} />
								{(["racks", "cooling", "power"] as const).map((k) => (
									<label key={k} className="ui-auto-check" title={k === "racks" ? "Place compute racks when offers go unserved" : k === "cooling" ? "Place an air handler when racks run hot" : "Place a grid tie or genset when power is short"}>
										<input type="checkbox" checked={policy.foreman[k]} onChange={() => edit("foreman", { [k]: !policy.foreman[k] })} />
										{k}
									</label>
								))}
								<span className="ui-auto-note">
									At most {view.automation.foremanPerHour ?? facts.foremanPerHour} per hour, on slab with a power conduit under it. Reserve {fmtMoney(policy.foreman.reserve)}.
								</span>
							</div>
						)}
					</section>
				);
			})}
			{clerk && (
				<>
			<h4 className="ui-dh">
				<span>CONTRACTS</span>
			</h4>
			<section className={`ui-auto-row ${clerk.unlocked && clerk.policy.enabled ? "is-on" : "is-off"} ${clerk.unlocked ? "" : "is-locked"}`} data-order="clerk" aria-label="Contract Automation standing order">
				<div className="ui-auto-head">
					<div className="ui-auto-name">
						<b>Contract Automation</b>
						<span className="ui-auto-blurb">{clerk.unlocked ? `${clerk.acceptedTotal} booked. Rules are on the Contracts tab (C).` : clerkLockedText(content)}</span>
					</div>
					{clerk.unlocked ? (
						<Toggle on={clerk.policy.enabled} onClick={() => sendClerk(store, { enabled: !clerk.policy.enabled })} label={clerk.policy.enabled ? "ON" : "OFF"} title={clerk.policy.enabled ? "Clerk is on. Click to switch off" : "Clerk is off. Click to switch on"} className="ui-auto-toggle" />
					) : (
						<button type="button" className="ui-btn ui-mini" onClick={() => openResearch()} title="Open the Department of Research (R)">
							Research (R)
						</button>
					)}
				</div>
			</section>
				</>
			)}
		</>
	);
}
