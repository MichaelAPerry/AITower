import type { DiagramId } from "./chapters";

/** One small labelled picture per core chapter. Colours come from classes (theme tokens), so they follow the theme. */
const T = ({ x, y, c = "", children }: { x: number; y: number; c?: string; children: string }) => (
	<text x={x} y={y} className={`pr-t ${c}`} textAnchor="middle">
		{children}
	</text>
);
const Box = ({ x, y, w, h, c = "" }: { x: number; y: number; w: number; h: number; c?: string }) => <rect x={x} y={y} width={w} height={h} rx="5" className={`pr-box ${c}`} />;

const PICS: Record<DiagramId, { label: string; body: React.ReactNode }> = {
	center: {
		label: "A building holds racks. Power, cooling and a repair bot look after them.",
		body: (
			<>
				<Box x={20} y={8} w={320} h={70} />
				{[60, 150, 240].map((x) => (
					<g key={x}>
						<Box x={x} y={20} w={46} h={50} c="is-acc" />
						<path d={`M${x + 8} 34h30M${x + 8} 46h30M${x + 8} 58h30`} className="pr-ln" />
					</g>
				))}
				<T x={83} y={98}>1. power</T>
				<T x={180} y={98}>2. cooling</T>
				<T x={277} y={98}>3. repair bot</T>
			</>
		),
	},
	power: {
		label: "Power flows from the grid along wires to the rack. A battery covers short gaps.",
		body: (
			<>
				<Box x={12} y={30} w={70} h={44} />
				<T x={47} y={56}>Grid</T>
				<Box x={150} y={30} w={60} h={44} c="is-acc" />
				<T x={180} y={56}>Rack</T>
				<Box x={280} y={30} w={70} h={44} />
				<T x={315} y={56}>Battery</T>
				<path d="M82 52h68M280 52h-70" className="pr-ln is-flow" />
				<T x={116} y={44} c="is-dim">wire</T>
				<T x={245} y={44} c="is-dim">backup</T>
				<T x={180} y={102} c="is-dim">no power = NO POWER sign</T>
			</>
		),
	},
	heat: {
		label: "Hot air leaves the rack. The air handler cools it and sends cool air back.",
		body: (
			<>
				<Box x={40} y={30} w={64} h={74} c="is-acc" />
				<T x={72} y={72}>Rack</T>
				<circle cx={72} cy={46} r={6} className="pr-hotdot" />
				<Box x={250} y={34} w={92} h={66} />
				<T x={296} y={72}>Air handler</T>
				<path d="M110 48H236" className="pr-ln is-hot" />
				<path d="M244 90H118" className="pr-ln is-cool" />
				<path d="M236 41l12 7-12 7z" className="pr-hotdot" />
				<path d="M110 83l-12 7 12 7z" className="pr-cooldot" />
				<T x={176} y={38} c="is-hot">hot air</T>
				<T x={176} y={110} c="is-cool">cool air</T>
			</>
		),
	},
	break: {
		label: "A broken rack waits for a bot to bring a spare part from the depot.",
		body: (
			<>
				<Box x={14} y={26} w={70} h={64} c="is-bad" />
				<T x={49} y={54}>Rack</T>
				<T x={49} y={74} c="is-bad">BROKEN</T>
				<Box x={150} y={34} w={64} h={48} />
				<T x={182} y={62}>Bot</T>
				<Box x={280} y={34} w={70} h={48} />
				<T x={315} y={62}>Depot</T>
				<path d="M280 58h-66M150 58H84" className="pr-ln is-flow" />
				<T x={247} y={50} c="is-dim">part</T>
				<T x={180} y={108} c="is-dim">no part, no repair</T>
			</>
		),
	},
	uptime: {
		label: "A bar fills up to your uptime. A mark shows the target you must beat.",
		body: (
			<>
				<rect x={20} y={40} width={320} height={22} rx="5" className="pr-box" />
				<rect x={20} y={40} width={304} height={22} rx="5" className="pr-fill" />
				<path d="M300 32v38" className="pr-ln is-warn" />
				<T x={300} y={26} c="is-warn">target</T>
				<T x={160} y={56} c="is-on">up and working</T>
				<T x={180} y={96} c="is-dim">over the target: a good audit</T>
			</>
		),
	},
	money: {
		label: "Jobs bring money in. Power, upkeep and repairs take it out.",
		body: (
			<>
				<Box x={12} y={14} w={80} h={36} />
				<T x={52} y={37}>Jobs</T>
				<Box x={140} y={34} w={80} h={52} c="is-acc" />
				<T x={180} y={65}>Cash</T>
				<Box x={268} y={14} w={80} h={36} />
				<T x={308} y={37}>Power</T>
				<Box x={268} y={70} w={80} h={36} />
				<T x={308} y={93}>Upkeep</T>
				<path d="M92 36L140 52" className="pr-ln is-good" />
				<path d="M220 56L268 36M220 66L268 88" className="pr-ln is-warn" />
				<T x={60} y={78} c="is-good">money in</T>
				<T x={180} y={108} c="is-warn">money out</T>
			</>
		),
	},
};

export function Diagram({ id }: { id: DiagramId }) {
	const d = PICS[id];
	return (
		<svg className="pr-svg" viewBox="0 0 360 120" role="img" aria-label={d.label}>
			{d.body}
		</svg>
	);
}
