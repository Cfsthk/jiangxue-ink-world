import test from 'node:test';
import assert from 'node:assert/strict';
import { Soundscape } from '../dist/audio.js';

class Param {
  constructor() { this.value = 0; }
  setValueAtTime(value) { this.value = value; }
  linearRampToValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
  setTargetAtTime(value) { this.value = value; }
  cancelAndHoldAtTime() {}
}
class Node {
  constructor() {
    this.gain = new Param(); this.frequency = new Param(); this.Q = new Param();
    this.starts = []; this.stops = [];
  }
  connect(node) { return node; }
  disconnect() { this.disconnected = true; }
  start(...args) { this.starts.push(args); }
  stop(time) { this.stops.push(time); }
}
class Context {
  constructor() {
    this.currentTime = 0; this.sampleRate = 12000; this.state = 'running';
    this.destination = new Node(); this.sources = [];
  }
  createGain() { return new Node(); }
  createBufferSource() { const source = new Node(); this.sources.push(source); return source; }
  createBiquadFilter() { return new Node(); }
  createOscillator() { return new Node(); }
  createBuffer(channels, length, sampleRate) {
    const data = new Float32Array(length);
    return { duration: length / sampleRate, getChannelData: () => data };
  }
  async close() { this.state = 'closed'; }
}
async function winterSound(t) {
  const previousWindow = globalThis.window;
  globalThis.window = { AudioContext: Context };
  const sound = new Soundscape();
  t.after(() => { sound.dispose(); globalThis.window = previousWindow; });
  await sound.start();
  return sound;
}

test('ambient wind and river continue without introducing any musical sources', async t => {
  const sound = await winterSound(t), ctx = sound.context;
  assert.equal(ctx.sources.length, 2);
  for (let seconds = 0; seconds <= 600; seconds += 10) {
    ctx.currentTime = seconds;
    sound.update({ wind: 0.7, river: 0.5, shelter: 0 });
  }
  assert.equal(ctx.sources.length, 2);
  assert.ok(sound.getDiagnostics().gustScheduledUntil > ctx.currentTime);
  assert.equal(sound.getDiagnostics().activeTransients, 0);
  assert.ok(sound.layers.every(source => source.loop && source.stops.length === 0));
});

test('shelter softens wind and river, while mute fades footfalls and restores ambience cleanly', async t => {
  const sound = await winterSound(t), ctx = sound.context;
  sound.update({ wind: 0.8, river: 0.7, shelter: 0 });
  const openWind = sound.getDiagnostics().windLevel, openRiver = sound.river.gain.gain.value;
  sound.update({ shelter: 1 });
  assert.ok(sound.getDiagnostics().windLevel < openWind / 4);
  assert.ok(sound.river.gain.gain.value < openRiver / 2);
  sound.step();
  const footfalls = [...sound.activeSources];
  assert.equal(footfalls.length, 2);
  sound.setMuted(true);
  assert.equal(sound.master.gain.value, 0);
  for (const source of footfalls) assert.equal(source.stops.at(-1), ctx.currentTime + 0.05);
  ctx.currentTime = 600; sound.update(); sound.step(); sound.rustle();
  assert.equal(ctx.sources.length, 4);
  sound.setMuted(false); sound.update();
  assert.ok(sound.master.gain.value > 0);
  assert.equal(ctx.sources.length, 4);
  assert.ok(sound.getDiagnostics().gustScheduledUntil > ctx.currentTime);
  assert.ok(sound.layers.every(source => source.stops.length === 0));
});

test('restarting clears transient footsteps without duplicating ambient layers; disposal stops all audio', async t => {
  const sound = await winterSound(t), ctx = sound.context;
  sound.step(); sound.rustle();
  const transients = [...sound.activeSources], layers = [...sound.layers];
  sound.resetTransients();
  assert.equal(sound.getDiagnostics().lastStep, null);
  assert.equal(sound.getDiagnostics().lastStepDuration, 0);
  for (const source of transients) {
    assert.equal(source.stops.at(-1), ctx.currentTime + 0.05);
    source.onended();
  }
  assert.equal(sound.getDiagnostics().activeTransients, 0);
  sound.step();
  assert.equal(sound.getDiagnostics().activeTransients, 2);
  assert.deepEqual(sound.layers, layers);
  const allSources = [...ctx.sources];
  sound.dispose();
  for (const source of allSources) assert.ok(source.stops.length > 0 && source.disconnected);
  assert.equal(sound.layers.length, 0);
  assert.equal(sound.activeSources.size, 0);
  assert.equal(ctx.state, 'closed');
});
