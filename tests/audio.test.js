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
  constructor() { this.currentTime = 0; this.sampleRate = 12000; this.state = 'running'; this.destination = new Node(); }
  createGain() { return new Node(); }
  createBufferSource() { return new Node(); }
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

test('pipa phrases leave a quiet opening and wide gaps while wind stays dominant', async t => {
  const sound = await winterSound(t), ctx = sound.context;
  const first = sound.getDiagnostics().music.nextPhraseAt;
  assert.ok(first >= 12 && first <= 18);
  ctx.currentTime = first - 0.01; sound.update();
  assert.equal(sound.getDiagnostics().music.phrasesPlayed, 0);
  ctx.currentTime = first; sound.update();
  const music = sound.getDiagnostics().music;
  assert.equal(music.phrasesPlayed, 1);
  assert.ok(music.activePlucks >= 2 && music.activePlucks <= 4);
  assert.ok(music.nextPhraseAt - first >= 35 && music.nextPhraseAt - first <= 66.24);
  assert.ok(music.mix > 0 && music.mix < 0.011);
  assert.ok(music.mix < sound.getDiagnostics().windLevel / 3);
  sound.update();
  assert.equal(sound.getDiagnostics().music.phrasesPlayed, 1);
  assert.equal(typeof sound.call, 'undefined');
});

test('mute cancels pending plucks, and resuming or restarting never catches up missed phrases', async t => {
  const sound = await winterSound(t), ctx = sound.context;
  ctx.currentTime = sound.nextPhraseAt; sound.update();
  const plucks = [...sound.musicSources];
  sound.setMuted(true);
  assert.equal(sound.nextPhraseAt, null);
  for (const source of plucks) assert.equal(source.stops.at(-1), ctx.currentTime + 0.05);
  ctx.currentTime = 600; sound.update();
  assert.equal(sound.phrasesPlayed, 1);
  sound.setMuted(false); sound.update();
  assert.ok(sound.nextPhraseAt >= 612 && sound.nextPhraseAt <= 618);
  assert.equal(sound.phrasesPlayed, 1);
  sound.resetTransients(); sound.update();
  assert.equal(sound.phrasesPlayed, 0);
  assert.equal(sound.lastPhraseAt, null);
  assert.ok(sound.nextPhraseAt > ctx.currentTime);
  sound.dispose();
  assert.equal(sound.musicSources.size, 0);
  assert.equal(sound.pipaBuffers.size, 0);
  assert.equal(ctx.state, 'closed');
});

test('cached plucked strings have bounded peaks, a soft start and a decaying tail', async t => {
  const sound = await winterSound(t);
  const buffer = sound.makePipaBuffer(293.66), samples = buffer.getChannelData(0);
  assert.equal(sound.makePipaBuffer(293.66), buffer);
  assert.equal(Math.abs(samples[0]), 0);
  let early = 0, late = 0, peak = 0;
  for (let i = 0; i < samples.length; i++) {
    assert.ok(Number.isFinite(samples[i]));
    peak = Math.max(peak, Math.abs(samples[i]));
    if (i < 2400) early += samples[i] ** 2;
    if (i >= samples.length - 2400) late += samples[i] ** 2;
  }
  assert.ok(peak > 0.70 && peak <= 0.720001);
  assert.ok(early > late * 20);
  assert.ok(Math.abs(samples.at(-1)) < 0.0001);
});
