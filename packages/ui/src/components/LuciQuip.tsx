import { ADVISORS } from "../advisors/advisors";
import { Portrait } from "../advisors/Portrait";
import "./inspect.css";

/** Luci's face and one short line, at the head of an inspection card. */
export function LuciQuip({ text }: { text: string }) {
	return (
		<div className="insp-luci" style={{ ["--adv" as string]: ADVISORS.luci.color }} data-insp-quip>
			<Portrait id="luci" size={64} talking />
			<p className="insp-quip">
				<b className="adv-who">{ADVISORS.luci.first}</b> {text}
			</p>
		</div>
	);
}
