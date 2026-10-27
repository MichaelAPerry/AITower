/**
 * retrofit (docs/REFRAME.md): turn a rack into the next rung of a tree, in place. A base rack (or a rack of another tree) becomes
 * rung 1 of the chosen tree; a tree rack becomes its own next rung. The new rack keeps the old one's tiles (a wider one takes a free
 * tile beside it, to the right first, then to the left); when it does not fit the player demolishes and rebuilds. Cost: the new
 * rack minus 50 % of the old one (`retrofitCost`). A closed tree (seal at `soul.sealMax`) takes no new retrofits.
 */
import { type AscensionPath, isRetrofittable, retrofitCost, retrofitTarget, TREE_NAME } from "@aitower/content";
import { findById } from "../core/grid";
import { placeBlock } from "../progression/access";
import { isClosed } from "../progression/soul";
import { getDef } from "../world/defs";
import { addFacility, removeFacility } from "../world/entities";
import { accept, type Plan, type PlanCtx, reject } from "./plan";
import { afterPlace, siteBlock } from "./placement";
import { anchors } from "./upgrade";

export function planRetrofit(ctx: PlanCtx, facilityId: number, tree: AscensionPath): Plan {
	const { state: s, content } = ctx;
	const f = findById(s.facilities, facilityId);
	if (!f) return reject("no such facility");
	if (f.grown) return reject("a growth cannot be retrofitted");
	const from = getDef(content, f.defId);
	if (!isRetrofittable(from)) return reject(`${from.name} is not a rack that can be retrofitted`);
	if (tree !== "synthetic" && tree !== "biotech" && tree !== "greentech") return reject("no such branch");
	const target = retrofitTarget(content, from, tree);
	if (!target) return reject(`${from.name} is already the last rung of ${TREE_NAME[tree]}`);
	if (isClosed(s, content, tree)) return reject(`${TREE_NAME[tree]} is closed: its seal reached ${content.balance.soul.sealMax}`);
	const to = target.to;
	const gate = placeBlock(s, content, to);
	if (gate) return reject(gate);
	let at: number | null = null;
	let why = "";
	for (const x of anchors(f.x, f.width, to.width)) {
		const block = siteBlock(s, to, f.floor, x, f.id);
		if (!block) {
			at = x;
			break;
		}
		if (!why) why = block;
	}
	if (at === null) return reject(`${to.name} does not fit here: ${why}`);
	const x = at;
	const rung = to.rung ?? 1;
	return accept(retrofitCost(content, from, to), (events) => {
		removeFacility(s, content, f);
		const made = addFacility(s, content, to.id, f.floor, x);
		afterPlace(s, to, false);
		events.push({ type: "built", what: "facility", floor: f.floor, x });
		events.push({ type: "retrofitted", facilityId: made.id, tree, rung });
	});
}
