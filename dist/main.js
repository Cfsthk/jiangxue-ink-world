import * as THREE from './vendor/three.module.js';
import { createWorld } from './world.js?v=1.3.0';
import { Soundscape } from './audio.js?v=1.3.0';
import { InkWash } from './wash.js?v=1.3.0';
import { createGroundSnow } from './ground-snow.js?v=1.3.0';

const $ = id => document.getElementById(id);
const canvas = $('world');
const chineseCounts=['零','一','二','三','四','五'];
const intro = $('intro');
const menu = $('menu');
const referenceDialog = $('reference-dialog');
const storyDialog = $('story-dialog'), luggageDialog = $('luggage-dialog');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const keys = new Set();
const sound = new Soundscape();
sound.setMuted(true);
const state = { ready: false, started: false, entering: false, paused: false, muted: true, time: 0, zone: '', target: null, fps: 60 };
const player = { x: -32, z: 44, y: 0, yaw: -.85, pitch: -.08, targetYaw: -.85, targetPitch: -.08, vx: 0, vz: 0 };
const joy = { x: 0, y: 0, id: null };
let renderer, camera, world, wash;
let storyFromLuggage=false;
let lastTime = performance.now(), footDistance = 0, lastPlayer = null, feedbackTimer, interactionTime = -100;
let shelter = 0;
let drag = null, focusUntil = 0, frameSamples = 0, fpsTime = 0;
let nextFoot = 1, snowCount = 0, powderDiagnostics = null;
const footprints = [], effects = [];
const effectRoot = new THREE.Group();

// ponytail: native DOM controls and one render loop suffice; no UI framework or physics engine.
function notify(text, duration = 3500) {
  clearTimeout(feedbackTimer);
  $('feedback').textContent = text;
  $('feedback').classList.add('visible');
  feedbackTimer = setTimeout(() => $('feedback').classList.remove('visible'), duration);
}

function clearInput() {
  $('interact').hidden=true;
  keys.clear();
  player.vx = player.vz = 0;
  joy.x = joy.y = 0;
  joy.id = null;
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
  storyFromLuggage=false;
  world.journey.reset();
  if(storyDialog.open)storyDialog.close();
  if(luggageDialog.open)luggageDialog.close();
  Object.assign(player, world.spawn);
  world.trail.reset(world.spawn);
  player.targetYaw = player.yaw;
  player.targetPitch = player.pitch;
  player.y = world.heightAt(player.x, player.z) + 1.65;
  player.vx = player.vz = 0;
  lastPlayer = { x: player.x, z: player.z };
  for (const footprint of footprints) { effectRoot.remove(footprint.mesh); footprint.mesh.geometry.dispose(); footprint.mesh.material.dispose(); }
  footprints.length = 0;
  footDistance = 0;
  nextFoot = 1;
  focusUntil = 0;
  for (const effect of effects) disposeEffect(effect.object);
  effects.length = 0;
  interactionTime = -100;
  shelter = 0;
  state.target = null;
  clearTimeout(feedbackTimer);
  $('feedback').classList.remove('visible');
  sound.resetTransients();
  syncJourneyHUD();
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
    syncJourneyHUD();
    notify('沿路墨點通往行李。走近後，點選按鈕或按 E。',6500);
    canvas.focus({ preventScroll: true });
  }, reducedMotion ? 70 : 2800);
}

function storyArt(id){return `<img src="./assets/props-v2/${id}.png" alt="" width="600" height="380">`;}
function syncJourneyHUD(){
  if(!world)return;
  const j=world.journey.getState();$('luggage-count').textContent=`${chineseCounts[j.collected]}／五`;
  $('open-luggage').setAttribute('aria-label',`查看行李與已讀往事，已尋回${chineseCounts[j.collected]}件，共五件`);
}
function showStory(item,fromLuggage=false){
  storyFromLuggage=fromLuggage;
  clearInput();state.paused=true;state.target=null;
  $('story-year').textContent=item.title;$('story-title').textContent=item.name;$('story-title').dataset.long=String(item.name.length>5);$('story-text').textContent=item.text;$('story-detail').textContent=item.detail;$('story-art').innerHTML=storyArt(item.id);
  if(luggageDialog.open)luggageDialog.close();
  if(!storyDialog.open)storyDialog.showModal();syncSound();$('story-continue').focus();
}
function closeStory(){
  if(storyDialog.open)storyDialog.close();
  if(storyFromLuggage){storyFromLuggage=false;openLuggage();return;}
  state.paused=false;clearInput();syncSound();canvas.focus({preventScroll:true});detectInteraction();
}
function openLuggage(){
  if(!world||!state.started||state.entering)return;
  clearInput();state.paused=true;syncSound();
  const j=world.journey.getState();
  $('luggage-title').textContent=j.complete?'查看馬車':'行李';
  $('luggage-title').classList.toggle('sr-only',!j.complete);
  $('continue-journey').hidden=!j.complete;
  $('luggage-list').innerHTML=world.journey.items.map(item=>{
    const read=j.storiesRead.includes(item.id),tag=read?'button':'div';
    const attr=read?`type="button" data-story="${item.id}" aria-label="重讀${item.name}"`:'class="luggage-row"';
    return `<li><${tag} ${attr}><img class="journal-art" src="./assets/props-v2/${item.id}.png" alt=""><strong>${item.name}</strong></${tag}></li>`;
  }).join('');
  if(!luggageDialog.open)luggageDialog.showModal();
}
function closeLuggage(){if(luggageDialog.open)luggageDialog.close();state.paused=false;clearInput();syncSound();canvas.focus({preventScroll:true});detectInteraction();}
function finishJourney(){
  clearInput();state.target=null;clearTimeout(feedbackTimer);$('feedback').classList.remove('visible');
  world.trail.update(0,state.time,player,false);
  openLuggage();
}
function returnToMain(){
  restart();
  state.started=false;state.entering=false;state.paused=false;storyFromLuggage=false;
  $('hud').hidden=true;intro.hidden=false;intro.classList.remove('departing');
  $('mist-transition').classList.remove('flow');
  $('start').disabled=!state.ready;$('start-label').textContent='步入江雪';
  clearInput();syncSound();$('start').focus({preventScroll:true});
}

function makeFootTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 224;
  const ctx = c.getContext('2d');
  // Two soft depressions, broken by paper grain, rather than a stamped black sole.
  ctx.shadowColor = 'rgba(88,102,106,.48)'; ctx.shadowBlur = 9;
  ctx.fillStyle = 'rgba(104,116,119,.68)';
  ctx.beginPath(); ctx.moveTo(38,30); ctx.bezierCurveTo(46,14,83,15,94,37);
  ctx.bezierCurveTo(106,65,91,109,82,135); ctx.bezierCurveTo(76,148,46,148,37,130);
  ctx.bezierCurveTo(28,104,25,53,38,30); ctx.fill();
  ctx.beginPath(); ctx.ellipse(61,174,25,24,-.08,0,Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(243,245,241,.66)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(32,47); ctx.bezierCurveTo(25,82,33,120,40,134); ctx.stroke();
  for (let i=0;i<180;i++) {
    const x=(Math.sin(i*71.3)*.5+.5)*128, y=(Math.sin(i*37.7+2)*.5+.5)*224;
    ctx.clearRect(x,y,1.5+(i%3),1+(i%2));
  }
  return new THREE.CanvasTexture(c);
}
const footTexture = makeFootTexture();

function addFootprint() {
  const side = nextFoot; nextFoot *= -1;
  const heading = Math.atan2(-player.vx, -player.vz) + side * .055;
  const rightX = Math.cos(heading), rightZ = -Math.sin(heading);
  const forwardX = -Math.sin(heading), forwardZ = -Math.cos(heading);
  const x = player.x + rightX * .135 * side - forwardX * .14;
  const z = player.z + rightZ * .135 * side - forwardZ * .14;
  const geometry = new THREE.PlaneGeometry(.21, .38, 2, 4);
  const p = geometry.attributes.position;
  for (let i=0;i<p.count;i++) {
    const across=p.getX(i), along=p.getY(i);
    const px=x+across*rightX+along*forwardX, pz=z+across*rightZ+along*forwardZ;
    p.setXYZ(i,px,world.heightAt(px,pz)+.022,pz);
  }
  geometry.computeVertexNormals();
  const material = new THREE.MeshBasicMaterial({ map: footTexture, transparent: true, opacity: .64, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  effectRoot.add(mesh);
  footprints.push({ mesh, born: state.time });
  if (footprints.length > 140) { const old = footprints.shift(); effectRoot.remove(old.mesh); old.mesh.geometry.dispose(); old.mesh.material.dispose(); }
  sound.step();
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

function interact() {
  if(!isPlaying())return;
  detectInteraction();
  if(!state.target)return;
  const target=state.target,journeyTarget=target.type==='luggage'||target.type==='wagon';
  if(state.time-interactionTime<(journeyTarget ? .35 : 2.8))return;
  interactionTime=state.time;
  if(journeyTarget){
    const result=world.journey.act(target);if(!result)return;
    if(result.picked){player.targetPitch=-.025;world.trail.update(0,state.time,player,true);}
    if(result.message)notify(result.message,4000);
    if(result.working)sound.rustle();
    if(result.journal)openLuggage();
    if(result.story)showStory(result.story);
    if(result.complete)finishJourney();
    syncJourneyHUD();if(isPlaying())detectInteraction();return;
  }
  if (target.type === 'pine') { shakePine(target); notify('枝頭落雪，又靜下來了。'); }
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
  nearest=world.journey.candidate(player)||nearest;
  state.target = nearest;
  updateInteractionPrompt();
}

const promptPoint=new THREE.Vector3();
function updateInteractionPrompt(){
  const button=$('interact'),target=state.target;
  if(!isPlaying()||!target||target.busy||!target.label||world.journey.getState().working){button.hidden=true;return;}
  promptPoint.copy(target.promptPosition||target.position);
  if(!target.promptPosition)promptPoint.y+=.45;
  promptPoint.project(camera);
  if(promptPoint.z< -1||promptPoint.z>1||Math.abs(promptPoint.x)>1.12||Math.abs(promptPoint.y)>1.12){button.hidden=true;return;}
  $('interact-label').textContent=target.label;
  button.disabled=Boolean(target.busy);
  button.setAttribute('aria-label',target.label+'，點擊或按 E');
  button.hidden=false;
  const half=Math.max(88,button.offsetWidth/2+16);
  button.style.left=THREE.MathUtils.clamp((promptPoint.x*.5+.5)*innerWidth,half,innerWidth-half)+'px';
  button.style.top=THREE.MathUtils.clamp((.5-promptPoint.y*.5)*innerHeight+28,100,innerHeight-72)+'px';
}

function disposeEffect(object) {
  effectRoot.remove(object);
  object.traverse(child => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  });
}

function updateEffects(dt) {
  for (let i = footprints.length - 1; i >= 0; i--) {
    const foot = footprints[i], age = state.time - foot.born;
    foot.mesh.material.opacity = .64 * (1 - THREE.MathUtils.smoothstep(age, 2, 21));
    if (age > 21) { effectRoot.remove(foot.mesh); foot.mesh.geometry.dispose(); foot.mesh.material.dispose(); footprints.splice(i, 1); }
  }
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i]; e.age += dt;
    if (e.type === 'snow') {
      const p = e.object.geometry.attributes.position;
      for (let j = 0; j < p.count; j++) { p.array[j * 3] += dt * .27; p.array[j * 3 + 1] -= dt * e.speeds[j]; }
      p.needsUpdate = true; e.object.material.opacity = .9 * Math.max(0, 1 - e.age / e.life);
    }
    if (e.age >= e.life) {
      disposeEffect(e.object);
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
  if (footDistance > .74) { addFootprint(); footDistance %= .74; }
  lastPlayer = { x: player.x, z: player.z };
  player.y = THREE.MathUtils.damp(player.y, world.heightAt(player.x, player.z) + 1.65, 14, dt);
  player.yaw = THREE.MathUtils.damp(player.yaw, player.targetYaw, 12, dt);
  player.pitch = THREE.MathUtils.damp(player.pitch, player.targetPitch, 12, dt);
  const zone = world.zoneAt(player.x, player.z);
  if (zone !== state.zone) { state.zone = zone; }
  const shoreDistance = Math.max(0, 1 - Math.abs(player.x - 2) / 25);
  shelter = THREE.MathUtils.damp(shelter, world.shelterAt(player.x,player.z), 2.8, dt);
  sound.update({ wind: .3 + Math.min(.5, (player.y - 1.65) / 35), river: shoreDistance, shelter: Math.max(shelter, zone.includes('松') ? .30 : 0) });
}

function addWeather() {
  const count = matchMedia('(pointer:coarse)').matches ? 4200 : 7600;
  snowCount = count;
  const positions = new Float32Array(count * 3), sizes = new Float32Array(count), phases = new Float32Array(count), speed = [], spans = [];
  for (let i = 0; i < count; i++) {
    // A close veil gives the snowfall depth; a broader layer still reaches the ridges.
    const span = i % 5 === 0 ? 32 : 64;
    spans.push(span);
    positions.set([player.x+(Math.random()-.5)*span,player.y-10+Math.random()*38,player.z+(Math.random()-.5)*span],i*3);
    sizes[i]=.045+Math.pow(Math.random(),2)*.115;
    phases[i]=Math.random()*Math.PI*2;
    speed.push(.95+Math.random()*1.35);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));
  geometry.setAttribute('aPhase',new THREE.BufferAttribute(phases,1));
  const material = new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,
    uniforms:{uScale:{value:innerHeight*renderer.getPixelRatio()*.94},uShelter:{value:0}},
    vertexShader:`attribute float aSize; attribute float aPhase; uniform float uScale; uniform float uShelter;
      varying float vAlpha; varying float vPhase;
      void main(){ vec4 p=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*p;
        gl_PointSize=clamp(aSize*uScale/max(1.,-p.z),1.35,18.);
        float localLee=uShelter*(1.-smoothstep(3.,18.,-p.z));
        vAlpha=(.58+.23*sin(aPhase*2.3))*(1.-smoothstep(14.,45.,-p.z))*(1.-localLee*.83); vPhase=aPhase; }`,
    fragmentShader:`varying float vAlpha; varying float vPhase;
      void main(){vec2 p=gl_PointCoord-.5; float a=atan(p.y,p.x);
        float r=length(p)+.025*sin(a*5.+vPhase)+.018*sin(a*9.);
        float alpha=(1.-smoothstep(.16,.5,r))*vAlpha;
        if(alpha<.008)discard; gl_FragColor=vec4(vec3(.98,.985,.977),alpha);
        #include <colorspace_fragment>
      }`
  });
  const snow = new THREE.Points(geometry, material);
  snow.frustumCulled = false; world.scene.add(snow);
  const powder = createGroundSnow({ scene:world.scene, heightAt:world.heightAt, shelterAt:world.shelterAt, reducedMotion, coarse:matchMedia('(pointer:coarse)').matches });
  powderDiagnostics = powder.diagnostics;
  return dt => {
    const gust = .5 + .3*Math.sin(state.time*.37) + .2*Math.sin(state.time*.83+1.4);
    const drift=.20+gust*.64, motion=reducedMotion ? .5 : 1;
    for (let i = 0; i < count; i++) {
      const j=i*3;
      const localLee=shelter*(1-THREE.MathUtils.smoothstep(Math.hypot(positions[j]-player.x,positions[j+2]-player.z),3,18));
      positions[j]+=dt*(drift+Math.sin(state.time*.65+phases[i])*.13)*motion*(1-localLee*.86);
      positions[j+1]-=dt*speed[i]*motion;
      positions[j+2]+=dt*(drift*.2+Math.sin(phases[i]+state.time*.36)*.08)*motion*(1-localLee*.86);
      if(positions[j+1]<player.y-10)positions[j+1]=player.y+28;
      if(positions[j+1]>player.y+28)positions[j+1]=player.y-10;
      const span=spans[i], half=span*.5;
      if(positions[j]>player.x+half)positions[j]-=span; else if(positions[j]<player.x-half)positions[j]+=span;
      if(positions[j+2]>player.z+half)positions[j+2]-=span; else if(positions[j+2]<player.z-half)positions[j+2]+=span;
    }
    material.uniforms.uScale.value=innerHeight*renderer.getPixelRatio()*.94;
    material.uniforms.uShelter.value=shelter;
    geometry.attributes.position.needsUpdate = true;
    powder.update(dt,state.time,player,gust);
  };
}

function resize() {
  if (!renderer) return;
  const width = innerWidth, height = innerHeight;
  renderer.setSize(width, height, false);
  wash?.resize(width, height, renderer.getPixelRatio());
  camera.aspect = width / height; camera.updateProjectionMatrix();
}

async function init() {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, matchMedia('(pointer:coarse)').matches ? 1.3 : 1.65));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    await Promise.all([document.fonts.load('20px InkBrush'),document.fonts.load('20px InkCalligraphy')]);
    world = createWorld();
    wash = new InkWash(renderer);
    camera = new THREE.PerspectiveCamera(56, 1, .1, 720); camera.rotation.order = 'YXZ';
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
        world.journey.update(dt,state.time,player);
        world.trail.update(dt,state.time,player,isPlaying());
        const workingFocus=world.journey.focusPoint();
        if(workingFocus&&isPlaying()){
          const dx=workingFocus.x-player.x,dz=workingFocus.z-player.z,direction=Math.atan2(-dx,-dz);
          player.targetYaw=player.yaw+Math.atan2(Math.sin(direction-player.yaw),Math.cos(direction-player.yaw));
          player.targetPitch=THREE.MathUtils.clamp(Math.atan2(workingFocus.y-player.y,Math.hypot(dx,dz)),-.95,.40);
        }
        world.update(dt, state.time, player, .5+.3*Math.sin(state.time*.37)+.2*Math.sin(state.time*.83+1.4));
        updateEffects(dt); weather(dt);
      }
      camera.position.set(player.x, player.y, player.z); camera.rotation.set(player.pitch, player.yaw, 0);
      const fov = state.time < focusUntil ? 44 : 56;
      camera.fov = THREE.MathUtils.damp(camera.fov, fov, 3, dt); camera.updateProjectionMatrix();
      if (isPlaying() && (interactionTick += dt) > .15) { detectInteraction(); interactionTick = 0; }
      updateInteractionPrompt();
      wash.render(world.scene, camera, state.time);
      frameSamples++; fpsTime += elapsed;
      if (fpsTime > 1) { state.fps = Math.round(frameSamples / fpsTime); frameSamples = fpsTime = 0; }
    });
    // Let at least two real frames render before the image-to-world transition can start.
    Promise.all([world.ready,document.fonts.load('20px InkBrush'),document.fonts.load('20px InkCalligraphy'),...['hat','scroll','decree','map','farewell'].map(id=>new Promise((resolve,reject)=>{const img=new Image();img.onload=resolve;img.onerror=reject;img.src=`./assets/props-v2/${id}.png`;}))]).then(() => requestAnimationFrame(() => requestAnimationFrame(() => {
      state.ready = true; $('start').disabled = false; $('start-label').textContent = '步入江雪'; $('load-status').textContent = '';
    }))).catch(error => {
      console.error('水墨素材載入失敗', error);
      $('load-status').textContent = '水墨素材未能載入，請重新整理再試。';
    });
    window.__JIANGXUE__ = Object.freeze({ inspectGuideRoutes:()=>world.trail.inspectRoutes(), getState: () => ({ ready: state.ready, started: state.started, paused: state.paused, entering: state.entering, muted: state.muted, zone: state.zone, fps: state.fps, x: player.x, y: player.y, z: player.z, yaw: player.yaw, pitch: player.pitch, target: state.target?.type,targetId:state.target?.id,targetLabel:state.target?.label, landmarks: world.landmarks, renderer: renderer.info.render, footprints: footprints.length, footprintOpacity: footprints.map(f=>Number(f.mesh.material.opacity.toFixed(3))), snowflakes:snowCount, effects: effects.length, boat: { y:world.boat.position.y, roll:world.boat.rotation.z, pitch:world.boat.rotation.x }, audio: sound.getDiagnostics?.(), shelter:Number(shelter.toFixed(3)), shelterSpots:world.shelterSpots, vegetation:world.vegetationStats,rockGrounding:world.rockGrounding, ambience:{...world.ambienceDiagnostics}, groundSnow:powderDiagnostics?.(),journey:world.journey.getState(),trail:world.trail.getState() }) });
  } catch (error) {
    console.error('江雪世界載入失敗', error);
    $('start-label').textContent = '重新載入'; $('start').disabled = false;
    $('load-status').textContent = '未能建立 3D 畫面。請使用支援 WebGL 的瀏覽器，或重新載入再試。';
    $('start').addEventListener('click', () => location.reload(), { once: true });
  }
}

$('interact').addEventListener('click', interact);
$('open-luggage').addEventListener('click',openLuggage);
$('close-luggage').addEventListener('click',closeLuggage);
$('story-continue').addEventListener('click',closeStory);
$('continue-journey').addEventListener('click',returnToMain);
storyDialog.addEventListener('cancel',event=>{event.preventDefault();closeStory();});
luggageDialog.addEventListener('cancel',event=>{event.preventDefault();closeLuggage();});
$('luggage-list').addEventListener('click',event=>{const id=event.target.closest('[data-story]')?.dataset.story;if(id){const item=world.journey.items.find(i=>i.id===id);showStory(item,true);}});
$('start').addEventListener('click', start);
$('close-menu').addEventListener('click', closeMenu);
$('resume').addEventListener('click', closeMenu);
$('restart').addEventListener('click', restart);
menu.addEventListener('cancel', event => { event.preventDefault(); closeMenu(); });
$('reference').addEventListener('click', () => referenceDialog.showModal());
$('close-reference').addEventListener('click', () => referenceDialog.close());
$('sound').addEventListener('click', async () => { state.muted = !state.muted; if (!state.muted) { try { await sound.start(); } catch { state.muted = true; notify('這個瀏覽器暫未能播放聲音。'); } } syncSound(); });
window.addEventListener('keydown', event => {
  if (event.code === 'Escape' && isPlaying()) { event.preventDefault(); openMenu(); return; }
  if (!isPlaying() || event.target.closest('dialog,input,textarea')) return;
  if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyE'].includes(event.code) || (event.code === 'Space' && !event.target.closest('button'))) event.preventDefault();
  keys.add(event.code);
  if (!event.repeat && event.code === 'KeyE') interact();
});
window.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', () => { if (document.hidden && isPlaying()) openMenu(); });
window.addEventListener('resize', resize);

const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
function targetAt(x,y){
  if(!state.target)return false;
  pointer.set(x/innerWidth*2-1,1-y/innerHeight*2);raycaster.setFromCamera(pointer,camera);
  const object=state.target.root||state.target.object;
  if(object)return raycaster.intersectObject(object,true).some(hit=>!hit.object.userData.rigBleed&&hit.distance<12);
  const centre=state.target.position.clone();centre.y+=.45;
  return !!raycaster.ray.intersectSphere(new THREE.Sphere(centre,.8),new THREE.Vector3());
}
canvas.addEventListener('pointerdown',event=>{
  if(!isPlaying()||event.button>0)return;
  canvas.focus({preventScroll:true});canvas.setPointerCapture(event.pointerId);
  const motion=event.pointerType==='touch'&&event.clientX<innerWidth*.45;
  if(motion){if(joy.id!==null)return;joy.id=event.pointerId;joy.startX=event.clientX;joy.startY=event.clientY;joy.travel=0;}
  else if(!drag)drag={id:event.pointerId,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,travel:0};
});
canvas.addEventListener('pointermove',event=>{
  if(!isPlaying())return;
  if(event.pointerId===joy.id){
    let dx=event.clientX-joy.startX,dy=event.clientY-joy.startY;joy.travel=Math.max(joy.travel,Math.hypot(dx,dy));
    const length=Math.hypot(dx,dy),limit=60;if(length>limit){dx*=limit/length;dy*=limit/length;}
    joy.x=length>8?dx/limit:0;joy.y=length>8?dy/limit:0;return;
  }
  if(drag&&drag.id===event.pointerId){
    drag.travel=Math.max(drag.travel,Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY));
    player.targetYaw-=(event.clientX-drag.x)*.0032;
    player.targetPitch=THREE.MathUtils.clamp(player.targetPitch-(event.clientY-drag.y)*.0028,-1.1,.85);
    drag.x=event.clientX;drag.y=event.clientY;
  }else if(event.pointerType==='mouse')canvas.style.cursor=targetAt(event.clientX,event.clientY)?'pointer':'grab';
});
for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,event=>{
  let tap=false;
  if(event.pointerId===joy.id){tap=joy.travel<9;joy.id=null;joy.x=joy.y=0;}
  if(event.pointerId===drag?.id){tap=drag.travel<9;drag=null;}
  if(name==='pointerup'&&tap&&isPlaying()){detectInteraction();if(targetAt(event.clientX,event.clientY))interact();}
});
canvas.addEventListener('contextmenu',event=>event.preventDefault());
canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); if (state.started) openMenu(); notify('畫面暫停，正在恢復。'); });
canvas.addEventListener('webglcontextrestored', () => location.reload());
window.addEventListener('pagehide', () => sound.dispose());
init();
