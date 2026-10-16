import * as THREE from './vendor/three.module.js';
import { LUGGAGE, createJourneyState } from './journey-state.js?v=1.4.0';
import { makeJourneyPalette, buildWagon, buildLuggage, buildDeadBranch } from './journey-props.js?v=1.4.0';
import { paintDiagnostics } from './painted-rig.js?v=1.4.0';
import { buildWinterPlant, BrushBatch, tube } from './props.js?v=1.4.0';
import { OUTWARD_PASS } from './landscape-shape.js?v=1.4.0';
export const WAGON_SITE=Object.freeze({x:OUTWARD_PASS.x,z:OUTWARD_PASS.z,yaw:0});
export const JOURNEY_SPAWN=Object.freeze({x:-27.8,z:54.5,yaw:Math.PI,pitch:-.025});
const ease=t=>t*t*(3-2*t);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function contactWash(scene,x,z,rx,rz,heightAt) {
  const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),gradient=ctx.createRadialGradient(64,64,5,64,64,62);
  gradient.addColorStop(0,'rgba(74,86,78,.45)');gradient.addColorStop(.4,'rgba(81,90,83,.25)');gradient.addColorStop(1,'rgba(81,90,83,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
  const g=new THREE.PlaneGeometry(rx*2,rz*2,10,12),p=g.attributes.position;
  for(let i=0;i<p.count;i++){const px=x+p.getX(i),pz=z+p.getY(i);p.setXYZ(i,px,heightAt(px,pz)+.019,pz);}g.computeVertexNormals();
  const texture=new THREE.CanvasTexture(c);const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide,opacity:.57}));scene.add(mesh);
}

export function createJourney({scene,palette,heightAt,collisions}) {
  const p=makeJourneyPalette(palette),state=createJourneyState(),sites=new Map();
  const wagon=buildWagon(p);wagon.rig.position.set(WAGON_SITE.x,heightAt(WAGON_SITE.x,WAGON_SITE.z),WAGON_SITE.z);
  // Terrain grade is shared by cart wheels and horse hooves; no floating feet.
  wagon.body.rotation.z=Math.atan2(heightAt(WAGON_SITE.x+1.27,WAGON_SITE.z)-heightAt(WAGON_SITE.x-1.27,WAGON_SITE.z),2.54);
  wagon.body.rotation.x=-Math.atan2(heightAt(WAGON_SITE.x,WAGON_SITE.z+1.3)-heightAt(WAGON_SITE.x,WAGON_SITE.z-1.3),2.6);
  wagon.horse.position.y=heightAt(WAGON_SITE.x,WAGON_SITE.z+4.9)-wagon.rig.position.y-.03;
  wagon.horse.rotation.z=Math.atan2(heightAt(WAGON_SITE.x+.34,WAGON_SITE.z+4.9)-heightAt(WAGON_SITE.x-.34,WAGON_SITE.z+4.9),.68);
  wagon.horse.rotation.x=-Math.atan2(heightAt(WAGON_SITE.x,WAGON_SITE.z+5.8)-heightAt(WAGON_SITE.x,WAGON_SITE.z+4),1.8);
  scene.add(wagon.rig);contactWash(scene,WAGON_SITE.x,WAGON_SITE.z,1.6,2.1,heightAt);contactWash(scene,WAGON_SITE.x,WAGON_SITE.z+4.9,.9,1.4,heightAt);
  for(const [dz,r] of [[-1.05,1.77],[.6,1.78],[2,1.7],[4.5,.72],[5.8,.64]])collisions.push({x:WAGON_SITE.x,z:WAGON_SITE.z+dz,r});
  const depositPosition=new THREE.Vector3(WAGON_SITE.x,heightAt(WAGON_SITE.x,WAGON_SITE.z-3),WAGON_SITE.z-3);
  const cargo=new THREE.Group();wagon.body.add(cargo);
  let working=null,elapsed=0,lastCompleted=null;

  LUGGAGE.forEach((data,index)=>{
    const root=new THREE.Group();root.name=`尋物地點・${data.name}`;root.position.set(data.x,heightAt(data.x,data.z),data.z);scene.add(root);
    const item=new THREE.Group(),model=buildLuggage(data.id,p);
    // Keep reveal and cargo transforms outside the true-to-scale painted model.
    model.scale.setScalar(data.id==='hat'?.80:.84);item.add(model);item.rotation.y=index*.52+.2;root.add(item);
    const cover=new THREE.Group();root.add(cover);
    const coverBase=new THREE.Vector3(),itemBase=new THREE.Vector3();
    if(data.id==='hat'){
      const tree=new THREE.Group(),branches=new BrushBatch();
      branches.add(tube([[0,-.12,0],[.07,.8,-.03],[-.12,1.65,.06],[.03,2.35,0],[.08,2.95,.04]],.14,.018,48,12),p.branchMaterial);
      for(let i=0;i<7;i++){
        const y=.65+i*.29,side=i%2?1:-1,end=[side*(.56+.15*Math.sin(i)),y+.34,Math.sin(i*2)*.34];
        branches.add(tube([[0,y,0],[side*.24,y+.08,end[2]*.3],end],.045,.007,22,9),p.branchMaterial);
        branches.add(tube([[side*.15,y+.085,end[2]*.2],[side*.30,y+.16,end[2]*.42],[end[0]*.84,end[1]-.03,end[2]*.85]],.025,.005,16,8),p.snowMaterial);
        branches.add(tube([[end[0]*.55,y+.18,end[2]*.55],[end[0]*.69,y+.43,end[2]*.70],[end[0]*.82,y+.61,end[2]*.8]],.017,.003,16,7),p.branchMaterial);
      }
      branches.add(tube([[-.11,.1,.02],[-.28,-.03,.08],[-.43,-.09,.2]],.06,.006,16,8),p.branchMaterial);
      branches.finish(tree,'掛帽冬樹・圓筆積雪');tree.position.set(-.60,-.04,-.65);cover.add(tree);item.position.set(-.10,2.02,-.25);item.rotation.z=.35;
      collisions.push({x:data.x-.60,z:data.z-.65,r:.32});
    }else if(data.id==='scroll'){
      const rock=new THREE.Mesh(new THREE.SphereGeometry(1,26,18),p.withSnow(p.stoneMaterial,.62));rock.scale.set(.51,.35,.49);rock.position.set(.08,.24,.04);cover.add(rock);
      const v=rock.geometry.attributes.position;for(let i=0;i<v.count;i++){const x=v.getX(i),y=v.getY(i),z=v.getZ(i);const n=1+.08*Math.sin(x*4+z*3)*Math.sin(y*3+1);v.setXYZ(i,x*n,y*n,z*n);}rock.geometry.computeVertexNormals();
      for(const side of [-1,1]){const small=new THREE.Mesh(new THREE.SphereGeometry(1,20,14),p.stoneMaterial);small.scale.set(.20,.24,.28);small.position.set(side*.68,.15,-.12);root.add(small);}
    }else if(data.id==='decree'){
      const g=new THREE.PlaneGeometry(1.9,1.55,28,24),v=g.attributes.position,base=[],drift=[];
      for(let i=0;i<v.count;i++){
        const x=v.getX(i),z=v.getY(i),radial=Math.hypot(x/.87,z/.68),edge=1-THREE.MathUtils.smoothstep(radial,.30,1);
        const ground=heightAt(data.x+x,data.z+z)-root.position.y+.008;
        const depth=edge*edge*(.21+.035*Math.sin(x*8+z*5)+.018*Math.sin(z*14));
        base.push(ground);drift.push(depth);v.setXYZ(i,x,ground+depth,z);
      }
      const indices=g.index;for(let i=0;i<indices.count;i+=3){const a=indices.getX(i+1);indices.setX(i+1,indices.getX(i+2));indices.setX(i+2,a);}g.computeVertexNormals();
      const snowPaint=p.withSnow(p.snowMaterial,0);snowPaint.transparent=true;snowPaint.depthWrite=false;snowPaint.uniforms.uDigRemaining={value:1};
      snowPaint.fragmentShader='uniform float uDigRemaining;\n'+snowPaint.fragmentShader.replace('gl_FragColor=vec4(max(color,vec3(0.)),uOpacity);','float digEdge=1.-smoothstep(.44,.98,length((vBrushUv-.5)*vec2(2.1,2.2))+(noise(vWorld*5.)-.5)*.09); gl_FragColor=vec4(max(color,vec3(0.)),uOpacity*digEdge*uDigRemaining);');
      const snow=new THREE.Mesh(g,snowPaint);snow.userData.digBase=base;snow.userData.digDrift=drift;cover.add(snow);item.visible=false;
      const rope=new BrushBatch();rope.add(tube([[.13,.02,0],[.5,.03,.14],[.79,.06,.29]],.015,.011,14,6),p.cloth);rope.finish(cover,'雪中的繫帶');
    }else if(data.id==='map'){
      cover.add(buildDeadBranch(p));item.scale.x=.48;
    }else{
      for(let i=0;i<4;i++){const reed=buildWinterPlant(p,{kind:'reed',size:1.25+i*.13,seed:726+i*21,softSnow:true});reed.position.set((i-1.5)*.24,0,.12+Math.sin(i)*.15);cover.add(reed);}
      item.position.set(.05,.01,.07);
    }
    if(data.id!=='hat'){
      const epsilon=.25,dx=(heightAt(data.x+epsilon,data.z)-heightAt(data.x-epsilon,data.z))/(2*epsilon),dz=(heightAt(data.x,data.z+epsilon)-heightAt(data.x,data.z-epsilon))/(2*epsilon);
      const groundRotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(-dx,1,-dz).normalize());
      item.quaternion.premultiply(groundRotation);
      if(data.id==='map')cover.quaternion.copy(groundRotation);
    }
    const coverRotation=cover.rotation.clone();
    coverBase.copy(cover.position);itemBase.copy(item.position);
    contactWash(scene,data.x,data.z,.88,.77,heightAt);
    sites.set(data.id,{data,root,item,cover,coverBase,coverRotation,itemBase,itemRotation:item.rotation.clone(),itemScale:item.scale.clone()});
  });

  function candidate(player) {
    const returnDistance=Math.hypot(player.x-depositPosition.x,player.z-depositPosition.z);
    if(state.readyToReturn&&returnDistance<3.0&&Math.abs(player.y-1.65-depositPosition.y)<3.2)return {type:'wagon',root:wagon.rig,position:depositPosition,promptPosition:wagon.rig.position.clone().add(new THREE.Vector3(0,1.55,-1.65)),radius:3,label:'放回全部行李'};
    let best=null,distance=Infinity;
    for(const site of sites.values()){
      const {data}=site,s=state.status(data.id);if(['returned','collected','working'].includes(s)||!state.unlocked(data.id))continue;
      const d=Math.hypot(player.x-data.x,player.z-data.z),dy=Math.abs(player.y-1.65-site.root.position.y);
      if(d<2.8&&dy<3.5&&d<distance){distance=d;best={type:'luggage',id:data.id,root:site.root,position:site.root.position,promptPosition:site.root.position.clone().add(new THREE.Vector3(0,data.id==='hat'&&s==='covered'?1.65:.65,0)),radius:2.8,label:s==='ready'?`拾起${data.name}`:data.action};}
    }
    return best;
  }
  function act(target) {
    if(state.complete)return null;
    if(target.type==='wagon'){
      const ids=state.deposit();if(!ids)return null;
      for(const [index,id] of ids.entries()){
        const site=sites.get(id);cargo.add(site.item);site.item.visible=true;
        site.item.position.set(index%2===0?-.50:.48,1.33,-.98+Math.floor(index/2)*.54);
        site.item.rotation.set(0,index*.45-.4,0);site.item.scale.setScalar(id==='hat'?.77:.74);
      }
      lastCompleted='wagon';
      return {deposited:ids,complete:state.complete};
    }
    const site=sites.get(target.id);if(!site)return null;
    if(state.status(target.id)==='ready'){
      if(!state.pickup(target.id))return null;
      site.item.visible=false;
      return {picked:target.id,story:site.data};
    }
    if(working||!state.begin(target.id))return null;
    working=target.id;elapsed=0;return {working:target.id};
  }
  function update(dt,time,player) {
    if(working){
      const site=sites.get(working);elapsed+=dt;const t=clamp(elapsed/site.data.duration,0,1),e=ease(t);
      const {cover,item,data}=site;
      if(data.id==='hat'){
        cover.rotation.z=Math.sin(t*36)*(1-t)*.065;
        const fall=ease(clamp((t-.25)/.68,0,1));item.position.y=2.02*(1-fall)+.035*fall;item.position.x=-.1+.3*fall;item.rotation.z=.35-.19*fall;
      }
      if(data.id==='scroll'){cover.position.set(.72*e,Math.sin(t*Math.PI)*.30,.35*e);cover.rotation.z=-.9*e;}
      if(data.id==='decree'){
        const snow=cover.children[0],v=snow.geometry.attributes.position;
        for(let i=0;i<v.count;i++)v.setY(i,snow.userData.digBase[i]+snow.userData.digDrift[i]*(1-e));
        v.needsUpdate=true;snow.geometry.computeVertexNormals();snow.material.uniforms.uDigRemaining.value=1-ease(clamp((t-.60)/.40,0,1));item.visible=t>.40;
      }
      if(data.id==='map'){cover.position.set(.74*e,Math.sin(t*Math.PI)*.28,.37*e);cover.rotation.y=.72*e;item.scale.x=.48+.52*e;}
      if(data.id==='farewell'){cover.children.forEach((reed,i)=>{reed.rotation.z=(i<2?1:-1)*(.12+.43*e);});}
      if(t===1){state.reveal(working);lastCompleted=working;working=null;}
    }
    for(const site of sites.values()){
      const s=state.status(site.data.id);
      // Snow-bound grass moves only at the tips; this reed cover leans as a rooted clump.
      if(site.data.id==='farewell'&&s==='covered')site.cover.children.forEach((reed,i)=>{reed.rotation.z=Math.sin(time*.7+i)*.035;});
    }
    wagon.horse.scale.y=1+Math.sin(time*1.15)*.0015;

  }
  function reset() {
    state.reset();working=null;elapsed=0;lastCompleted=null;cargo.clear();
    wagon.rig.position.set(WAGON_SITE.x,heightAt(WAGON_SITE.x,WAGON_SITE.z),WAGON_SITE.z);wagon.horse.position.y=heightAt(WAGON_SITE.x,WAGON_SITE.z+4.9)-wagon.rig.position.y-.03;wagon.wheels.forEach(w=>w.rotation.x=0);
    for(const site of sites.values()){
      site.root.add(site.item);site.item.position.copy(site.itemBase);site.item.rotation.copy(site.itemRotation);site.item.scale.copy(site.itemScale);site.item.visible=site.data.id!=='decree';
      site.cover.position.copy(site.coverBase);site.cover.rotation.copy(site.coverRotation);site.cover.scale.set(1,1,1);site.cover.children.forEach(c=>c.rotation.z=0);
      if(site.data.id==='decree'){const snow=site.cover.children[0],v=snow.geometry.attributes.position;for(let i=0;i<v.count;i++)v.setY(i,snow.userData.digBase[i]+snow.userData.digDrift[i]);v.needsUpdate=true;snow.geometry.computeVertexNormals();snow.material.uniforms.uDigRemaining.value=1;}
    }
  }
  return {candidate,act,update,reset,ready:wagon.ready,focusPoint:()=>working?sites.get(working).item.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,.18,0)):null,items:LUGGAGE,wagon,spawn:JOURNEY_SPAWN,depositPosition,
    getState:()=>({...state.snapshot(),inventoryVisible:false,working,progress:working?clamp(elapsed/sites.get(working).data.duration,0,1):0,lastCompleted,art:{wagon:paintDiagnostics(wagon.body),horse:paintDiagnostics(wagon.horse),items:[...sites.values()].map(s=>({id:s.data.id,modelScale:s.item.children[0].scale.x,...paintDiagnostics(s.item)}))},wagon:{x:WAGON_SITE.x,z:WAGON_SITE.z,facing:'+z',returnX:depositPosition.x,returnZ:depositPosition.z}}),
  };
}
