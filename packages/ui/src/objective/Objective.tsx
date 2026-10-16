import type { PanelProps } from "../components/context";
import { fmtMoney } from "../format";
import { currentObjective, moneyToday } from "./objective";

/** "CURRENT ORDERS": what to do next and where today's money went. Always visible during play. */
export function Objective({ store, content, state }: PanelProps) {
	const obj = currentObjective(state.view, content, (cmd) => store.canBuild(cmd));
	const money = moneyToday(state.view);
	const net = money.income - money.costs;
	return (
		<section className={`ui-objective tone-${obj.tone}`} aria-live="polite" aria-label="Current orders">
			<header className="ui-objective-head">
				<span className="ui-dymo">CURRENT ORDERS</span>
				<span className={`ui-objective-net ${net < 0 ? "is-neg" : "is-pos"}`} title={money.breakdown ? `Spent today: ${money.breakdown}` : "Nothing spent yet today"}>
					TODAY +{fmtMoney(money.income)} / −{fmtMoney(money.costs)}
				</span>
			</header>
			<strong className="ui-objective-title">{obj.title}</strong>
			<p className="ui-objective-detail">{obj.detail}</p>
			{money.breakdown && <p className="ui-objective-costs">Spent today: {money.breakdown}</p>}
		</section>
	);
}
