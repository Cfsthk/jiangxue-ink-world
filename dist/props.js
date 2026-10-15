import * as THREE from './vendor/three.module.js';

const TAU = Math.PI * 2;
const v3 = p => p.isVector3 ? p.clone() : new THREE.Vector3(...p);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function seeded(seed) {
  let n = seed >>> 0;
  return () => { n = (n * 1664525 + 1013904223) >>> 0; return n / 4294967296; };
}

// Merge by material without losing UVs or hard/smooth vertex normals. Thin
// straw, woven lines and timber seams therefore cost no additional draw calls.
class BrushBatch {
  constructor() { this.parts = new Map(); }
  add(geometry, material, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) {
    const matrix = new THREE.Matrix4().compose(v3(position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), v3(scale));
    geometry.applyMatrix4(matrix);
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    if (flat !== geometry) geometry.dispose();
    if (!this.parts.has(material)) this.parts.set(material, []);
    this.parts.get(material).push(flat);
  }
  finish(group, prefix) {
    for (const [material, pieces] of this.parts) {
      const count = pieces.reduce((n, g) => n + g.attributes.position.count, 0);
      const positions = new Float32Array(count * 3), normals = new Float32Array(count * 3), uvs = new Float32Array(count * 2);
      let offset = 0;
      for (const g of pieces) {
        const n = g.attributes.position.count;
        positions.set(g.attributes.position.array, offset * 3);
        normals.set(g.attributes.normal.array, offset * 3);
        if (g.attributes.uv) uvs.set(g.attributes.uv.array, offset * 2);
        offset += n; g.dispose();
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, material); mesh.name = prefix;
      group.add(mesh);
    }
    this.parts.clear();
  }
}

function tube(points, radius, endRadius = radius, segments = 12, sides = 5, profile = null) {
  const curve = new THREE.CatmullRomCurve3(points.map(v3));
  const frames = curve.computeFrenetFrames(segments, false);
  const positions = [], uvs = [], indices = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, p = curve.getPointAt(t);
    const baseRadius = radius + (endRadius - radius) * t;
    for (let j = 0; j <= sides; j++) {
      const a = j / sides * TAU;
      const r = profile ? profile(t, a, baseRadius) : baseRadius;
      const local = p.clone().addScaledVector(frames.normals[i], Math.cos(a) * r).addScaledVector(frames.binormals[i], Math.sin(a) * r);
      positions.push(local.x, local.y, local.z); uvs.push(j / sides, t);
      if (i < segments && j < sides) {
        const n = i * (sides + 1) + j, m = n + sides + 1;
        indices.push(n, n + 1, m, m, n + 1, m + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

function ringPoints(radius, y, count = 48, x = 0, z = 0, wobble = 0) {
  return Array.from({ length: count + 1 }, (_, i) => {
    const a = i / count * TAU, r = radius * (1 + wobble * Math.sin(a * 5));
    return [x + Math.cos(a) * r, y, z + Math.sin(a) * r];
  });
}

function shellPoint(t, angle, inside = false) {
  const end = Math.pow(Math.abs(t - .5) * 2, 3.6);
  const beam = Math.pow(Math.sin(t * Math.PI), .64) * .83 + .018;
  const inset = inside ? .055 : 0;
  return [
    (t - .5) * 5.8,
    .47 + end * .52 - Math.cos(angle) * (.52 - inset),
    Math.sin(angle) * Math.max(.012, beam - inset),
  ];
}

function hullPatch(a0, a1, inside = false, steps = 48, across = 2) {
  const positions = [], uvs = [], indices = [];
  for (let i = 0; i <= steps; i++) {
    const t = .005 + i / steps * .99;
    for (let j = 0; j <= across; j++) {
      positions.push(...shellPoint(t, a0 + (a1 - a0) * j / across, inside));
      // Brush wood fibres run vertically in the image: V follows each plank.
      uvs.push(j / across, t * 2);
      if (i < steps && j < across) {
        const n = i * (across + 1) + j, m = n + across + 1;
        if (inside) indices.push(n, n + 1, m, m, n + 1, m + 1);
        else indices.push(n, m, n + 1, m, m + 1, n + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

function timberBox(x, y, z) {
  const geometry = new THREE.BoxGeometry(x, y, z);
  const p = geometry.attributes.position, n = geometry.attributes.normal, uv = geometry.attributes.uv;
  const longX = x >= z;
  for (let i = 0; i < p.count; i++) {
    // End grain keeps its native mapping; side and top fibres follow the timber.
    if (Math.abs(longX ? n.getX(i) : n.getZ(i)) > .5) continue;
    const along = longX ? p.getX(i) / x : p.getZ(i) / z;
    const cross = Math.abs(n.getY(i)) > .5 ? (longX ? p.getZ(i) / z : p.getX(i) / x) : p.getY(i) / y;
    uv.setXY(i, cross + .5, (along + .5) * 2);
  }
  return geometry;
}

function mantleGeometry() {
  const rings = [
    [-.67, .65, .35, .25], [-.75, .78, .51, .35], [-.76, 1.02, .45, .34],
    [-.69, 1.26, .37, .30], [-.61, 1.48, .29, .25], [-.55, 1.57, .15, .17],
  ];
  const p = [], uv = [], idx = [], sides = 36;
  rings.forEach(([x, y, rx, rz], j) => {
    for (let i = 0; i <= sides; i++) {
      const a = i / sides * TAU, fold = 1 + Math.sin(a * 14 + j * .2) * .045;
      p.push(x + Math.cos(a) * rx * fold, y, Math.sin(a) * rz * fold);
      uv.push(i / sides, j / (rings.length - 1));
      if (j < rings.length - 1 && i < sides) { const n = j * (sides + 1) + i, m = n + sides + 1; idx.push(n, m, n + 1, m, m + 1, n + 1); }
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(idx); geometry.computeVertexNormals(); return geometry;
}

/** A complete, UV-mapped wooden skiff and seated fisherman, in local space. */
export function buildFishingBoat(palette) {
  const boat = new THREE.Group(); boat.name = '孤舟・木紋與蓑衣';
  const b = new BrushBatch(), r = seeded(1937);
  const { hullMaterial: wood, hullInsideMaterial: inner, rimMaterial: dark, cloakMaterial: cloak, hatMaterial: straw, snowMaterial: snow, branchMaterial: ink } = palette;
  const sphere = (p, s, m, detail = 12) => b.add(new THREE.SphereGeometry(1, detail, 8), m, p, [0, 0, 0], s);

  // Separate strakes leave genuine narrow joins over a darker inner shell.
  b.add(hullPatch(-Math.PI / 2, Math.PI / 2, true, 48, 20), inner);
  for (let plank = 0; plank < 12; plank++) {
    const lo = -Math.PI / 2 + plank / 12 * Math.PI + .005;
    const hi = -Math.PI / 2 + (plank + 1) / 12 * Math.PI - .005;
    b.add(hullPatch(lo, hi, false, 48, 2), wood);
  }
  for (let plank = 1; plank < 12; plank++) {
    const a = -Math.PI / 2 + plank / 12 * Math.PI;
    const points = Array.from({ length: 31 }, (_, i) => shellPoint(.012 + i / 30 * .976, a));
    b.add(tube(points, .006, .006, 36, 3), dark);
  }
  for (const side of [-1, 1]) {
    const points = Array.from({ length: 41 }, (_, i) => shellPoint(.005 + i / 40 * .99, side * Math.PI / 2));
    b.add(tube(points, .047, .039, 48, 6), dark);
    const snowPoints = points.slice(7, 20).map(p => [p[0], p[1] + .037, p[2] - side * .012]);
    b.add(tube(snowPoints, .027, .012, 20, 5), snow);
  }
  // The two raised ends are closed timber pieces, never open holes.
  for (const side of [-1, 1]) b.add(tube([[side * 2.81, .48, 0], [side * 2.89, .75, 0], [side * 2.88, 1.0, 0]], .065, .041, 10, 6), dark);

  for (let i = 0; i < 7; i++) b.add(timberBox(3.65, .075, .095), inner, [0, .115, (i - 3) * .103]);
  for (const x of [-1.34, -.74, .83, 1.45]) {
    b.add(timberBox(.13, .09, 1.08), dark, [x, .205, 0]);
    if (x === -.74 || x === .83) {
      for (let j = 0; j < 3; j++) b.add(timberBox(.115, .085, 1.22), wood, [x + (j - 1) * .119, .51, 0]);
    }
  }
  // Small cross-grain scars and pegs follow the timber surface.
  for (const x of [-1.31, -.74, .83, 1.42]) for (const z of [-.49, .49]) sphere([x, .557, z], [.017, .008, .017], dark, 7);

  // An oar rests diagonally in the boat, with a thin broad paddle blade.
  b.add(tube([[-1.77, .29, -.36], [-.25, .37, -.05], [1.57, .41, .38]], .025, .031, 18, 6), wood);
  sphere([1.79, .42, .425], [.46, .036, .125], inner, 14);
  b.add(tube([[-1.99, .29, -.407], [-1.77, .29, -.36], [-1.56, .30, -.32]], .038, .028, 5, 6), dark);

  // Pelvis, bent thighs, shin and feet remain visible below the straw mantle.
  sphere([-.68, .77, .0], [.30, .21, .28], cloak);
  for (const side of [-1, 1]) {
    b.add(tube([[-.65, .77, side * .16], [-.25, .77, side * .24], [.02, .63, side * .25]], .14, .12, 10, 8), cloak);
    b.add(tube([[.02, .66, side * .25], [.10, .44, side * .27], [.18, .24, side * .27]], .105, .075, 8, 8), cloak);
    sphere([.27, .205, side * .27], [.19, .078, .096], dark);
  }
  b.add(mantleGeometry(), cloak);
  sphere([-.67, 1.29, -.015], [.31, .33, .27], cloak);
  // Two bent arms, hanging sleeves and small articulated hands grasp the rod.
  for (const side of [-1, 1]) {
    const z = side * .25;
    const elbow = side > 0 ? [-.16, 1.08, .37] : [-.27, 1.06, -.20];
    const hand = side > 0 ? [.30, 1.24, .39] : [.14, 1.18, .34];
    b.add(tube([[-.54, 1.43, z], elbow, [hand[0] - .10, hand[1] - .025, hand[2]]], .16, .104, 16, 8), cloak);
    b.add(tube([[hand[0] - .12, hand[1] - .023, hand[2]], [hand[0] - .065, hand[1], hand[2]]], .11, .101, 4, 8), dark);
    sphere(hand, [.105, .052, .06], straw);
    for (let finger = 0; finger < 3; finger++) {
      b.add(tube([[hand[0] + .02, hand[1] + .015, hand[2] + (finger - 1) * .025], [hand[0] + .078, hand[1] -.008, hand[2] + (finger - 1) * .026], [hand[0] + .068, hand[1] - .04, hand[2] + (finger - 1) * .026]], .013, .009, 5, 4), straw);
    }
  }

  // Hunched neck, visible brow, nose and pale beard; a reserved neutral face.
  b.add(tube([[-.55, 1.43, 0], [-.46, 1.64, 0], [-.43, 1.78, 0]], .10, .09, 8, 8), straw);
  sphere([-.41, 1.76, 0], [.158, .195, .135], straw, 16);
  sphere([-.255, 1.75, .008], [.060, .063, .045], straw, 10);
  sphere([-.42, 1.735, .128], [.042, .065, .025], straw, 8);
  sphere([-.42, 1.735, -.128], [.042, .065, .025], straw, 8);
  for (const side of [-1, 1]) {
    b.add(tube([[-.285, 1.825, side * .041], [-.266, 1.813, side * .062], [-.277, 1.807, side * .077]], .009, .005, 5, 3), ink);
  }
  for (let i = 0; i < 14; i++) {
    const z = (i / 13 - .5) * .18;
    b.add(tube([[-.285, 1.667, z], [-.273 + r() * .025, 1.58, z * .83], [-.265 + r() * .025, 1.48 + r() * .045, z * .35]], .012, .002, 5, 3), snow);
  }

  // Real overlapping straw strips, in two layers, retain depth from every side.
  for (let layer = 0; layer < 2; layer++) for (let i = 0; i < 82; i++) {
    const a = i / 82 * TAU + r() * .04;
    const y0 = layer ? 1.28 : 1.53;
    const y1 = layer ? .68 + r() * .13 : .91 + r() * .16;
    const rx0 = layer ? .39 : .25, rz0 = layer ? .315 : .235;
    const rx1 = layer ? .52 : .48, rz1 = layer ? .37 : .35;
    const x0 = layer ? -.69 : -.56;
    b.add(tube([
      [x0 + Math.cos(a) * rx0, y0 + r() * .035, Math.sin(a) * rz0],
      [-.71 + Math.cos(a + .025) * (rx0 + rx1) * .55, (y0 + y1) * .5, Math.sin(a + .025) * (rz0 + rz1) * .54],
      [-.76 + Math.cos(a + .04) * rx1, y1, Math.sin(a + .04) * rz1],
    ], .014 + r() * .006, .003, 5, 3), i % 6 === 0 ? dark : straw);
  }
  b.add(tube([[-.85, 1.49, .22], [-.55, 1.50, .28], [-.28, 1.44, .17]], .025, .021, 10, 4), dark);

  // Broad conical woven hat with ring weaving and radial bamboo ribs.
  const hatCenter = [-.44, 1.94, 0];
  b.add(new THREE.ConeGeometry(.53, .245, 40, 3, false), straw, hatCenter, [0, 0, -.075]);
  for (let i = 1; i <= 13; i++) {
    const radius = i / 13 * .53, y = 2.0625 - i / 13 * .245;
    b.add(tube(ringPoints(radius, y, 48, -.44, 0, .008), .0048, .0048, 48, 3), i % 4 ? straw : dark);
  }
  for (let i = 0; i < 28; i++) {
    const a = i / 28 * TAU;
    b.add(tube([[-.44 + Math.cos(a) * .055, 2.04, Math.sin(a) * .055], [-.44 + Math.cos(a) * .28, 1.94, Math.sin(a) * .28], [-.44 + Math.cos(a) * .53, 1.818, Math.sin(a) * .53]], .0048, .003, 9, 3), dark);
  }
  b.add(tube(ringPoints(.533, 1.817, 48, -.44, 0), .016, .016, 48, 4), dark);
  sphere([-.47, 2.057, -.035], [.15, .018, .10], snow, 12);

  // Bamboo basket is open, with separate rim, crossing weft and a curved handle.
  const basketX = 1.13, basketZ = -.16, basketY = .19;
  const basketShape = [[.21, 0], [.23, .05], [.255, .23], [.245, .36]].map(p => new THREE.Vector2(...p));
  b.add(new THREE.LatheGeometry(basketShape, 24), straw, [basketX, basketY, basketZ]);
  b.add(new THREE.CylinderGeometry(.208, .208, .018, 20), inner, [basketX, basketY + .015, basketZ]);
  for (let i = 0; i < 10; i++) {
    const y = basketY + .025 + i * .034, radius = .215 + Math.sin(i / 12 * Math.PI) * .032;
    b.add(tube(ringPoints(radius, y, 36, basketX, basketZ), .006, .006, 36, 3), i % 3 ? straw : dark);
  }
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * TAU;
    b.add(tube([[basketX + Math.cos(a) * .212, basketY + .02, basketZ + Math.sin(a) * .212], [basketX + Math.cos(a) * .254, basketY + .22, basketZ + Math.sin(a) * .254], [basketX + Math.cos(a) * .246, basketY + .36, basketZ + Math.sin(a) * .246]], .006, .005, 7, 3), dark);
  }
  b.add(tube(ringPoints(.247, basketY + .36, 36, basketX, basketZ), .017, .017, 36, 5), dark);
  b.add(tube([[basketX, basketY + .33, basketZ - .235], [basketX, basketY + .65, basketZ - .12], [basketX, basketY + .65, basketZ + .12], [basketX, basketY + .33, basketZ + .235]], .014, .014, 20, 5), straw);
  const rope = Array.from({ length: 91 }, (_, i) => { const a = i / 90 * TAU * 3.5, radius = .15 + i / 90 * .14; return [.61 + Math.cos(a) * radius, .225 + Math.sin(a * 2) * .005, -.25 + Math.sin(a) * radius * .72]; });
  b.add(tube(rope, .012, .011, 100, 4), straw);

  // Bent bamboo and a hair-thin hanging line are both spatial geometry.
  b.add(tube([[.17, 1.18, .34], [.80, 1.93, .54], [1.87, 2.57, .91], [3.35, 2.91, 1.30], [4.02, 2.84, 1.48]], .019, .005, 50, 6), dark);
  for (const [x, y, z] of [[.70, 1.83, .51], [1.41, 2.35, .76], [2.24, 2.70, 1.01]]) sphere([x, y, z], [.023, .023, .023], straw, 7);
  b.add(tube([[4.02, 2.84, 1.48], [4.035, 1.75, 1.49], [4.04, .65, 1.49], [4.03, -.13, 1.48]], .0038, .0025, 28, 3), dark);
  b.finish(boat, '舟・手描き外皮');
  boat.userData.fisherman = true;
  return boat;
}

function needleGeometry() {
  // A hair-thin curved triangular needle, not intersecting leaf-shaped planes.
  // A slightly broader ink stroke keeps these fine needles visible from the
  // path, while their triangular cross section stays spatial from every angle.
  const p = [], uv = [], indices = [], sides = 3;
  for (let ring = 0; ring < 2; ring++) {
    const y = ring ? .47 : 0, bend = ring ? .004 : 0, radius = ring ? .0048 : .0038;
    for (let j = 0; j <= sides; j++) {
      const a = j / sides * TAU;
      p.push(Math.cos(a) * radius, y, bend + Math.sin(a) * radius);
      uv.push(j / sides, y);
      if (!ring && j < sides) { const n = j, m = j + sides + 1; indices.push(n, n + 1, m, m, n + 1, m + 1); }
    }
  }
  const tip = p.length / 3;
  p.push(0, 1, .013); uv.push(.5, 1);
  for (let j = 0; j < sides; j++) indices.push(sides + 1 + j, sides + 2 + j, tip);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

/** A rooted, twisted three-dimensional pine; no sprites or camera-facing parts. */
export function buildBrushPine(palette, { size = 1, seed = 1 } = {}) {
  const tree = new THREE.Group(); tree.name = '雪松・立體筆枝';
  const b = new BrushBatch(), r = seeded(seed);
  const { branchMaterial: bark, foliageMaterial: foliage, snowMaterial: snow } = palette;
  const wobble = () => (r() - .5) * .24;
  const trunkPoints = [[0,-.24,0],[.12,.75,.02],[.36,1.6,-.08],[.83,2.48,.05],[1.42,3.36,.13],[1.35,4.20,.12],[1.70,5.15,-.07],[1.88,5.85,0]];
  trunkPoints.slice(1).forEach(p => { p[0] += wobble(); p[2] += wobble(); });
  const trunkCurve = new THREE.CatmullRomCurve3(trunkPoints.map(v3));
  const knotAt = [.20, .39, .61, .79];
  b.add(tube(trunkPoints, .26, .044, 58, 11, (t, a) => {
    const taper = .035 + .255 * Math.pow(1 - t, 1.45) + .085 * Math.exp(-t * 28);
    const knots = knotAt.reduce((sum, k) => sum + .030 * Math.exp(-Math.pow((t - k) / .024, 2)), 0);
    return (taper + knots) * (1 + .085 * Math.sin(a * 3 + t * 19) + .035 * Math.sin(a * 7 - t * 13));
  }), bark);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU + r() * .5;
    const length = .62 + r() * .55;
    // Both endpoints disappear into the soil; no exposed open tube or cut plate.
    b.add(tube([[.02, .34, .01], [Math.cos(a) * .32, .02, Math.sin(a) * .30], [Math.cos(a) * length * .70, -.095, Math.sin(a) * length * .66], [Math.cos(a) * length, -.18, Math.sin(a) * length * .94]], .15, .004, 15, 7), bark);
  }
  // Shallow knot swellings break the machined tube silhouette at old branch scars.
  knotAt.forEach((t, i) => {
    const p = trunkCurve.getPointAt(t), a = i * 2.3 + .7;
    p.add(new THREE.Vector3(Math.cos(a) * .13, .015, Math.sin(a) * .13));
    b.add(new THREE.SphereGeometry(1, 9, 6), bark, p, [0, a, .2], [.10, .14, .075]);
  });
  function snowHeap(center, long = .22, wide = .11, yaw = 0) {
    const p = [0, .035 + r() * .025, 0], uv = [.5, .5], idx = [], sides = 11;
    for (let i = 0; i <= sides; i++) {
      const a = i / sides * TAU, radius = .72 + r() * .28;
      p.push(Math.cos(a) * long * radius, (r() - .5) * .009, Math.sin(a) * wide * radius);
      uv.push(.5 + Math.cos(a) * .5, .5 + Math.sin(a) * .5);
      if (i < sides) idx.push(0, i + 2, i + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    b.add(g, snow, center, [0, yaw, 0]);
  }
  for (const [startT, endT] of [[.12,.19], [.31,.37], [.54,.58]]) {
    const points = Array.from({ length: 5 }, (_, i) => trunkCurve.getPointAt(startT + i / 4 * (endT - startT)).add(new THREE.Vector3(-.10, .025, .10)));
    b.add(tube(points, .045, .015, 8, 5), snow);
  }

  const branchSpec = [
    [.33, [-1.65,2.96,-.46]], [.48, [3.86,3.56,.46]], [.56, [-.20,4.22,1.76]],
    [.66, [3.39,4.60,-1.43]], [.72, [-.62,4.98,-.89]], [.82, [3.37,5.28,.83]],
    [.90, [.63,5.73,1.17]], [.97, [2.47,5.92,-.53]],
  ];
  const needles = [];
  function tuft(center, outward) {
    const axis = new THREE.Vector3(outward.x, 0, outward.z).normalize();
    if (axis.lengthSq() < .1) axis.set(1, 0, 0);
    // Several displaced short sprays create a broken horizontal umbrella,
    // instead of one long vertical spear emerging from every twig.
    for (let spray = 0; spray < 3; spray++) {
      const yaw = (spray - 1) * .70 + (r() - .5) * .45;
      const sprayAxis = axis.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      const root = center.clone().addScaledVector(sprayAxis, .07 + r() * .12);
      root.y += (r() - .5) * .055;
      b.add(tube([center, root], .006, .0025, 3, 3), bark);
      for (let j = 0; j < 7; j++) {
        const angle = (j / 6 - .5) * 2.6 + (r() - .5) * .23;
        const direction = sprayAxis.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
        direction.y = -.10 - r() * .34;
        direction.normalize();
        needles.push({ p: root.clone().addScaledVector(direction, r() * .024), direction, length: .10 + r() * .23, width: .65 + r() * .7 });
      }
    }
  }
  for (let i = 0; i < branchSpec.length; i++) {
    const [t, target] = branchSpec[i], start = trunkCurve.getPointAt(t), end = v3(target);
    end.x += wobble(); end.y += wobble() * .5; end.z += wobble();
    const mid = start.clone().lerp(end, .48); mid.y -= .26;
    b.add(tube([start, mid, end], .09 - i * .005, .012, 22, 7, (t, a, radius) => radius * (1 + .075 * Math.sin(a * 3 + t * 14) + .09 * Math.sin(t * 16))), bark);
    const branch = new THREE.CatmullRomCurve3([start, mid, end]);
    const snowYaw = Math.atan2(-(end.z - start.z), end.x - start.x);
    for (const f of [.27, .53, .81]) {
      if (r() < .18) continue;
      const p = branch.getPointAt(f); p.y += .055 - i * .003;
      snowHeap(p, .14 + r() * .17, .055 + r() * .045, snowYaw);
    }
    for (let j = 0; j < 4; j++) {
      const f = .34 + j * .19, origin = branch.getPointAt(clamp(f, 0, .98));
      const side = j % 2 ? 1 : -1;
      const direction = end.clone().sub(start).normalize();
      const tip = origin.clone().add(new THREE.Vector3(direction.x * (.40 + r() * .36) + side * .17, .045 + r() * .16, side * (.33 + r() * .40)));
      const bend = origin.clone().lerp(tip, .55).add(new THREE.Vector3(0, -.045, 0));
      b.add(tube([origin, bend, tip], .027, .005, 9, 5), bark);
      for (let k = 0; k < 3; k++) {
        const q = .33 + k * .30, center = bend.clone().lerp(tip, q).add(new THREE.Vector3(wobble() * .35, r() * .045, wobble() * .35));
        const fan = tip.clone().sub(origin).normalize();
        tuft(center, fan);
      }
      if ((i + j) % 3 === 0) snowHeap(bend.clone().lerp(tip, .6).add(new THREE.Vector3(0, .029, 0)), .10 + r() * .08, .045 + r() * .035, snowYaw + .3);
    }
  }
  // At the crown, a few small fans continue the tapered trunk naturally.
  const top = v3(trunkPoints[trunkPoints.length - 1]);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU, end = top.clone().add(new THREE.Vector3(Math.cos(a)*.33,.03+r()*.08,Math.sin(a)*.33));
    b.add(tube([top, end], .017, .004, 5, 4), bark); tuft(end, end.clone().sub(top));
  }
  b.finish(tree, '松・墨枝と雪');
  const leaves = new THREE.InstancedMesh(needleGeometry(), foliage, needles.length);
  leaves.name = '松針・幼細下垂針束';
  const matrix = new THREE.Matrix4(), up = new THREE.Vector3(0, 1, 0), quaternion = new THREE.Quaternion();
  needles.forEach((needle, i) => {
    quaternion.setFromUnitVectors(up, needle.direction);
    matrix.compose(needle.p, quaternion, new THREE.Vector3(needle.width, needle.length, needle.width));
    leaves.setMatrixAt(i, matrix);
  });
  leaves.instanceMatrix.needsUpdate = true; leaves.computeBoundingSphere(); tree.add(leaves);
  tree.scale.setScalar(size);
  tree.userData.baseRotation = 0;
  tree.userData.swayPhase = r() * TAU;
  tree.userData.shake = 0;
  tree.userData.size = size;
  tree.userData.seed = seed;
  return tree;
}
