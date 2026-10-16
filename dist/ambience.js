import * as THREE from './vendor/three.module.js';

const TAU = Math.PI * 2;
const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
const smooth = (lo, hi, value) => {
  const t = clamp((value - lo) / Math.max(hi - lo, 1e-6), 0, 1);
  return t * t * (3 - 2 * t);
};
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;

// These are deliberately procedural. The reflection is a flattened ink
// silhouette, rather than a second render of the boat or a costly reflection
// target. Noise breaks every stroke before it reaches the transparent water.
const reflectionVertexShader = /* glsl */`
  uniform mat4 uBoatMatrix;
  uniform vec3 uCamera;
  uniform float uWaterLevel;
  uniform float uTime;
  varying vec3 vProjectedWorld;
  varying float vValid;
  void main() {
    vec3 world = (uBoatMatrix * vec4(position, 1.0)).xyz;
    float valid = step(uWaterLevel + 0.012, world.y);
    float mirroredY = uWaterLevel - (world.y - uWaterLevel);
    vec3 virtualPoint = vec3(world.x, mirroredY, world.z);
    float denominator = virtualPoint.y - uCamera.y;
    float safeDenominator = min(denominator, -0.0001);
    float projectionT = clamp((uWaterLevel + 0.008 - uCamera.y) / safeDenominator, 0.0, 1.0);
    vec3 projected = uCamera + (virtualPoint - uCamera) * projectionT;
    projected.y = uWaterLevel + 0.008;
    projected.x += .075*sin(projected.z*2.7+uTime*.75)+.025*sin(projected.z*6.1-uTime*.43);
    vProjectedWorld = projected;
    vValid = valid;
    gl_Position = projectionMatrix * viewMatrix * vec4(projected, 1.0);
  }
`;

const reflectionFragmentShader = /* glsl */`
  uniform float uTime;
  uniform float uOpacity;
  varying vec3 vProjectedWorld;
  varying float vValid;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
               mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0)), f.x), f.y);
  }
  void main() {
    if (vValid < 0.5) discard;
    vec2 p = vProjectedWorld.xz;
    float pigment = 0.48 + 0.52 * noise(p * vec2(0.42, 1.7) + vec2(uTime * 0.018, 19.0));
    float horizontalBreak = smoothstep(0.24, 0.71, noise(p * vec2(1.7, 0.21) + vec2(13.0+uTime*.12, uTime * 0.025)));
    float wave = 0.68 + 0.32 * sin(p.x * 0.82 + p.y * 0.12 + uTime * 0.35 + pigment * 2.3);
    float alpha = (0.14 + pigment * 0.10) * horizontalBreak * wave * uOpacity;
    if (alpha < 0.006) discard;
    gl_FragColor = vec4(vec3(0.40, 0.50, 0.52), alpha);
    #include <colorspace_fragment>
  }
`;

const rippleVertexShader = /* glsl */`
  varying vec2 vLocal;
  void main() {
    vLocal = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const rippleFragmentShader = /* glsl */`
  uniform float uTime;
  uniform float uOpacity;
  varying vec2 vLocal;

  float hash21(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
               mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0)), f.x), f.y);
  }
  float brokenRing(vec2 p, vec2 center, float phase, float speed) {
    vec2 q = (p - center) * vec2(0.60, 1.0);
    float progress = fract(uTime * speed + phase);
    float radius = 0.24 + progress * 1.62;
    float warp = (noise(q * vec2(3.1, 5.3) + vec2(phase * 9.0, uTime * 0.04)) - 0.5) * 0.11;
    float distanceToRing = abs(length(q) + warp - radius);
    float width = 0.020 + radius * 0.018;
    float stroke = 1.0 - smoothstep(width, width * 2.8, distanceToRing);
    float breaks = 0.28 + 0.72 * noise(q * vec2(2.1, 4.7) + vec2(phase * 17.0, 4.0));
    float fade = 1.0 - smoothstep(1.24, 1.86, radius);
    return stroke * breaks * fade;
  }

  void main() {
    vec2 p = vLocal;
    float waves = brokenRing(p, vec2(-1.85, 0.02), 0.04, 0.075)
                + brokenRing(p, vec2(0.25, -0.02), 0.39, 0.067)
                + brokenRing(p, vec2(1.86, 0.04), 0.70, 0.082);
    float planeEdge = smoothstep(0.0, 0.38, 5.0 - abs(p.x))
                    * smoothstep(0.0, 0.30, 2.6 - abs(p.y));
    float longWash = (1.0 - smoothstep(0.0, 3.9, abs(p.x)))
                   * (0.18 + 0.20 * noise(p * vec2(.34, .92) + vec2(7.0, uTime * .018)));
    float alpha = clamp(waves * 0.13 + longWash * 0.035, 0.0, 0.23) * uOpacity * planeEdge;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(vec3(0.47, 0.57, 0.59), alpha);
    #include <colorspace_fragment>
  }
`;

const mistVertexShader = /* glsl */`
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const mistFragmentShader = /* glsl */`
  uniform float uTime;
  uniform float uPhase;
  uniform float uOpacity;
  uniform float uDrift;
  varying vec2 vUv;
  varying vec3 vWorld;

  float hash21(vec2 p) {
    p = fract(p * vec2(91.7, 247.3));
    p += dot(p, p + 17.13);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
               mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0)), f.x), f.y);
  }

  void main() {
    vec2 drifted = vWorld.xz + vec2(uTime * uDrift, -uTime * uDrift * 0.43);
    float broad = noise(drifted * vec2(0.105, 0.18) + vec2(uPhase * 3.7, 9.0));
    float torn = noise(drifted * vec2(0.33, 0.075) + vec2(31.0, uPhase * 5.1));
    float wisps = smoothstep(0.28, 0.72, broad) * (0.54 + 0.46 * smoothstep(0.22, 0.82, torn));
    float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(0.0, 0.18, 1.0 - vUv.x)
               * smoothstep(0.0, 0.24, vUv.y) * smoothstep(0.0, 0.24, 1.0 - vUv.y);
    float filament = 0.74 + 0.26 * sin(drifted.x * 0.21 + drifted.y * 0.13 + uTime * 0.018 + uPhase);
    float alpha = edge * wisps * filament * uOpacity;
    if (alpha < 0.004) discard;
    vec3 inkMist = mix(vec3(0.73, 0.76, 0.75), vec3(0.89, 0.90, 0.87), broad);
    gl_FragColor = vec4(inkMist, alpha);
    #include <colorspace_fragment>
  }
`;

// Far veils stand vertically below the painted ridges. Their low opacity and
// four-sided noise fade let the mountain paper breathe through them instead of
// producing a billboard rectangle.
const veilVertexShader = /* glsl */`
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const veilFragmentShader = /* glsl */`
  uniform float uTime;
  uniform float uPhase;
  uniform float uOpacity;
  uniform float uDrift;
  varying vec2 vUv;
  varying vec3 vWorld;

  float hash21(vec2 p) {
    p = fract(p * vec2(71.3, 193.7));
    p += dot(p, p + 23.17);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
               mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0)), f.x), f.y);
  }

  void main() {
    vec2 drifted = vec2(vWorld.x + uTime * uDrift, vWorld.z - uTime * uDrift * .36);
    vec2 verticalDomain = drifted * vec2(.11, .13) + vec2(vWorld.y * .075, vWorld.y * .027);
    float broad = noise(verticalDomain + vec2(uPhase * 2.7, 12.0));
    float torn = noise(drifted * vec2(.31, .08) + vec2(27.0 + vWorld.y * .13, uPhase * 4.9));
    float edge = smoothstep(0.0, .19, vUv.x) * smoothstep(0.0, .19, 1.0 - vUv.x)
               * smoothstep(0.0, .22, vUv.y) * smoothstep(0.0, .25, 1.0 - vUv.y);
    float wisps = smoothstep(.27, .73, broad) * (.48 + .52 * smoothstep(.22, .80, torn));
    float tendril = .72 + .28 * sin(vWorld.y * .31 + drifted.x * .14 + uTime * .014 + uPhase);
    float alpha = edge * wisps * tendril * uOpacity;
    if (alpha < .0035) discard;
    vec3 inkMist = mix(vec3(.70, .73, .73), vec3(.87, .89, .87), broad);
    gl_FragColor = vec4(inkMist, alpha);
    #include <colorspace_fragment>
  }
`;

function hashSeed(value) {
  const n = Math.sin(value * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function makeMistGeometry(width, depth, seed) {
  const cols = 12, rows = 4;
  const positions = [], uvs = [], indices = [];
  for (let j = 0; j <= rows; j++) {
    const v = j / rows;
    for (let i = 0; i <= cols; i++) {
      const u = i / cols;
      const edge = Math.min(u, 1 - u, v, 1 - v);
      const wobble = (hashSeed(seed + i * 3.7 + j * 11.9) - .5) * (0.08 + edge * .28);
      const x = (u - .5) * width + Math.sin(v * TAU + seed) * wobble * width;
      const z = (v - .5) * depth + Math.cos(u * TAU * .7 + seed * .3) * wobble * depth;
      const y = Math.sin(u * 4.1 + v * 2.2 + seed) * .16 + (hashSeed(seed + i * 5.3 + j * 2.1) - .5) * .10;
      positions.push(x, y, z);
      uvs.push(u, v);
    }
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = j * (cols + 1) + i, b = a + cols + 1;
    indices.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function makeVeilGeometry(width, height, depth, seed) {
  const cols = 8, rows = 6;
  const positions = [], uvs = [], indices = [];
  for (let j = 0; j <= rows; j++) {
    const v = j / rows;
    for (let i = 0; i <= cols; i++) {
      const u = i / cols;
      const edge = Math.min(u, 1 - u, v, 1 - v);
      const wobble = (hashSeed(seed + i * 4.1 + j * 9.7) - .5) * (.08 + edge * .30);
      const x = (u - .5) * width + Math.sin(v * TAU + seed) * wobble * width * .28;
      const y = (v - .5) * height + Math.cos(u * TAU * .8 + seed * .4) * wobble * height * .12;
      const z = Math.sin(u * TAU * .7 + seed) * wobble * depth;
      positions.push(x, y, z);
      uvs.push(u, v);
    }
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = j * (cols + 1) + i, b = a + cols + 1;
    indices.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function collectBoatReflectionGeometry(boat, maxTriangles = 40000) {
  boat.updateMatrixWorld(true);
  const boatInverse = new THREE.Matrix4().copy(boat.matrixWorld).invert();
  const sources = [];
  let triangleCount = 0;
  boat.traverse(object => {
    const position = object.geometry?.attributes?.position;
    if (!object.isMesh || !position) return;
    const count = object.geometry.index ? object.geometry.index.count : position.count;
    const triangles = Math.floor(count / 3);
    if (!triangles) return;
    sources.push({ object, geometry: object.geometry, position, index: object.geometry.index, triangles });
    triangleCount += triangles;
  });

  const stride = Math.max(1, Math.ceil(triangleCount / maxTriangles));
  const positions = [];
  const local = new THREE.Vector3();
  for (const source of sources) {
    for (let triangle = 0; triangle < source.triangles; triangle += stride) {
      for (let corner = 0; corner < 3; corner++) {
        const element = triangle * 3 + corner;
        const index = source.index ? source.index.getX(element) : element;
        local.fromBufferAttribute(source.position, index)
          .applyMatrix4(source.object.matrixWorld)
          .applyMatrix4(boatInverse);
        positions.push(local.x, local.y, local.z);
      }
    }
  }

  // A small fallback keeps the effect visible in isolated tests or if a boat
  // is supplied before its child meshes have finished loading.
  if (positions.length < 9) {
    positions.push(
      -2.9, .54, -.45, 2.9, .54, -.45, 2.9, .54, .45,
      -2.9, .54, -.45, 2.9, .54, .45, -2.9, .54, .45,
      -.92, 1.35, -.22, -.25, 1.90, -.08, -.25, 1.35, .25,
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  return { geometry, sourceTriangles: triangleCount, emittedTriangles: positions.length / 9 };
}

/**
 * Lightweight ink ambience around the fishing boat and distant ridges.
 * It uses transparent shader masks instead of a second scene render or image
 * sprites, so the scene retains the brush-painted water and fog depth.
 */
export function createAmbience({ scene, boat, heightAt = () => 0, bank = () => 1 } = {}) {
  if (!scene || typeof scene.add !== 'function') throw new TypeError('createAmbience requires a THREE.Scene');
  if (!boat || !boat.position) throw new TypeError('createAmbience requires the fishing boat');

  const ambience = new THREE.Group();
  ambience.name = '寒江・淡墨倒影與流霧';

  const waterLevel = finite(boat.userData?.buoyancy?.waterLevel, -0.02);
  const boatEffects = new THREE.Group();
  boatEffects.name = '孤舟・水下淡墨映痕';
  boatEffects.position.set(boat.position.x, waterLevel + .006, boat.position.z);
  boatEffects.rotation.y = boat.rotation?.y || 0;
  ambience.add(boatEffects);

  const reflectionMaterial = new THREE.ShaderMaterial({
    name: '孤舟・破墨倒影',
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: .92 },
      uBoatMatrix: { value: new THREE.Matrix4() },
      uCamera: { value: new THREE.Vector3(0, waterLevel + 12, 0) },
      uWaterLevel: { value: waterLevel },
    },
    vertexShader: reflectionVertexShader,
    fragmentShader: reflectionFragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const reflectionData = collectBoatReflectionGeometry(boat);
  const reflection = new THREE.Mesh(reflectionData.geometry, reflectionMaterial);
  reflection.name = '孤舟・實體投影破墨倒影';
  // The shader projects this local geometry far from its CPU bounding sphere.
  reflection.frustumCulled = false;
  reflection.renderOrder = 4;
  ambience.add(reflection);
  reflectionMaterial.uniforms.uBoatMatrix.value.copy(boat.matrixWorld);
  reflectionMaterial.uniforms.uCamera.value.set(boat.position.x + 18, waterLevel + 12, boat.position.z + 18);

  const rippleMaterial = new THREE.ShaderMaterial({
    name: '孤舟・不規則擴散墨紋',
    uniforms: { uTime: { value: 0 }, uOpacity: { value: .92 } },
    vertexShader: rippleVertexShader,
    fragmentShader: rippleFragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const ripples = new THREE.Mesh(new THREE.PlaneGeometry(10.0, 5.2), rippleMaterial);
  ripples.name = '孤舟・破碎擴散波紋';
  ripples.rotation.x = -Math.PI / 2;
  ripples.renderOrder = 3;
  boatEffects.add(ripples);

  const mistRoot = new THREE.Group();
  mistRoot.name = '遠嶺・緩慢流霧';
  ambience.add(mistRoot);
  const mistDescriptions = [
    { x: -52, z: 23, width: 30, depth: 12, lift: 1.7, phase: .55, drift: .35 },
    { x: -39, z: -18, width: 27, depth: 11, lift: 1.9, phase: 2.25, drift: .28 },
    { x: -25, z: 30, width: 22, depth: 10, lift: 1.5, phase: 4.05, drift: .42 },
  ];
  const mistPatches = mistDescriptions.map((description, index) => {
    const x = Math.min(description.x, finite(bank(description.z), 1) - 3.0);
    const y = finite(heightAt(x, description.z), .65) + description.lift;
    const material = new THREE.ShaderMaterial({
      name: `遠嶺・流霧${index + 1}`,
      uniforms: {
        uTime: { value: 0 },
        uPhase: { value: description.phase },
        uOpacity: { value: 0 },
        uDrift: { value: description.drift },
      },
      vertexShader: mistVertexShader,
      fragmentShader: mistFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(makeMistGeometry(description.width, description.depth, index + 17), material);
    mesh.name = `遠嶺・破碎流霧${index + 1}`;
    mesh.position.set(x, y, description.z);
    mesh.renderOrder = 2;
    mistRoot.add(mesh);
    return { description, mesh, material, baseX: x, baseY: y, baseZ: description.z };
  });

  // Two distant vertical veils add atmospheric depth below the surrounding
  // mountain paintings. They drift in world space and pulse independently, so
  // a path or ridge is sometimes clear and sometimes veiled by pale ink.
  const farVeilDescriptions = [
    { x: 46, z: -72, y: 10.5, width: 50, height: 16, depth: 1.6, phase: 1.15, drift: .23, yaw: -.16, tilt: -.055 },
    { x: 82, z: 28, y: 13.0, width: 46, height: 18, depth: 1.8, phase: 3.45, drift: .19, yaw: .32, tilt: .045 },
  ];
  const farVeils = farVeilDescriptions.map((description, index) => {
    const material = new THREE.ShaderMaterial({
      name: `遠山・垂直流霧${index + 1}`,
      uniforms: {
        uTime: { value: 0 },
        uPhase: { value: description.phase },
        uOpacity: { value: 0 },
        uDrift: { value: description.drift },
      },
      vertexShader: veilVertexShader,
      fragmentShader: veilFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(makeVeilGeometry(description.width, description.height, description.depth, index + 43), material);
    mesh.name = `遠山・破碎垂直流霧${index + 1}`;
    mesh.position.set(description.x, description.y, description.z);
    mesh.rotation.y = description.yaw;
    mesh.rotation.z = description.tilt;
    mesh.renderOrder = 1;
    mistRoot.add(mesh);
    return { description, mesh, material, baseX: description.x, baseY: description.y, baseZ: description.z };
  });

  scene.add(ambience);
  let elapsed = 0;
  const diagnostics = {
    reflection: true,
    rippleMeshes: 1,
    reflectionSourceTriangles: reflectionData.sourceTriangles,
    reflectionEmittedTriangles: reflectionData.emittedTriangles,
    mistPatches: mistPatches.length,
    farWisps: farVeils.length,
    activeMist: 0,
    activeFarWisps: 0,
    updates: 0,
    time: 0,
    waterLevel,
  };

  function update(dt = 0, time = undefined, player = null) {
    elapsed = Number.isFinite(time) ? time : elapsed + Math.max(0, finite(dt, 0));
    diagnostics.time = elapsed;
    diagnostics.updates++;

    boatEffects.position.set(boat.position.x, waterLevel + .006, boat.position.z);
    boatEffects.rotation.y = finite(boat.rotation?.y, 0);
    const scale = finite(boat.scale?.x, 1);
    boatEffects.scale.setScalar(scale);
    boat.updateMatrixWorld(true);
    reflectionMaterial.uniforms.uBoatMatrix.value.copy(boat.matrixWorld);
    const camera = reflectionMaterial.uniforms.uCamera.value;
    if (player && Number.isFinite(player.x) && Number.isFinite(player.y) && Number.isFinite(player.z)) {
      camera.set(player.x, player.y, player.z);
    } else {
      camera.set(boat.position.x + 18, waterLevel + 12, boat.position.z + 18);
    }
    reflectionMaterial.uniforms.uTime.value = elapsed;
    rippleMaterial.uniforms.uTime.value = elapsed;

    let activeMist = 0;
    mistPatches.forEach(({ description, mesh, material, baseX, baseY, baseZ }) => {
      const phase = description.phase;
      mesh.position.x = baseX + Math.sin(elapsed * .018 * description.drift + phase) * 2.4;
      mesh.position.y = baseY + Math.sin(elapsed * .027 + phase * 1.7) * .22;
      mesh.position.z = baseZ + Math.cos(elapsed * .014 * description.drift + phase) * 2.8;
      material.uniforms.uTime.value = elapsed;

      const pulse = .5 + .5 * Math.sin(elapsed * (.052 + description.drift * .006) + phase);
      let distanceFade = 1;
      if (player && Number.isFinite(player.x) && Number.isFinite(player.z)) {
        const distance = Math.hypot(mesh.position.x - player.x, mesh.position.z - player.z);
        distanceFade = smooth(8, 34, distance);
      }
      const opacity = (.035 + pulse * .20) * distanceFade;
      material.uniforms.uOpacity.value = opacity;
      if (opacity > .055) activeMist++;
    });

    let activeFarWisps = 0;
    farVeils.forEach(({ description, mesh, material, baseX, baseY, baseZ }) => {
      const phase = description.phase;
      mesh.position.x = baseX + Math.sin(elapsed * .010 * description.drift + phase) * 3.8;
      mesh.position.y = baseY + Math.sin(elapsed * .016 + phase * 1.3) * .42;
      mesh.position.z = baseZ + Math.cos(elapsed * .008 * description.drift + phase) * 4.6;
      mesh.rotation.y = description.yaw + Math.sin(elapsed * .007 + phase) * .035;
      material.uniforms.uTime.value = elapsed;

      const pulse = .5 + .5 * Math.sin(elapsed * (.034 + description.drift * .004) + phase);
      let distanceFade = 1;
      if (player && Number.isFinite(player.x) && Number.isFinite(player.z)) {
        const distance = Math.hypot(mesh.position.x - player.x, mesh.position.z - player.z);
        distanceFade = smooth(18, 105, distance);
      }
      const opacity = (.025 + pulse * .12) * distanceFade;
      material.uniforms.uOpacity.value = opacity;
      if (opacity > .045) activeFarWisps++;
    });
    diagnostics.activeMist = activeMist + activeFarWisps;
    diagnostics.activeFarWisps = activeFarWisps;
  }

  return { update, diagnostics };
}

