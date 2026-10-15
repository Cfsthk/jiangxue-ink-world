import * as THREE from './vendor/three.module.js';
import { createWorld } from './world.js';
import { Soundscape } from './audio.js';
import { InkWash } from './wash.js';

const $ = id => document.getElementById(id);
const canvas = $('world');
const intro = $('intro');
const menu = $('menu');
const referenceDialog = $('reference-dialog');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const keys = new Set();
const sound = new Soundscape();
sound.setMuted(true);
const state = { ready: false, started: false, entering: false, paused: false, muted: true, time: 0, zone: '', target: null, fps: 60 };
const player = { x: -32, z: 44, y: 0, yaw: -.85, pitch: -.08, targetYaw: -.85, targetPitch: -.08, vx: 0, vz: 0 };
const joy = { x: 0, y: 0, id: null };
let renderer, camera, world, wash;
let lastTime = performance.now(), footDistance = 0, lastPlayer = null, feedbackTimer, callTime = -100, interactionTime = -100;
let drag = null, focusUntil = 0, frameSamples = 0, fpsTime = 0;
const footprints = [], effects = [];
const effectRoot = new THREE.Group();
const footGeometry = new THREE.PlaneGeometry(.13, .28);
const rippleGeometry = new THREE.RingGeometry(.97, 1, 64);

// ponytail: native DOM controls and one render loop suffice; no UI framework or physics engine.
function notify(text, duration = 3500) {
  clearTimeout(feedbackTimer);
  $('feedback').textContent = text;
  $('feedback').classList.add('visible');
  feedbackTimer = setTimeout(() => $('feedback').classList.remove('visible'), duration);
}

function clearInput() {
  keys.clear();
  player.vx = player.vz = 0;
  joy.x = joy.y = 0;
  joy.id = null;
  $('joystick-thumb').style.transform = '';
  drag = null;
}

function isPlaying() { return state.started && !state.entering && !state.paused; }

function syncSound() {
  sound.setMuted(state.muted || state.paused || !state.started);
  $('sound').setAttribute('aria-pressed', String(!state.muted));
  $('sound').setAttribute('aria-label', state.muted ? '開啟環境聲' : '關閉環境聲');
}

function openMenu() {
  clearInput();
  state.paused = true;
  $('resume').textContent = state.started ? '繼續漫遊 ↗' : '返回畫面 ↗';
  $('restart').hidden = !state.started;
  if (!menu.open) menu.showModal();
  syncSound();
}

function closeMenu() {
  if (menu.open) menu.close();
  state.paused = false;
  clearInput();
  syncSound();
  if (state.started) canvas.focus({ preventScroll: true });
}

function restart() {
  Object.assign(player, world.spawn);
  player.targetYaw = player.yaw;
  player.targetPitch = player.pitch;
  player.y = world.heightAt(player.x, player.z) + 1.65;
  player.vx = player.vz = 0;
  lastPlayer = { x: player.x, z: player.z };
  for (const footprint of footprints) { effectRoot.remove(footprint.mesh); footprint.mesh.material.dispose(); }
  footprints.length = 0;
  footDistance = 0;
  focusUntil = 0;
  closeMenu();
}

async function start() {
  if (!state.ready || state.entering || state.started) return;
  state.entering = true;
  state.started = true;
  state.muted = false;
  try { await sound.start(); } catch { state.muted = true; }
  syncSound();
  $('mist-transition').classList.add('flow');
  intro.classList.add('departing');
  $('start').disabled = true;
  setTimeout(() => { intro.hidden = true; $('hud').hidden = false; }, reducedMotion ? 30 : 1450);
  setTimeout(() => {
    state.entering = false;
    canvas.focus({ preventScroll: true });
  }, reducedMotion ? 70 : 2800);
}

function makeFootTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const ctx = c.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 60, 4, 32, 60, 49);
  gradient.addColorStop(0, 'rgba(92,103,103,.65)'); gradient.addColorStop(1, 'rgba(92,103,103,0)');
  ctx.fillStyle = gradient; ctx.translate(0, 24); ctx.scale(1, 1.5); ctx.beginPath(); ctx.ellipse(32, 33, 24, 34, 0, 0, Math.PI * 2); ctx.fill();
  return new THREE.CanvasTexture(c);
}
const footTexture = makeFootTexture();

function addFootprint() {
  const side = footprints.length % 2 ? -1 : 1;
  const x = player.x + Math.cos(player.yaw) * .15 * side;
  const z = player.z - Math.sin(player.yaw) * .15 * side;
  const material = new THREE.MeshBasicMaterial({ map: footTexture, transparent: true, opacity: .12, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  const mesh = new THREE.Mesh(footGeometry, material);
  mesh.rotation.set(-Math.PI / 2, 0, -player.yaw);
  mesh.position.set(x, world.heightAt(x, z) + .027, z);
  effectRoot.add(mesh);
  footprints.push({ mesh, born: state.time });
  if (footprints.length > 100) { const old = footprints.shift(); effectRoot.remove(old.mesh); old.mesh.material.dispose(); }
  sound.step();
}

function addRipple(x, z) {
  const group = new THREE.Group(); group.position.set(x, .075, z);
  for (let i = 0; i < 3; i++) {
    const mesh = new THREE.Mesh(rippleGeometry, new THREE.MeshBasicMaterial({ color: '#8e9e9e', transparent: true, opacity: .16, depthWrite: false, side: THREE.DoubleSide }));
    mesh.rotation.x = -Math.PI / 2; mesh.userData.delay = i * .3; group.add(mesh);
  }
  effectRoot.add(group);
  effects.push({ type: 'ripple', object: group, age: 0, life: 4.2 });
}

function throwStone() {
  const start = new THREE.Vector3(player.x + .22, player.y - .35, player.z);
  const end = new THREE.Vector3(Math.max(8, player.x + 11), .05, player.z - 5);
  const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(.065, 0), new THREE.MeshBasicMaterial({ color: '#8b9290' }));
  mesh.position.copy(start); effectRoot.add(mesh);
  effects.push({ type: 'stone', object: mesh, age: 0, life: 1.1, start, end });
}

function shakePine(target) {
  sound.rustle();
  if (target.object) target.object.userData.shake = performance.now() / 1000;
  const count = 95, points = new Float32Array(count * 3), speeds = [];
  for (let i = 0; i < count; i++) {
    const r = Math.random() * 1.6, a = Math.random() * Math.PI * 2;
    points.set([target.position.x + Math.cos(a) * r, target.position.y + 2.4 + Math.random() * 2.5, target.position.z + Math.sin(a) * r], i * 3);
    speeds.push(.65 + Math.random() * 1.2);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(points, 3));
  const snow = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#fafaf6', size: .09, transparent: true, opacity: .9, depthWrite: false }));
  effectRoot.add(snow);
  effects.push({ type: 'snow', object: snow, speeds, age: 0, life: 3.5 });
}

function call() {
  if (!isPlaying() || state.time - callTime < 6.5) return;
  callTime = state.time;
  sound.call();
  notify('有人嗎？', 1800);
  setTimeout(() => { if (isPlaying()) notify('回聲漸遠，無人應答。', 4000); }, 2300);
}

function interact() {
  if (!isPlaying() || !state.target || state.time - interactionTime < 2.8) return;
  interactionTime = state.time;
  const target = state.target;
  if (target.type === 'pine') { shakePine(target); notify('枝頭落雪，又靜下來了。'); }
  else if (target.type === 'stone') { throwStone(); }
  else if (target.type === 'echo') { call(); }
  else if (target.type === 'boat') {
    const p = target.object ? target.object.getWorldPosition(new THREE.Vector3()) : target.position;
    const direction = Math.atan2(-(p.x - player.x), -(p.z - player.z));
    player.targetYaw = player.yaw + Math.atan2(Math.sin(direction - player.yaw), Math.cos(direction - player.yaw));
    player.targetPitch = Math.atan2(p.y + 1.4 - player.y, Math.hypot(p.x - player.x, p.z - player.z));
    focusUntil = state.time + 7;
    notify('一葉孤舟，一人獨釣。', 4500);
  }
}

function detectInteraction() {
  let nearest = null, score = Infinity;
  for (const item of world.interactables) {
    const distance = Math.hypot(player.x - item.position.x, player.z - item.position.z);
    const height = Math.abs(player.y - 1.65 - item.position.y);
    if (distance < item.radius && height < (item.type === 'boat' ? 5 : 7) && distance / item.radius < score) {
      score = distance / item.radius; nearest = item;
    }
  }
  state.target = nearest;
  $('interact').hidden = !nearest;
  if (nearest) $('interaction-label').textContent = nearest.label;
  document.querySelector('.reticle').classList.toggle('active', Boolean(nearest));
}

function updateEffects(dt) {
  for (let i = footprints.length - 1; i >= 0; i--) {
    const foot = footprints[i], age = state.time - foot.born;
    foot.mesh.material.opacity = .12 * Math.max(0, 1 - age / 20);
    if (age > 20) { effectRoot.remove(foot.mesh); foot.mesh.material.dispose(); footprints.splice(i, 1); }
  }
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i]; e.age += dt;
    if (e.type === 'ripple') {
      e.object.children.forEach((ring, n) => {
        const age = Math.max(0, e.age - n * .3); ring.visible = e.age > n * .3;
        ring.scale.setScalar(.2 + age * .65); ring.material.opacity = .18 * Math.max(0, 1 - age / 3.2);
      });
    } else if (e.type === 'stone') {
      const t = Math.min(1, e.age / e.life);
      e.object.position.lerpVectors(e.start, e.end, t); e.object.position.y += Math.sin(t * Math.PI) * 2;
      e.object.rotation.x += dt * 5;
      if (t >= 1) { addRipple(e.end.x, e.end.z); sound.splash(); }
    } else if (e.type === 'snow') {
      const p = e.object.geometry.attributes.position;
      for (let j = 0; j < p.count; j++) { p.array[j * 3] += dt * .27; p.array[j * 3 + 1] -= dt * e.speeds[j]; }
      p.needsUpdate = true; e.object.material.opacity = .9 * Math.max(0, 1 - e.age / e.life);
    }
    if (e.age >= e.life) {
      effectRoot.remove(e.object);
      e.object.traverse(child => { if (child.geometry && child.geometry !== rippleGeometry) child.geometry.dispose(); if (child.material) child.material.dispose(); });
      effects.splice(i, 1);
    }
  }
}

function move(dt) {
  const forward = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - joy.y;
  const sideways = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0) + joy.x;
  const magnitude = Math.max(1, Math.hypot(forward, sideways));
  if (keys.has('ArrowLeft')) player.targetYaw += dt * 1.05;
  if (keys.has('ArrowRight')) player.targetYaw -= dt * 1.05;
  const vx = (-Math.sin(player.yaw) * forward + Math.cos(player.yaw) * sideways) / magnitude * 4.1;
  const vz = (-Math.cos(player.yaw) * forward - Math.sin(player.yaw) * sideways) / magnitude * 4.1;
  player.vx = THREE.MathUtils.damp(player.vx, vx, 7, dt);
  player.vz = THREE.MathUtils.damp(player.vz, vz, 7, dt);
  const nextX = player.x + player.vx * dt, nextZ = player.z + player.vz * dt;
  if (world.canWalk(nextX, player.z)) player.x = nextX; else player.vx = 0;
  if (world.canWalk(player.x, nextZ)) player.z = nextZ; else player.vz = 0;
  const distance = lastPlayer ? Math.hypot(player.x - lastPlayer.x, player.z - lastPlayer.z) : 0;
  footDistance += distance;
  if (footDistance > .94) { addFootprint(); footDistance = 0; }
  lastPlayer = { x: player.x, z: player.z };
  player.y = THREE.MathUtils.damp(player.y, world.heightAt(player.x, player.z) + 1.65, 14, dt);
  player.yaw = THREE.MathUtils.damp(player.yaw, player.targetYaw, 12, dt);
  player.pitch = THREE.MathUtils.damp(player.pitch, player.targetPitch, 12, dt);
  const zone = world.zoneAt(player.x, player.z);
  if (zone !== state.zone) { state.zone = zone; $('location').textContent = zone; }
  const shoreDistance = Math.max(0, 1 - Math.abs(player.x - 2) / 25);
  sound.update({ wind: .3 + Math.min(.5, (player.y - 1.65) / 35), river: shoreDistance, shelter: zone.includes('松') ? .55 : 0 });
}

function addWeather() {
  const count = matchMedia('(pointer:coarse)').matches ? 260 : 550;
  const positions = new Float32Array(count * 3), speed = [];
  for (let i = 0; i < count; i++) { positions.set([(Math.random() - .5) * 100, Math.random() * 52, (Math.random() - .5) * 100], i * 3); speed.push(.3 + Math.random() * .5); }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const snow = new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#ffffff', size: .065, transparent: true, opacity: .65, depthWrite: false, sizeAttenuation: true }));
  snow.frustumCulled = false; world.scene.add(snow);
  return dt => {
    for (let i = 0; i < count; i++) { positions[i * 3] += dt * .15; positions[i * 3 + 1] -= dt * speed[i]; if (positions[i * 3 + 1] < -2) positions[i * 3 + 1] = 52; if (positions[i * 3] > 50) positions[i * 3] = -50; }
    snow.position.x = player.x; snow.position.z = player.z; geometry.attributes.position.needsUpdate = true;
  };
}

function resize() {
  if (!renderer) return;
  const width = innerWidth, height = innerHeight;
  renderer.setSize(width, height, false);
  wash?.resize(width, height, renderer.getPixelRatio());
  camera.aspect = width / height; camera.updateProjectionMatrix();
}

function init() {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    world = createWorld();
    wash = new InkWash(renderer);
    camera = new THREE.PerspectiveCamera(61, 1, .1, 720); camera.rotation.order = 'YXZ';
    Object.assign(player, world.spawn); player.targetYaw = player.yaw; player.targetPitch = player.pitch;
    player.y = world.heightAt(player.x, player.z) + 1.65;
    world.scene.add(effectRoot);
    resize();
    const weather = addWeather();
    renderer.compile(world.scene, camera);
    let interactionTick = 0;
    renderer.setAnimationLoop(now => {
      const elapsed = Math.min(1, (now - lastTime) / 1000);
      const dt = Math.min(.04, elapsed); lastTime = now;
      if (!state.paused && !document.hidden) {
        state.time += dt;
        if (isPlaying()) move(dt);
        world.update(dt, state.time, player);
        updateEffects(dt); weather(dt);
      }
      camera.position.set(player.x, player.y, player.z); camera.rotation.set(player.pitch, player.yaw, 0);
      const fov = state.time < focusUntil ? 48 : 61;
      camera.fov = THREE.MathUtils.damp(camera.fov, fov, 3, dt); camera.updateProjectionMatrix();
      if (isPlaying() && (interactionTick += dt) > .15) { detectInteraction(); interactionTick = 0; }
      wash.render(world.scene, camera, state.time);
      frameSamples++; fpsTime += elapsed;
      if (fpsTime > 1) { state.fps = Math.round(frameSamples / fpsTime); frameSamples = fpsTime = 0; }
    });
    // Let at least two real frames render before the image-to-world transition can start.
    Promise.resolve(world.ready).then(() => requestAnimationFrame(() => requestAnimationFrame(() => {
      state.ready = true; $('start').disabled = false; $('start-label').textContent = '步入江雪'; $('load-status').textContent = '';
    }))).catch(error => {
      console.error('水墨素材載入失敗', error);
      $('load-status').textContent = '水墨素材未能載入，請重新整理再試。';
    });
    window.__JIANGXUE__ = Object.freeze({ getState: () => ({ ready: state.ready, started: state.started, paused: state.paused, entering: state.entering, muted: state.muted, zone: state.zone, fps: state.fps, x: player.x, y: player.y, z: player.z, yaw: player.yaw, pitch: player.pitch, target: state.target?.type, landmarks: world.landmarks, renderer: renderer.info.render, footprints: footprints.length, effects: effects.length }) });
  } catch (error) {
    console.error('江雪世界載入失敗', error);
    $('start-label').textContent = '重新載入'; $('start').disabled = false;
    $('load-status').textContent = '未能建立 3D 畫面。請使用支援 WebGL 的瀏覽器，或重新載入再試。';
    $('start').addEventListener('click', () => location.reload(), { once: true });
  }
}

$('start').addEventListener('click', start);
$('intro-help').addEventListener('click', openMenu);
$('help').addEventListener('click', openMenu);
$('pause').addEventListener('click', openMenu);
$('close-menu').addEventListener('click', closeMenu);
$('resume').addEventListener('click', closeMenu);
$('restart').addEventListener('click', restart);
menu.addEventListener('cancel', event => { event.preventDefault(); closeMenu(); });
$('reference').addEventListener('click', () => referenceDialog.showModal());
$('close-reference').addEventListener('click', () => referenceDialog.close());
$('call').addEventListener('click', call);
$('interact').addEventListener('click', interact);
$('sound').addEventListener('click', async () => { state.muted = !state.muted; if (!state.muted) { try { await sound.start(); } catch { state.muted = true; notify('這個瀏覽器暫未能播放聲音。'); } } syncSound(); });
$('fullscreen').addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('experience').requestFullscreen(); }
  catch { notify('可使用瀏覽器的全螢幕模式觀看。'); }
});
document.addEventListener('fullscreenchange', () => { $('fullscreen').setAttribute('aria-label', document.fullscreenElement ? '離開全螢幕' : '全螢幕'); resize(); });

window.addEventListener('keydown', event => {
  if (event.code === 'Escape' && isPlaying()) { event.preventDefault(); openMenu(); return; }
  if (!isPlaying() || event.target.closest('dialog,input,textarea')) return;
  if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyE','KeyC'].includes(event.code) || (event.code === 'Space' && !event.target.closest('button'))) event.preventDefault();
  keys.add(event.code);
  if (!event.repeat && event.code === 'KeyE') interact();
  if (!event.repeat && event.code === 'KeyC') call();
});
window.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', () => { if (document.hidden && isPlaying()) openMenu(); });
window.addEventListener('resize', resize);

canvas.addEventListener('pointerdown', event => {
  if (!isPlaying() || event.button > 0 || drag) return;
  if (event.pointerType === 'touch' && event.clientX < innerWidth * .32 && event.clientY > innerHeight * .55) return;
  canvas.focus({ preventScroll: true }); canvas.setPointerCapture(event.pointerId);
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
});
canvas.addEventListener('pointermove', event => {
  if (!isPlaying() || !drag || drag.id !== event.pointerId) return;
  player.targetYaw -= (event.clientX - drag.x) * .0032;
  player.targetPitch = THREE.MathUtils.clamp(player.targetPitch - (event.clientY - drag.y) * .0028, -1.1, .85);
  drag.x = event.clientX; drag.y = event.clientY;
});
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(name, event => { if (event.pointerId === drag?.id) drag = null; });
canvas.addEventListener('contextmenu', event => event.preventDefault());
const joystick = $('joystick');
function updateJoystick(event) {
  const rect = joystick.getBoundingClientRect(), limit = rect.width * .34;
  let dx = event.clientX - rect.left - rect.width / 2, dy = event.clientY - rect.top - rect.height / 2;
  const length = Math.hypot(dx, dy); if (length > limit) { dx *= limit / length; dy *= limit / length; }
  joy.x = dx / limit; joy.y = dy / limit;
  $('joystick-thumb').style.transform = `translate(${dx}px,${dy}px)`;
}
joystick.addEventListener('pointerdown', event => { if (!isPlaying() || joy.id !== null) return; event.preventDefault(); joy.id = event.pointerId; joystick.setPointerCapture(event.pointerId); updateJoystick(event); });
joystick.addEventListener('pointermove', event => { if (event.pointerId === joy.id) updateJoystick(event); });
for (const name of ['pointerup','pointercancel','lostpointercapture']) joystick.addEventListener(name, event => { if(event.pointerId !== joy.id) return; joy.x = joy.y = 0; joy.id = null; $('joystick-thumb').style.transform = ''; });
canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); if (state.started) openMenu(); notify('畫面暫停，正在恢復。'); });
canvas.addEventListener('webglcontextrestored', () => location.reload());
window.addEventListener('pagehide', () => sound.dispose());
init();
