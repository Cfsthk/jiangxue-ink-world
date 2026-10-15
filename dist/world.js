import * as THREE from './vendor/three.module.js';
import { createBrushMaterials } from './ink-materials.js';
import { buildFishingBoat, buildBrushPine } from './props.js';

// Walkable terrain, layered stone, snow caps, pines and the boat are real 3D.
// Chinese brush pigments wrap their surfaces; distant paintings complete the view.
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
  const palette = createBrushMaterials();
  const { inkMaterial, snowMaterial, stoneMaterial, cliffMaterial, branchMaterial, foliageMaterial, distantMaterials } = palette;
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
    const snowRelief = .065*Math.sin(x*.72+z*.31)+.035*Math.sin(z*1.5+x*.16);
    return 0.65 + coast * Math.max(0.05, summit + shoulder + foothill + north + rolling + snowRelief + 0.45);
  }

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
  const positions = [], indices = [], terrainUV = [];
  for (let j = 0; j <= nz; j++) {
    const z = -86 + j / nz * 172;
    const edge = bank(z);
    for (let i = 0; i <= nx; i++) {
      const x = -86 + i / nx * (86 + edge);
      positions.push(x, heightAt(x, z), z);terrainUV.push(x/10,z/10);
    }
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + nx + 1;
    indices.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const groundGeometry = new THREE.BufferGeometry();
  groundGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  groundGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(terrainUV,2));
  groundGeometry.setIndex(indices);
  groundGeometry.computeVertexNormals();
  // A little exposed bedrock breaks through the snow on the steep folds.
  const terrainVertices=groundGeometry.attributes.position;
  const terrainGroups=[[],[]];
  for(let t=0;t<indices.length;t+=3){
    const ia=indices[t],ib=indices[t+1],ic=indices[t+2];
    const a=new THREE.Vector3().fromBufferAttribute(terrainVertices,ia),b=new THREE.Vector3().fromBufferAttribute(terrainVertices,ib),c=new THREE.Vector3().fromBufferAttribute(terrainVertices,ic);
    const normal=new THREE.Vector3().subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a)).normalize();
    const x=(a.x+b.x+c.x)/3,z=(a.z+b.z+c.z)/3;
    const fold=Math.sin(x*.27+z*.19)+Math.sin(x*.57-z*.32)*.55;
    const material=(normal.y<.81 && x<-19 && fold>.88)?1:0;
    terrainGroups[material].push(ia,ib,ic);
  }
  groundGeometry.setIndex([...terrainGroups[0],...terrainGroups[1]]);
  groundGeometry.addGroup(0,terrainGroups[0].length,0);
  groundGeometry.addGroup(terrainGroups[0].length,terrainGroups[1].length,1);
  const terrain = new THREE.Mesh(groundGeometry, [snowMaterial,stoneMaterial]);
  terrain.name = 'continuous-snow-terrain';
  scene.add(terrain);

  // Tiny exposed bank faces make the land and its water level legible.
  const bankPositions = [], bankIndices = [], bankUV = [];
  for (let i = 0; i <= 172; i++) {
    const z = i - 86, x = bank(z);
    bankPositions.push(x,heightAt(x,z),z, x+.15,-.65,z);bankUV.push(z/6,1,z/6,0);
    if (i < 172) { const n=i*2;bankIndices.push(n,n+1,n+2,n+1,n+3,n+2); }
  }
  const bankGeometry = new THREE.BufferGeometry();
  bankGeometry.setAttribute('position',new THREE.Float32BufferAttribute(bankPositions,3));
  bankGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(bankUV,2));
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
        vec3 c=mix(vec3(.792,.830,.851),vec3(.847,.872,.883),wash);
        float second=pow(max(0.,sin(drift*.175+sin(vWater.x*.021)*2.)),84.);
        float third=pow(max(0.,sin(drift*.071+sin(vWater.x*.013)*1.6)),94.);
        float inkBreak=smoothstep(.32,.82,sin(vWater.x*.13-vWater.z*.017)*.5+.5);
        c-=vec3(.037,.032,.027)*(stroke*broken+second*inkBreak*.48+third*(1.-broken)*.30);
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
      fragmentShader:`varying vec2 vUv;void main(){float edge=smoothstep(0.,.2,vUv.x)*smoothstep(0.,.2,1.-vUv.x);float broken=.5+.5*sin(vUv.y*7.1+sin(vUv.x*20.));gl_FragColor=vec4(.635,.635,.63,edge*(.13+broken*.10));#include <colorspace_fragment>}`.replace(';#include',';\n#include'),
    });
    scene.add(new THREE.Mesh(geo,mat));
    // Occasional exposed step edges, rather than a solid paved road.
    for(let i=1;i<38;i++){
      const t=i/38,p=curve.getPoint(t),n=curve.getTangent(t);
      if(i%3!==0)continue;
      const step=makeRockGroup(width*.40,.21,rand()*30,false,stoneMaterial,.025);
      step.scale.z=.32+rand()*.15;
      step.position.set(p.x,heightAt(p.x,p.z)-.165,p.z);
      step.rotation.y=Math.atan2(n.x,n.z)+Math.sin(i)*.13;
      step.name='覆雪石階';scene.add(step);
    }
  }
  makePath([[-32,47],[-43,35],[-38,24],[-29,16],[-33,3],[-46,-12]],3.0);
  makePath([[-35,43],[-22,32],[-16,16],[-17,0],[-10,-14],[-4,-24]],3.1);
  makePath([[-32,8],[-25,9],[-19,5],[-17,0]],2.8);
  makePath([[-46,-12],[-46,-29],[-35,-43],[-21,-43],[-10,-34],[-4,-24]],2.2);
  makePath([[-43,35],[-55,43],[-64,33],[-59,20],[-44,16],[-33,3]],2.0);

  // Dilute, irregular contact washes sit on the actual snow surface.
  const contactCanvas=document.createElement('canvas');contactCanvas.width=128;contactCanvas.height=128;
  const contactContext=contactCanvas.getContext('2d');
  const contactGradient=contactContext.createRadialGradient(64,64,4,64,64,62);
  contactGradient.addColorStop(0,'rgba(85,85,83,.85)');contactGradient.addColorStop(.35,'rgba(97,97,95,.58)');contactGradient.addColorStop(.72,'rgba(112,112,110,.19)');contactGradient.addColorStop(1,'rgba(112,112,110,0)');
  contactContext.fillStyle=contactGradient;contactContext.fillRect(0,0,128,128);
  const contactTexture=new THREE.CanvasTexture(contactCanvas);contactTexture.colorSpace=THREE.SRGBColorSpace;
  function addContactWash(x,z,r,seed,opacity=.12,stretch=1){
    const positions=[],uv=[],indices=[],n=8;
    for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){
      const u=i/n*2-1,v=j/n*2-1;
      const px=x+u*r*1.16*stretch,pz=z+v*r*(.86+.06*Math.sin(seed));
      positions.push(px,heightAt(px,pz)+.016,pz);
      uv.push(i/n+Math.sin(v*4+seed)*.055*(1-u*u),j/n+Math.sin(u*5-seed)*.045*(1-v*v));
    }
    for(let j=0;j<n;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i,b=a+n+1;indices.push(a,b,a+1,b,b+1,a+1);}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
    const material=new THREE.MeshBasicMaterial({map:contactTexture,transparent:true,opacity,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,toneMapped:false,fog:true});
    const wash=new THREE.Mesh(geometry,material);wash.name='淡墨接觸暈';scene.add(wash);return wash;
  }

  // Chiselled, asymmetrical rock masses have uneven crowns and oblique cracks.
  // No horizontal rings: their ridges and snow edges cannot become white belts.
  function rockGeometry(radius,height,seed=0,spire=false) {
    const crag=spire||height/radius>1.1;
    const source=new THREE.IcosahedronGeometry(1,(spire||height>4||radius>2.7)?5:3);
    const positions=source.attributes.position;
    for(let i=0;i<positions.count;i++){
      const ox=positions.getX(i),oy=positions.getY(i),oz=positions.getZ(i);
      const t=(oy+1)*.5;
      const grain=Math.sin(ox*4.3+seed)*Math.cos(oz*3.7-seed*.63)*.105
        +Math.sin(ox*7.4+oz*5.1+oy*2.8+seed)*.055;
      const xShape=Math.sign(ox)*Math.pow(Math.abs(ox),.79);
      const zShape=Math.sign(oz)*Math.pow(Math.abs(oz),.82);
      const fractureA=Math.abs(ox*.72+oz*.48-.16*Math.sin(oy*3.2+seed));
      const fractureB=Math.abs(ox*.32-oz*.87+.17*Math.cos(oy*2.7+seed));
      const crack=Math.exp(-fractureA*fractureA/.006)*.08+Math.exp(-fractureB*fractureB/.009)*.065;
      const radial=1+grain-crack;
      const crossSection=Math.sqrt(ox*ox+oz*oz);
      // Below the shoulder a cliff continues with a broad foot into the river.
      const rootScale=crag&&t<.52?Math.min(5.5,Math.max(1,.93/Math.max(.001,crossSection))):1;
      const angle=Math.atan2(oz,ox);
      const lobes=crag?1+.12*Math.sin(angle*3+seed)+.07*Math.cos(angle*5-seed*.4)+.09*Math.sin(t*7+angle*2+seed):1;
      const waist=crag?1+.10*Math.sin(t*7.2+seed)-.13*smooth(.48,.95,t):1;
      const leanX=crag?radius*(.17*t-.16*(1-t))*Math.sin(seed+1.3):0;
      const leanZ=crag?radius*.18*t*Math.cos(seed*.7):0;
      const x=xShape*radius*radial*rootScale*lobes*waist+Math.sin(t*3.8+seed)*radius*.10*t+leanX;
      const z=zShape*radius*.83*(radial+Math.cos(oy*4.1+seed)*.045)*rootScale*lobes*(crag?1+.11*Math.cos(t*5.8+seed):1)+leanZ;
      // Multiple unequal high points interrupt the crown, even on a small rock.
      const crown=(Math.sin(ox*3.9+seed)*Math.cos(oz*4.8+seed*.34)*.105
        +Math.sin(ox*8.7-oz*5.3+seed)*.035)*smooth(.22,.84,t);
      const y=height*(crag?t-.12+crown+grain*.14:Math.max(.005,t+crown+grain*.20));
      positions.setXYZ(i,x,y,z);
    }
    source.computeVertexNormals();source.userData.height=height;source.userData.seed=seed;
    return source;
  }
  // A separate uneven thin snow shell rests only on upward-facing ledges.
  function snowCapGeometry(rockGeo,thickness=.055){
    const source=rockGeo.attributes.position,sourceUV=rockGeo.attributes.uv;
    const index=rockGeo.index?.array??Uint32Array.from({length:source.count},(_,i)=>i);
    const positions=[],uvs=[],triangles=[],edges=new Map(),selected=new Map(),midpoints=new Map();
    const va=new THREE.Vector3(),vb=new THREE.Vector3(),vc=new THREE.Vector3(),normal=new THREE.Vector3();
    const addVertex=(i)=>{
      const x=source.getX(i),y=source.getY(i),z=source.getZ(i);
      const key=`${x.toFixed(5)},${y.toFixed(5)},${z.toFixed(5)}`;
      if(selected.has(key))return selected.get(key);
      const n=positions.length/3;
      positions.push(x,y+thickness*(.8+.25*Math.sin(x*4.7+z*3.3)),z);
      uvs.push(sourceUV.getX(i),sourceUV.getY(i));selected.set(key,n);return n;
    };
    const midpoint=(a,b)=>{
      const key=a<b?`${a}:${b}`:`${b}:${a}`;if(midpoints.has(key))return midpoints.get(key);
      const i=positions.length/3,x=(positions[a*3]+positions[b*3])*.5,z=(positions[a*3+2]+positions[b*3+2])*.5;
      const lift=thickness*.24+Math.min(.018,rockGeo.userData.height*.003)*(1+Math.sin(x*3.2+z*2.7))*.5;
      positions.push(x,(positions[a*3+1]+positions[b*3+1])*.5+lift,z);
      uvs.push((uvs[a*2]+uvs[b*2])*.5,(uvs[a*2+1]+uvs[b*2+1])*.5);midpoints.set(key,i);return i;
    };
    for(let t=0;t<index.length;t+=3){
      const a=index[t],b=index[t+1],c=index[t+2];
      va.fromBufferAttribute(source,a);vb.fromBufferAttribute(source,b);vc.fromBufferAttribute(source,c);
      normal.subVectors(vb,va).cross(new THREE.Vector3().subVectors(vc,va)).normalize();
      const avgY=(va.y+vb.y+vc.y)/3;
      const centreX=(va.x+vb.x+vc.x)/3,centreZ=(va.z+vb.z+vc.z)/3;
      const snowLine=.59+.055*Math.sin(centreX*1.7+rockGeo.userData.seed)+.055*Math.cos(centreZ*1.6-rockGeo.userData.seed*.6);
      if(normal.y<.48 || avgY<rockGeo.userData.height*(snowLine+.035))continue;
      const ia=addVertex(a),ib=addVertex(b),ic=addVertex(c),ab=midpoint(ia,ib),bc=midpoint(ib,ic),ca=midpoint(ic,ia);
      triangles.push(ia,ab,ca,ab,ib,bc,ca,bc,ic,ab,bc,ca);
      for(const [v,w] of [[a,b],[b,c],[c,a]]){
        const keyFor=i=>`${source.getX(i).toFixed(5)},${source.getY(i).toFixed(5)},${source.getZ(i).toFixed(5)}`;
        const ka=keyFor(v),kb=keyFor(w),key=ka<kb?`${ka}|${kb}`:`${kb}|${ka}`;
        const edge=edges.get(key);if(edge)edge.count++;else edges.set(key,{v,w,count:1});
      }
    }
    // A shallow irregular lip makes the white cover a physical layer.
    for(const edge of edges.values())if(edge.count===1){
      const a=addVertex(edge.v),b=addVertex(edge.w),m=midpoint(a,b),n=positions.length/3;
      for(const i of [edge.v,edge.w]){positions.push(source.getX(i),source.getY(i)-thickness*.25,source.getZ(i));uvs.push(sourceUV.getX(i),sourceUV.getY(i));}
      positions.push((source.getX(edge.v)+source.getX(edge.w))*.5,(source.getY(edge.v)+source.getY(edge.w))*.5-thickness*.25,(source.getZ(edge.v)+source.getZ(edge.w))*.5);
      uvs.push((sourceUV.getX(edge.v)+sourceUV.getX(edge.w))*.5,(sourceUV.getY(edge.v)+sourceUV.getY(edge.w))*.5);
      triangles.push(a,n,m,m,n,n+2,m,n+2,b,b,n+2,n+1);
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(triangles);geo.computeVertexNormals();return geo;
  }
  function makeRockGroup(radius,height,seed,spire,material,capThickness=.055){
    const group=new THREE.Group(),geometry=rockGeometry(radius,height,seed,spire);
    group.add(new THREE.Mesh(geometry,material));
    group.add(new THREE.Mesh(snowCapGeometry(geometry,capThickness),snowMaterial));
    group.name=spire?'水墨斷崖':'層理雪岩';return group;
  }
  function addRock(x,z,r=1,h=1,material=stoneMaterial,ground=true,spire=false,addCollision=false){
    const rock=makeRockGroup(r,h,rand()*20,spire,material,Math.min(.13,.035+h*.016));
    rock.position.set(x,ground?heightAt(x,z)-h*((spire||h/r>1.1)?.35:.26):(spire?-3.6:-.48),z);
    rock.rotation.y=rand()*TAU;scene.add(rock);
    if(addCollision)collisions.push({x,z,r:r*.84});
    if(ground&&r>.7)addContactWash(x,z,r,randomSeed*.001,.12);
    return rock;
  }

  // A few exposed rocks leave the snow, river and sky generous empty areas.
  const nearRocks=[[-20,42,1.8,1.5],[-35,51,1.3,.8],[-50,29,1.5,1.6],[-23,18,.9,.65],[-40,3,1.5,1.4],[-53,-17,2.6,2.8],[-39,-25,1.4,1.1],[-19,-39,1.7,1.5],[-12,-19,1.5,1.3],[-5,-29,.8,.7],[-1,-16,1.4,1.2],[-4,-35,1.2,.8],[-8,-28,.55,.4],[-6,-21,.55,.35],[-.2,-28,.8,.6],[-2,-40,1.25,1],[-5,16,1.3,1.2],[-2,29,1.4,1.1],[-68,48,2.8,3.1],[-68,-24,2.3,2.8]];
  nearRocks.forEach(([x,z,r,h])=>addRock(x,z,r,h,stoneMaterial,true,false,r>1.4));
  [[12,-53,1.5,1.2],[35,-51,2.6,2.5],[47,-2,1.6,1.5],[27,45,2.4,1.6],[6,12,.8,.8],[48,-79,3.3,3.5]].forEach(([x,z,r,h])=>addRock(x,z,r,h,stoneMaterial,false));

  // A cut into the hillside: broad snow ledges above tall, brush-marked faces.
  // Their downhill faces form the near-left frame seen in the original painting.
  for(const [x,z,r,h,yaw] of [
    [-29,-8,4.8,9.4,.15],[-22,-8,3.0,3.7,-.20],[-39,4,3.4,5.2,.32],
    [-48,8,4.5,5.8,-.15],[-53,25,3.6,4.2,.25],[-58,-38,6.0,7.2,.40],
    [-37,-53,4.0,5.0,-.30],
  ]){
    const ledge=addRock(x,z,r,h,cliffMaterial,true,false,true);ledge.rotation.y=yaw;
  }
  // A few broken pieces collect naturally below the cut rock, under snow.
  for(let i=0;i<12;i++){
    const z=-16-i*2.4+Math.sin(i)*.6,x=-1.7-Math.sin(i*2.1)*1.2;
    addRock(x,z,.32+rand()*.47,.22+rand()*.48,stoneMaterial,true,false,false);
  }
  // The far bank rises on the right in overlapping broad crag clusters.
  // Their irregular silhouettes leave the lonely boat against open water.
  for(const [x,z,r,h,yaw] of [[60,-24,10,37,.27],[66,-35,7,28,-.18],[65,-8,8,31,.48],[69,18,12,40,.10],[61,29,8,29,-.28]]){
    const cliff=addRock(x,z,r,h,cliffMaterial,false,true,false);cliff.rotation.y=yaw;
  }
  addRock(51,-12,3.8,4.5,stoneMaterial,false,false,false);
  // Broken faces beside the initial path interrupt the otherwise blank slope.
  for(const [x,z,r,h,yaw] of [[-29.5,2,2.4,2.2,.25],[-24,-2,2.2,1.5,-.18],[-20,-12,2.1,2,.35],[-15,-25,3.2,2.8,-.28],[-25,4,1.2,1.1,.35],[-22,-1,.95,.7,-.22],[-19,-8,1.2,1.2,.17],[-13,-20,1.5,1.2,-.3]]){
    const rock=addRock(x,z,r,h,cliffMaterial,true,false,true);rock.rotation.y=yaw;
  }

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
    // Deepen only painted pigment; the pale gaps must remain empty mist.
    material.onBeforeCompile=shader=>{
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        float inkDensity=clamp(1.-dot(diffuseColor.rgb,vec3(.299,.587,.114)),0.,1.);
        diffuseColor.rgb=max(vec3(0.),diffuseColor.rgb-vec3(inkDensity*.22));`);
    };
    material.customProgramCacheKey=()=> 'distant-brush-pigment-v1';
    const panel=new THREE.Mesh(new THREE.PlaneGeometry(width,width*809/1942),material);
    panel.position.set(x,y,z);panel.rotation.y=rotation;if(mirror)panel.scale.x=-1;
    panel.name='淡墨遠山';panel.renderOrder=-2;scene.add(panel);mountainPaintMaterials.push(material);
  }
  addPaintedRange(116,-89,220,28,-Math.PI/2,.91);
  addPaintedRange(163,132,234,25,-Math.PI/2,.66,true);
  addPaintedRange(25,-216,172,20,0,.72,true);

  function addPine(x,z,size=1,interactive=false,onRock=false){
    const tree=buildBrushPine(palette,{size,seed:Math.floor(rand()*100000)});
    tree.position.set(x,heightAt(x,z)+(onRock?1.5:0),z);
    tree.rotation.y=(x===-23.7&&z===-5)?-.60:rand()*TAU;
    scene.add(tree);addContactWash(x,z,1.05*size,randomSeed*.001,.10,1.18);
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
  addPine(-23.7,-5,.90,true);
  addPine(-15,-39,.67);
  addPine(-4,31,.83);
  addPine(-61,-63,1.2);
  const boat=buildFishingBoat(palette);
  boat.position.set(17,.10,-30);boat.rotation.y=-.24;boat.name='孤舟';scene.add(boat);
  boat.userData.initialY=boat.position.y;
  for(let k=0;k<4;k++){
    const ring=[];for(let i=0;i<=80;i++){const a=i/80*TAU;ring.push(new THREE.Vector3(17+Math.cos(a)*(3.1+k*.58),.012+k*.001,-30+Math.sin(a)*(1.1+k*.27)));}
    const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring),new THREE.LineBasicMaterial({color:'#b7c3c8',transparent:true,opacity:.25-k*.035,depthWrite:false}));scene.add(l);waterAnimations.push(l);
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
    palette.ready,
    loader.loadAsync(new URL('./assets/ink-mountains.png',import.meta.url).href),
  ]).then(([,mountainTexture])=>{
    mountainTexture.colorSpace=THREE.SRGBColorSpace;mountainTexture.anisotropy=4;
    mountainPaintMaterials.forEach(material=>{material.map=mountainTexture;material.needsUpdate=true;});
  });
  const landmarks={summit:{x:-46,z:-12},shore:{x:-4,z:-24},forest:{x:-48,z:37}};
  return {scene,ready,spawn:{x:-25,z:9,yaw:-0.60,pitch:0.01},heightAt,canWalk,zoneAt,interactables,boat,update,landmarks};
}
