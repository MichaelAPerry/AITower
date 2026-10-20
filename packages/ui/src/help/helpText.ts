/**
 * Plain-language help for every HUD region, in one place. An element opts in with `data-help="<key>"`.
 * `entry` is the Encyclopedia entry its "More..." link opens (ids come from `encyclopedia/entries.ts`).
 */
export interface HelpItem {
	title: string;
	text: string;
	entry: string;
}

export const HELP = {
	day: { title: "Day and time", text: "The game clock. One tick is one game minute, so a day is 1,440 ticks.", entry: "basics:money" },
	speed: { title: "Speed", text: "Pause, play, or fast-forward. Space pauses; keys 1 to 5 pick a speed. Pausing is free: you can plan while it is stopped.", entry: "basics:money" },
	treasury: { title: "Treasury", text: "Cash on hand. Builds and parts spend it; finished contracts refill it. Below zero for long, the Compute Authority shuts you down.", entry: "basics:money" },
	perhour: { title: "Per hour", text: "How much money you are making or losing each game hour, averaged over the last six. Red means upkeep and power cost more than you earn.", entry: "basics:money" },
	level: { title: "Level", text: "Your standing with the Compute Authority. Install more compute and keep uptime high to reach the next level, which unlocks bigger builds.", entry: "basics:level" },
	reputation: { title: "Reputation", text: "How much the Compute Authority trusts you, 0 to 100. Good uptime and finished jobs raise it; missed deadlines lower it. At 0 you are shut down.", entry: "basics:reputation" },
	inbox: { title: "Inbox", text: "Memos from the Compute Authority. Most are choices with a price. They never expire in a hurry, so read them when you are ready.", entry: "basics:memos" },
	help: { title: "Help", text: "Turn help mode on or off. While it is on, hover any outlined part of the screen to see what it does. Press ? or F1.", entry: "basics:money" },
	build: { title: "Build", text: "The most useful things to build right now. Click one, then click the tower to place it. B opens everything.", entry: "basics:power" },
	goals: { title: "Goals", text: "The next one to three things to do, with progress. Do the top one and the card moves on.", entry: "basics:contracts" },
	next: { title: "Next", text: "Appears only when something needs fixing, such as no power or an overheating rack. Click it to jump to the cause.", entry: "basics:cooling" },
	"tab-contracts": { title: "Contracts (C)", text: "Jobs clients want done. Accept one and put racks to work on it. This is how you earn money.", entry: "basics:contracts" },
	"tab-research": { title: "Research (R)", text: "Spend research points on new machines, cooling and perks. Points come from compute you deliver.", entry: "basics:research" },
	"tab-automation": { title: "Automation (T)", text: "Standing orders so routine chores run themselves. Unlocked by research.", entry: "basics:automation" },
	"tab-finance": { title: "Finance (F)", text: "The ledger, credit and quarterly audits. Look here to see where the money goes.", entry: "basics:money" },
	"tab-gauges": { title: "Gauges (I)", text: "Power, heat and uptime at a glance, plus the map overlays and live charts.", entry: "basics:cooling" },
	"tab-encyclopedia": { title: "Encyclopedia (K)", text: "Search how everything works: machines, bots, research and the jargon.", entry: "basics:money" },
} as const satisfies Record<string, HelpItem>;

export type HelpKey = keyof typeof HELP;
export const HELP_KEYS = Object.keys(HELP) as HelpKey[];
export const helpFor = (key: string): HelpItem | null => (key in HELP ? HELP[key as HelpKey] : null);
