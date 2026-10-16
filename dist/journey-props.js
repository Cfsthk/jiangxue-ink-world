import * as THREE from './vendor/three.module.js';
import { BrushBatch, tube, timberBox } from './props.js?v=1.3.0';
import { createRigPaint, addRigBleed } from './painted-rig.js?v=1.3.0';
const TAU=Math.PI*2;

function softBox(w,h,d,seed=1) {
  const shape=new THREE.Shape(),r=Math.min(.045,w*.14,h*.16,d*.16),x=-w/2,y=-h/2;
  shape.moveTo(x+r,y);shape.lineTo(x+w-r,y);shape.quadraticCurveTo(x+w,y,x+w,y+r);shape.lineTo(x+w,y+h-r);shape.quadraticCurveTo(x+w,y+h,x+w-r,y+h);shape.lineTo(x+r,y+h);shape.quadraticCurveTo(x,y+h,x,y+h-r);shape.lineTo(x,y+r);shape.quadraticCurveTo(x,y,x+r,y);
  const g=new THREE.ExtrudeGeometry(shape,{depth:Math.max(.004,d-r*2),bevelEnabled:true,bevelSize:r*.7,bevelThickness:r,bevelSegments:4,steps:Math.max(2,Math.ceil(d/.16)),curveSegments:7});g.translate(0,0,-d/2+r);
  const p=g.attributes.position,normals=g.attributes.normal;
  const uv=g.attributes.uv,longX=w>=d;
  for(let i=0;i<p.count;i++){
    const px=p.getX(i),py=p.getY(i),pz=p.getZ(i),wave=Math.sin(pz*3.1+px*2+seed)*.008;
    p.setXYZ(i,px+Math.sin(pz*4+py*3+seed)*.010,py+wave+Math.sin(px*5+pz*2+seed)*.008,pz+Math.sin(px*4+py*3+seed)*.008);
    const end=Math.abs(longX?normals.getX(i):normals.getZ(i))>.6;
    const cross=Math.abs(normals.getY(i))>.6?(longX?pz/d:px/w):py/h;
    uv.setXY(i,(end?(longX?pz/d:px/w):cross)*.64+.5+Math.sin(seed*17)*.13,(longX?px/w:pz/d)*.78+.5);
  }
  g.computeVertexNormals();return g;
}
function oval(b,p,s,m,seed=0) {
  const g=new THREE.SphereGeometry(1,28,18),v=g.attributes.position;
  for(let i=0;i<v.count;i++){const x=v.getX(i),y=v.getY(i),z=v.getZ(i),n=1+.018*Math.sin(x*6+y*4+z*3+seed);v.setXYZ(i,x*n,y*n,z*n);}
  g.computeVertexNormals();b.add(g,m,p,[0,0,0],s);
}
function stroke(b,points,r,m,end=r*.7){b.add(tube(points,r,end,Math.max(10,points.length*5),7),m);}

export function makeJourneyPalette(palette) {
  const rigPaint=createRigPaint(),linen=rigPaint.cloth.clone();linen.uniforms.uAtlas=rigPaint.cloth.uniforms.uAtlas;linen.uniforms.uInk.value.set('#68796d');linen.uniforms.uDensity.value=.80;linen.name='行李亞麻・積墨纖維';
  return {...palette,cloth:rigPaint.cloth,paper:rigPaint.paper,horse:rigPaint.horse,dark:rigPaint.dark,linen,rigPaint,rigReady:rigPaint.ready};
}

// A curved strip has real depth changes and UVs; dry brush gaps come from its pigment skin.
export function brushRibbon(points,width,seed=1,across=6) {
  const c=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),steps=Math.max(18,points.length*7),frames=c.computeFrenetFrames(steps,false),pos=[],uv=[],idx=[];
  for(let j=0;j<=steps;j++){
    const t=j/steps,p=c.getPointAt(t),taper=.14+.86*Math.pow(Math.sin(Math.PI*t),.35);
    for(let i=0;i<=across;i++){
      const u=i/across,edge=1+.075*Math.sin(t*19+seed)+.045*Math.sin(t*47+seed*2);
      const q=p.clone().addScaledVector(frames.normals[j],(u-.5)*width*taper*edge).addScaledVector(frames.binormals[j],Math.sin(u*Math.PI)*width*.075*Math.sin(t*8+seed));
      pos.push(q.x,q.y,q.z);uv.push(u,t);
      if(i<across&&j<steps){const a=j*(across+1)+i,b=a+across+1;idx.push(a,b,a+1,a+1,b,b+1);}
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}

export function buildWagon(p) {
  const rig=new THREE.Group();rig.name='路邊木車與馬・面向出口';
  const body=new THREE.Group(),b=new BrushBatch(),wood=p.rigPaint.wood,dark=p.rigPaint.dark;
  let plankSeed=0;
  const plank=(w,h,d,at,rot=[0,0,0])=>b.add(softBox(w,h,d,++plankSeed),wood,at,rot);
  // Uneven timber boards, open tail, rounded rims and visible end pegs.
  for(let i=0;i<9;i++)plank(.225,.12,3.15,[(i-4)*.233,1.23,0]);
  for(const x of [-.89,.89])plank(.13,.16,3.45,[x,1.07,0]);
  for(const z of [-1.2,0,1.15])plank(2.3,.15,.13,[0,1.12,z]);
  for(const x of [-1.06,1.06]) {
    for(let j=0;j<3;j++)plank(.085,.17,3.15,[x,1.42+j*.19,0]);
    for(const z of [-1.4,-.1,1.4])plank(.11,.82,.11,[x,1.6,z]);
    stroke(b,[[x,1.95,-1.55],[x,1.97,0],[x,1.95,1.55]],.043,dark);
  }
  // A low rear gate leaves luggage visible from the player's starting side.
  for(let j=0;j<2;j++)plank(2.08,.16,.08,[0,1.40+j*.18,-1.58]);
  plank(2.08,.15,.14,[0,1.88,1.25]);plank(1.9,.12,.43,[0,1.62,1.37]);
  for(const x of [-.95,.95])for(const z of [-1.42,1.42])oval(b,[x,1.80,z],[.022,.025,.025],dark);
  // Wooden axle and two large spoked wheels. Wheels turn only during departure.
  stroke(b,[[-1.5,.78,0],[1.5,.78,0]],.075,dark);
  const wheels=[];
  for(const side of [-1,1]) {
    const wheel=new THREE.Group(),wb=new BrushBatch();wheel.position.set(side*1.27,.78,0);
    const ring=radius=>Array.from({length:97},(_,i)=>{const a=i/96*TAU,r=radius*(1+.018*Math.sin(a*3+side)+.009*Math.sin(a*7));return [.008*Math.sin(a*4),Math.sin(a)*r,Math.cos(a)*r];});
    wb.add(tube(ring(.73),.072,.072,64,8),wood);wb.add(tube(ring(.76),.018,.018,64,5),dark);
    for(let i=0;i<12;i++){const a=i/12*TAU+.018*Math.sin(i*7);stroke(wb,[[0,0,0],[.012*Math.sin(i),Math.sin(a+.025)*.37,Math.cos(a+.025)*.37],[0,Math.sin(a)*.68,Math.cos(a)*.68]],.026,wood);}
    oval(wb,[0,0,0],[.14,.12,.12],dark);wb.finish(wheel,'手繪木輪・輪輻');body.add(wheel);wheels.push(wheel);
  }
  // Two curved bows support a light, irregular cloth roof, with an open rear.
  for(const z of [-.65,1.1]) {
    const arch=Array.from({length:35},(_,i)=>{const a=i/34*Math.PI;return [-1.06*Math.cos(a)+.014*Math.sin(a*3+z),1.98+Math.sin(a)*(.88+.014*Math.sin(a*5))+.008*Math.sin(a*8+z),z+.008*Math.sin(a*6)];});
    stroke(b,arch,.023,wood);
  }
  const roofPos=[],roofUV=[],roofI=[],nr=48,nz=28;
  for(let j=0;j<=nz;j++)for(let i=0;i<=nr;i++){
    const a=i/nr*Math.PI,z=-.72+j/nz*1.92;
    const sag=Math.sin(j/nz*Math.PI)*.055,fold=Math.sin(a*7+z*.7)*.016+Math.sin(a*13-z*1.8)*.007;
    roofPos.push(-1.09*Math.cos(a)+Math.cos(a)*fold,1.99+Math.sin(a)*(.89-sag)+fold,z+.022*Math.sin(a*9+z*2));
    roofUV.push(i/nr*.95,j/nz*.95);
    if(i<nr&&j<nz){const q=j*(nr+1)+i,t=q+nr+1;roofI.push(q,t,q+1,q+1,t,t+1);}
  }
  const roof=new THREE.BufferGeometry();roof.setAttribute('position',new THREE.Float32BufferAttribute(roofPos,3));roof.setAttribute('uv',new THREE.Float32BufferAttribute(roofUV,2));roof.setIndex(roofI);roof.computeVertexNormals();b.add(roof,p.rigPaint.cloth);
  const curtain=paperPatch(1.92,.79,31,.035);curtain.rotateX(-Math.PI/2);curtain.translate(0,2.30,-.76);b.add(curtain,p.rigPaint.cloth);
  for(const x of [-1.05,1.05])stroke(b,[[x,1.99,-.70],[x*1.01,1.96,.2],[x,2,1.2]],.013,p.rigPaint.cloth);
  // Thin snow streaks sit on broad curved surfaces rather than polygonal caps.
  for(const x of [-1.06,1.06])stroke(b,[[x,1.99,-1.1],[x+.015,2.01,-.8],[x,1.99,-.4]],.026,p.snowMaterial,.008);
  // Long shafts and rope traces join the cart to the horse.
  for(const x of [-.83,.83]){
    stroke(b,[[x,1.09,.9],[x,.99,2.9],[x*.78,.94,5.7]],.045,wood,.028);
    stroke(b,[[x,1.38,1.28],[x*.74,1.38,3.7],[x*.67,1.43,5.12]],.012,dark,.01);
  }
  b.finish(body,'舊木車・筆墨木紋');rig.add(body);
  const horse=buildHorse(p);horse.position.z=4.9;rig.add(horse);
  // A few ordinary bundles establish an occupied travelling cart without adding another NPC.
  const bundles=new BrushBatch();oval(bundles,[.65,1.48,1.1],[.31,.22,.28],p.cloth);stroke(bundles,[[.4,1.5,.9],[.67,1.72,1.1],[.89,1.49,1.3]],.018,dark);bundles.finish(body,'車前行囊');
  addRigBleed(rig);
  return {rig,body,horse,wheels,ready:Promise.all([p.rigReady,horse.userData.ready])};
}

let horseGeometryReady;
function horseSkin(){
  if(!horseGeometryReady)horseGeometryReady=fetch(new URL('./assets/models/horse-v2.bin',import.meta.url)).then(r=>{if(!r.ok)throw new Error('馬匹曲面未能載入');return r.arrayBuffer();}).then(buffer=>{
    const h=new Uint32Array(buffer,0,4);if(h[0]!==0x484f5253)throw new Error('馬匹曲面格式不符');
    const n=h[1],g=new THREE.BufferGeometry();let offset=16;
    g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(buffer,offset,n*3),3));offset+=n*12;
    g.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(buffer,offset,n*3),3));offset+=n*12;
    g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(buffer,offset,n*2),2));offset+=n*8;
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(buffer,offset,h[2]),1));g.computeBoundingSphere();return g;
  });return horseGeometryReady;
}
function hoofGeometry(){
  const g=new THREE.CylinderGeometry(.078,.103,.12,24,7,false),v=g.attributes.position;
  for(let i=0;i<v.count;i++){const x=v.getX(i),y=v.getY(i),z=v.getZ(i);v.setXYZ(i,x*(1+.025*Math.sin(z*47)),y,z*1.35+(.06-y)*.26);}g.computeVertexNormals();return g;
}
function buildHorse(p) {
  const group=new THREE.Group(),b=new BrushBatch(),m=p.horse,dark=p.rigPaint.dark;group.name='馬・連續曲面與筆墨皮膚';
  group.userData.ready=horseSkin().then(g=>{const skin=new THREE.Mesh(g,m);skin.name='馬身・連續肩背頸腿';group.add(skin);addRigBleed(skin,.009);});
  for(const side of [-1,1]){
    // Small almond eyes and nostrils, and short leaf shaped ears.
    oval(b,[side*.176,2.326,1.24],[.013,.019,.026],dark);
    oval(b,[side*.160,1.992,1.78],[.009,.021,.034],dark);
    const ear=new THREE.SphereGeometry(1,24,16),v=ear.attributes.position;
    for(let i=0;i<v.count;i++){const x=v.getX(i),y=v.getY(i),z=v.getZ(i),t=(y+1)/2;v.setXYZ(i,x*.055*(1-.55*t),y*.14,z*.064*(1-.4*t));}ear.computeVertexNormals();b.add(ear,m,[side*.107,2.62,1.07],[.22,0,side*-.18]);
    stroke(b,[[side*.109,2.56,1.12],[side*.115,2.68,1.10],[side*.10,2.73,1.08]],.009,p.rigPaint.cloth,.002);
    const offset=side===1?.065:-.025;
    for(const z of [.81+offset,-.82+offset])b.add(hoofGeometry(),dark,[side*.295,.061,z]);
    // Harness follows the actual skull, chest and back, rather than crossing empty space.
    stroke(b,[[side*.19,2.09,1.57],[side*.205,2.34,1.26],[side*.11,2.54,1.08]],.011,dark,.009);
    stroke(b,[[side*.33,1.65,.54],[side*.28,1.43,.88],[0,1.30,.98]],.025,p.rigPaint.cloth);
    stroke(b,[[side*.188,2.1,1.57],[side*.59,1.66,.03],[side*.78,1.61,-3.52]],.008,dark,.006);
  }
  stroke(b,[[-.17,2.05,1.69],[0,2.085,1.84],[.17,2.05,1.69]],.012,dark);
  const crest=[[0,2.54,1.01],[0,2.43,.79],[0,2.16,.54],[0,1.88,.34]];
  b.add(brushRibbon(crest,.125,13),p.rigPaint.stroke);
  for(let i=0;i<4;i++)b.add(brushRibbon([[.035*Math.sin(i),1.67,-1.13],[.08*Math.sin(i),1.24,-1.41],[.10*Math.sin(i+.4),.58,-1.43-i*.015]],.055,20+i),p.rigPaint.stroke);
  stroke(b,[[-.41,1.48,-.27],[-.32,1.79,-.27],[0,1.84,-.27],[.32,1.79,-.27],[.41,1.48,-.27]],.023,p.rigPaint.cloth);
  b.finish(group,'馬具・蹄與乾筆鬃尾');return group;
}

function paperPatch(w,d,seed=1,fold=.025){
  const nx=40,nz=30,pos=[],uv=[],idx=[];
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
    const u=i/nx,v=j/nz,x=(u-.5)*w,z=(v-.5)*d,edge=Math.pow(Math.abs(u-.5)*2,12)+Math.pow(Math.abs(v-.5)*2,12);
    pos.push(x+edge*(.0035*Math.sin(v*13+seed)+.002*Math.sin(v*27+seed)),.009*Math.sin(x*19+z*11+seed)+fold*Math.sin(x/w*Math.PI*3)+.016*Math.pow(Math.abs(z/d)*2,4),z+edge*(.0035*Math.sin(u*17+seed)+.002*Math.sin(u*29+seed)));uv.push(u,v);
    if(i<nx&&j<nz){const a=j*(nx+1)+i,b=a+nx+1;idx.push(a,a+1,b,a+1,b+1,b);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
function capGeometry(){
  const pos=[],uv=[],idx=[],nr=72,ny=42;
  for(let j=0;j<=ny;j++)for(let i=0;i<=nr;i++){
    const t=j/ny,a=i/nr*TAU,rx=.36*(1-.62*t),rz=.27*Math.pow(1-t,.74)+.0018,crease=.017*Math.sin(a*3+t*5)*Math.sin(Math.PI*t);
    pos.push(Math.sign(Math.cos(a))*Math.pow(Math.abs(Math.cos(a)),.74)*(rx+crease),.045+t*.43+.035*Math.cos(a)*t+.045*Math.sin(a)*Math.sin(a)*t+.025*Math.sin(a*2)*Math.sin(Math.PI*t),Math.sign(Math.sin(a))*Math.pow(Math.abs(Math.sin(a)),.75)*(rz+crease)+.08*t);uv.push(i/nr,t);
    if(i<nr&&j<ny){const n=j*(nr+1)+i,m=n+nr+1;idx.push(n,m,n+1,n+1,m,m+1);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
function capBand(){
  const pos=[],uv=[],idx=[],nr=72,ny=9;
  for(let j=0;j<=ny;j++)for(let i=0;i<=nr;i++){
    const t=j/ny,a=i/nr*TAU,wave=.003*Math.sin(a*9)+.002*Math.sin(a*17);
    pos.push(Math.sign(Math.cos(a))*Math.pow(Math.abs(Math.cos(a)),.74)*(.367-.032*t),.03+t*.10+wave,Math.sign(Math.sin(a))*Math.pow(Math.abs(Math.sin(a)),.75)*(.281-.024*t)+.012*t);uv.push(i/nr,t*.25+.2);
    if(i<nr&&j<ny){const a=j*(nr+1)+i,b=a+nr+1;idx.push(a,b,a+1,a+1,b,b+1);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
function capFold(){
  const pos=[],uv=[],idx=[],nx=56,ny=36;
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
    const u=i/nx,v=j/ny,a=Math.PI+u*Math.PI,top=.64+.11*Math.sin(u*Math.PI)+.025*Math.cos(a),t=.075+v*(top-.075),rx=.36*(1-.62*t),rz=.27*Math.pow(1-t,.74)+.0018,crease=.017*Math.sin(a*3+t*5)*Math.sin(Math.PI*t);
    // The folded facing follows the underlying cloth skin with a tiny outward offset.
    // This prevents a darker oval of the body poking through the lighter front fold.
    pos.push(Math.sign(Math.cos(a))*Math.pow(Math.abs(Math.cos(a)),.74)*(rx+crease)+Math.cos(a)*.007,.045+t*.43+.035*Math.cos(a)*t+.045*Math.sin(a)*Math.sin(a)*t+.025*Math.sin(a*2)*Math.sin(Math.PI*t),Math.sign(Math.sin(a))*Math.pow(Math.abs(Math.sin(a)),.75)*(rz+crease)+.08*t+Math.sin(a)*.007);uv.push(u,v);
    if(i<nx&&j<ny){const a=j*(nx+1)+i,b=a+nx+1;idx.push(a,a+1,b,a+1,b+1,b);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
function paperSurface(p,id) {
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=id==='map'?512:1024;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#eeefea';ctx.fillRect(0,0,768,canvas.height);
  for(let i=0;i<7600;i++){const x=(Math.sin(i*71.3)*.5+.5)*768,y=(Math.sin(i*31.7)*.5+.5)*canvas.height;ctx.fillStyle=`rgba(65,76,70,${.01+(i%5)*.006})`;ctx.fillRect(x,y,1+i%4,.6);}
  ctx.strokeStyle='rgba(65,77,70,.52)';ctx.lineWidth=2.5;ctx.lineCap='round';ctx.fillStyle='#535f56';ctx.font='40px InkCalligraphy,InkBrush,"Kaiti TC",serif';
  if(id==='map'){
    for(const [x,y] of [[145,140],[260,245],[480,120],[600,300]]){ctx.beginPath();ctx.moveTo(x-50,y+30);ctx.quadraticCurveTo(x-15,y-25,x,y-35);ctx.quadraticCurveTo(x+20,y+15,x+60,y+30);ctx.stroke();}
    ctx.beginPath();ctx.moveTo(160,70);ctx.bezierCurveTo(300,110,280,310,490,420);ctx.stroke();ctx.beginPath();ctx.moveTo(470,320);ctx.quadraticCurveTo(520,380,675,425);ctx.stroke();ctx.fillText('長安',45,70);ctx.fillText('邵州',365,440);ctx.fillText('永州',610,485);ctx.beginPath();ctx.moveTo(360,380);ctx.lineTo(460,435);ctx.moveTo(455,380);ctx.lineTo(370,435);ctx.stroke();
  }else if(id==='farewell'){
    ctx.font='100px InkCalligraphy,InkBrush,"Kaiti TC",serif';ctx.fillText('珍',590,175);ctx.fillText('重',590,300);ctx.font='35px InkCalligraphy,InkBrush,"Kaiti TC",serif';
    for(let c=0;c<3;c++)for(let r=0;r<5;r++)ctx.fillText('故人遠行山水長'[(c*5+r)%7],465-c*83,190+r*91);
  }else{ctx.font='30px InkCalligraphy,InkBrush,"Kaiti TC",serif';for(let c=0;c<6;c++)for(let r=0;r<8;r++)ctx.fillText('永州司馬遠行'[(c*8+r)%6],650-c*85,120+r*100);}
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
  const m=p.rigPaint.paper.clone();m.uniforms.uAtlas=p.rigPaint.paper.uniforms.uAtlas;
  // The paper skin and its handwritten face both remain UV mapped to the folded sheet.
  m.uniforms.uWriting={value:texture};m.fragmentShader='uniform sampler2D uWriting;\n'+m.fragmentShader.replace('color-=vec3((noise', 'float writing=1.-dot(texture2D(uWriting,vUv).rgb,vec3(.299,.587,.114));color=mix(color,vec3(.065,.095,.076),smoothstep(.30,.80,writing)*.86);\n    color-=vec3((noise');return m;
}
export function buildLuggage(id,p) {
  const group=new THREE.Group(),b=new BrushBatch(),dark=p.rigPaint.dark;group.name=`立體行李・${id}`;
  if(id==='hat'){
    b.add(capGeometry(),p.rigPaint.hat);
    const ring=Array.from({length:81},(_,i)=>{const a=i/80*TAU;return [.36*Math.cos(a),.065+.009*Math.sin(a*7),.29*Math.sin(a)];});stroke(b,ring,.017,p.rigPaint.hat);
    // A folded crown and two soft fabric ties, not a bowl and round rods.
    const foldPaint=p.rigPaint.hat.clone();foldPaint.uniforms.uAtlas=p.rigPaint.hat.uniforms.uAtlas;foldPaint.uniforms.uDensity.value=.70;
    b.add(capFold(),foldPaint);b.add(capBand(),foldPaint);
    for(const side of [-1,1])b.add(brushRibbon([[side*.20,.055,.19],[side*.31,.08,.38],[side*.35,.026,.63],[side*.45,.018,.76]],.10,4+side),p.rigPaint.hat);
    stroke(b,[[-.32,.09,-.19],[0,.078,-.277],[.32,.09,-.19]],.004,p.rigPaint.cloth,.003);
  }else if(id==='scroll'){
    const g=new THREE.CylinderGeometry(.112,.119,.88,40,22,false),v=g.attributes.position;
    for(let i=0;i<v.count;i++){const x=v.getX(i),y=v.getY(i),z=v.getZ(i),r=1+.018*Math.sin(y*37+Math.atan2(z,x)*5);v.setXYZ(i,x*r,y,z*r);}g.computeVertexNormals();
    b.add(g,p.linen,[0,.14,0],[Math.PI/2,0,0]);
    for(const z of [-.45,.45]){b.add(new THREE.CylinderGeometry(.113,.113,.025,40),p.rigPaint.paper,[0,.14,z],[Math.PI/2,0,0]);const spiral=Array.from({length:80},(_,i)=>{const a=i/79*Math.PI*7,r=.009+i/79*.092+.0015*Math.sin(a*4.1);return [Math.cos(a)*r,.14+Math.sin(a)*r,z+Math.sign(z)*.014];});stroke(b,spiral,.003,p.rigPaint.wood);}
    stroke(b,[[-.11,.16,-.07],[0,.26,-.07],[.11,.16,-.07],[0,.023,-.07],[-.11,.16,-.07]],.009,dark);
    b.add(brushRibbon([[0,.26,-.07],[.09,.29,-.08],[.16,.23,-.13],[.06,.24,-.12],[0,.26,-.07],[-.1,.29,-.11],[-.09,.24,-.19]],.025,5),p.linen);
  }else if(id==='decree'||id==='farewell'){
    const face=paperSurface(p,id),w=id==='farewell'?.64:.58,d=id==='farewell'?.84:.78;
    const layers=id==='farewell'?2:3;
    // All sheet layers share the same warp, so fibres and writing never flicker in intersecting bands.
    for(let i=0;i<layers;i++)b.add(paperPatch(w,d,14,.024),i===layers-1?face:p.rigPaint.paper,[i*.002,.030+i*.012,0],[0,-.08,0]);
    if(id==='decree'){
      const ropeY=(x,z)=>.030+(layers-1)*.012+.009*Math.sin(x*19+z*11+14)+.024*Math.sin(x/w*Math.PI*3)+.016*Math.pow(Math.abs(z/d)*2,4)+.009;
      const across=Array.from({length:17},(_,i)=>{const x=(i/16-.5)*w;return [x,ropeY(x,0),0];});
      const along=Array.from({length:19},(_,i)=>{const z=(i/18-.5)*d;return [0,ropeY(0,z),z];});
      stroke(b,across,.005,dark);stroke(b,along,.005,dark);
      b.add(brushRibbon([[0,.077,0],[-.10,.105,.05],[-.09,.11,-.035],[.02,.078,0],[.10,.11,-.035],[.08,.10,.05]],.022,51),p.linen);
    }else{b.add(brushRibbon([[-.29,.03,.12],[-.40,.031,.27],[-.34,.027,.43],[-.19,.027,.34]],.035,67),p.linen);}
  }else if(id==='map'){
    for(let i=0;i<2;i++)b.add(paperPatch(.90,.67,38,.026),i?paperSurface(p,id):p.linen,[0,.043+i*.007,0]);
    for(const x of [-.33,.07])stroke(b,[[x,.071,-.32],[x-.014,.065,0],[x,.09,.32]],.003,p.rigPaint.cloth);
    // Frayed selvage remains an irregular thin edge, with no rectangular roller bars.
    for(let i=0;i<17;i++){const x=-.42+i*.051;stroke(b,[[x,.054,.32],[x+.009,.045,.345+.007*Math.sin(i)]],.0016,p.rigPaint.cloth,.0005);}
  }
  b.finish(group,`行李・纖維與摺痕・${id}`);addRigBleed(group,.004);return group;
}
export function buildDeadBranch(p){
  const g=new THREE.Group(),b=new BrushBatch();
  stroke(b,[[-.65,.10,-.3],[-.25,.18,-.03],[.3,.22,.14],[.72,.32,.32]],.055,p.branchMaterial,.015);
  stroke(b,[[-.1,.2,.04],[.1,.35,-.25],[.36,.38,-.44]],.026,p.branchMaterial,.008);
  stroke(b,[[.26,.21,.12],[.23,.38,.43],[.38,.43,.56]],.023,p.branchMaterial,.006);
  stroke(b,[[-.45,.15,-.16],[-.15,.24,-.02],[.2,.26,.12]],.022,p.snowMaterial,.006);b.finish(g,'覆雪枯枝');return g;
}
