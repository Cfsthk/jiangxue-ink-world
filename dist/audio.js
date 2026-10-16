/** A deliberately quiet, procedural winter soundscape. No audio is made before start(). */
export class Soundscape {
  constructor() {
    this.context = null;
    this.master = null;
    this.muted = false;
    this.disposed = false;
    this.layers = [];
    this.activeSources = new Set();
    this.transientGains = new Map();
    this.environment = { wind: 0.45, river: 0, shelter: 0 };
    this.lastStep = -Infinity;
    this.pipaBuffers = new Map();
    this.musicSources = new Set();
    this.nextPhraseAt = null;
    this.phrasesPlayed = 0;
    this.lastPhraseAt = null;
    this.lastMusicMix = 0;
    this.stepInterval = 0.24;
    this.lastStepDuration = 0;
    this.windScheduledUntil = 0;
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
      this.windGust = ctx.createGain();
      this.windGust.gain.value = 0.38;
      this.windGust.connect(this.master);
      this.wind = this.makeLayer(this.darkNoise, 65, 620, this.windGust);
      this.river = this.makeLayer(this.noise, 230, 1850);
    }
    if (this.context.state === 'suspended') await this.context.resume();
    if (this.disposed) return;
    this.ramp(this.master.gain, this.muted ? 0 : 0.48, 0.65);
    this.update(this.environment);
    this.queueWindGusts(true);
  }

  setMuted(value) {
    const changed = this.muted !== Boolean(value);
    this.muted = Boolean(value);
    if (this.master) this.ramp(this.master.gain, this.muted ? 0 : 0.48, 0.35);
    if (this.muted) {
      this.nextPhraseAt = null;
      this.fadeTransients();
      if (this.context && this.windGust) {
        this.ramp(this.windGust.gain, 0.38, 0.4);
        this.windScheduledUntil = 0;
      }
    } else if (changed) {
      this.nextPhraseAt = null;
      this.queueWindGusts(true);
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
    this.wind.gain.gain.setTargetAtTime((0.011 + wind * 0.060) * (1 - shelter * 0.83), now, 0.85);
    this.river.gain.gain.setTargetAtTime(river * river * 0.037 * (1 - shelter * 0.58), now, 1.15);
    this.queueWindGusts();
    this.queuePipaPhrase();
  }

  /** Native gain automation makes real gusts; random rise, hold and lull lengths
   * avoid the fixed rhythm of a looping oscillator or a filter-only effect. */
  queueWindGusts(reset = false) {
    if (!this.canPlay() || !this.windGust) return;
    const now = this.context.currentTime, gain = this.windGust.gain, filter = this.wind.lowpass.frequency;
    if (reset || this.windScheduledUntil < now) {
      this.ramp(gain, 0.38, 0.55);
      this.ramp(filter, 420, 0.55);
      this.windScheduledUntil = now + 0.55;
    }
    while (this.windScheduledUntil < now + 24) {
      const peak = 0.95 + Math.random() * 0.85;
      const lull = 0.20 + Math.random() * 0.29;
      const riseEnd = this.windScheduledUntil + 2.0 + Math.random() * 2.8;
      const holdEnd = riseEnd + 0.3 + Math.random() * 1.0;
      const fallEnd = holdEnd + 2.8 + Math.random() * 2.7;
      const quietEnd = fallEnd + 0.6 + Math.random() * 1.8;
      gain.linearRampToValueAtTime(peak, riseEnd);
      gain.setValueAtTime(peak, holdEnd);
      gain.linearRampToValueAtTime(lull, fallEnd);
      gain.setValueAtTime(lull, quietEnd);
      filter.linearRampToValueAtTime(500 + peak * 160, riseEnd);
      filter.setValueAtTime(500 + peak * 160, holdEnd);
      filter.linearRampToValueAtTime(340 + lull * 200, fallEnd);
      filter.setValueAtTime(340 + lull * 200, quietEnd);
      this.windScheduledUntil = quietEnd;
    }
  }

  step() {
    if (!this.canPlay()) return;
    const now = this.context.currentTime;
    if (now - this.lastStep < this.stepInterval) return;
    this.lastStep = now;
    this.noiseBurst({ duration: 0.19, volume: 0.075, low: 145, high: 1050, attack: 0.015 });
    this.noiseBurst({ duration: 0.10, volume: 0.025, low: 1000, high: 3400, delay: 0.03, attack: 0.006 });
    this.lastStepDuration = 0.23;
  }

  rustle() {
    if (!this.canPlay()) return;
    this.noiseBurst({ duration: 0.52, volume: 0.07, low: 240, high: 2300, attack: 0.055 });
    this.noiseBurst({ duration: 0.3, volume: 0.037, low: 120, high: 1350, delay: 0.32, attack: 0.04 });
  }

  /** Unhurried pentatonic plucks with shorter spaces for wind between phrases.
   * The frame clock schedules only the current phrase, so returning from a
   * paused / hidden tab cannot play a backlog of missed music. */
  queuePipaPhrase() {
    if (!this.canPlay()) return;
    const now = this.context.currentTime;
    if (this.nextPhraseAt === null) {
      this.nextPhraseAt = now + 1 + Math.random();
      return;
    }
    if (now < this.nextPhraseAt) return;
    const motifs = [
      [[293.66, 0], [392.00, 1.7], [329.63, 3.6]],
      [[261.63, 0], [293.66, 1.9], [261.63, 3.5]],
      [[392.00, 0], [440.00, 1.5], [329.63, 3.3], [293.66, 5.2]],
      [[329.63, 0], [261.63, 1.8], [293.66, 3.5]],
    ];
    const notes = motifs[Math.floor(Math.random() * motifs.length)];
    const { wind, shelter } = this.environment;
    // Give the short, rapidly decaying plucks enough presence above the wind.
    const mix = 0.055 * (0.85 + wind * 0.15) * (1 - shelter * 0.12);
    notes.forEach(([frequency, delay], index) => {
      this.pluckPipa(frequency, mix * (index === 0 ? 1 : 0.88), delay);
    });
    this.phrasesPlayed++;
    this.lastPhraseAt = now;
    this.lastMusicMix = mix;
    this.nextPhraseAt = now + notes.at(-1)[1] + 5 + Math.random() * 3;
  }

  /** A damped plucked string with a small wooden-body resonance and nail
   * transient. A cached sample keeps later phrases cheap and avoids the
   * organ-like sustain of a bank of oscillators. */
  makePipaBuffer(frequency) {
    if (this.pipaBuffers.has(frequency)) return this.pipaBuffers.get(frequency);
    const ctx = this.context, duration = 2.5;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    const period = Math.max(3, Math.round(ctx.sampleRate / frequency - 0.5));
    const string = new Float32Array(period);
    let average = 0;
    for (let i = 0; i < period; i++) {
      string[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / period);
      average += string[i] / period;
    }
    for (let i = 0; i < period; i++) string[i] -= average;
    let peak = 0;
    for (let i = 0; i < samples.length; i++) {
      const index = i % period, t = i / ctx.sampleRate;
      const vibration = string[index];
      string[index] = 0.4982 * (vibration + string[(index + 1) % period]);
      const phase = Math.PI * 2 * frequency * t;
      const body = Math.sin(phase) * 0.13 * Math.exp(-3.8 * t)
        + Math.sin(phase * 2.003) * 0.055 * Math.exp(-7.6 * t);
      const nail = (Math.random() * 2 - 1) * 0.045 * Math.exp(-t * 280);
      const attack = Math.min(1, t / 0.0018);
      const release = Math.min(1, (duration - t) / 0.085);
      samples[i] = (vibration * Math.exp(-1.35 * t) + body + nail) * attack * release;
      peak = Math.max(peak, Math.abs(samples[i]));
    }
    const normalise = peak > 0 ? 0.72 / peak : 1;
    for (let i = 0; i < samples.length; i++) samples[i] *= normalise;
    this.pipaBuffers.set(frequency, buffer);
    return buffer;
  }

  pluckPipa(frequency, volume, delay = 0) {
    if (!this.canPlay()) return;
    const ctx = this.context, start = ctx.currentTime + delay;
    const source = ctx.createBufferSource();
    source.buffer = this.makePipaBuffer(frequency);
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 3100;
    lowpass.Q.value = 0.45;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.linearRampToValueAtTime(0, start + source.buffer.duration);
    source.connect(lowpass).connect(gain).connect(this.master);
    this.track(source, [lowpass, gain], gain.gain, 'music');
    source.start(start);
    source.stop(start + source.buffer.duration + 0.01);
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

  makeLayer(buffer, low, high, destination = this.master) {
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
    source.connect(highpass).connect(lowpass).connect(gain).connect(destination);
    source.start(0, Math.random() * buffer.duration);
    this.layers.push(source);
    return { source, gain, lowpass };
  }

  noiseBurst({ duration, volume, low, high, delay = 0, attack = 0.015, hold = 0, buffer = this.noise }) {
    const ctx = this.context;
    const start = ctx.currentTime + delay;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
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
    if (hold > 0) gain.gain.setValueAtTime(volume, start + Math.min(duration - 0.02, attack + hold));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    gain.gain.linearRampToValueAtTime(0, start + duration + 0.025);
    source.connect(hp).connect(lp).connect(gain).connect(this.master);
    this.track(source, [hp, lp, gain], gain.gain);
    source.start(start, Math.random() * 2);
    source.stop(start + duration + 0.04);
  }

  track(source, nodes, gain, kind = null) {
    this.activeSources.add(source);
    if (kind === 'music') this.musicSources.add(source);
    if (gain) this.transientGains.set(source, gain);
    source.onended = () => {
      this.activeSources.delete(source);
      this.musicSources.delete(source);
      this.transientGains.delete(source);
      source.disconnect();
      for (const node of nodes) node.disconnect();
    };
  }

  ramp(param, value, duration) {
    const now = this.context.currentTime;
    if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(now);
    else { const current = param.value; param.cancelScheduledValues(now); param.setValueAtTime(current, now); }
    param.linearRampToValueAtTime(value, now + duration);
  }

  fadeTransients() {
    if (!this.context) return;
    const now = this.context.currentTime;
    for (const source of this.activeSources) {
      const gain = this.transientGains.get(source);
      if (gain) this.ramp(gain, 0, 0.04);
      try { source.stop(now + 0.05); } catch (_) { /* Already finished. */ }
    }
  }

  /** Fade plucks and footfalls on restart, with a fresh quiet opening afterwards. */
  resetTransients() {
    this.fadeTransients();
    this.nextPhraseAt = null;
    this.phrasesPlayed = 0;
    this.lastPhraseAt = null;
    this.lastMusicMix = 0;
    this.lastStep = -Infinity;
    this.lastStepDuration = 0;
  }

  reset() { this.resetTransients(); }

  getDiagnostics() {
    return Object.freeze({
      running: this.context?.state === 'running', muted: this.muted,
      gustGain: this.windGust?.gain.value ?? 0,
      windLevel: this.wind?.gain.gain.value ?? 0, environment:{...this.environment},
      gustScheduledUntil: this.windScheduledUntil,
      lastStep: Number.isFinite(this.lastStep) ? this.lastStep : null,
      stepInterval: this.stepInterval, lastStepDuration: this.lastStepDuration,
      activeTransients: this.activeSources.size,
      music: Object.freeze({
        instrument: 'pipa', phrasesPlayed: this.phrasesPlayed,
        nextPhraseAt: this.nextPhraseAt, lastPhraseAt: this.lastPhraseAt,
        activePlucks: this.musicSources.size, mix: this.lastMusicMix,
        firstDelaySeconds: [1, 2], gapSeconds: [5, 8],
        noteSpacingSeconds: [1.5, 1.9], phraseNotes: [3, 4],
      }),
    });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.nextPhraseAt = null;
    for (const source of [...this.layers, ...this.activeSources]) {
      try { source.stop(); } catch (_) { /* Already finished. */ }
      source.disconnect();
    }
    this.layers.length = 0;
    this.activeSources.clear();
    this.transientGains.clear();
    this.musicSources.clear();
    this.pipaBuffers.clear();
    this.windGust?.disconnect();
    this.master?.disconnect();
    this.context?.close().catch(() => {});
  }
}
