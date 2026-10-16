import * as THREE from './vendor/three.module.js';
import { createBrushMaterials } from './ink-materials.js?v=0.8.0';
import { buildFishingBoat, buildBrushPine, buildWinterPlant } from './props.js?v=0.8.0';
import { createRiverMaterial } from './river.js?v=0.8.0';
import { createMountainSurround } from './mountains.js?v=0.8.0';
import { createAmbience } from './ambience.js?v=0.8.0';
import { createJourney, WAGON_SITE, JOURNEY_SPAWN } from './journey.js?v=0.8.0';
import { LUGGAGE } from './journey-state.js?v=0.8.0';

// Walkable terrain, weathered stone, pines and the boat are real 3D.
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
  const windbreaks = [];
  const mountainSurround=createMountainSurround();scene.add(mountainSurround.group);
  const pineClearances=[];
  const farPineMaterials = [];
  const pathSamples = [];
  const pathWidths = [];
  const pathPaintMaterials = [];
  const assetState = {pathPaint:false};
  const pathPaintPlaceholder=new THREE.DataTexture(new Uint8Array([143,145,141,255]),1,1,THREE.RGBAFormat);
  pathPaintPlaceholder.colorSpace=THREE.SRGBColorSpace;pathPaintPlaceholder.needsUpdate=true;
  const winterPlants = [];
  const winterPlantBatches = new Map();
  const farForestStats = {models:0,sprites:0,variants:{bare:0,crooked:0,upright:0,windswept:0}};
  const vegetationCounts = {grass:0,reed:0,shrub:0,seedhead:0,litter:0,twig:0};
  const beachPathSamples = [];
  const pathFootprints = [];
  let maxPathSampleSpacing=0;
  const rockSnowMaterials = new Map();
  const palette = createBrushMaterials();
  const { inkMaterial, snowMaterial, terrainMaterial, stoneMaterial, cliffMaterial, branchMaterial, foliageMaterial, distantMaterials } = palette;
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
  // Snow and exposed bedrock blend continuously in one shader, across the
  // shared vertex normals, rather than changing material at triangle edges.
  const terrain = new THREE.Mesh(groundGeometry, terrainMaterial);
  terrain.name = 'continuous-snow-terrain';
  scene.add(terrain);

  // A narrow rounded lip joins the snow to the submerged bank.  The top
  // shares the terrain normal, so it does not read as a sharp pasted-on strip.
  const bankPositions = [], bankIndices = [], bankUV = [], bankSnow = [];
  const bankProfile=[[0,0],[.024,.025],[.065,.13],[.105,.36],[.14,.78],[.15,1.30]],bankRows=344;
  for (let i = 0; i <= bankRows; i++) {
    const z = i/bankRows*172-86, x = bank(z),top=heightAt(x,z);
    for(let j=0;j<bankProfile.length;j++){
      const [offset,drop]=bankProfile[j];
      bankPositions.push(x+offset,top-drop,z);bankUV.push(z/6,1-drop/1.3);bankSnow.push(1-drop/1.3);
      if(i<bankRows&&j<bankProfile.length-1){const n=i*bankProfile.length+j,m=n+bankProfile.length;bankIndices.push(n,m,n+1,n+1,m,m+1);}
    }
  }
  const bankGeometry = new THREE.BufferGeometry();
  bankGeometry.setAttribute('position',new THREE.Float32BufferAttribute(bankPositions,3));
  bankGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(bankUV,2));
  bankGeometry.setAttribute('snowHeight',new THREE.Float32BufferAttribute(bankSnow,1));
  bankGeometry.setIndex(bankIndices);bankGeometry.computeVertexNormals();
  const bankNormals=bankGeometry.attributes.normal,lipNormal=new THREE.Vector3();
  for(let i=0;i<=bankRows;i++){
    const index=i*bankProfile.length,x=bankPositions[index*3],z=bankPositions[index*3+2],epsilon=.08;
    lipNormal.set(-(heightAt(x+epsilon,z)-heightAt(x-epsilon,z))/(2*epsilon),1,-(heightAt(x,z+epsilon)-heightAt(x,z-epsilon))/(2*epsilon)).normalize();
    bankNormals.setXYZ(index,lipNormal.x,lipNormal.y,lipNormal.z);
  }
  const bankMesh=new THREE.Mesh(bankGeometry,palette.withSnow(stoneMaterial,.90));bankMesh.name='融雪圓邊江岸';scene.add(bankMesh);

  const riverMaterial = createRiverMaterial();
  const water = new THREE.Mesh(new THREE.PlaneGeometry(220, 620), riverMaterial);
  water.rotation.x=-Math.PI/2;water.position.set(85,-.02,0);scene.add(water);

  function curveTube(points, radius, material, segments = 12) {
    const curve = new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    return new THREE.Mesh(new THREE.TubeGeometry(curve,segments,radius,5,false),material);
  }

  // Thin, irregular washes on a path remain on the same analytic terrain.
  function makePath(waypoints, width=2.4) {
    const baseWidth=width;width*=1.42;
    const curve = new THREE.CatmullRomCurve3(waypoints.map(p=>new THREE.Vector3(p[0],0,p[1])));
    const pathPos=[],pathUV=[],pathIndices=[],surfacePos=[],surfaceUV=[],surfaceIndices=[];
    const length=curve.getLength(),pathSeed=Math.abs(waypoints[0][0]*.31+waypoints[0][1]*.17)+41;
    const count=190,columns=7;
    let minimumWidth=Infinity,maximumWidth=0;
    for(let i=0;i<=count;i++){
      const t=i/count,p=curve.getPoint(t),n=curve.getTangent(t);
      const distance=t*length;
      const left=.88+valueNoise3(distance*.16,0,0,pathSeed)*.21+valueNoise3(distance*.57,1,0,pathSeed+7)*.065;
      const right=.89+valueNoise3(distance*.13,0,1,pathSeed+13)*.20+valueNoise3(distance*.51,1,1,pathSeed+23)*.06;
      const drift=(valueNoise3(distance*.09,2,0,pathSeed+31)-.5)*width*.09;
      p.x+=n.z*drift;p.z-=n.x*drift;
      beachPathSamples.push({x:p.x,z:p.z,width});
      for(const side of [-1,1]){
        const extent=width*.5*(side<0?left:right)*side;
        const x=p.x+n.z*extent,z=p.z-n.x*extent;
        pathPos.push(x,heightAt(x,z)+.035,z);pathUV.push(side<0?0:1,distance);
      }
      const index=i*6,ax=pathPos[index],az=pathPos[index+2],bx=pathPos[index+3],bz=pathPos[index+5];
      const actualWidth=Math.hypot(bx-ax,bz-az);minimumWidth=Math.min(minimumWidth,actualWidth);maximumWidth=Math.max(maximumWidth,actualWidth);
      // Cross-road subdivisions stay on the snow instead of spanning its hollows.
      for(let j=0;j<=columns;j++){
        const u=j/columns,x=ax+(bx-ax)*u,z=az+(bz-az)*u;
        surfacePos.push(x,heightAt(x,z)+.036,z);surfaceUV.push(u,distance);
        if(j<columns&&i<count){const a=i*(columns+1)+j,b=a+columns+1;surfaceIndices.push(a,b,a+1,b,b+1,a+1);}
      }
      if(i<count){const a=i*2;pathIndices.push(a,a+2,a+1,a+1,a+2,a+3);}
    }
    // Dense samples follow the rendered strip itself, not the control anchors.
    for(let i=0;i<count;i++){
      const a=i*6,b=a+6;
      const points=[{x:pathPos[a],z:pathPos[a+2]},{x:pathPos[a+3],z:pathPos[a+5]},{x:pathPos[b+3],z:pathPos[b+5]},{x:pathPos[b],z:pathPos[b+2]}];
      const edges=points.map((p,j)=>{const q=points[(j+1)%4],dx=q.x-p.x,dz=q.z-p.z;return {x:p.x,z:p.z,dx,dz,length2:Math.max(.0000001,dx*dx+dz*dz)};});
      pathFootprints.push({points,edges,minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minZ:Math.min(...points.map(p=>p.z)),maxZ:Math.max(...points.map(p=>p.z))});
      const ca={x:(pathPos[a]+pathPos[a+3])*.5,y:(pathPos[a+1]+pathPos[a+4])*.5,z:(pathPos[a+2]+pathPos[a+5])*.5};
      const cb={x:(pathPos[b]+pathPos[b+3])*.5,y:(pathPos[b+1]+pathPos[b+4])*.5,z:(pathPos[b+2]+pathPos[b+5])*.5};
      const distance=Math.hypot(cb.x-ca.x,cb.y-ca.y,cb.z-ca.z),steps=Math.max(1,Math.ceil(distance/.65));
      maxPathSampleSpacing=Math.max(maxPathSampleSpacing,distance/steps);
      for(let j=0;j<steps;j++){const t=j/steps;pathSamples.push({x:ca.x+(cb.x-ca.x)*t,y:ca.y+(cb.y-ca.y)*t,z:ca.z+(cb.z-ca.z)*t});}
      if(i===count-1)pathSamples.push(cb);
    }
    pathWidths.push({baseWidth,scale:1.42,min:minimumWidth,max:maximumWidth,length});
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(surfacePos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(surfaceUV,2));geo.setIndex(surfaceIndices);geo.computeVertexNormals();
    const mat=new THREE.ShaderMaterial({
      uniforms:{uPathPaint:{value:pathPaintPlaceholder},uPathLength:{value:length}},
      transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
      vertexShader:`varying vec2 vUv;varying vec3 vWorld;void main(){vUv=uv;vec4 world=modelMatrix*vec4(position,1.);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
      fragmentShader:`
        uniform sampler2D uPathPaint;
        uniform float uPathLength;
        varying vec2 vUv;varying vec3 vWorld;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
        void main(){
          float left=.065+noise(vec2(vUv.y*.52,1.3))*.20;
          float right=.065+noise(vec2(vUv.y*.41,8.6))*.22;
          float edge=smoothstep(0.,left,vUv.x)*smoothstep(0.,right,1.-vUv.x);
          float wash=noise(vWorld.xz*.31+vec2(4.1,7.3));
          float fibre=noise(vec2(vUv.x*29.,vUv.y*.66));
          float fine=noise(vWorld.xz*9.7);
          float snow=smoothstep(.68,.87,noise(vWorld.xz*.69+noise(vWorld.xz*.13)));
          vec3 mud=mix(vec3(.145,.155,.15),vec3(.355,.36,.35),wash*.65+fibre*.35);
          vec2 cells=vWorld.xz*3.3,cell=floor(cells),f=fract(cells)-.5;
          vec2 jitter=vec2(hash(cell),hash(cell+17.2))-.5;
          float pebble=(1.-smoothstep(.08,.25,length(f-jitter*.48)))*step(.58,hash(cell+6.3));
          vec3 gravel=mix(vec3(.18,.19,.185),vec3(.54,.55,.53),hash(cell+23.4));
          mud=mix(mud,gravel,pebble*.63);mud+=(fine-.5)*.033;
          vec2 paintUv=vWorld.xz*.23;
          vec3 brushA=texture2D(uPathPaint,paintUv).rgb;
          vec3 brushB=texture2D(uPathPaint,mat2(.819,-.574,.574,.819)*paintUv*.67+vec2(.31,.73)).rgb;
          float painted=clamp(dot(mix(brushA,brushB,.23),vec3(.299,.587,.114))*.91+.035,.13,.77);
          mud=mix(mud,vec3(painted),.64);
          float dry=smoothstep(.12,.72,noise(vec2(vUv.x*41.,vUv.y*3.7)));
          float endWash=smoothstep(0.,.95,vUv.y)*smoothstep(0.,1.15,uPathLength-vUv.y);
          float alpha=edge*endWash*(.48+wash*.22)*(1.-snow*.67)*(.78+dry*.22);
          gl_FragColor=vec4(mud,alpha);
          #include <colorspace_fragment>
        }
      `,
    });
    pathPaintMaterials.push(mat);
    const road=new THREE.Mesh(geo,mat);road.name='灰泥碎礫寬山徑';scene.add(road);
    // Sparse exposed stones follow distance, with varied gaps and partial widths.
    // Keep the world random stream unchanged so rocks and trees do not move.
    let stepSeed=0;
    for(let i=0;i<24;i++){const value=rand();if(i===0)stepSeed=Math.floor(value*4294967296);}
    const stepRand=()=>{stepSeed=(stepSeed*1664525+1013904223)>>>0;return stepSeed/4294967296;};
    for(let distance=1.5+stepRand()*3.5;distance<length-1.5;distance+=1.6+stepRand()*5.8){
      if(stepRand()>.48)continue;
      const p=curve.getPointAt(distance/length),n=curve.getTangentAt(distance/length);
      const offset=(stepRand()-.5)*width*.40;
      const x=p.x+n.z*offset,z=p.z-n.x*offset;
      const radius=width*(.11+stepRand()*.22),height=.15+stepRand()*.13;
      const step=makeRockGroup(radius,height,stepRand()*30,false,stoneMaterial,.44);
      step.scale.set(.82+stepRand()*.43,1,.20+stepRand()*.43);
      step.position.set(x,heightAt(x,z)-.09-stepRand()*.045,z);
      step.rotation.y=Math.atan2(n.x,n.z)+(stepRand()-.5)*.78;
      step.name='覆雪石階';scene.add(step);
    }
  }
  makePath([[-32,47],[-43,35],[-38,24],[-29,16],[-33,3],[-46,-12]],3.0);
  makePath([[-35,43],[-22,32],[-16,16],[-17,0],[-10,-14],[-4,-24]],3.1);
  makePath([[-32,8],[-25,9],[-19,5],[-17,0]],2.8);
  makePath([[-46,-12],[-46,-29],[-35,-43],[-21,-43],[-10,-34],[-4,-24]],2.2);
  makePath([[-43,35],[-55,43],[-64,33],[-59,20],[-44,16],[-33,3]],2.0);

  // Extra connecting loops keep the small world open to different walks.
  makePath([[-46,-12],[-57,-19],[-66,-29],[-67,-47],[-55,-58],[-42,-55],[-35,-43]],2.5);
  makePath([[-22,32],[-9,35],[-10,48],[-23,59],[-39,60],[-50,50],[-55,43]],2.5);
  makePath([[-17,0],[-7,5],[-9,20],[-16,16]],2.3);

  // The outward road shares the same irregular brush edges and ground texture.
  const beforeExitRoad=randomSeed;
  makePath([[-22,32],[-24,43],[-25,55],[-29,68],[-35,84]],3.5);
  randomSeed=beforeExitRoad;

  // Dilute, irregular contact washes sit on the actual snow surface.
  const contactCanvas=document.createElement('canvas');contactCanvas.width=128;contactCanvas.height=128;
  const contactContext=contactCanvas.getContext('2d');
  const contactGradient=contactContext.createRadialGradient(64,64,4,64,64,62);
  contactGradient.addColorStop(0,'rgba(85,85,83,.85)');contactGradient.addColorStop(.35,'rgba(97,97,95,.58)');contactGradient.addColorStop(.72,'rgba(112,112,110,.19)');contactGradient.addColorStop(1,'rgba(112,112,110,0)');
  contactContext.fillStyle=contactGradient;contactContext.fillRect(0,0,128,128);
  const contactTexture=new THREE.CanvasTexture(contactCanvas);contactTexture.colorSpace=THREE.SRGBColorSpace;
  function addContactWash(x,z,r,seed,opacity=.22,stretch=1){
    const positions=[],uv=[],indices=[],n=8;
    for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){
      const u=i/n*2-1,v=j/n*2-1;
      const px=x+.16*r+u*r*1.22*stretch,pz=z-.11*r+v*r*(.91+.06*Math.sin(seed));
      positions.push(px,heightAt(px,pz)+.016,pz);
      uv.push(i/n+Math.sin(v*4+seed)*.055*(1-u*u),j/n+Math.sin(u*5-seed)*.045*(1-v*v));
    }
    for(let j=0;j<n;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i,b=a+n+1;indices.push(a,b,a+1,b,b+1,a+1);}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
    const material=new THREE.MeshBasicMaterial({map:contactTexture,transparent:true,opacity,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,toneMapped:false,fog:true});
    const wash=new THREE.Mesh(geometry,material);wash.name='淡墨接觸暈';scene.add(wash);return wash;
  }

  // Smooth, shared normals describe non-periodic, broad weathered folds.
  // Height-normalised snow is painted on this same surface, with no paper caps.
  function valueNoise3(x,y,z,seed){
    const hash=(a,b,c)=>{const h=Math.sin(a*127.1+b*311.7+c*74.7+seed*19.19)*43758.5453;return h-Math.floor(h);};
    const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);
    let fx=x-ix,fy=y-iy,fz=z-iz;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);fz=fz*fz*(3-2*fz);
    const mix=(a,b,t)=>a+(b-a)*t;
    return mix(mix(mix(hash(ix,iy,iz),hash(ix+1,iy,iz),fx),mix(hash(ix,iy+1,iz),hash(ix+1,iy+1,iz),fx),fy),mix(mix(hash(ix,iy,iz+1),hash(ix+1,iy,iz+1),fx),mix(hash(ix,iy+1,iz+1),hash(ix+1,iy+1,iz+1),fx),fy),fz);
  }
  function rockGeometry(radius,height,seed=0,spire=false) {
    const large=spire||height>3||radius>2.7,crag=spire||height/radius>1.1;
    const geometry=new THREE.SphereGeometry(1,large?30:22,large?22:16);
    const position=geometry.attributes.position;
    let minY=Infinity,maxY=-Infinity;
    for(let i=0;i<position.count;i++){
      const ox=position.getX(i),oy=position.getY(i),oz=position.getZ(i),t=(oy+1)*.5;
      const broad=valueNoise3(ox*1.65+seed*.37,oy*.86,oz*1.65-seed*.21,seed)-.5;
      const fold=valueNoise3(ox*3.3+seed*.13,oy*1.24,oz*3.3+seed*.17,seed+7)-.5;
      const crown=valueNoise3(ox*2.6+1.4,oy*.66+seed*.1,oz*2.6-2.1,seed+19)-.5;
      const radial=1+broad*.39+fold*.16;
      const cross=Math.sqrt(ox*ox+oz*oz);
      const foot=crag&&t<.46?Math.min(4.2,Math.max(1,.77/Math.max(.001,cross))):1;
      const shoulder=crag?1-.16*smooth(.56,.98,t):1;
      const xShape=Math.sign(ox)*Math.pow(Math.abs(ox),.79),zShape=Math.sign(oz)*Math.pow(Math.abs(oz),.84);
      const x=xShape*radius*radial*foot*shoulder+radius*(broad*.18+t*.10*Math.sin(seed));
      const z=zShape*radius*.81*(radial+crown*.10)*foot+radius*t*.10*Math.cos(seed*.7);
      const y=height*(t+(crag?-.10:0)+crown*.14*smooth(.15,.88,t)+fold*.055);
      position.setXYZ(i,x,y,z);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
    }
    geometry.computeVertexNormals();
    // Sphere UV seams and the poles share an averaged physical normal as well.
    const normals=geometry.attributes.normal,sums=new Map();
    for(let i=0;i<position.count;i++){
      const key=`${position.getX(i).toFixed(5)},${position.getY(i).toFixed(5)},${position.getZ(i).toFixed(5)}`;
      if(!sums.has(key))sums.set(key,{n:new THREE.Vector3(),ids:[]});
      const entry=sums.get(key);entry.n.add(new THREE.Vector3().fromBufferAttribute(normals,i));entry.ids.push(i);
    }
    for(const entry of sums.values()){entry.n.normalize();for(const i of entry.ids)normals.setXYZ(i,entry.n.x,entry.n.y,entry.n.z);}
    const snowHeight=new Float32Array(position.count),range=Math.max(.001,maxY-minY);
    for(let i=0;i<position.count;i++)snowHeight[i]=(position.getY(i)-minY)/range;
    geometry.setAttribute('snowHeight',new THREE.BufferAttribute(snowHeight,1));
    geometry.userData.height=height;geometry.userData.seed=seed;geometry.computeBoundingSphere();return geometry;
  }
  function makeRockGroup(radius,height,seed,spire,material,specifiedSnow=null){
    const group=new THREE.Group(),geometry=rockGeometry(radius,height,seed,spire);
    const snowAmount=specifiedSnow??(height<.35?.67:.85),key=`${material.uuid}:${snowAmount}`;
    if(!rockSnowMaterials.has(key))rockSnowMaterials.set(key,palette.withSnow(material,snowAmount));
    group.add(new THREE.Mesh(geometry,rockSnowMaterials.get(key)));
    group.name=spire?'水墨斷崖':'層理雪岩';return group;
  }
  function addRock(x,z,r=1,h=1,material=stoneMaterial,ground=true,spire=false,addCollision=false){
    if(ground)x=Math.min(x,bank(z)-Math.max(r*1.4,r+.6));
    const rock=makeRockGroup(r,h,rand()*20,spire,material);
    rock.position.set(x,ground?heightAt(x,z)-h*((spire||h/r>1.1)?.35:.26):(spire?-3.6:-.48),z);
    rock.rotation.y=rand()*TAU;scene.add(rock);
    if(addCollision)collisions.push({x,z,r:r*.84});
    if(ground&&h>=2.2&&r>=1.5)windbreaks.push({x,z,radius:r,height:h,top:rock.position.y+h});
    if(ground&&r>.7)addContactWash(x,z,r,randomSeed*.001,.22,1.12);
    return rock;
  }

  // A few exposed rocks leave the snow, river and sky generous empty areas.
  const nearRocks=[[-20,42,1.8,1.5],[-35,51,1.3,.8],[-50,29,1.5,1.6],[-23,18,.9,.65],[-40,3,1.5,1.4],[-57,-11,2.6,2.8],[-39,-25,1.4,1.1],[-19,-39,1.7,1.5],[-12,-19,1.5,1.3],[-5,-29,.8,.7],[-1,-16,1.4,1.2],[-4,-35,1.2,.8],[-8,-28,.55,.4],[-6,-21,.55,.35],[-.2,-28,.8,.6],[-2,-40,1.25,1],[-5,16,1.3,1.2],[-2,29,1.4,1.1],[-68,48,2.8,3.1],[-68,-24,2.3,2.8]];
  nearRocks.forEach(([x,z,r,h])=>addRock(x,z,r,h,stoneMaterial,true,false,r>1.4));

  // A cut into the hillside: broad snow ledges above tall, brush-marked faces.
  // Their downhill faces form the near-left frame seen in the original painting.
  for(const [x,z,r,h,yaw] of [
    [-29,-8,4.8,9.4,.15],[-22,-8,3.0,3.7,-.20],[-39,4,3.4,5.2,.32],
    [-48,8,4.5,5.8,-.15],[-53,25,3.6,4.2,.25],[-58,-38,6.0,7.2,.40],
    [-34,-58,4.0,5.0,-.30],
  ]){
    const ledge=addRock(x,z,r,h,cliffMaterial,true,false,true);ledge.rotation.y=yaw;
  }
  // A few broken pieces collect naturally below the cut rock, under snow.
  for(let i=0;i<12;i++){
    const z=-16-i*2.4+Math.sin(i)*.6,x=-1.7-Math.sin(i*2.1)*1.2;
    addRock(x,z,.32+rand()*.47,.22+rand()*.48,stoneMaterial,true,false,false);
  }
  // A continuous low opposite shore bounds the broad, uninterrupted channel.
  // Its mountains remain distant ink paintings, with no pillars in the river.
  const farBankAt=z=>67+Math.sin(z*.019)*6+Math.sin(z*.041)*2.5;
  const farHeightAt=(x,z)=>.19+smooth(0,20,x-farBankAt(z))*(1.2+valueNoise3(x*.027,0,z*.027,41)*1.4);
  const farPositions=[],farUV=[],farIndices=[],farWidth=22,farLength=128;
  for(let j=0;j<=farLength;j++){
    const z=-310+j/farLength*620,edge=farBankAt(z);
    for(let i=0;i<=farWidth;i++){
      const u=i/farWidth,x=edge+u*140;
      const h=farHeightAt(x,z);
      farPositions.push(x,h,z);farUV.push(x/12,z/12);
      if(i<farWidth&&j<farLength){const a=j*(farWidth+1)+i,b=a+farWidth+1;farIndices.push(a,b,a+1,b,b+1,a+1);}
    }
  }
  const farGeometry=new THREE.BufferGeometry();farGeometry.setAttribute('position',new THREE.Float32BufferAttribute(farPositions,3));farGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(farUV,2));farGeometry.setIndex(farIndices);farGeometry.computeVertexNormals();
  const farShore=new THREE.Mesh(farGeometry,snowMaterial);farShore.name='對岸連續雪岸';scene.add(farShore);
  function farPineMaterial(sprite=false,opacity=.80){
    const material=sprite?new THREE.SpriteMaterial({transparent:true,opacity,alphaTest:.018,depthWrite:false,toneMapped:false,fog:true}):new THREE.MeshBasicMaterial({transparent:true,opacity,alphaTest:.018,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,fog:true});
    if(!sprite){
      material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        float ink=clamp(1.-dot(diffuseColor.rgb,vec3(.299,.587,.114)),0.,1.);
        diffuseColor.rgb=max(vec3(0.),diffuseColor.rgb-vec3(ink*.19));`);};
      material.customProgramCacheKey=()=> 'far-pine-pigment-v2';
    }
    farPineMaterials.push(material);return material;
  }
  // Loose far-shore groups mix bare 3D trees and differently proportioned paint.
  let farSeed=83317,farTreeIndex=0;
  const farRand=()=>{farSeed=(farSeed*1664525+1013904223)>>>0;return farSeed/4294967296;};
  for(const [centre,count] of [[-160,2],[-118,4],[-74,3],[-32,4],[18,3],[65,4],[112,3],[160,3]]){
    for(let i=0;i<count;i++,farTreeIndex++){
      const z=centre+(farRand()-.5)*24,inland=7+farRand()*19,h=6+farRand()*5,x=farBankAt(z)+inland;
      if(farTreeIndex%6===0){
        const variant=farTreeIndex%12===0?'bare':'crooked';
        const tree=buildBrushPine(palette,{size:h/(variant==='bare'?5.08:5.35),seed:83317+farTreeIndex*71,variant});
        tree.position.set(x,farHeightAt(x,z)-.08,z);tree.rotation.y=-Math.PI/2+(farRand()-.5)*1.1;
        tree.name='對岸枯枝立體樹';scene.add(tree);farForestStats.models++;farForestStats.variants[variant]++;
      }else{
        const ratio=1.14+farRand()*.64,geometry=new THREE.PlaneGeometry(h*ratio,h);geometry.translate(h*ratio*.15,h*.43,0);
        const tree=new THREE.Mesh(geometry,farPineMaterial(false,.76+farRand()*.09));
        tree.position.set(x,farHeightAt(x,z),z);tree.rotation.y=-Math.PI/2+(farRand()-.5)*.32;
        if(farTreeIndex%2)tree.scale.x=-1;
        tree.name='對岸淡墨疏松';scene.add(tree);farForestStats.sprites++;
      }
    }
  }

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
  for(const z of [-83,83])for(let i=0;i<5;i++){
    const x=-70+i*13,rz=z+rand()*6,r=8+rand()*4,h=13+rand()*16;
    // Leave a visible mountain pass where the new outward road continues.
    if(z>0&&(i===2||i===3))continue;
    addRock(x,rz,r,h,cliffMaterial,true,true);
  }

  const journey=createJourney({scene,palette,heightAt,collisions});
  const journeyReserved=(x,z,r=0)=>Math.hypot(x-WAGON_SITE.x,z-(WAGON_SITE.z+2.4))<6.9+r||LUGGAGE.some(i=>Math.hypot(x-i.x,z-i.z)<2.2+r);

  function beachPathClearanceAt(x,z){
    let clearance=Infinity;
    for(const p of beachPathSamples)clearance=Math.min(clearance,Math.hypot(x-p.x,z-p.z)-p.width*.5);
    return clearance;
  }
  function pathClearanceAt(x,z){
    // Exact distance to the union of the quads used for the visible road mesh.
    // This includes its varying brush width and both straight edge segments.
    const insideTriangle=(a,b,c)=>{
      const cross=(p,q)=>(q.x-p.x)*(z-p.z)-(q.z-p.z)*(x-p.x);
      const d1=cross(a,b),d2=cross(b,c),d3=cross(c,a);
      return !((d1<0||d2<0||d3<0)&&(d1>0||d2>0||d3>0));
    };
    let minimum2=Infinity;
    for(const quad of pathFootprints){
      const bx=Math.max(quad.minX-x,0,x-quad.maxX),bz=Math.max(quad.minZ-z,0,z-quad.maxZ);
      if(bx*bx+bz*bz>minimum2)continue;
      if(bx===0&&bz===0){const p=quad.points;if(insideTriangle(p[0],p[1],p[2])||insideTriangle(p[0],p[2],p[3]))return -1;}
      for(const edge of quad.edges){
        const t=clamp(((x-edge.x)*edge.dx+(z-edge.z)*edge.dz)/edge.length2,0,1);
        const dx=x-edge.x-edge.dx*t,dz=z-edge.z-edge.dz*t;
        minimum2=Math.min(minimum2,dx*dx+dz*dz);
      }
    }
    return Math.sqrt(minimum2);
  }
  // Low grey outcrops and a broken gravel wash remain on their own shore.
  const beachMaterial=inkMaterial('#9ea29f',.52,0,1,.0023,0,'rock');
  const farBeachMaterial=inkMaterial('#abb0ab',.45,0,1,.0032,0,'rock');
  for(const material of [beachMaterial,farBeachMaterial]){
    material.uniforms.uStrength.value=.36;material.uniforms.uRepeat.value.set(.21,.15);
  }
  function addGravelBand(far=false){
    const positions=[],uv=[],indices=[],rows=far?230:150,cols=8,z0=far?-205:-72,z1=far?205:69;
    for(let j=0;j<=rows;j++){
      const z=z0+j/rows*(z1-z0),edge=far?farBankAt(z):bank(z),width=far?14:8.5;
      for(let i=0;i<=cols;i++){
        const u=i/cols,offset=1.2+u*width+(valueNoise3(z*.13,u*2.2,0,117)-.5)*.65;
        const x=edge+(far?offset:-offset),h=far?farHeightAt(x,z):heightAt(x,z);
        positions.push(x,h+.024,z);uv.push(u,j/rows);
        if(i<cols&&j<rows){const a=j*(cols+1)+i,b=a+cols+1;indices.push(a,b,a+1,b,b+1,a+1);}
      }
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
    const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
      vertexShader:`varying vec2 vUv;varying vec3 vWorld;varying float vDepth;void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;vec4 v=viewMatrix*w;vDepth=length(v.xyz);gl_Position=projectionMatrix*v;}`,
      fragmentShader:`varying vec2 vUv;varying vec3 vWorld;varying float vDepth;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}void main(){float edge=smoothstep(0.,.18,vUv.x)*smoothstep(0.,.25,1.-vUv.x);edge*=smoothstep(0.,.025,vUv.y)*smoothstep(0.,.025,1.-vUv.y);float ink=noise(vWorld.xz*.31);float grains=smoothstep(.42,.78,noise(vWorld.xz*5.8));float gap=smoothstep(.62,.83,noise(vWorld.xz*1.4));float alpha=edge*(.19+ink*.22+grains*.10)*(1.-gap*.78)*exp(-vDepth*vDepth*.000007);gl_FragColor=vec4(.34,.345,.34,alpha);
        #include <colorspace_fragment>
      }`,});
    const band=new THREE.Mesh(geometry,material);band.name=far?'對岸灰墨砂礫帶':'近岸灰墨砂礫帶';scene.add(band);
  }
  addGravelBand(false);addGravelBand(true);
  let beachSeed=416183;
  const beachRand=()=>{beachSeed=(beachSeed*1664525+1013904223)>>>0;return beachSeed/4294967296;};
  function addBeachCluster(centre,far=false,count=3){
    for(let i=0;i<count;i++){
      const z=centre+(beachRand()-.5)*9,r=1.05+beachRand()*1.15,h=.43+beachRand()*.80;
      const stretch=1.0+beachRand()*.25,angle=beachRand()*TAU,seed=beachRand()*70,inland=beachRand()*3;
      let x=(far?farBankAt(z):bank(z))+(far?1:-1)*(r*1.9+1+inland),found=far;
      if(!far){for(let attempt=0;attempt<6;attempt++){
        if(beachPathClearanceAt(x,z)>r*1.28+1.05 && collisions.every(c=>Math.hypot(x-c.x,z-c.z)>r+c.r+.5)){found=true;break;}x-=1.3;
      }}
      if(!found)continue;
      const snow=far?.30:[.28,.37,.46][i%3],rock=makeRockGroup(r,h,seed,false,far?farBeachMaterial:beachMaterial,snow);
      rock.scale.set(stretch,1,.72+beachRand()*.25);rock.rotation.y=angle;
      rock.position.set(x,(far?farHeightAt(x,z):heightAt(x,z))-h*.23,z);
      rock.name=far?'對岸灰雪岩簇':'近岸灰雪岩簇';rock.userData.beachSide=far?'far':'near';scene.add(rock);
      if(!far){collisions.push({x,z,r:r*1.18});addContactWash(x,z,r,seed,.18,1.15);}
    }
  }
  for(const [z,count] of [[-59,3],[-43,4],[-31,3],[-10,3],[10,3],[28,4],[47,3],[62,3]])addBeachCluster(z,false,count);
  for(const [z,count] of [[-131,3],[-89,4],[-53,3],[-17,4],[24,3],[63,4],[111,3],[151,3]])addBeachCluster(z,true,count);

  function findPineSite(x,z,size){
    const safe=(px,pz)=>{
      if(px<-69||pz<-69||pz>65||px>bank(pz)-3||!canWalk(px,pz)||journeyReserved(px,pz,size*.65))return false;
      if(Math.hypot(px+25,pz-9)<5+size*.4)return false;
      if(collisions.some(c=>Math.hypot(px-c.x,pz-c.z)<c.r+.90+size*.25))return false;
      return pathClearanceAt(px,pz)>=2.6;
    };
    if(safe(x,z))return {x,z};
    for(let radius=.7;radius<=22;radius+=.7){
      const count=Math.max(14,Math.ceil(radius*7));
      for(let i=0;i<count;i++){
        const angle=i/count*TAU+.27,px=x+Math.cos(angle)*radius,pz=z+Math.sin(angle)*radius;
        if(safe(px,pz))return {x:px,z:pz};
      }
    }
    return null;
  }
  function addPine(x,z,size=1,interactive=false,onRock=false){
    const requested={x,z},mainPine=x===-23.7&&z===-5,site=findPineSite(x,z,size);if(!site)return null;
    x=site.x;z=site.z;
    const variants=['windswept','upright','crooked','bare'];
    const variant=variants[pines.length%variants.length];
    const tree=buildBrushPine(palette,{size,seed:Math.floor(rand()*100000),variant});
    tree.position.set(x,heightAt(x,z)+(onRock?1.5:0),z);
    tree.rotation.y=mainPine?-.60:rand()*TAU;
    // Low roots follow this slope, so their tips remain buried in the snow.
    const rootPoint=new THREE.Vector3();
    const rootRotation=new THREE.Matrix4().makeRotationY(tree.rotation.y);
    tree.children.forEach(part=>{
      if(part.isInstancedMesh||!part.geometry?.attributes.position)return;
      const vertices=part.geometry.attributes.position;
      let changed=false;
      for(let i=0;i<vertices.count;i++){
        const ly=vertices.getY(i),lx=vertices.getX(i),lz=vertices.getZ(i);
        if(ly>.46||Math.hypot(lx,lz)>.99*1.8)continue;
        const weight=smooth(.10,.52,Math.hypot(lx,lz))*(1-smooth(.18,.46,ly));
        if(weight<=0)continue;
        rootPoint.set(lx*size,ly*size,lz*size).applyMatrix4(rootRotation).add(tree.position);
        const offset=(heightAt(rootPoint.x,rootPoint.z)-tree.position.y)/size;
        vertices.setY(i,ly+offset*weight);changed=true;
      }
      if(changed){vertices.needsUpdate=true;part.geometry.computeVertexNormals();part.geometry.computeBoundingSphere();}
    });
    // Nearby trunks retain full 3D detail; distant trees use one brush sprite.
    const detail=new THREE.Group();[...tree.children].forEach(part=>detail.add(part));
    if(variant==='bare')tree.add(detail);
    else{
      const lod=new THREE.LOD(),painted=new THREE.Sprite(farPineMaterial(true,.85));
      painted.center.set(.35,.07);painted.scale.set(tree.userData.baseDimensions.height*1.5,tree.userData.baseDimensions.height,1);
      lod.addLevel(detail,0);lod.addLevel(painted,72);tree.add(lod);tree.userData.paintedSprite=painted;
    }
    const clearance=pathClearanceAt(x,z),id=`pine-${String(pines.length+1).padStart(2,'0')}`;
    tree.userData.planting={id,requested,x,z,variant,pathClearance:clearance};pineClearances.push({id,requested:{...requested},x,z,variant,clearance});
    scene.add(tree);addContactWash(x,z,1.05*size,randomSeed*.001,.17,1.30);
    tree.userData.baseRotation=tree.rotation.z;tree.userData.swayPhase=rand()*TAU;tree.userData.shake=0;
    pines.push(tree);collisions.push({x,z,r:.48*size});
    if(interactive)interactables.push({id:`pine-${interactables.length}`,type:'pine',position:tree.position.clone().add(new THREE.Vector3(0,1.3*size,0)),radius:3.7,label:variant==='bare'?'輕碰枯枝':'輕觸松枝',object:tree});
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
  const extraPineCandidates=[[-30,52],[-17,43],[-37,31],[-54,52],[-61,13],[-44,-4],[-57,-7],[-66,-10],[-66,-53],[-48,-46],[-26,-52],[-18,-22],[-5,52]];
  extraPineCandidates.forEach(([x,z],i)=>addPine(x,z,.74+(i%4)*.11,i%5===0));
  // Additional near-land pines stay sparse and alternate in height.
  [[-34,65],[-17,56],[-8,24],[-21,17],[-43,7],[-57,3],[-64,53],[-65,-43],[-54,-55],[-34,-60],[-21,-34],[-7,-47]].forEach(([x,z],i)=>addPine(x,z,.70+(i%5)*.105,i%6===0));
  [[-43,55],[-24,46],[-11,13],[-31,0],[-58,-51],[-42,-65],[-14,-56],[-63,23]].forEach(([x,z],i)=>addPine(x,z,.68+(i%4)*.12,i%5===0));
  // The lee side follows the same eastward wind as the airborne snow. It is
  // tied to physical rock height, so a low stone cannot shelter an uphill eye.
  function shelterAt(x,z){
    const windX=.980580676,windZ=.196116135;
    let shelter=0;
    const eye=heightAt(x,z)+1.28;
    for(const rock of windbreaks){
      const dx=x-rock.x,dz=z-rock.z,along=dx*windX+dz*windZ;
      const start=rock.radius*.52,reach=rock.radius+rock.height*2.3;
      if(along<start||along>reach||eye>rock.top+.12)continue;
      const cross=Math.abs(dx*windZ-dz*windX);
      const width=rock.radius*(.94-.28*smooth(start,reach,along))+.30;
      const lateral=1-smooth(width*.32,width,cross);
      const downstream=smooth(start,start+.75,along)*(1-smooth(rock.radius+1,reach,along));
      const overhead=smooth(-.12,1.1,rock.top-eye);
      shelter=Math.max(shelter,lateral*downstream*overhead*.95);
    }
    return shelter;
  }
  // Small winter plants are merged by shared material: many clumps, few draws.
  let plantSeed=192731;
  const plantRand=()=>{plantSeed=(plantSeed*1664525+1013904223)>>>0;return plantSeed/4294967296;};
  function queueWinterPlant(type,x,z,size,far=false){
    // Reject obvious collisions before generating several thousand vertices.
    if(!far&&(!canWalk(x,z)||pathClearanceAt(x,z)<.65||journeyReserved(x,z,size*.25)))return false;
    const seed=Math.floor(plantRand()*1000000),plant=buildWinterPlant(palette,{kind:type,size,seed});
    plant.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(plant);
    const staticPlant=plant.userData.noAnimation;
    const swayAmplitude=staticPlant?0:(type==='reed'?.19:type==='shrub'?.055:.105)*size;
    const radius=Math.max(plant.userData.footprintRadius||0,Math.hypot(Math.max(Math.abs(bounds.min.x),Math.abs(bounds.max.x)),Math.max(Math.abs(bounds.min.z),Math.abs(bounds.max.z))))+swayAmplitude;
    const clearance=pathClearanceAt(x,z);
    if(clearance<radius+.38)return false;
    if(far){if(x<farBankAt(z)+radius*1.3+.65)return false;}
    else{
      if(x<-71||z<-71||z>67||x>bank(z)-radius*1.3-.65||!canWalk(x,z))return false;
      if(collisions.some(c=>Math.hypot(x-c.x,z-c.z)<c.r+radius+.12))return false;
    }
    if(winterPlants.some(p=>p.far===far&&Math.hypot(x-p.x,z-p.z)<(p.radius+radius)*.75))return false;
    plant.position.set(x,far?farHeightAt(x,z):heightAt(x,z),z);plant.rotation.y=plantRand()*TAU;plant.updateMatrixWorld(true);
    plant.traverse(part=>{
      if(!part.isMesh||part.isInstancedMesh||Array.isArray(part.material))return;
      let geometry=part.geometry.clone();geometry.applyMatrix4(part.matrixWorld);
      if(geometry.index){const flat=geometry.toNonIndexed();geometry.dispose();geometry=flat;}
      const positions=geometry.attributes.position,motion=new Float32Array(positions.count*4),plantHeight=Math.max(.05,bounds.max.y);
      const exposure=far?1:1-shelterAt(x,z)*.82;
      for(let i=0;i<positions.count;i++){
        const wx=positions.getX(i),wz=positions.getZ(i),localHeight=Math.max(0,positions.getY(i)-plant.position.y);
        const ground=far?farHeightAt(wx,wz):heightAt(wx,wz);
        const conform=staticPlant?1:1-smooth(.02,.28*size,localHeight);
        positions.setY(i,positions.getY(i)+(ground-plant.position.y)*conform+.006);
        motion[i*4]=clamp(localHeight/plantHeight,0,1);motion[i*4+1]=plantHeight;
        motion[i*4+2]=seed*.017;motion[i*4+3]=swayAmplitude*exposure;
      }
      geometry.setAttribute('plantMotion',new THREE.BufferAttribute(motion,4));
      if(!winterPlantBatches.has(part.material))winterPlantBatches.set(part.material,[]);
      winterPlantBatches.get(part.material).push(geometry);
    });
    winterPlants.push({type,x,z,size,far,radius,clearance,maxSway:swayAmplitude});vegetationCounts[type]++;return true;
  }
  for(let i=2;i<pathFootprints.length;i+=7+Math.floor(plantRand()*9)){
    const quad=pathFootprints[i],centre={x:quad.points.reduce((n,p)=>n+p.x,0)/4,z:quad.points.reduce((n,p)=>n+p.z,0)/4};
    for(const side of [0,1]){
      if(plantRand()>.78)continue;
      const a=quad.points[side],b=quad.points[side===0?3:2],ex=(a.x+b.x)*.5,ez=(a.z+b.z)*.5;
      const dx=ex-centre.x,dz=ez-centre.z,length=Math.hypot(dx,dz)||1;
      const type=plantRand()<.17?'shrub':'grass',size=type==='shrub'?.55+plantRand()*.40:.48+plantRand()*.52;
      const offset=.95+plantRand()*1.4,x=ex+dx/length*offset,z=ez+dz/length*offset;
      queueWinterPlant(type,x,z,size,false);
    }
  }
  for(let z=-68;z<67;z+=3.5+plantRand()*3.5){
    for(let j=0;j<2;j++){
      const zz=z+(plantRand()-.5)*2,type=plantRand()<.67?'reed':plantRand()<.65?'grass':'shrub';
      queueWinterPlant(type,bank(zz)-1.7-plantRand()*4.5,zz,.72+plantRand()*.52,false);
    }
  }
  for(let z=-174;z<179;z+=7+plantRand()*6){
    const type=plantRand()<.76?'reed':'shrub';
    queueWinterPlant(type,farBankAt(z)+1.8+plantRand()*5.5,z,1.0+plantRand()*.55,true);
  }
  // Debris collects beneath the different trees rather than evenly covering
  // every patch of snow. Keep open gaps, and never overlap the walking path.
  for(const tree of pines){
    for(let i=0;i<7;i++){
      const angle=plantRand()*TAU,distance=1.1+plantRand()*3.6;
      const type=i<4?(tree.userData.variant==='bare'?'twig':'litter'):plantRand()<.45?'seedhead':'grass';
      queueWinterPlant(type,tree.position.x+Math.cos(angle)*distance,tree.position.z+Math.sin(angle)*distance,.63+plantRand()*.53);
    }
  }
  // Irregular small islands of winter growth fill the lower slopes and
  // sheltered hollows, interspersed with empty wind-swept snow.
  for(let cluster=0;cluster<100;cluster++){
    const cx=-67+plantRand()*60,cz=-66+plantRand()*128;
    const kinds=['grass','grass','seedhead','litter','twig','shrub'];
    for(let j=0;j<4;j++){
      const angle=plantRand()*TAU,spread=Math.sqrt(plantRand())*2.7;
      const type=kinds[Math.floor(plantRand()*kinds.length)];
      queueWinterPlant(type,cx+Math.cos(angle)*spread,cz+Math.sin(angle)*spread,.55+plantRand()*.57);
    }
  }
  let vegetationBatchCount=0;
  const windPlantMaterials=[];
  for(const [material,pieces] of winterPlantBatches){
    const count=pieces.reduce((n,g)=>n+g.attributes.position.count,0),positions=new Float32Array(count*3),normals=new Float32Array(count*3),uv=new Float32Array(count*2),motion=new Float32Array(count*4);
    let offset=0;
    for(const geometry of pieces){const n=geometry.attributes.position.count;positions.set(geometry.attributes.position.array,offset*3);normals.set(geometry.attributes.normal.array,offset*3);motion.set(geometry.attributes.plantMotion.array,offset*4);if(geometry.attributes.uv)uv.set(geometry.attributes.uv.array,offset*2);offset+=n;geometry.dispose();}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));geometry.setAttribute('plantMotion',new THREE.BufferAttribute(motion,4));geometry.computeBoundingSphere();geometry.boundingSphere.radius+=.3;
    const windMaterial=palette.withRootedWind(material);windPlantMaterials.push(windMaterial);
    const mesh=new THREE.Mesh(geometry,windMaterial);mesh.name='冬草蘆葦枯葉枝・固定根部風動合批';scene.add(mesh);vegetationBatchCount++;
  }
  winterPlantBatches.clear();
  const boat=buildFishingBoat(palette);
  // The hull keel is local y=-.05, and the low gunwale is about y=.43.
  // Even at the top of a wave the keel stays immersed; the rim stays dry.
  boat.position.set(17,-.095,-30);boat.rotation.y=-.24;boat.name='孤舟';scene.add(boat);
  boat.userData.initialY=boat.position.y;
  boat.userData.buoyancy=Object.freeze({waterLevel:-.02,amplitude:.105,angularSpeed:.68,rollAmplitude:.018,pitchAmplitude:.011});
  const ambience=createAmbience({scene,boat,heightAt,bank});

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
  function update(dt,time,player,gust=.5+.3*Math.sin(time*.37)+.2*Math.sin(time*.83+1.4)){
    riverMaterial.uniforms.uTime.value=time;
    const buoyancy=boat.userData.buoyancy;
    boat.position.y=boat.userData.initialY+Math.sin(time*buoyancy.angularSpeed)*buoyancy.amplitude;
    boat.rotation.z=Math.sin(time*.52)*buoyancy.rollAmplitude;
    boat.rotation.x=Math.cos(time*.57)*buoyancy.pitchAmplitude;
    pines.forEach(tree=>{
      const elapsed=performance.now()/1000-(tree.userData.shake||-100);
      const shake=Math.max(0,1-elapsed/1.2);
      tree.rotation.z=Math.sin(time*.37+tree.userData.swayPhase)*.005+Math.sin(elapsed*23)*shake*.045;
      if(tree.userData.paintedSprite)tree.userData.paintedSprite.material.rotation=tree.rotation.z;
    });
    windPlantMaterials.forEach(material=>{material.uniforms.uPlantTime.value=time;material.uniforms.uPlantGust.value=clamp(gust,0,1);});
    ambience.update(dt,time,player);
  }
  // A zero default also keeps non-rock shader inputs explicit and predictable.
  scene.traverse(object=>{
    const geometry=object.geometry;
    if(geometry?.attributes.position&&!geometry.attributes.snowHeight)geometry.setAttribute('snowHeight',new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count),1));
  });
  const loader=new THREE.TextureLoader();
  const pathPaintReady=loader.loadAsync(new URL('./assets/brush-path.png',import.meta.url).href).then(texture=>{
    texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=8;
    pathPaintMaterials.forEach(material=>{material.uniforms.uPathPaint.value=texture;});assetState.pathPaint=true;
  });
  const ready=Promise.all([
    palette.ready,mountainSurround.ready,pathPaintReady,
    loader.loadAsync(new URL('./assets/ink-pine.png',import.meta.url).href),
  ]).then(([, , ,pineTexture])=>{
    pineTexture.colorSpace=THREE.SRGBColorSpace;pineTexture.anisotropy=4;
    farPineMaterials.forEach(material=>{material.map=pineTexture;material.needsUpdate=true;});
  });
  const shelterSpots=[];
  for(const rock of windbreaks){
    for(const distance of [rock.radius+.8,rock.radius+1.6,rock.radius+2.5]){
      const x=rock.x+.980580676*distance,z=rock.z+.196116135*distance;
      if(canWalk(x,z)&&shelterAt(x,z)>.55){shelterSpots.push(Object.freeze({x,z,shelter:shelterAt(x,z),rockX:rock.x,rockZ:rock.z}));break;}
    }
  }
  const journeySpawn=innerWidth/innerHeight<.8?{x:-31.1,z:35.2,yaw:3.40,pitch:-.025}:JOURNEY_SPAWN;
  const landmarks={summit:{x:-46,z:-12},shore:{x:-4,z:-24},forest:{x:-48,z:37}};
  return {scene,ready,journey,spawn:journeySpawn,heightAt,canWalk,shelterAt,shelterSpots:Object.freeze(shelterSpots),ambienceDiagnostics:ambience.diagnostics,zoneAt,interactables,boat,update,landmarks,pineClearances,pathSampling:{count:pathSamples.length,maxSpacing:maxPathSampleSpacing,mode:'rendered-road-footprint'},pathWidths:Object.freeze(pathWidths),assetState,vegetationStats:Object.freeze({counts:{...vegetationCounts},clumps:winterPlants.length,batches:vegetationBatchCount,minRoadClearance:Math.min(...winterPlants.map(p=>p.clearance))}),vegetationPlacements:Object.freeze(winterPlants),farForestStats:Object.freeze(farForestStats),treeVariantCounts:Object.freeze(pineClearances.reduce((counts,p)=>(counts[p.variant]=(counts[p.variant]||0)+1,counts),{}))};
}
