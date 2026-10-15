/** A deliberately quiet, procedural winter soundscape. No audio is made before start(). */
export class Soundscape {
  constructor() {
    this.context = null;
    this.master = null;
    this.muted = false;
    this.disposed = false;
    this.layers = [];
    this.activeSources = new Set();
    this.timeouts = new Set();
    this.environment = { wind: 0.45, river: 0, shelter: 0 };
    this.lastStep = -Infinity;
    this.lastCall = -Infinity;
    this.callInProgress = false;
    this.callToken = 0;
  }

  /** Call this from the start / audio button's click handler. */
  async start() {
    if (this.disposed) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!this.context) {
      this.context = new AudioContextClass();
      const ctx = this.context;
      this.master = ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(ctx.destination);
      this.noise = this.makeNoise(false);
      this.darkNoise = this.makeNoise(true);
      this.wind = this.makeLayer(this.darkNoise, 65, 620);
      this.river = this.makeLayer(this.noise, 230, 1850);
      // An almost imperceptible, slow movement in the wind; never a musical tone.
      const drift = ctx.createOscillator();
      const depth = ctx.createGain();
      drift.type = 'sine';
      drift.frequency.value = 0.071;
      depth.gain.value = 110;
      drift.connect(depth);
      depth.connect(this.wind.lowpass.frequency);
      drift.start();
      this.layers.push(drift);
    }
    if (this.context.state === 'suspended') await this.context.resume();
    if (this.disposed) return;
    this.ramp(this.master.gain, this.muted ? 0 : 0.48, 0.65);
    this.update(this.environment);
  }

  setMuted(value) {
    this.muted = Boolean(value);
    if (this.master) this.ramp(this.master.gain, this.muted ? 0 : 0.48, 0.35);
    if (this.muted) {
      this.cancelCall();
      if (this.context) {
        for (const source of this.activeSources) {
          try { source.stop(this.context.currentTime + 0.36); } catch (_) { /* Already finished. */ }
        }
      }
    }
  }

  /** Values are clamped to 0–1. Safe to call once per animation frame. */
  update(values = {}) {
    for (const name of ['wind', 'river', 'shelter']) {
      if (Number.isFinite(values[name])) this.environment[name] = Math.max(0, Math.min(1, values[name]));
    }
    if (!this.context || this.disposed) return;
    const { wind, river, shelter } = this.environment;
    // Exponential smoothing avoids gain discontinuities as the player crosses a zone.
    const now = this.context.currentTime;
    this.wind.gain.gain.setTargetAtTime((0.008 + wind * 0.043) * (1 - shelter * 0.83), now, 0.85);
    this.river.gain.gain.setTargetAtTime(river * river * 0.037 * (1 - shelter * 0.58), now, 1.15);
  }

  step() {
    if (!this.canPlay()) return;
    const now = this.context.currentTime;
    if (now - this.lastStep < 0.24) return;
    this.lastStep = now;
    this.noiseBurst({ duration: 0.19, volume: 0.075, low: 145, high: 1050, attack: 0.015 });
    this.noiseBurst({ duration: 0.10, volume: 0.025, low: 1000, high: 3400, delay: 0.03, attack: 0.006 });
  }

  rustle() {
    if (!this.canPlay()) return;
    this.noiseBurst({ duration: 0.52, volume: 0.07, low: 240, high: 2300, attack: 0.055 });
    this.noiseBurst({ duration: 0.3, volume: 0.037, low: 120, high: 1350, delay: 0.32, attack: 0.04 });
  }

  splash() {
    if (!this.canPlay()) return;
    this.noiseBurst({ duration: 0.40, volume: 0.075, low: 600, high: 4700, attack: 0.008 });
    this.noiseBurst({ duration: 0.65, volume: 0.032, low: 170, high: 1700, delay: 0.07, attack: 0.025 });
    this.softTone(420, 0.13, 0.027, 0, 185);
  }

  call() {
    if (!this.canPlay() || this.callInProgress) return;
    const now = performance.now();
    if (now - this.lastCall < 6500) return;
    this.lastCall = now;
    this.callInProgress = true;
    const token = ++this.callToken;
    const synth = window.speechSynthesis;
    const voices = synth?.getVoices() || [];
    const voice = voices.find(v => /zh[-_]HK|yue/i.test(v.lang)) || voices.find(v => /^zh/i.test(v.lang));
    if (synth && window.SpeechSynthesisUtterance && voice) {
      const speak = (volume, rate, done) => {
        if (token !== this.callToken || !this.canPlay()) return;
        const utterance = new SpeechSynthesisUtterance('有人嗎？');
        utterance.voice = voice;
        utterance.lang = voice.lang;
        utterance.rate = rate;
        utterance.pitch = 0.98;
        utterance.volume = volume;
        utterance.onend = () => {
          if (token === this.callToken) done();
        };
        utterance.onerror = () => {
          if (token === this.callToken) this.callInProgress = false;
        };
        synth.speak(utterance);
      };
      speak(0.20, 0.88, () => {
        this.later(() => speak(0.055, 0.77, () => { this.callInProgress = false; }), 580);
      });
      // Prevent a stalled browser speech engine from locking out later calls.
      this.later(() => {
        if (token === this.callToken) this.callInProgress = false;
      }, 6000);
    } else {
      // Soft, short call-and-echo cue for systems without a Chinese voice.
      for (const [offset, level] of [[0, 0.042], [1.4, 0.014], [2.35, 0.005]]) {
        this.softTone(370, 0.28, level, offset);
        this.softTone(312, 0.38, level * 0.8, offset + 0.26);
      }
      this.later(() => { this.callInProgress = false; }, 3100);
    }
  }

  canPlay() {
    return Boolean(this.context && this.context.state === 'running' && !this.muted && !this.disposed);
  }

  makeNoise(dark) {
    const ctx = this.context;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    let previous = 0;
    for (let i = 0; i < samples.length; i++) {
      const white = Math.random() * 2 - 1;
      if (dark) {
        previous = (previous + white * 0.024) / 1.024;
        samples[i] = previous * 3.4;
      } else samples[i] = white * 0.58;
    }
    // Make the loop boundary continuous, so there is no periodic click.
    const fade = Math.floor(ctx.sampleRate * 0.025);
    const seam = (samples[0] + samples[samples.length - 1]) * 0.5;
    for (let i = 0; i < fade; i++) {
      const weight = i / fade;
      samples[i] = seam * (1 - weight) + samples[i] * weight;
      const end = samples.length - 1 - i;
      samples[end] = seam * (1 - weight) + samples[end] * weight;
    }
    return buffer;
  }

  makeLayer(buffer, low, high) {
    const ctx = this.context;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = low;
    highpass.Q.value = 0.5;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = high;
    lowpass.Q.value = 0.5;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(highpass).connect(lowpass).connect(gain).connect(this.master);
    source.start(0, Math.random() * buffer.duration);
    this.layers.push(source);
    return { source, gain, lowpass };
  }

  noiseBurst({ duration, volume, low, high, delay = 0, attack = 0.015 }) {
    const ctx = this.context;
    const start = ctx.currentTime + delay;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = low;
    hp.Q.value = 0.4;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = high;
    lp.Q.value = 0.5;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    gain.gain.linearRampToValueAtTime(0, start + duration + 0.025);
    source.connect(hp).connect(lp).connect(gain).connect(this.master);
    this.track(source, [hp, lp, gain]);
    source.start(start, Math.random() * 2);
    source.stop(start + duration + 0.04);
  }

  softTone(frequency, duration, volume, delay = 0, endFrequency = frequency) {
    const ctx = this.context;
    const start = ctx.currentTime + delay;
    const source = ctx.createOscillator();
    const gain = ctx.createGain();
    source.type = 'sine';
    source.frequency.setValueAtTime(frequency, start);
    source.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    gain.gain.linearRampToValueAtTime(0, start + duration + 0.03);
    source.connect(gain).connect(this.master);
    this.track(source, [gain]);
    source.start(start);
    source.stop(start + duration + 0.04);
  }

  track(source, nodes) {
    this.activeSources.add(source);
    source.onended = () => {
      this.activeSources.delete(source);
      source.disconnect();
      for (const node of nodes) node.disconnect();
    };
  }

  ramp(param, value, duration) {
    const now = this.context.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(value, now + duration);
  }

  later(fn, ms) {
    const timer = window.setTimeout(() => {
      this.timeouts.delete(timer);
      if (!this.disposed) fn();
    }, ms);
    this.timeouts.add(timer);
  }

  cancelCall() {
    ++this.callToken;
    this.callInProgress = false;
    for (const timer of this.timeouts) window.clearTimeout(timer);
    this.timeouts.clear();
    // This prototype owns its speech queue and never leaves a whispered echo queued.
    window.speechSynthesis?.cancel();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelCall();
    for (const source of [...this.layers, ...this.activeSources]) {
      try { source.stop(); } catch (_) { /* Already finished. */ }
      source.disconnect();
    }
    this.layers.length = 0;
    this.activeSources.clear();
    this.master?.disconnect();
    this.context?.close().catch(() => {});
  }
}
