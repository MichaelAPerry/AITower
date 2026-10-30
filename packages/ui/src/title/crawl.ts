/** The opening crawl: a few cards of Compute Authority prose before a new game, in the manner of an old film's title sequence. */

export const CRAWL_LINES: readonly string[] = [
	"The year is 20XX, you have been assigned the job as datacenter manager.",
	"Everyone agrees the Singularity is coming but nobody agrees what it will look like.",
	"Will it be a machine dominated world with minds lost to chrome? Or something else?",
	"What you build and what you think are the producers of this world.",
	"The four advisors given to you are to help lead you to the world you want.",
	"This tower and perhaps the world is under your care.",
];

/** Seconds between one line appearing and the next. */
export const CRAWL_STEP_S = 2.6;
/** Seconds each line takes to fade in. */
export const CRAWL_FADE_S = 1.4;
/** Seconds to hold the last line before the crawl ends by itself. */
export const CRAWL_HOLD_S = 3;

/** When line `i` starts appearing, in seconds. */
export const lineDelay = (i: number): number => i * CRAWL_STEP_S;

/** Total length of the crawl until it ends by itself, in seconds. */
export const crawlSeconds = (lines: readonly string[] = CRAWL_LINES): number => lineDelay(Math.max(0, lines.length - 1)) + CRAWL_FADE_S + CRAWL_HOLD_S;

/** Reduced motion: the user's setting or the system preference. The crawl then shows every line at once and waits for a click. */
export function reducedMotion(setting: boolean, win: { matchMedia?: (q: string) => { matches: boolean } } | undefined = typeof window === "undefined" ? undefined : window): boolean {
	if (setting) return true;
	try {
		return !!win?.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
	} catch {
		return false;
	}
}

/** Keys that skip the crawl. */
export const isSkipKey = (key: string): boolean => key === "Escape" || key === "Enter" || key === " " || key === "Spacebar";
