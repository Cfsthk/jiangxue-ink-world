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

test('the soundscape stays silent before start, and disposal also releases scheduled music', async t => {
  const sound = new Soundscape();
  sound.update({ wind: 0.7 }); sound.step(); sound.rustle(); sound.queuePipaPhrase();
  assert.equal(sound.context, null);
  assert.equal(sound.getDiagnostics().music.nextPhraseAt, null);
  assert.equal(sound.activeSources.size, 0);
  sound.dispose();
  const playing = await winterSound(t), ctx = playing.context;
  ctx.currentTime = playing.getDiagnostics().music.nextPhraseAt;
  playing.update();
  assert.ok(playing.musicSources.size >= 3);
  assert.ok(playing.pipaBuffers.size >= 2);
  const sources = [...ctx.sources];
  playing.dispose();
  for (const source of sources) assert.ok(source.stops.length > 0 && source.disconnected);
  assert.equal(playing.musicSources.size, 0);
  assert.equal(playing.pipaBuffers.size, 0);
  assert.equal(playing.getDiagnostics().music.nextPhraseAt, null);
  assert.equal(ctx.state, 'closed');
});

test('pipa starts promptly with audible plucks, slow note spacing and short rests', async t => {
  const sound = await winterSound(t), ctx = sound.context;
  assert.equal(ctx.sources.length, 2);
  const due = sound.getDiagnostics().music.nextPhraseAt;
  assert.ok(due >= 1 && due <= 2);
  ctx.currentTime = due - 0.01;
  sound.update({ wind: 0.7, river: 0.5, shelter: 0 });
  assert.equal(ctx.sources.length, 2);
  ctx.currentTime = due;
  sound.update();
  const plucks = [...sound.musicSources], music = sound.getDiagnostics().music;
  assert.ok(plucks.length >= 3 && plucks.length <= 4);
  assert.equal(music.phrasesPlayed, 1);
  assert.equal(music.lastPhraseAt, due);
  const outputPeak = music.mix * 0.72 * sound.master.gain.value;
  assert.ok(outputPeak > 0.01 && outputPeak < 0.03,'plucks are audible while retaining ample output headroom');
  const starts = plucks.map(source => source.starts[0][0]);
  assert.equal(starts[0], due);
  for (let i = 1; i < starts.length; i++) {
    assert.ok(starts[i] - starts[i - 1] >= 1.3);
    assert.ok(starts[i] - starts[i - 1] <= 2.0);
  }
  assert.ok(music.nextPhraseAt - starts.at(-1) >= 5);
  assert.ok(music.nextPhraseAt - starts.at(-1) <= 8);
  for (const source of plucks) {
    assert.ok(source.buffer.duration >= 2);
    const samples = source.buffer.getChannelData(0);
    assert.ok(samples.every(Number.isFinite));
    assert.ok(samples.some(sample => Math.abs(sample) > 0.1));
    assert.ok(Math.max(...samples) <= 0.721);
    assert.ok(Math.min(...samples) >= -0.721);
    source.onended();
  }
  assert.equal(sound.musicSources.size, 0);
  assert.equal(sound.activeSources.size, 0);
  assert.ok(sound.getDiagnostics().gustScheduledUntil > ctx.currentTime);
  assert.ok(sound.layers.every(source => source.loop && source.stops.length === 0));
});

test('muting cancels even future pipa notes, and resuming never plays missed phrases', async t => {
  const sound = await winterSound(t), ctx = sound.context;
  ctx.currentTime = sound.getDiagnostics().music.nextPhraseAt;
  sound.update();
  const plucks = [...sound.musicSources];
  assert.ok(plucks.some(source => source.starts[0][0] > ctx.currentTime));
  sound.setMuted(true);
  for (const source of plucks) {
    assert.equal(source.stops.at(-1), ctx.currentTime + 0.05);
    source.onended();
  }
  assert.equal(sound.getDiagnostics().music.nextPhraseAt, null);
  const sourceCount = ctx.sources.length;
  ctx.currentTime = 600;
  sound.update();
  assert.equal(ctx.sources.length, sourceCount);
  sound.setMuted(false);
  sound.update();
  assert.equal(ctx.sources.length, sourceCount);
  assert.ok(sound.getDiagnostics().music.nextPhraseAt >= 601);
  assert.ok(sound.getDiagnostics().music.nextPhraseAt <= 602);
  ctx.currentTime = sound.getDiagnostics().music.nextPhraseAt;
  sound.update();
  assert.equal(sound.getDiagnostics().music.phrasesPlayed, 2);
  const resumedPlucks = [...sound.musicSources];
  sound.resetTransients();
  assert.equal(sound.getDiagnostics().music.phrasesPlayed, 0);
  assert.equal(sound.getDiagnostics().music.nextPhraseAt, null);
  assert.equal(sound.getDiagnostics().music.lastPhraseAt, null);
  for (const source of resumedPlucks) {
    assert.equal(source.stops.at(-1), ctx.currentTime + 0.05);
    source.onended();
  }
  sound.update();
  assert.ok(sound.getDiagnostics().music.nextPhraseAt >= ctx.currentTime + 1);
  assert.ok(sound.getDiagnostics().music.nextPhraseAt <= ctx.currentTime + 2);
  assert.equal(sound.musicSources.size, 0);
  assert.ok(sound.layers.every(source => source.stops.length === 0));
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
