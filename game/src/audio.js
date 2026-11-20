// Synthesised sound for Solmar Bay: every effect is built with WebAudio,
// so the game ships no audio files and works fully offline.
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.startEngineHum();
      this.startSiren();
    } catch {
      this.ctx = null;
    }
  }

  startEngineHum() {
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 50;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);
    this.engineOsc.start();
  }

  setEngine(speed, inCar) {
    if (!this.ctx || !this.engineGain) return;
    const target = this.muted ? 0 : inCar ? 0.03 + Math.min(0.05, Math.abs(speed) / 9000) : 0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(46 + Math.abs(speed) / 9, this.ctx.currentTime, 0.1);
  }

  startSiren() {
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'sine';
    this.sirenOsc.frequency.value = 700;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.ctx.destination);
    this.sirenOsc.start();
  }

  setSiren(wanted, phase) {
    if (!this.ctx || !this.sirenGain) return;
    const on = wanted > 0 && !this.muted;
    this.sirenGain.gain.setTargetAtTime(on ? 0.02 : 0, this.ctx.currentTime, 0.2);
    if (on) this.sirenOsc.frequency.setTargetAtTime(phase % 1 < 0.5 ? 740 : 980, this.ctx.currentTime, 0.05);
  }

  blip(freq, dur, type = 'sine', vol = 0.08) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  }

  noise(dur, vol = 0.12) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(t);
  }

  shot() { this.noise(0.14, 0.16); this.blip(160, 0.1, 'square', 0.05); }
  empty() { this.blip(220, 0.06, 'square', 0.05); }
  pickup() { this.blip(880, 0.09); setTimeout(() => this.blip(1320, 0.12), 90); }
  missionComplete() { [523, 659, 784].forEach((f, i) => setTimeout(() => this.blip(f, 0.16), i * 110)); }
  missionFail() { this.blip(196, 0.3, 'sawtooth', 0.06); }
  shove() { this.noise(0.08, 0.08); }
  ram() { this.noise(0.1, 0.1); }
  busted() { this.blip(330, 0.4, 'sawtooth', 0.07); }
  enterCar() { this.blip(440, 0.08); setTimeout(() => this.blip(660, 0.1), 80); }
  click() { this.blip(660, 0.05, 'square', 0.04); }
}
