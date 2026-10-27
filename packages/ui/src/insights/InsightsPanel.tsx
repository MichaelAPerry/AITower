import { Jargon, Term, TermScope } from "../glossary/Term";
import { AffinityBars } from "../components/AffinityBars";
import { Meter } from "../components/common";
import type { PanelProps } from "../components/context";
import { OverlaySwitcher } from "../components/OverlaySwitcher";
import { fmtMoney, fmtPower, fmtPue, fmtTemp } from "../format";
import { FinanceTab } from "../finance/FinanceTab";
import { leadingPath } from "../ascension/ascension";
import { ModifierChips } from "../status/Status";
import { PanelHead, PanelTabs } from "../panel/PanelShell";
import { Telemetry } from "../calm/Panels";
import { moneyFlow, pueExplain, uptimeVerdict } from "./insights";
import { TREE_COLOR, TREE_LONG, treeBars } from "../soul/soul";

const hourly = (n: number | null): string => (n === null ? "—" : `${fmtMoney(n)}/h`);

/** Insights: Finance and Gauges in one place, with plain headlines first and the jargon behind "details". */
export function InsightsPanel(props: PanelProps) {
	const { state, ui, setUi, content } = props;
	const { view } = state;
	const tab = ui.insightsTab ?? "overview";
	const flow = moneyFlow(view);
	const up = uptimeVerdict(view);
	const supply = view.powerNets.reduce((s, n) => s + n.supplyKw, 0);
	return (
		<>
			<PanelHead kicker="How is the tower doing?" title="Insights" />
			<PanelTabs
				label="Insights sections"
				value={tab}
				onPick={(t) => setUi({ insightsTab: t })}
				tabs={[
					{ id: "overview", label: "Overview", title: "Money, uptime and the Singularity at a glance" },
					{ id: "money", label: "Money details", title: "Daily accounts, loans and audits" },
				]}
			/>
			{tab === "money" && <FinanceTab {...props} />}
			{tab === "overview" && (
				<TermScope key={tab}>
				<div className="ins">
					<section className="ins-card" aria-label="Look at the tower with an overlay">
						<h3 className="ins-h">See it on the map</h3>
						<p className="ins-p">Pick a view to colour the tower. Heat shows hot racks, Power shows where electricity flows, Coolant shows the cooling pipes.</p>
						<OverlaySwitcher {...props} embedded />
					</section>

					<section className="ins-card" aria-label="Money">
						<h3 className="ins-h">Money</h3>
						<p className="ins-big">{flow.headline}</p>
						<div className="ins-two">
							<div>
								<span className="ins-k">Coming in</span>
								<b className="ins-v is-money">{hourly(flow.inPerHour)}</b>
							</div>
							<div>
								<span className="ins-k">Going out</span>
								<b className="ins-v">{hourly(flow.outPerHour)}</b>
							</div>
						</div>
						<p className="ins-p">Going out is power, upkeep, fines and fees, averaged over the last six game hours. Cash in the bank: {fmtMoney(view.cash)}.</p>
					</section>

					<section className="ins-card" aria-label="Uptime">
						<h3 className="ins-h">Uptime</h3>
						<p className={`ins-big tone-${up.tone}`}>{up.headline}</p>
						<Meter value={view.uptime} tone={up.tone === "bad" ? "error" : up.tone} height={8} />
						<p className="ins-p">{up.sub} <Term id="uptime">Uptime</Term> is how much of the last day your racks were up and working. Customers hold you to it through an <Term id="sla">SLA</Term>.</p>
					</section>

					{view.soul && (
						<section className="ins-card" aria-label="The Singularity">
							<h3 className="ins-h">The Singularity</h3>
							{treeBars(view.soul).map((t) => (
								<div key={t.tree} className="ins-tree" title={t.title}>
									<span className="ins-k" style={{ color: TREE_COLOR[t.tree] }}>
										{TREE_LONG[t.tree]} {t.state === "closed" ? "· closed" : ""}
									</span>
									<Meter value={t.frac} tone={t.tree === "synthetic" ? "warn" : "good"} height={6} />
								</div>
							))}
							<p className="ins-p">The first tree to fill ends the game. Each fills only from racks you have retrofitted down it; base racks score for none. Click the bars at the top for the Trees panel.</p>
						</section>
					)}

					<details className="ins-fold ins-details">
						<summary>Details for the curious</summary>
						<dl className="ins-dl">
							<dt>
								<span>Cooling cost (<Term id="pue">PUE</Term>)</span> <b>{fmtPue(view.pue)}</b>
							</dt>
							<dd><Jargon text={pueExplain(view.pue)} /></dd>
							<dt>
								<span>Computer power (<Term id="it-load">IT load</Term>)</span> <b className={supply > 0 && view.totalKw > supply ? "is-down" : ""}>{fmtPower(view.itKw)}</b>
							</dt>
							<dd>How much electricity your racks use right now, in <Term id="kw">kW</Term>. If the whole tower needs more than your supply, things brown out.</dd>
							<dt>
								Computing speed <b>{Math.round(view.pflops)} PF</b>
							</dt>
							<dd><Term id="pflops">PF</Term> (petaflops) is how fast your racks calculate. More PF means you can take bigger jobs.</dd>
							<dt>
								Outside air <b>{fmtTemp(view.ambientC, 0)}</b>
							</dt>
							<dd>Hot weather makes cooling harder and your power bill bigger.</dd>
							<dt>
								Grid price <b>${view.energyPrice.toFixed(3)}/kWh</b>
							</dt>
							<dd>What one unit of electricity costs now. It changes during the day.</dd>
						</dl>
						{view.modifiers.length > 0 && <ModifierChips modifiers={view.modifiers} tick={view.tick} />}
						<h4 className="ins-h2">Which path are you on?</h4>
						<AffinityBars affinity={view.affinity} content={content} leading={view.path ?? leadingPath(view.affinity)} />
						<h4 className="ins-h2">Charts</h4>
						<Telemetry {...props} />
					</details>
				</div>
				</TermScope>
			)}
		</>
	);
}
