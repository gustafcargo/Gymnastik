/**
 * sfx – enkla spelljud genererade i kod via Web Audio API.
 *
 * Ingen mp3-asset behövs, vilket håller bundeln liten och laddningen snabb.
 * Alla playX() läser `useAudioStore.getState().muted` innan ljudet startas
 * och returnerar tidigt om mute är aktivt. Master-volymen appliceras på
 * en gemensam GainNode så muting/volym är billig runtime-kostnad.
 *
 * AudioContext initieras lazy vid första play-anrop: browsers kräver en
 * user gesture innan ljud får starta, och det första play()-anropet
 * kommer typiskt från ett click/touch i spelläget.
 */
import { useAudioStore } from "../store/useAudioStore";

let _ctx: AudioContext | null = null;
let _master: GainNode | null = null;

function ctx(): AudioContext | null {
  if (_ctx) return _ctx;
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    _ctx = new AC();
    _master = _ctx.createGain();
    _master.gain.value = useAudioStore.getState().volume;
    _master.connect(_ctx.destination);
    // Prenumerera på volymändringar så master följer storen
    useAudioStore.subscribe((s) => {
      if (_master) _master.gain.value = s.muted ? 0 : s.volume;
    });
  } catch {
    return null;
  }
  return _ctx;
}

function canPlay(): { ac: AudioContext; master: GainNode } | null {
  if (useAudioStore.getState().muted) return null;
  const ac = ctx();
  if (!ac || !_master) return null;
  // Resume om browsern pausat kontexten (auto-play-policy)
  if (ac.state === "suspended") void ac.resume();
  return { ac, master: _master };
}

/** Kort tvåtonig klang – mount/hopp-upp. */
export function playMount(): void {
  const p = canPlay();
  if (!p) return;
  const { ac, master } = p;
  const t0 = ac.currentTime;
  [660, 990].forEach((freq, i) => {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(g);
    g.connect(master);
    const start = t0 + i * 0.06;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(0.25, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
    osc.start(start);
    osc.stop(start + 0.24);
  });
}

/** Sjunkande tvåton – dismount. */
export function playDismount(): void {
  const p = canPlay();
  if (!p) return;
  const { ac, master } = p;
  const t0 = ac.currentTime;
  [880, 550].forEach((freq, i) => {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(g);
    g.connect(master);
    const start = t0 + i * 0.06;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(0.2, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
    osc.start(start);
    osc.stop(start + 0.24);
  });
}

/** Whoosh vid trickstart – kort filtrerat brus. */
export function playTrick(): void {
  const p = canPlay();
  if (!p) return;
  const { ac, master } = p;
  const dur = 0.35;
  const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * 0.6;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 900;
  bp.Q.value = 2.5;
  const g = ac.createGain();
  const t0 = ac.currentTime;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(0.35, t0 + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  // Svep bp-frekvens uppåt för whoosh-känsla
  bp.frequency.setValueAtTime(400, t0);
  bp.frequency.exponentialRampToValueAtTime(2400, t0 + dur);
  src.connect(bp);
  bp.connect(g);
  g.connect(master);
  src.start(t0);
  src.stop(t0 + dur);
}

/** Landning – kort lågfrekvent dunk. */
export function playLanding(): void {
  const p = canPlay();
  if (!p) return;
  const { ac, master } = p;
  const t0 = ac.currentTime;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(140, t0);
  osc.frequency.exponentialRampToValueAtTime(55, t0 + 0.22);
  osc.connect(g);
  g.connect(master);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(0.4, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
  osc.start(t0);
  osc.stop(t0 + 0.3);
}

/** Stegklick – subtil tick. */
export function playStep(): void {
  const p = canPlay();
  if (!p) return;
  const { ac, master } = p;
  const t0 = ac.currentTime;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = "triangle";
  osc.frequency.value = 180;
  osc.connect(g);
  g.connect(master);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(0.08, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.07);
  osc.start(t0);
  osc.stop(t0 + 0.08);
}

/** "Upptaget"-ton – när ett redskap är låst av en annan spelare. */
export function playDenied(): void {
  const p = canPlay();
  if (!p) return;
  const { ac, master } = p;
  const t0 = ac.currentTime;
  [320, 260].forEach((freq, i) => {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    osc.connect(g);
    g.connect(master);
    const start = t0 + i * 0.08;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(0.15, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);
    osc.start(start);
    osc.stop(start + 0.15);
  });
}
