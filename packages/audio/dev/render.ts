// Offline render of the music engine through the real mixer: a scripted 20 s timeline.
import { createMixer } from "../src/mixer";
import { createMusic } from "../src/music";
import { musicParams } from "../src/music/director";

const SR = 44100;

async function render(seconds: number): Promise<{ sr: number; left: number[]; right: number[]; voicePeak: number }> {
	const ctx = new OfflineAudioContext(2, Math.ceil(seconds * SR), SR);
	const mixer = createMixer(ctx as unknown as AudioContext, 0.7, 0.6);
	const music = createMusic(ctx, mixer.buses.music);
	let voicePeak = 0;
	let prev: ReturnType<typeof musicParams> | undefined;
	// Timeline: load/night/stingers/duck driven from suspend points.
	const view = (t: number) => ({ itKw: t < 6 ? 0 : t < 10 ? 60 : 200, minuteOfDay: t < 14 ? 720 : 1320, gameOver: null });
	const events = (t: number) => (Math.abs(t - 10) < 0.01 ? [{ type: "decisionIssued", decisionId: 1, eventId: "x" }] : Math.abs(t - 15) < 0.01 ? [{ type: "tierUp", tier: 2, reward: 1 }] : []);
	const step = 0.05;
	const jobs: Promise<void>[] = [];
	for (let t = 0; t < seconds; t += step) {
		const tt = Math.round(t / step) * step;
		jobs.push(
			ctx.suspend(Math.max(tt, 128 / SR)).then(() => {
				const now = ctx.currentTime;
				prev = musicParams(view(now) as never, events(Math.round(now / step) * step) as never, false, prev);
				music.update(prev);
				if (Math.abs(now - 17) < step / 2) mixer.duck();
				music.pump(now);
				voicePeak = Math.max(voicePeak, music.voices());
				void ctx.resume();
			}),
		);
	}
	const buf = await ctx.startRendering();
	await Promise.all(jobs);
	music.destroy();
	return { sr: SR, left: Array.from(buf.getChannelData(0)), right: Array.from(buf.getChannelData(1)), voicePeak };
}
(window as unknown as { render: typeof render }).render = render;
