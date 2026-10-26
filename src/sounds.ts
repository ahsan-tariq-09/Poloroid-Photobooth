let audio: AudioContext | undefined;
let enabled = true;
try { enabled = localStorage.getItem("poloroid-sound") !== "off"; } catch { /* Storage can be unavailable in private mode. */ }
export const soundEnabled = () => enabled;
export function setSoundEnabled(value: boolean) {
  enabled = value;
  try { localStorage.setItem("poloroid-sound", value ? "on" : "off"); } catch { /* The session preference still works. */ }
  if (value) unlockSound();
}
export function unlockSound() {
  if (!enabled) return;
  try { audio ??= new AudioContext(); void audio.resume().catch(()=>{}); } catch { /* Sound is optional. */ }
}
export function playSound(kind: "shutter" | "paper" | "tick") {
  if (!enabled || document.hidden) return;
  unlockSound();
  if (!audio || audio.state !== "running") return;
  const ctx = audio, duration = kind === "paper" ? .45 : kind === "shutter" ? .13 : .06;
  const gain = ctx.createGain(); gain.connect(ctx.destination);
  gain.gain.setValueAtTime(kind === "tick" ? .025 : .045, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + duration);
  if (kind === "tick") {
    const tone = ctx.createOscillator(); tone.frequency.value = 740; tone.connect(gain); tone.start(); tone.stop(ctx.currentTime+duration); tone.onended=()=>gain.disconnect();
  } else {
    const buffer = ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate), data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++) data[i]=(Math.random()*2-1)*(kind === "paper" ? .3 : 1);
    const source = ctx.createBufferSource(); source.buffer=buffer;
    const filter=ctx.createBiquadFilter(); filter.type="lowpass"; filter.frequency.value=kind === "paper"?900:2800;
    source.connect(filter); filter.connect(gain); source.start(); source.onended=()=>{filter.disconnect();gain.disconnect();};
  }
}
