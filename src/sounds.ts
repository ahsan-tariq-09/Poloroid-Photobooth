// Measured from the decoded recordings, including the shutter's film-ejection tail.
export const FILM_LOAD_MS = 2800;
export const SHUTTER_SOUND_MS = 2490;
const clips = { load: "/audio/film-load.mp3", shutter: "/audio/shutter.mp3" };
type Clip = keyof typeof clips;
let audio: AudioContext | undefined;
let enabled = true, generation = 0;
const buffers: Partial<Record<Clip, Promise<AudioBuffer | undefined>>> = {};
const active = new Map<AudioScheduledSourceNode, () => void>();
const pending = new Set<() => void>();
try { enabled = localStorage.getItem("poloroid-sound") !== "off"; } catch { /* Storage can be unavailable in private mode. */ }
export const soundEnabled = () => enabled;

function context() {
  try { return audio ??= new AudioContext(); } catch { return undefined; }
}
function loadClip(kind: Clip, ctx: AudioContext) {
  return buffers[kind] ??= fetch(clips[kind]).then(response => {
    if (!response.ok) throw new Error("Audio unavailable");
    return response.arrayBuffer();
  }).then(data => ctx.decodeAudioData(data)).catch(() => {
    delete buffers[kind]; // A later gesture can retry a failed download.
    return undefined;
  });
}
export async function preloadSounds() {
  const ctx = context();
  if (ctx) await Promise.all([loadClip("load", ctx), loadClip("shutter", ctx)]);
}
export function stopSounds() {
  generation++;
  for (const cancel of pending) cancel();
  for (const [source, clean] of active) {
    try { source.stop(); } catch { /* A source may have just ended. */ }
    clean();
  }
}
document.addEventListener("visibilitychange", () => { if (document.hidden) stopSounds(); });
export function setSoundEnabled(value: boolean) {
  enabled = value;
  try { localStorage.setItem("poloroid-sound", value ? "on" : "off"); } catch { /* The session preference still works. */ }
  if (value) void unlockSound(); else stopSounds();
}
export async function unlockSound() {
  if (!enabled || document.hidden) return;
  const ctx = context();
  // Resume before awaiting downloads so mobile browsers retain the user gesture.
  try { await ctx?.resume(); } catch { /* Sound is optional. */ }
}
function track(source: AudioScheduledSourceNode, nodes: AudioNode[]) {
  const clean = () => { source.disconnect(); nodes.forEach(node => node.disconnect()); active.delete(source); };
  active.set(source, clean);
  source.onended = clean;
}
export async function playSound(kind: Clip | "paper" | "tick") {
  if (!enabled || document.hidden) return;
  if (kind === "load" || kind === "shutter") stopSounds();
  const token = generation, requested = performance.now(), resumed = unlockSound(), ctx = audio;
  if (!ctx) return;
  let cancel!: () => void;
  const cancelled = new Promise<undefined>(resolve => { cancel = () => resolve(undefined); pending.add(cancel); });
  const timeout = setTimeout(cancel, 2000);
  try {
    const ready = await Promise.race([Promise.all([resumed, kind === "load" || kind === "shutter" ? loadClip(kind, ctx) : undefined]), cancelled]);
    // A late decode/resume must not attach an old effect to a newer camera action.
    if (!ready || !enabled || document.hidden || token !== generation || ctx.state !== "running") return;
    if ((kind === "tick" || kind === "paper") && performance.now() - requested > 250) return;
    const buffer = ready[1];
    if (kind === "load" || kind === "shutter") {
      if (!buffer) return;
      const source = ctx.createBufferSource(); source.buffer = buffer;
      source.connect(ctx.destination); track(source, []);
      source.start();
      return;
    }
    const duration = kind === "paper" ? .45 : .06;
    const gain = ctx.createGain(); gain.connect(ctx.destination);
    gain.gain.setValueAtTime(kind === "tick" ? .025 : .045, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + duration);
    if (kind === "tick") {
      const tone = ctx.createOscillator(); tone.frequency.value = 740; tone.connect(gain);
      track(tone, [gain]); tone.start(); tone.stop(ctx.currentTime + duration);
    } else {
      const noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate), data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * .3;
      const source = ctx.createBufferSource(); source.buffer = noise;
      const filter = ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 900;
      source.connect(filter); filter.connect(gain); track(source, [filter, gain]); source.start();
    }
  } catch { /* Audio failure never blocks the camera or scrapbook. */ }
  finally { clearTimeout(timeout); pending.delete(cancel); }
}
