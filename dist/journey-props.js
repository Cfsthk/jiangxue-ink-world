import * as THREE from './vendor/three.module.js';
import { BrushBatch, tube, timberBox } from './props.js?v=0.8.0';
const TAU=Math.PI*2;

function softBox(w,h,d,seed=1) {
  const shape=new THREE.Shape(),r=Math.min(.045,w*.14,h*.16,d*.16),x=-w/2,y=-h/2;
  shape.moveTo(x+r,y);shape.lineTo(x+w-r,y);shape.quadraticCurveTo(x+w,y,x+w,y+r);shape.lineTo(x+w,y+h-r);shape.quadraticCurveTo(x+w,y+h,x+w-r,y+h);shape.lineTo(x+r,y+h);shape.quadraticCurveTo(x,y+h,x,y+h-r);shape.lineTo(x,y+r);shape.quadraticCurveTo(x,y,x+r,y);
  const g=new THREE.ExtrudeGeometry(shape,{depth:Math.max(.004,d-r*2),bevelEnabled:true,bevelSize:r*.7,bevelThickness:r,bevelSegments:3,steps:1,curveSegments:5});g.translate(0,0,-d/2+r);
  const p=g.attributes.position;
  for(let i=0;i<p.count;i++){const px=p.getX(i),py=p.getY(i),pz=p.getZ(i);p.setXYZ(i,px+Math.sin(pz*4+py*3+seed)*.005,py+Math.sin(px*5+pz*2+seed)*.006,pz+Math.sin(px*4+py*3+seed)*.005);}
  g.computeVertexNormals();return g;
}
function oval(b,p,s,m,seed=0) {
  const g=new THREE.SphereGeometry(1,28,18),v=g.attributes.position;
  for(let i=0;i<v.count;i++){const x=v.getX(i),y=v.getY(i),z=v.getZ(i),n=1+.018*Math.sin(x*6+y*4+z*3+seed);v.setXYZ(i,x*n,y*n,z*n);}
  g.computeVertexNormals();b.add(g,m,p,[0,0,0],s);
}
function stroke(b,points,r,m,end=r*.7){b.add(tube(points,r,end,Math.max(10,points.length*5),7),m);}

export function makeJourneyPalette(palette) {
  const cloth=palette.inkMaterial('#abaea5',.3,0,1,.0024,0,'cloth');cloth.uniforms.uStrength.value=.23;
  const paper=palette.inkMaterial('#dcded4',.2,0,1,.0024,0,'cloth');paper.uniforms.uStrength.value=.12;
  const horse=palette.inkMaterial('#b1b1a7',.3,0,1,.0024,0,'cloth');horse.uniforms.uStrength.value=.44;
  const coat=document.createElement('canvas');coat.width=coat.height=512;const cc=coat.getContext('2d');cc.fillStyle='#c2c5bb';cc.fillRect(0,0,512,512);
  for(let i=0;i<1700;i++){const x=(Math.sin(i*41.73)*.5+.5)*512,y=(Math.sin(i*83.19+2)*.5+.5)*512;cc.strokeStyle=`rgba(99,116,98,${.025+(i%7)*.006})`;cc.lineWidth=.6+(i%4)*.6;cc.beginPath();cc.moveTo(x,y);cc.quadraticCurveTo(x+4,y+8,x+Math.sin(i)*5,y+13+i%23);cc.stroke();}
  for(let i=0;i<70;i++){const x=(Math.sin(i*59.3)*.5+.5)*512,y=(Math.sin(i*19.7)*.5+.5)*512;const wash=cc.createRadialGradient(x,y,1,x,y,30+i%40);wash.addColorStop(0,'rgba(105,119,105,.08)');wash.addColorStop(1,'rgba(105,119,105,0)');cc.fillStyle=wash;cc.fillRect(x-70,y-70,140,140);}
  const coatTexture=new THREE.CanvasTexture(coat);coatTexture.colorSpace=THREE.SRGBColorSpace;coatTexture.wrapS=coatTexture.wrapT=THREE.RepeatWrapping;palette.ready.then(()=>{horse.uniforms.uPigment.value=coatTexture;});
  const dark=palette.inkMaterial('#535c56',.4,0,1,.0024,0,'wood');dark.uniforms.uStrength.value=.20;
  return {...palette,cloth,paper,horse,dark};
}

export function buildWagon(p) {
  const rig=new THREE.Group();rig.name='路邊木車與馬・面向出口';
  const body=new THREE.Group(),b=new BrushBatch(),wood=p.hullMaterial,dark=p.dark;
  const plank=(w,h,d,at,rot=[0,0,0])=>b.add(softBox(w,h,d),wood,at,rot);
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
    const ring=radius=>Array.from({length:65},(_,i)=>[0,Math.sin(i/64*TAU)*radius,Math.cos(i/64*TAU)*radius]);
    wb.add(tube(ring(.73),.072,.072,64,8),wood);wb.add(tube(ring(.76),.018,.018,64,5),dark);
    for(let i=0;i<12;i++){const a=i/12*TAU;stroke(wb,[[0,0,0],[0,Math.sin(a)*.37,Math.cos(a)*.37],[0,Math.sin(a)*.68,Math.cos(a)*.68]],.028,wood);}
    oval(wb,[0,0,0],[.14,.12,.12],dark);wb.finish(wheel,'手繪木輪・輪輻');body.add(wheel);wheels.push(wheel);
  }
  // Two curved bows support a light, irregular cloth roof, with an open rear.
  for(const z of [-.65,1.1]) {
    const arch=Array.from({length:19},(_,i)=>{const a=i/18*Math.PI;return [-1.06*Math.cos(a),1.98+Math.sin(a)*.88,z];});
    stroke(b,arch,.027,wood);
  }
  const roofPos=[],roofUV=[],roofI=[],nr=22,nz=12;
  for(let j=0;j<=nz;j++)for(let i=0;i<=nr;i++){
    const a=i/nr*Math.PI,z=-.72+j/nz*1.92;
    roofPos.push(-1.09*Math.cos(a),1.99+Math.sin(a)*.89+.017*Math.sin(i*1.8+z*3),z);
    roofUV.push(i/nr*1.7,j/nz);
    if(i<nr&&j<nz){const q=j*(nr+1)+i,t=q+nr+1;roofI.push(q,t,q+1,q+1,t,t+1);}
  }
  const roof=new THREE.BufferGeometry();roof.setAttribute('position',new THREE.Float32BufferAttribute(roofPos,3));roof.setAttribute('uv',new THREE.Float32BufferAttribute(roofUV,2));roof.setIndex(roofI);roof.computeVertexNormals();b.add(roof,p.paper);
  for(const x of [-1.05,1.05])stroke(b,[[x,1.99,-.70],[x*1.01,1.96,.2],[x,2,1.2]],.018,p.cloth);
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
  return {rig,body,horse,wheels};
}

function buildHorse(p) {
  const group=new THREE.Group(),b=new BrushBatch(),m=p.horse,dark=p.dark;
  // Soft continuous muscles overlap along their natural folds; fine brush contours describe joints.
  oval(b,[0,1.39,-.15],[.46,.60,1.04],m,1);
  oval(b,[0,1.49,.48],[.43,.56,.48],m,2);oval(b,[0,1.44,-.84],[.44,.52,.48],m,3);
  const neck=new THREE.Group(),nb=new BrushBatch();
  oval(nb,[0,2.02,.69],[.28,.72,.39],m,4);nb.finish(neck,'馬頸淡墨');neck.rotation.x=.26;neck.position.set(0,.22,-.35);group.add(neck);
  oval(b,[0,2.43,1.03],[.25,.37,.40],m,5);oval(b,[0,2.22,1.35],[.235,.23,.38],m,6);
  // Jaw and muzzle wash, nostrils, eyes, long ears and a broken ink mane.
  oval(b,[0,2.15,1.59],[.23,.16,.18],p.cloth);
  for(const side of [-1,1]){
    oval(b,[side*.225,2.47,1.14],[.021,.027,.035],dark);
    oval(b,[side*.21,2.21,1.65],[.016,.032,.042],dark);
    oval(b,[side*.15,2.78,.91],[.062,.16,.085],m);
    stroke(b,[[side*.15,2.73,.98],[side*.15,2.87,.94]],.017,dark,.006);
    // Four legs have shoulders, knees, sloping pasterns and softened hooves.
    for(const end of [-1,1]){
      const z=end>0?.57:-.91,lean=end>0?.05:-.10,offset=side>0?.10:-.09;
      stroke(b,[[side*.30,1.50,z],[side*.32,.93,z+lean],[side*.31,.70,z+lean+offset]],.125,m,.073);
      stroke(b,[[side*.31,.76,z+lean+offset],[side*.30,.31,z+.09+offset],[side*.30,.13,z+.17+offset]],.067,m,.047);
      oval(b,[side*.30,.10,z+.23+offset],[.095,.09,.155],dark);
      stroke(b,[[side*.36,1.18,z+.02],[side*.36,.82,z+lean+offset]],.009,p.cloth,.006);
    }
  }
  for(let i=0;i<17;i++){
    const a=i/16,y=2.67-a*.90,z=.91-a*.58;
    stroke(b,[[0,y,z],[.025*Math.sin(i),y-.08,z-.055],[.055*Math.sin(i*.8),y-.22-Math.sin(i)*.025,z-.105]],.016,dark,.004);
  }
  for(let i=0;i<14;i++)stroke(b,[[.06*Math.sin(i),1.64,-1.10],[.10*Math.sin(i),1.13,-1.40],[.12*Math.sin(i*.7),.54,-1.34-i*.012]],.016,dark,.003);
  // Bridle, breast collar and saddlecloth: actual narrow straps, not painted rectangles.
  stroke(b,[[-.25,2.30,1.45],[0,2.33,1.54],[.25,2.30,1.45]],.018,dark);
  for(const side of [-1,1]){
    stroke(b,[[side*.24,2.25,1.43],[side*.26,2.57,1.06],[side*.15,2.70,.90]],.017,dark);
    stroke(b,[[side*.40,1.60,.52],[side*.28,1.34,.94],[0,1.26,1.04]],.035,p.cloth);
    stroke(b,[[side*.24,2.28,1.4],[side*.63,1.78,.1],[side*.82,1.68,-2.8]],.010,dark,.008);
  }
  stroke(b,[[-.41,1.50,-.3],[-.35,1.93,-.3],[0,1.99,-.3],[.35,1.93,-.3],[.41,1.50,-.3]],.035,p.cloth);
  // Snow caught on the back dissolves into the coat through fine narrow traces.
  for(let i=0;i<7;i++)stroke(b,[[.06*Math.sin(i),1.99,-.78+i*.15],[.12,2.0,-.74+i*.15]],.017,p.snowMaterial,.004);
  b.finish(group,'馬・乾筆毛色與鬃毛');return group;
}

function paperSurface(p,map=false) {
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=384;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#d7d9cf';ctx.fillRect(0,0,512,384);
  for(let i=0;i<1800;i++){const x=(Math.sin(i*71.3)*.5+.5)*512,y=(Math.sin(i*31.7)*.5+.5)*384;ctx.fillStyle=`rgba(65,76,70,${.015+(i%4)*.007})`;ctx.fillRect(x,y,1+i%3,1);}
  ctx.strokeStyle='rgba(68,80,73,.58)';ctx.lineWidth=2.2;ctx.lineCap='round';
  if(map){
    for(const [x,y] of [[110,85],[170,160],[325,90],[385,245]]){ctx.beginPath();ctx.moveTo(x-35,y+30);ctx.quadraticCurveTo(x-9,y-8,x,y-25);ctx.quadraticCurveTo(x+18,y+10,x+39,y+30);ctx.stroke();}
    ctx.setLineDash([8,8]);ctx.beginPath();ctx.moveTo(95,70);ctx.bezierCurveTo(220,80,170,240,280,285);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(240,220);ctx.quadraticCurveTo(300,250,395,310);ctx.stroke();ctx.font='32px "Kaiti TC",serif';ctx.fillStyle='#4d5850';ctx.fillText('長安',40,50);ctx.fillText('邵州',225,337);ctx.fillText('永州',360,365);ctx.beginPath();ctx.moveTo(240,295);ctx.lineTo(310,325);ctx.moveTo(305,295);ctx.lineTo(245,325);ctx.stroke();
  }else{
    ctx.font='24px "Kaiti TC",serif';ctx.fillStyle='rgba(70,79,71,.70)';for(let c=0;c<5;c++)for(let r=0;r<7;r++){ctx.fillText('山水故人遠行珍重'[ (c*7+r)%8],420-c*65,55+r*40);}
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
  return new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,color:'#f3f3e9',toneMapped:false});
}
export function buildLuggage(id,p) {
  const group=new THREE.Group(),b=new BrushBatch(),dark=p.dark;
  if(id==='books'){
    oval(b,[0,.32,0],[.44,.38,.30],p.cloth);
    for(let i=0;i<3;i++)b.add(softBox(.51,.08,.32,i),p.paper,[.05,.61+i*.056,.01],[0,.10,0]);
    stroke(b,[[-.35,.22,-.2],[0,.69,-.22],[.31,.24,-.21]],.027,dark);
    stroke(b,[[-.12,.67,0],[-.32,.91,0],[.25,.90,.03],[.12,.67,0]],.022,p.cloth);
  }else if(id==='hat'){
    oval(b,[0,.25,0],[.36,.28,.30],dark);
    const brim=new THREE.TorusGeometry(.31,.038,8,36);b.add(brim,dark,[0,.07,0],[Math.PI/2,0,0],[1.18,1,1]);
    for(const side of [-1,1])stroke(b,[[side*.23,.10,-.16],[side*.38,.12,-.36],[side*.48,.10,-.52]],.038,dark,.015);
  }else if(id==='scroll'){
    b.add(new THREE.CylinderGeometry(.115,.12,.88,24),p.hullMaterial,[0,.15,0],[Math.PI/2,0,.2]);
    for(const z of [-.43,.43])oval(b,[0,.15,z],[.13,.13,.035],dark);
    stroke(b,[[-.12,.18,-.09],[0,.30,-.09],[.12,.18,-.09],[0,.035,-.09],[-.12,.18,-.09]],.016,p.cloth);
  }else if(id==='decree'||id==='farewell'){
    b.add(softBox(.61,.075,.38),id==='farewell'?p.cloth:p.paper,[0,.09,0],[0,-.13,0]);
    stroke(b,[[-.29,.13,0],[0,.15,0],[.29,.13,0]],.012,dark);
    stroke(b,[[0,.14,-.19],[0,.15,.19]],.013,dark);
    if(id==='farewell'){stroke(b,[[-.05,.15,0],[-.16,.21,.09],[-.13,.24,-.03],[.06,.15,0],[.17,.23,-.06],[.15,.20,.07]],.011,dark);}
  }else if(id==='map'){
    const geo=new THREE.PlaneGeometry(.88,.67,20,16),v=geo.attributes.position;
    for(let i=0;i<v.count;i++){const x=v.getX(i),y=v.getY(i);v.setZ(i,.018*Math.sin(x*18)+.024*Math.sin(y*10+x*3));}geo.computeVertexNormals();
    const sheet=new THREE.Mesh(geo,paperSurface(p,true));sheet.rotation.x=-Math.PI/2;sheet.position.y=.07;group.add(sheet);
    for(const x of [-.45,.45])b.add(new THREE.CylinderGeometry(.026,.026,.72,10),p.hullMaterial,[x,.07,0],[Math.PI/2,0,0]);
  }
  b.finish(group,`行李・${id}`);return group;
}
export function buildDeadBranch(p){
  const g=new THREE.Group(),b=new BrushBatch();
  stroke(b,[[-.65,.10,-.3],[-.25,.18,-.03],[.3,.22,.14],[.72,.32,.32]],.055,p.branchMaterial,.015);
  stroke(b,[[-.1,.2,.04],[.1,.35,-.25],[.36,.38,-.44]],.026,p.branchMaterial,.008);
  stroke(b,[[.26,.21,.12],[.23,.38,.43],[.38,.43,.56]],.023,p.branchMaterial,.006);
  stroke(b,[[-.45,.15,-.16],[-.15,.24,-.02],[.2,.26,.12]],.022,p.snowMaterial,.006);b.finish(g,'覆雪枯枝');return g;
}
