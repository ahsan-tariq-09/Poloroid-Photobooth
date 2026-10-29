import { afterEach, beforeEach, expect, it, vi } from "vitest";

type Sounds = typeof import("./sounds");
let sounds: Sounds;
let hidden: boolean;
let visibility: () => void;
let saved: string | null;
const sources: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; buffer: unknown }[] = [];
const ctx = {
  state: "suspended", destination: {},
  resume: vi.fn(), decodeAudioData: vi.fn(),
  createBufferSource: vi.fn(() => {
    const source = { start: vi.fn(), stop: vi.fn(), disconnect: vi.fn(), connect: vi.fn(), buffer: null as unknown, onended: null };
    sources.push(source); return source;
  }),
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
const decoded = { duration: 6 } as AudioBuffer;
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

beforeEach(async () => {
  vi.resetModules(); vi.clearAllMocks(); sources.length = 0; hidden = false; saved = null;
  ctx.state = "suspended";
  ctx.resume.mockImplementation(async () => { ctx.state = "running"; });
  ctx.decodeAudioData.mockResolvedValue(decoded);
  vi.stubGlobal("AudioContext", function () { return ctx; });
  vi.stubGlobal("document", { get hidden() { return hidden; }, addEventListener: (_name: string, listener: () => void) => { visibility = listener; } });
  vi.stubGlobal("localStorage", { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value; } });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) }));
  sounds = await import("./sounds");
});
afterEach(() => { sounds.stopSounds(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it("defaults on, preserves persisted mute, and stores changes", async () => {
  expect(sounds.soundEnabled()).toBe(true);
  sounds.setSoundEnabled(false);
  expect(saved).toBe("off");
  vi.resetModules(); sounds = await import("./sounds");
  expect(sounds.soundEnabled()).toBe(false);
  await sounds.playSound("load");
  expect(ctx.resume).not.toHaveBeenCalled(); expect(sources).toHaveLength(0);
  sounds.setSoundEnabled(true); expect(saved).toBe("on");
});
it("preloads both recordings once without starting audio", async () => {
  await sounds.preloadSounds(); await sounds.preloadSounds();
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch).toHaveBeenCalledWith("/audio/film-load.mp3");
  expect(fetch).toHaveBeenCalledWith("/audio/shutter.mp3");
  expect(ctx.resume).not.toHaveBeenCalled(); expect(sources).toHaveLength(0);
  expect(sounds.FILM_LOAD_MS).toBe(2800); expect(sounds.SHUTTER_SOUND_MS).toBe(7728);
});
it("resumes inside the gesture and awaits both resume and asynchronous decoding", async () => {
  const resume = deferred<void>(), decode = deferred<AudioBuffer>();
  ctx.resume.mockReturnValue(resume.promise); ctx.decodeAudioData.mockReturnValue(decode.promise);
  const playing = sounds.playSound("load");
  expect(ctx.resume).toHaveBeenCalledOnce();
  await flush(); expect(sources).toHaveLength(0);
  decode.resolve(decoded); await flush(); expect(sources).toHaveLength(0);
  ctx.state = "running"; resume.resolve(); await playing;
  expect(sources).toHaveLength(1); expect(sources[0].buffer).toBe(decoded); expect(sources[0].start).toHaveBeenCalledOnce();
});
it.each(["mute", "hidden", "cancel"])("stops active recordings immediately on %s", async reason => {
  await sounds.playSound("shutter");
  if (reason === "mute") sounds.setSoundEnabled(false);
  else if (reason === "hidden") { hidden = true; visibility(); }
  else sounds.stopSounds();
  expect(sources[0].stop).toHaveBeenCalledOnce(); expect(sources[0].disconnect).toHaveBeenCalledOnce();
});
it.each(["mute", "hidden", "cancel"])("settles pending startup on %s and never plays after decode", async reason => {
  const decode = deferred<AudioBuffer>(); ctx.decodeAudioData.mockReturnValue(decode.promise);
  const playing = sounds.playSound("load"); await flush();
  if (reason === "mute") sounds.setSoundEnabled(false);
  else if (reason === "hidden") { hidden = true; visibility(); }
  else sounds.stopSounds();
  await playing;
  hidden = false; sounds.setSoundEnabled(true); decode.resolve(decoded); await flush();
  expect(sources).toHaveLength(0);
});
it("supersedes pending loads with the next camera recording", async () => {
  const decode = deferred<AudioBuffer>(); ctx.decodeAudioData.mockReturnValueOnce(decode.promise).mockResolvedValueOnce(decoded);
  const old = sounds.playSound("load"); await flush();
  await sounds.playSound("shutter"); await old;
  decode.resolve(decoded); await flush();
  expect(sources).toHaveLength(1); expect(sources[0].start).toHaveBeenCalledOnce();
});
it("bounds startup to two seconds and does not play a timed-out recording later", async () => {
  vi.useFakeTimers(); const decode = deferred<AudioBuffer>(); ctx.decodeAudioData.mockReturnValue(decode.promise);
  const playing = sounds.playSound("shutter"); await flush();
  await vi.advanceTimersByTimeAsync(2000); await playing;
  decode.resolve(decoded); await flush(); expect(sources).toHaveLength(0);
});
it("retries a failed asset fetch on a later gesture", async () => {
  vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
  await sounds.playSound("load"); expect(sources).toHaveLength(0);
  await sounds.playSound("load"); expect(sources).toHaveLength(1); expect(fetch).toHaveBeenCalledTimes(2);
});
