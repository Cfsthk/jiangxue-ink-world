import * as THREE from './vendor/three.module.js';

// Walkable terrain, nearby stone and the boat are modelled in three dimensions.
// Painted distant ranges and anchored pines preserve the reference brushwork.
const TAU = Math.PI * 2;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const bank = z => 1 + Math.sin(z * 0.035) * 2.7;
const g = (x, z, cx, cz, sx, sz) => Math.exp(-(((x - cx) / sx) ** 2 + ((z - cz) / sz) ** 2));

export function createWorld() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#d1d2d1');
  scene.fog = new THREE.FogExp2('#e5e6e3', 0.0040);
  scene.add(new THREE.HemisphereLight(0xf5f5f2, 0xbdbfbd, 2.1));
  const sun = new THREE.DirectionalLight(0xf4f4ee, 1.5);
  sun.position.set(-35, 80, 25);
  scene.add(sun);

  const interactables = [];
  const collisions = [];
  const pines = [];
  const waterAnimations = [];
  const mountainPaintMaterials = [];
  const pinePaintMaterials = [];
  let randomSeed = 198406;
  function rand() {
    randomSeed = (randomSeed * 1664525 + 1013904223) >>> 0;
    return randomSeed / 4294967296;
  }

  function heightAt(x, z) {
    const coast = smooth(0, 28, bank(z) - x);
    const summit = 20.8 * g(x, z, -46, -12, 21, 28);
    const shoulder = 10.6 * g(x, z, -62, 37, 19, 24);
    const foothill = 3.0 * g(x, z, -35, 42, 22, 25);
    const north = 6.3 * g(x, z, -46, -62, 27, 22);
    const rolling = 0.62 * Math.sin(x * 0.092 + z * 0.035) + 0.35 * Math.cos(z * 0.11);
    return 0.65 + coast * Math.max(0.05, summit + shoulder + foothill + north + rolling + 0.45);
  }

  const pigmentVertex = `
    varying vec3 vPosition;
    varying vec3 vSurfaceNormal;
    varying vec3 vViewPosition;
    void main() {
      vec3 localPosition = position;
      vec3 localNormal = normal;
      #ifdef USE_INSTANCING
        localPosition = (instanceMatrix * vec4(position,1.0)).xyz;
        vec3 squaredScale = vec3(dot(instanceMatrix[0].xyz,instanceMatrix[0].xyz),dot(instanceMatrix[1].xyz,instanceMatrix[1].xyz),dot(instanceMatrix[2].xyz,instanceMatrix[2].xyz));
        localNormal = mat3(instanceMatrix) * (normal / squaredScale);
      #endif
      vec4 world = modelMatrix * vec4(localPosition, 1.0);
      vPosition = world.xyz;
      vSurfaceNormal = normalize(mat3(modelMatrix) * localNormal);
      vViewPosition = (viewMatrix * world).xyz;
      gl_Position = projectionMatrix * vec4(vViewPosition, 1.0);
    }
  `;
  const pigmentFragment = `
    uniform vec3 uColor;
    uniform vec3 uShadow;
    uniform float uShade;
    uniform float uSnow;
    uniform float uOpacity;
    uniform float uFog;
    uniform float uDistant;
    varying vec3 vPosition;
    varying vec3 vSurfaceNormal;
    varying vec3 vViewPosition;
    float hash(vec3 p) {
      p = fract(p * 0.1031);
      p += dot(p, p.yzx + 33.33);
      return fract((p.x + p.y) * p.z);
    }
    float noise(vec3 p) {
      vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),
                     mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                 mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                     mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
    }
    void main() {
      vec3 n = normalize(vSurfaceNormal);
      float light = max(0.0, dot(n, normalize(vec3(-0.45,0.85,0.35))));
      float grain = noise(vPosition*2.6)*0.58 + noise(vPosition*0.42)*0.42;
      // Brush marks stretch down the face of rock, with dry, broken gaps.
      float vein = noise(vec3(vPosition.x*2.2, vPosition.y*.14, vPosition.z*2.2));
      float fibres = noise(vec3(vPosition.x*12.0, vPosition.y*.9, vPosition.z*12.0));
      float brush = smoothstep(.59,.81,vein) * (.35+.65*smoothstep(.27,.7,fibres));
      float face = smoothstep(.16,.65,1.0-abs(n.y));
      float shade = (1.0-light)*uShade*.44;
      shade += brush*face*uShade*.78;
      shade += (grain-.5)*uShade*.10;
      vec3 color = mix(uColor, uShadow, clamp(shade,0.0,.65));
      float cap = smoothstep(0.30,0.76,n.y+(grain-0.5)*0.30)*uSnow;
      color = mix(color, vec3(.945,.945,.942), cap);
      // Very fine, discontinuous ink on the silhouette, not thick toon edges.
      vec3 eye = normalize(cameraPosition-vPosition);
      float edge = (1.0-smoothstep(.015,.10,abs(dot(n,eye)))) * face;
      edge *= smoothstep(.38,.72,noise(vPosition*5.0));
      color = mix(color,vec3(.43),edge*.12*(1.0-cap));
      float depth = length(vViewPosition);
      float fog = 1.0-exp(-depth*depth*uFog*uFog);
      // The feet of the distant peaks dissolve into a broad blank wash.
      float valleyMist = (1.0-smoothstep(0.0,25.0,vPosition.y))*uDistant*.72;
      color = mix(color,vec3(.868,.868,.866),clamp(fog+valleyMist,0.0,.90));
      gl_FragColor = vec4(color,uOpacity);
      #include <colorspace_fragment>
    }
  `;
  function inkMaterial(color, shade = 0.4, snow = 0, opacity = 1, fog = 0.0025, distant = 0) {
    return new THREE.ShaderMaterial({
      vertexShader: pigmentVertex,
      fragmentShader: pigmentFragment,
      uniforms: {
        uColor: {value: new THREE.Color(color)},
        uShadow: {value: new THREE.Color('#9c9c9b')},
        uShade: {value: shade}, uSnow: {value: snow},
        uOpacity: {value: opacity}, uFog: {value: fog}, uDistant: {value: distant},
      },
      transparent: opacity < 1,
      depthWrite: opacity >= 1,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
  }
  const snowMaterial = inkMaterial('#f5f5f2', 0.26, 0.25);
  const stoneMaterial = inkMaterial('#e4e4e1', 0.67, 0.97);
  const cliffMaterial = inkMaterial('#e2e2df', 0.68, 0.94);
  const branchMaterial = inkMaterial('#8b9089', 0.41, 0.08);
  const foliageMaterial = inkMaterial('#9fa79e', 0.40, 0.30);
  const distantMaterials = [
    inkMaterial('#c8c9c8', 0.47, 0.22, 1, 0.0022, 1),
    inkMaterial('#b9bbba', 0.40, 0.12, 1, 0.0017, 1),
    inkMaterial('#b0b3b3', 0.36, 0.04, 1, 0.0013, 1),
  ];

  // A grey, mottled sky above an almost blank horizon.  No photographic maps.
  const sky = new THREE.Mesh(new THREE.SphereGeometry(650, 32, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: false,
    vertexShader: `varying vec3 vSky; void main(){vSky=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `
      varying vec3 vSky;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      void main(){
        vec3 d=normalize(vSky);
        float h=smoothstep(-.06,.52,d.y);
        float wash=noise(d.xz*7.0+d.y*4.0)*.55+noise(d.xz*22.0)*.30+noise(d.xz*75.)*.15;
        vec3 c=mix(vec3(.878,.878,.876),vec3(.33,.34,.35),h);
        c+=(wash-.5)*.095*(.4+h);
        gl_FragColor=vec4(c,1.);
        #include <colorspace_fragment>
      }
    `,
  }));
  scene.add(sky);

  // Analytic height is sampled for this mesh and for the player's feet.
  const nx = 112, nz = 188;
  const positions = [], indices = [];
  for (let j = 0; j <= nz; j++) {
    const z = -86 + j / nz * 172;
    const edge = bank(z);
    for (let i = 0; i <= nx; i++) {
      const x = -86 + i / nx * (86 + edge);
      positions.push(x, heightAt(x, z), z);
    }
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + nx + 1;
    indices.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const groundGeometry = new THREE.BufferGeometry();
  groundGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  groundGeometry.setIndex(indices);
  groundGeometry.computeVertexNormals();
  const terrain = new THREE.Mesh(groundGeometry, snowMaterial);
  terrain.name = 'continuous-snow-terrain';
  scene.add(terrain);

  // Tiny exposed bank faces make the land and its water level legible.
  const bankPositions = [], bankIndices = [];
  for (let i = 0; i <= 172; i++) {
    const z = i - 86, x = bank(z);
    bankPositions.push(x,heightAt(x,z),z, x+.15,-.65,z);
    if (i < 172) { const n=i*2;bankIndices.push(n,n+1,n+2,n+1,n+3,n+2); }
  }
  const bankGeometry = new THREE.BufferGeometry();
  bankGeometry.setAttribute('position',new THREE.Float32BufferAttribute(bankPositions,3));
  bankGeometry.setIndex(bankIndices);bankGeometry.computeVertexNormals();
  scene.add(new THREE.Mesh(bankGeometry,stoneMaterial));

  // Water has long, sparsely spaced brush marks; its empty surface is deliberate.
  const riverMaterial = new THREE.ShaderMaterial({
    uniforms:{uTime:{value:0}},
    vertexShader:`varying vec3 vWater;void main(){vWater=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`
      uniform float uTime; varying vec3 vWater;
      void main(){
        float drift=vWater.z+sin(vWater.x*.09)*2.5+uTime*.09;
        float stroke=pow(max(0.,sin(drift*.43+sin(vWater.x*.027)*3.)),76.);
        float broken=smoothstep(.15,.8,sin(vWater.x*.19+vWater.z*.03)*.5+.5);
        float wash=sin(vWater.x*.034+vWater.z*.047)*.5+.5;
        vec3 c=mix(vec3(.835,.869,.883),vec3(.892,.908,.909),wash);
        c-=vec3(.045,.04,.035)*stroke*broken;
        gl_FragColor=vec4(c,1.);
        #include <colorspace_fragment>
      }
    `,
    side:THREE.DoubleSide,toneMapped:false,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(220, 620), riverMaterial);
  water.rotation.x=-Math.PI/2;water.position.set(85,-.02,0);scene.add(water);

  function curveTube(points, radius, material, segments = 12) {
    const curve = new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    return new THREE.Mesh(new THREE.TubeGeometry(curve,segments,radius,5,false),material);
  }

  // Thin, irregular washes on a path remain on the same analytic terrain.
  function makePath(waypoints, width=2.4) {
    const curve = new THREE.CatmullRomCurve3(waypoints.map(p=>new THREE.Vector3(p[0],0,p[1])));
    const pathPos=[],pathUV=[],pathIndices=[];
    const count=190;
    for(let i=0;i<=count;i++){
      const t=i/count,p=curve.getPoint(t),n=curve.getTangent(t);
      const wav=1+Math.sin(i*.67)*.10+Math.sin(i*.23)*.07;
      for(const s of [-1,1]){
        const x=p.x+n.z*width*.5*s*wav,z=p.z-n.x*width*.5*s*wav;
        pathPos.push(x,heightAt(x,z)+.025,z);pathUV.push(s<0?0:1,t*40);
      }
      if(i<count){const a=i*2;pathIndices.push(a,a+2,a+1,a+1,a+2,a+3);}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pathPos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(pathUV,2));geo.setIndex(pathIndices);geo.computeVertexNormals();
    const mat=new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
      vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`varying vec2 vUv;void main(){float edge=smoothstep(0.,.2,vUv.x)*smoothstep(0.,.2,1.-vUv.x);float broken=.5+.5*sin(vUv.y*7.1+sin(vUv.x*20.));gl_FragColor=vec4(.61,.65,.61,edge*(.13+broken*.10));#include <colorspace_fragment>}`.replace(';#include',';\n#include'),
    });
    scene.add(new THREE.Mesh(geo,mat));
    // Occasional exposed step edges, rather than a solid paved road.
    for(let i=1;i<38;i++){
      const t=i/38,p=curve.getPoint(t),n=curve.getTangent(t);
      if(i%3!==0)continue;
      const step=new THREE.Mesh(new THREE.CylinderGeometry(.66,.74,.038,7),stoneMaterial);
      step.scale.set(width*.46,1,.29+rand()*.13);
      step.position.set(p.x,heightAt(p.x,p.z)+.028,p.z);
      step.rotation.y=Math.atan2(n.x,n.z)+Math.sin(i)*.13;
      scene.add(step);
    }
  }
  makePath([[-32,47],[-43,35],[-38,24],[-29,16],[-33,3],[-46,-12]],2.8);
  makePath([[-35,43],[-22,32],[-16,16],[-17,0],[-10,-14],[-4,-24]],2.6);
  makePath([[-32,8],[-25,9],[-19,5],[-17,0]],2.2);
  makePath([[-46,-12],[-46,-29],[-35,-43],[-21,-43],[-10,-34],[-4,-24]],2.2);
  makePath([[-43,35],[-55,43],[-64,33],[-59,20],[-44,16],[-33,3]],2.0);

  // Radial rings give rock towers soft silhouettes with restrained faceting.
  function rockGeometry(radius,height,seed=0,spire=false) {
    const ringCount=spire?28:8,sides=spire?23:13;
    const pos=[],idx=[];
    for(let j=0;j<=ringCount;j++){
      const t=j/ringCount;
      const profile=spire?(1-t)*(.94+.055*Math.sin(t*11+seed))+.11*Math.sin(Math.PI*t)**2:.3+.7*Math.sin(Math.PI*(.05+t*.91));
      const cx=Math.sin(t*5+seed)*radius*.12*t,cz=Math.cos(t*6+seed)*radius*.09*t;
      for(let i=0;i<=sides;i++){
        const a=i/sides*TAU;
        const irregular=1+Math.sin(i*4.7+seed+j*.13)*.065+Math.cos(i*2.3+j*.45+seed)*.035;
        const r=radius*profile*irregular;
        pos.push(Math.cos(a)*r+cx,t*height+Math.sin(a*3+seed)*height*.012*(1-t),Math.sin(a)*r+cz);
      }
    }
    for(let j=0;j<ringCount;j++)for(let i=0;i<sides;i++){
      const a=j*(sides+1)+i,b=a+sides+1;idx.push(a,b,a+1,b,b+1,a+1);
    }
    const top=pos.length/3;pos.push(0,height,0);
    for(let i=0;i<sides;i++)idx.push(ringCount*(sides+1)+i,top,ringCount*(sides+1)+i+1);
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex(idx);geo.computeVertexNormals();return geo;
  }
  function addRock(x,z,r=1,h=1,material=stoneMaterial,ground=true,spire=false,addCollision=false){
    const rock=new THREE.Mesh(rockGeometry(r,h,rand()*20,spire),material);
    rock.position.set(x,ground?heightAt(x,z)-h*.12:-.15,z);
    rock.rotation.y=rand()*TAU;scene.add(rock);
    if(addCollision)collisions.push({x,z,r:r*.78});
    return rock;
  }

  // A few exposed rocks leave the snow, river and sky generous empty areas.
  const nearRocks=[[-20,42,1.8,1.5],[-35,51,1.3,.8],[-50,29,1.5,1.6],[-23,18,.9,.65],[-40,3,1.5,1.4],[-53,-17,2.6,2.8],[-39,-25,1.4,1.1],[-19,-39,1.7,1.5],[-12,-19,1.5,1.3],[-5,-29,.8,.7],[-1,-16,1.4,1.2],[-4,-35,1.2,.8],[-8,-28,.55,.4],[-6,-21,.55,.35],[-.2,-28,.8,.6],[-2,-40,1.25,1],[-5,16,1.3,1.2],[-2,29,1.4,1.1],[-68,48,2.8,3.1],[-68,-24,2.3,2.8]];
  nearRocks.forEach(([x,z,r,h])=>addRock(x,z,r,h,stoneMaterial,true,false,r>1.4));
  [[12,-53,1.5,1.2],[35,-51,2.6,2.5],[47,-2,1.6,1.5],[27,45,2.4,1.6],[6,12,.8,.8],[48,-79,3.3,3.5]].forEach(([x,z,r,h])=>addRock(x,z,r,h,stoneMaterial,false));

  // Boundaries read as cliffs in the landscape rather than invisible fencing.
  for(let i=0;i<9;i++){
    const z=-79+i*19;
    const r=9+rand()*4,h=17+rand()*14;
    addRock(-85-rand()*2,z,r,h,cliffMaterial,true,true);
  }
  for(const z of [-83,83])for(let i=0;i<5;i++)addRock(-70+i*13,z+rand()*6,8+rand()*4,13+rand()*16,cliffMaterial,true,true);

  // These distant ink paintings occupy real places beyond the walkable bank.
  // Their transparent margins and mist keep the sky and the valley open.
  function addPaintedRange(x,z,width,y,rotation,opacity,mirror=false){
    const material=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity,
      alphaTest:.008,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,fog:true});
    const panel=new THREE.Mesh(new THREE.PlaneGeometry(width,width*809/1942),material);
    panel.position.set(x,y,z);panel.rotation.y=rotation;if(mirror)panel.scale.x=-1;
    panel.name='淡墨遠山';panel.renderOrder=-2;scene.add(panel);mountainPaintMaterials.push(material);
  }
  addPaintedRange(116,-89,220,28,-Math.PI/2,.91);
  addPaintedRange(163,132,234,25,-Math.PI/2,.66,true);
  addPaintedRange(25,-216,172,20,0,.72,true);

  const leafGeometry=new THREE.SphereGeometry(1,7,4);
  const snowLeafMaterial=inkMaterial('#eaeee6',.11,0);
  function addPine(x,z,size=1,interactive=false,onRock=false){
    const tree=new THREE.Group();tree.position.set(x,heightAt(x,z)+(onRock?1.5:0),z);tree.rotation.y=rand()*TAU;
    const trunkPoints=[[0,0,0],[.08,1.0,0],[-.18,2.0,.08],[.16,3.05,0],[.39,4.1,-.1]].map(p=>p.map(v=>v*size));
    tree.add(curveTube(trunkPoints,.12*size,branchMaterial,15));
    const snowTrunk=curveTube(trunkPoints.map(p=>[p[0]-.045*size,p[1],p[2]+.025*size]),.045*size,snowLeafMaterial,15);tree.add(snowTrunk);
    const leafTransforms=[];
    const limbData=[[-1,1.45,1.6,.22],[1,2.2,1.65,-.35],[-1,2.95,1.24,-.65],[1,3.48,1.1,.48],[-1,3.85,.67,.22]];
    for(let n=0;n<limbData.length;n++){
      const [sign,y,span,depth]=limbData[n];
      const bx=y<2?-.04:y<3?.02:.24;
      const end=[(bx+sign*span)*size,(y+.35)*size,depth*size];
      tree.add(curveTube([[bx*size,y*size,0],[(bx+sign*span*.42)*size,(y-.08)*size,depth*.4*size],end],.047*size,branchMaterial,9));
      tree.add(curveTube([[(bx+sign*span*.32)*size,(y+.045)*size,depth*.25*size],[(bx+sign*span*.7)*size,(y+.18)*size,depth*.66*size],[(bx+sign*span)*size,(y+.4)*size,depth*size]],.025*size,snowLeafMaterial,8));
      for(let j=0;j<10;j++){
        const t=.45+rand()*.62;
        leafTransforms.push({x:(bx+sign*span*t+(rand()-.5)*.28)*size,y:(y+.15+t*.27+rand()*.16)*size,z:(depth*t+(rand()-.5)*.62)*size,s:(.18+rand()*.16)*size});
      }
    }
    const leaves=new THREE.InstancedMesh(leafGeometry,foliageMaterial,leafTransforms.length);
    const snowLeaves=new THREE.InstancedMesh(leafGeometry,snowLeafMaterial,Math.floor(leafTransforms.length*.22));
    const m=new THREE.Matrix4(),q=new THREE.Quaternion(),s=new THREE.Vector3(),p=new THREE.Vector3();
    leafTransforms.forEach((l,i)=>{
      p.set(l.x,l.y,l.z);s.set(l.s*.74,l.s*.19,l.s*.42);q.setFromEuler(new THREE.Euler(rand()*.1,rand()*TAU,.10+rand()*.20));m.compose(p,q,s);leaves.setMatrixAt(i,m);
      if(i<snowLeaves.count){p.y+=l.s*.055;s.multiplyScalar(.8);m.compose(p,q,s);snowLeaves.setMatrixAt(i,m);}
    });
    tree.add(leaves,snowLeaves);
    const needlePositions=[];
    leafTransforms.forEach((l,i)=>{
      // Open fans of individual pine needles, rather than flat solid canopies.
      const fan=(i%2?1:-1),count=5;
      for(let j=0;j<count;j++){
        const a=(j/(count-1)-.5)*1.65;
        const len=(.16+rand()*.16)*size;
        needlePositions.push(l.x,l.y+.025*size,l.z,
          l.x+Math.sin(a)*len*fan,l.y+Math.cos(a)*len*.78,l.z+Math.cos(a+i)*len*.38);
      }
    });
    const needles=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(needlePositions,3)),new THREE.LineBasicMaterial({color:'#8d968c',transparent:true,opacity:.65}));
    tree.add(needles);
    // A painting is anchored at the trunk root.  It has spatial parallax as
    // students move, while its fine brushwork survives a close view.
    tree.children.forEach(child=>{child.visible=false;});
    const paintedMaterial=new THREE.SpriteMaterial({color:0xffffff,transparent:true,
      opacity:.94,alphaTest:.012,depthWrite:false,toneMapped:false,fog:true});
    const paintedPine=new THREE.Sprite(paintedMaterial);
    paintedPine.center.set(.35,.07);
    paintedPine.scale.set(9.0*size,6.0*size,1);
    paintedPine.name='雪松・墨筆';tree.add(paintedPine);pinePaintMaterials.push(paintedMaterial);
    tree.userData.paintedSprite=paintedPine;
    scene.add(tree);
    tree.userData.baseRotation=tree.rotation.z;tree.userData.swayPhase=rand()*TAU;tree.userData.shake=0;
    pines.push(tree);collisions.push({x,z,r:.48*size});
    if(interactive)interactables.push({id:`pine-${interactables.length}`,type:'pine',position:tree.position.clone().add(new THREE.Vector3(0,1.3*size,0)),radius:3.7,label:'輕觸松枝',object:tree});
    return tree;
  }
  addPine(-39,48,1.25,true);
  addPine(-48,39,1.55,true);
  addPine(-57,31,1.2);
  addPine(-61,43,1.05);
  addPine(-47,28,.95,true);
  addPine(-29,23,1.1);
  addPine(-50,-11,1.05,true);
  addPine(-61,-28,.95);
  addPine(-34,-38,1.15);
  addPine(-23,2,1.16,true);
  addPine(-15,-39,.67);
  addPine(-4,31,.83);
  addPine(-61,-63,1.2);
  // Snow on the near cliff is cut by a few faded, tapering ink strokes.
  const cragStrokeMaterial=new THREE.LineBasicMaterial({color:'#939d95',transparent:true,opacity:.24,depthWrite:false});
  for(let i=0;i<13;i++){
    const z=-66+i*10,x=-72-rand()*3,base=heightAt(x,z);
    const pts=[];
    for(let j=0;j<8;j++)pts.push(new THREE.Vector3(x+Math.sin(j*1.2+i)*.3,base+j*1.2,z+Math.sin(j*.7+i)*.25));
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),cragStrokeMaterial);scene.add(line);
  }

  // A real, open wooden fishing skiff: curved hull, seats and one seated figure.
  const boat=new THREE.Group();boat.position.set(17,.10,-30);boat.rotation.y=-.24;boat.name='孤舟';
  const hullMaterial=inkMaterial('#a3a59a',.43,.14);
  const hullInsideMaterial=inkMaterial('#92998f',.30,0);
  const rimMaterial=inkMaterial('#858d82',.31,.12);
  const cloakMaterial=inkMaterial('#969d90',.33,.05);
  const hatMaterial=inkMaterial('#c4c6b7',.34,.35);
  const hullPos=[],hullIdx=[];
  const rings=24,sideCount=12;
  for(let j=0;j<=rings;j++){
    const t=j/rings,x=(t-.5)*5.1,beam=Math.pow(Math.sin(t*Math.PI),.65)*.74+.014,endLift=Math.pow(Math.abs(t-.5)*2,3)*.42;
    for(let i=0;i<=sideCount;i++){
      const a=-Math.PI/2+i/sideCount*Math.PI;
      hullPos.push(x,.31-Math.cos(a)*.34+endLift,Math.sin(a)*beam);
    }
  }
  for(let j=0;j<rings;j++)for(let i=0;i<sideCount;i++){const a=j*(sideCount+1)+i,b=a+sideCount+1;hullIdx.push(a,b,a+1,b,b+1,a+1);}
  const hullGeo=new THREE.BufferGeometry();hullGeo.setAttribute('position',new THREE.Float32BufferAttribute(hullPos,3));hullGeo.setIndex(hullIdx);hullGeo.computeVertexNormals();boat.add(new THREE.Mesh(hullGeo,hullMaterial));
  const floor=new THREE.Mesh(new THREE.BoxGeometry(3.25,.09,.82),hullInsideMaterial);floor.position.y=.13;boat.add(floor);
  for(const side of [-1,1]){
    const pts=[];
    for(let i=0;i<=24;i++){const t=i/24;pts.push([(t-.5)*5.1,.31+Math.pow(Math.abs(t-.5)*2,3)*.42,side*(Math.pow(Math.sin(t*Math.PI),.65)*.74+.014)]);}
    boat.add(curveTube(pts,.047,rimMaterial,30));
  }
  for(const x of [-1.1,.95]){const seat=new THREE.Mesh(new THREE.BoxGeometry(.27,.10,1.1),hullMaterial);seat.position.set(x,.33,0);boat.add(seat);}
  const oldMan=new THREE.Group();oldMan.position.set(-.45,.33,0);
  const cloak=new THREE.Mesh(new THREE.ConeGeometry(.46,1.02,9,3,true),cloakMaterial);cloak.position.set(0,.48,.01);cloak.rotation.z=.12;oldMan.add(cloak);
  const back=new THREE.Mesh(new THREE.SphereGeometry(1,10,8),cloakMaterial);back.scale.set(.28,.38,.25);back.position.set(.05,.72,0);oldMan.add(back);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.14,10,7),hatMaterial);head.position.set(.13,1.03,.03);oldMan.add(head);
  const hat=new THREE.Mesh(new THREE.ConeGeometry(.55,.25,16),hatMaterial);hat.position.set(.10,1.20,.02);hat.rotation.z=-.08;oldMan.add(hat);
  const hatRim=new THREE.Mesh(new THREE.CylinderGeometry(.55,.55,.027,16),hatMaterial);hatRim.position.set(.11,1.075,.02);hatRim.rotation.z=-.08;oldMan.add(hatRim);
  const arm=curveTube([[.16,.8,.09],[.38,.65,.19],[.62,.69,.28]],.075,cloakMaterial,8);oldMan.add(arm);
  // Straw folds are light, broken lines and stay readable from the riverbank.
  const strawMaterial=new THREE.LineBasicMaterial({color:'#737e70',transparent:true,opacity:.35});
  for(let i=0;i<11;i++){
    const a=i/11*TAU;
    const pts=[new THREE.Vector3(Math.cos(a)*.16,.84,Math.sin(a)*.16),new THREE.Vector3(Math.cos(a)*.30,.47,Math.sin(a)*.30),new THREE.Vector3(Math.cos(a)*.46,.02,Math.sin(a)*.46)];
    oldMan.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),strawMaterial));
  }
  boat.add(oldMan);
  const rod=curveTube([[.16,1.04,.27],[.98,1.9,.63],[2.15,2.48,1.05],[3.42,2.63,1.51]],.018,rimMaterial,24);boat.add(rod);
  const fishingLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(3.42,2.63,1.51),new THREE.Vector3(3.47,1.35,1.52),new THREE.Vector3(3.50,-.05,1.54)]),new THREE.LineBasicMaterial({color:'#8a978c',transparent:true,opacity:.55}));boat.add(fishingLine);
  const basket=new THREE.Mesh(new THREE.CylinderGeometry(.22,.25,.29,9),hullInsideMaterial);basket.position.set(1.05,.35,-.10);boat.add(basket);
  scene.add(boat);
  boat.userData.initialY=boat.position.y;
  for(let k=0;k<4;k++){
    const ring=[];for(let i=0;i<=80;i++){const a=i/80*TAU;ring.push(new THREE.Vector3(17+Math.cos(a)*(3.1+k*.58),.012+k*.001,-30+Math.sin(a)*(1.1+k*.27)));}
    const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring),new THREE.LineBasicMaterial({color:'#b1c3bf',transparent:true,opacity:.25-k*.035,depthWrite:false}));scene.add(l);waterAnimations.push(l);
  }

  // Soft ground mist is a wash, not a solid white wall around each mountain.
  const mistCanvas=document.createElement('canvas');mistCanvas.width=128;mistCanvas.height=128;
  const ctx=mistCanvas.getContext('2d');
  const gradient=ctx.createRadialGradient(64,64,0,64,64,64);gradient.addColorStop(0,'rgba(244,244,242,.70)');gradient.addColorStop(.5,'rgba(244,244,242,.34)');gradient.addColorStop(1,'rgba(244,244,242,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
  const mistTexture=new THREE.CanvasTexture(mistCanvas);mistTexture.colorSpace=THREE.SRGBColorSpace;
  const mistMaterial=new THREE.SpriteMaterial({map:mistTexture,transparent:true,opacity:.30,depthWrite:false,toneMapped:false});
  for(const [x,y,z,sx,sy] of [[64,10,-70,90,26],[88,13,23,105,34],[82,17,-132,110,38],[138,24,-91,120,45],[33,6,-114,90,19],[47,7,97,100,23]]){
    const mist=new THREE.Sprite(mistMaterial);mist.position.set(x,y,z);mist.scale.set(sx,sy,1);scene.add(mist);
  }

  const shorePoint=new THREE.Vector3(-4,heightAt(-4,-24),-24);
  interactables.push({id:'shore-stone',type:'stone',position:new THREE.Vector3(-6,heightAt(-6,-21)+.35,-21),radius:3.4,label:'拾起小石',object:null});
  interactables.push({id:'mountain-echo',type:'echo',position:new THREE.Vector3(-44,heightAt(-44,-12)+1,-12),radius:9,label:'向山谷呼喚'});
  interactables.push({id:'fishing-boat',type:'boat',position:shorePoint.clone().add(new THREE.Vector3(0,1,0)),radius:8,label:'凝望孤舟',object:boat});

  function canWalk(x,z){
    if(x < -73 || z < -73 || z > 69 || x > bank(z)-1.25)return false;
    // The accessible landscape has broad slopes and several connecting loops.
    if(x < -67 && (z < -58 || z > 58))return false;
    for(const c of collisions)if((x-c.x)**2+(z-c.z)**2<c.r*c.r)return false;
    return true;
  }
  function zoneAt(x,z){
    if((x+46)**2+(z+12)**2<11**2)return '山頂・千山寂寂';
    if(x>-12 && z>-45 && z<4)return '江岸・一葉孤舟';
    if(x<-34 && z>19 && z<55)return '松林・風過無聲';
    if(x<-48 && z<-28)return '風口・寒意漸深';
    return '山徑・不見人蹤';
  }
  function update(dt,time,player){
    riverMaterial.uniforms.uTime.value=time;
    boat.position.y=boat.userData.initialY+Math.sin(time*.68)*.027;
    boat.rotation.z=Math.sin(time*.49)*.009;
    boat.rotation.x=Math.cos(time*.57)*.007;
    pines.forEach(tree=>{
      const elapsed=performance.now()/1000-(tree.userData.shake||-100);
      const shake=Math.max(0,1-elapsed/1.2);
      tree.rotation.z=Math.sin(time*.37+tree.userData.swayPhase)*.005+Math.sin(elapsed*23)*shake*.045;
      if(tree.userData.paintedSprite)tree.userData.paintedSprite.material.rotation=tree.rotation.z;
    });
    waterAnimations.forEach((ring,i)=>{ring.material.opacity=.12+Math.sin(time*.35+i)*.035;});
  }
  const loader=new THREE.TextureLoader();
  const ready=Promise.all([
    loader.loadAsync(new URL('./assets/ink-mountains.png',import.meta.url).href),
    loader.loadAsync(new URL('./assets/ink-pine.png',import.meta.url).href),
  ]).then(([mountainTexture,pineTexture])=>{
    for(const texture of [mountainTexture,pineTexture]){
      texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
    }
    mountainPaintMaterials.forEach(material=>{material.map=mountainTexture;material.needsUpdate=true;});
    pinePaintMaterials.forEach(material=>{material.map=pineTexture;material.needsUpdate=true;});
  });
  const landmarks={summit:{x:-46,z:-12},shore:{x:-4,z:-24},forest:{x:-48,z:37}};
  return {scene,ready,spawn:{x:-25,z:9,yaw:-0.82,pitch:-0.14},heightAt,canWalk,zoneAt,interactables,boat,update,landmarks};
}
