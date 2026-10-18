let ctx: AudioContext | null = null;
function tone(freq: number, dur: number, type: OscillatorType = "sine", delay = 0) {
  if (typeof window === "undefined") return;
  ctx ??= new AudioContext();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t = ctx.currentTime + delay;
  g.gain.setValueAtTime(0.15, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur);
}
export const sfx = {
  dice: () => [0, 0.06, 0.12, 0.18].forEach((d) => tone(200 + Math.random() * 300, 0.05, "square", d)),
  move: () => tone(660, 0.08, "triangle"),
  capture: () => { tone(180, 0.2, "sawtooth"); tone(120, 0.3, "sawtooth", 0.1); },
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, "triangle", i * 0.15)),
};
