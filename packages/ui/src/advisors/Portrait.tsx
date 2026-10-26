import type { AdvisorId } from "@aitower/content";
import { ADVISORS } from "./advisors";

/**
 * Inline-SVG bust portraits, one per advisor, drawn flat in the game's style. The disc and the clothing take the
 * advisor's colour (`--adv`), so each reads at a glance; faces differ by hair, glasses and collar.
 */
export function Portrait({ id, size = 44, talking = false }: { id: AdvisorId; size?: number; talking?: boolean }) {
	const a = ADVISORS[id];
	return (
		<svg className={`adv-portrait ${talking ? "is-talking" : ""}`} viewBox="0 0 48 48" width={size} height={size} role="img" aria-label={a.name} focusable="false" style={{ ["--adv" as string]: a.color }}>
			<circle className="adv-disc" cx="24" cy="24" r="23" />
			<clipPath id={`adv-clip-${id}`}>
				<circle cx="24" cy="24" r="22" />
			</clipPath>
			<g clipPath={`url(#adv-clip-${id})`}>{BODY[id]}</g>
		</svg>
	);
}

const SKIN = { cass: "#d9a27a", bea: "#8d5a3c", mel: "#e8c29c", luci: "#d8b9a6" } as const;
const INK = "#1b1712";

/** Shared face: two eyes and a mouth line; `smile` curves it. */
function Face({ skin, smile = 0 }: { skin: string; smile?: number }) {
	return (
		<>
			<ellipse cx="24" cy="21" rx="8" ry="9.2" fill={skin} />
			<circle cx="20.6" cy="21" r="1.1" fill={INK} />
			<circle cx="27.4" cy="21" r="1.1" fill={INK} />
			<path d={`M21 26 q3 ${smile} 6 0`} stroke={INK} strokeWidth="1.1" fill="none" strokeLinecap="round" />
		</>
	);
}

const BODY: Record<AdvisorId, React.ReactNode> = {
	// Cass: practical. Hard hat, hi-vis vest over a grey shirt, clipboard edge.
	cass: (
		<>
			<path d="M4 50 q2 -14 20 -15 q18 1 20 15z" fill="#4d4a44" />
			<path d="M10 50 q1 -12 14 -13 q13 1 14 13z" fill="var(--adv)" />
			<path d="M20 37 l4 13 l4 -13" fill="#4d4a44" />
			<rect x="19" y="30" width="10" height="7" rx="3" fill={SKIN.cass} />
			<Face skin={SKIN.cass} smile={1.2} />
			<path d="M15 17 q0 -9 9 -9 q9 0 9 9z" fill="var(--adv)" stroke={INK} strokeWidth="0.8" />
			<rect x="13.5" y="16.2" width="21" height="2.4" rx="1.2" fill="var(--adv)" stroke={INK} strokeWidth="0.8" />
			<path d="M16 21 q-2.5 3 -1 7" stroke="#5b3b22" strokeWidth="2" fill="none" strokeLinecap="round" />
			<rect x="34" y="36" width="9" height="12" rx="1.2" fill="#d9d2c0" stroke={INK} strokeWidth="0.8" transform="rotate(12 38 42)" />
		</>
	),
	// Bea: deadpan. Hair bun, safety glasses, yellow collar with a bolt.
	bea: (
		<>
			<path d="M4 50 q2 -14 20 -15 q18 1 20 15z" fill="#2c3340" />
			<path d="M15 37 q9 7 18 0 l3 13 h-24z" fill="var(--adv)" />
			<path d="M25 39 l-3 5 h3 l-2 5 l6 -7 h-3.5 l2 -3z" fill={INK} />
			<rect x="19" y="30" width="10" height="7" rx="3" fill={SKIN.bea} />
			<circle cx="24" cy="9" r="4.4" fill="#16110d" />
			<Face skin={SKIN.bea} smile={0} />
			<path d="M16 19 q8 -9 16 0 q-1 -5 -8 -6 q-7 1 -8 6z" fill="#16110d" />
			<rect x="17.4" y="19.2" width="6" height="4.2" rx="1.6" fill="#a8dfff" fillOpacity="0.55" stroke={INK} strokeWidth="0.9" />
			<rect x="24.6" y="19.2" width="6" height="4.2" rx="1.6" fill="#a8dfff" fillOpacity="0.55" stroke={INK} strokeWidth="0.9" />
			<path d="M23.4 21 h1.2" stroke={INK} strokeWidth="0.9" />
		</>
	),
	// Mel: enthusiastic. Wild hair, round glasses, white lab coat with a green badge.
	mel: (
		<>
			<path d="M4 50 q2 -14 20 -15 q18 1 20 15z" fill="#ecebe4" />
			<path d="M20 36 l4 14 l4 -14" fill="var(--adv)" />
			<path d="M21.5 36 l2.5 5 l2.5 -5" fill="#ecebe4" />
			<rect x="32" y="41" width="6" height="4" rx="0.8" fill="var(--adv)" />
			<rect x="19" y="30" width="10" height="7" rx="3" fill={SKIN.mel} />
			<path d="M15 20 q-3 -12 9 -11 q12 -1 9 11 q-2 -6 -9 -6 q-7 0 -9 6z" fill="#6b3d1f" />
			<path d="M16 11 l-2 -4 M21 9 l-1 -4 M28 9 l2 -4 M33 12 l3 -3" stroke="#6b3d1f" strokeWidth="2.2" strokeLinecap="round" />
			<Face skin={SKIN.mel} smile={2.2} />
			<circle cx="20.4" cy="21" r="3.1" fill="none" stroke={INK} strokeWidth="0.9" />
			<circle cx="27.6" cy="21" r="3.1" fill="none" stroke={INK} strokeWidth="0.9" />
			<path d="M23.5 21 h1" stroke={INK} strokeWidth="0.9" />
		</>
	),
	// Luci: courteous, faintly threatening. Slicked hair, dark suit, violet tie, thin smile.
	luci: (
		<>
			<path d="M4 50 q2 -14 20 -15 q18 1 20 15z" fill="#23202b" />
			<path d="M18 36 l6 6 l6 -6 l1 14 h-14z" fill="#e9e6ef" />
			<path d="M24 41 l-2 3 l2 6 l2 -6z" fill="var(--adv)" />
			<rect x="19" y="30" width="10" height="7" rx="3" fill={SKIN.luci} />
			<Face skin={SKIN.luci} smile={0.8} />
			<path d="M15.6 19 q1 -10 8.4 -10 q8 0 8.4 10 q-3 -6 -8.4 -6 q-5.4 0 -8.4 6z" fill="#14121a" />
			<path d="M19 18 h4 M25 18 h4" stroke={INK} strokeWidth="1" strokeLinecap="round" />
		</>
	),
};
