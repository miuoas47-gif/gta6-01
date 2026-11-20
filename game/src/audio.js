// Sound, synthesized live with WebAudio — no audio files. Engine hum follows
// the car's speed, the siren wails in two tones, and pickups, shots and
// crashes are short oscillator and noise bursts. Everything is guarded: if
// the browser has no audio, the game just stays silent.

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(ctx.destination);
      sirenOsc.start();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function blip(freq, dur, type, vol) {
    const c = ensure();
    if (!c) return;
    try {
      if (c.state === 'suspended') void c.resume();
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + dur);
    } catch {
      // A blip failing must never break the game.
    }
  }

  function noise(dur, vol) {
    const c = ensure();
    if (!c) return;
    try {
      if (c.state === 'suspended') void c.resume();
      const len = Math.max(1, Math.floor(c.sampleRate * dur));
      const buffer = c.createBuffer(1, len, c.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = c.createBufferSource();
      src.buffer = buffer;
      const gain = c.createGain();
      gain.gain.value = vol;
      src.connect(gain);
      gain.connect(c.destination);
      src.start();
    } catch {
      // Noise failing must never break the game.
    }
  }

  return {
    unlock() { ensure(); },
    /** Call every frame: engine follows speed, siren follows wanted level. */
    update(speed, wanted, dt) {
      const c = ensure();
      if (!c) return;
      try {
        if (c.state === 'suspended') void c.resume();
        const target = speed > 30 ? 0.05 + Math.min(0.09, Math.abs(speed) / 9000) : 0;
        engineGain.gain.setTargetAtTime(target, c.currentTime, 0.08);
        engineOsc.frequency.setTargetAtTime(48 + Math.abs(speed) * 0.16, c.currentTime, 0.08);
        if (wanted > 0) {
          sirenTimer -= dt;
          if (sirenTimer <= 0) {
            sirenTimer = 0.42;
            sirenHigh = !sirenHigh;
            sirenOsc.frequency.setTargetAtTime(sirenHigh ? 880 : 660, c.currentTime, 0.05);
          }
          sirenGain.gain.setTargetAtTime(0.035, c.currentTime, 0.1);
        } else {
          sirenGain.gain.setTargetAtTime(0, c.currentTime, 0.1);
        }
      } catch {
        // Audio updates must never break the frame.
      }
    },
    pickup() { blip(880, 0.14, 'sine', 0.16); setTimeout(() => blip(1320, 0.18, 'sine', 0.14), 70); },
    shot() { noise(0.09, 0.22); blip(180, 0.07, 'square', 0.1); },
    crash() { noise(0.22, 0.18); },
    punch() { noise(0.08, 0.14); },
    mission() { blip(523, 0.16, 'triangle', 0.16); setTimeout(() => blip(659, 0.16, 'triangle', 0.16), 120); setTimeout(() => blip(784, 0.3, 'triangle', 0.16), 240); },
    fail() { blip(220, 0.3, 'sawtooth', 0.1); },
  };
}
