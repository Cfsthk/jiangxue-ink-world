import * as THREE from './vendor/three.module.js';
import { createBirdRoute, routeLength, pointOnRoute, nearestRouteDistance } from './bird-route.js?v=1.4.0';

// The trail visits all five keepsakes before taking the full collection to the cart.
export function inkTrailDestination(state,items,depositPosition){
  if(state.complete)return null;
  if(state.readyToReturn)return {key:'wagon',id:null,x:depositPosition.x,z:depositPosition.z};
  const item=items.find(item=>item.id===state.activeId);
  return item?{key:`item:${item.id}`,id:item.id,x:item.x,z:item.z}:null;
}

// Read-only audit of the actual six walking legs, including the final return.
export function inkTrailLegs(items,spawn,depositPosition){
  return [...items.map((item,index)=>({item:item.id,direction:'to-item',from:index?items[index-1]:spawn,to:item})),
    ...(items.length?[{item:'wagon',direction:'to-wagon',from:items.at(-1),to:depositPosition}]:[])];
}

function washTexture(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d');
  // Overlapping wet dabs keep their broken, feathery margin at every angle.
  for(let i=0;i<24;i++){
    const angle=i*2.39996323,r=4+Math.sqrt(i)*4.1;
    const x=64+Math.cos(angle)*r,y=64+Math.sin(angle)*r*.77,size=16+(i%5)*2.4;
    const wash=ctx.createRadialGradient(x,y,size*.10,x,y,size);
    wash.addColorStop(0,'rgba(39,48,48,.20)');wash.addColorStop(.38,'rgba(43,51,50,.15)');wash.addColorStop(.75,'rgba(48,56,54,.055)');wash.addColorStop(1,'rgba(48,56,54,0)');
    ctx.fillStyle=wash;ctx.fillRect(x-size,y-size,size*2,size*2);
  }
  // A few dry brush fibres stop the middle reading as a manufactured disc.
  ctx.lineCap='round';
  for(let i=0;i<13;i++){
    ctx.strokeStyle=`rgba(35,43,43,${.055+(i%4)*.018})`;ctx.lineWidth=.8+(i%3)*.5;
    ctx.beginPath();ctx.moveTo(39+i*3.5,45+(i%4)*3.4);ctx.quadraticCurveTo(51+i*1.2,58,52+i*2.1,82-(i%5)*3);ctx.stroke();
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=4;texture.needsUpdate=true;return texture;
}

function trailMaterial(){
  const material=new THREE.MeshBasicMaterial({map:washTexture(),color:0xffffff,transparent:true,opacity:.88,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,side:THREE.DoubleSide,fog:true});
  const uniforms={along:{value:0},clock:{value:0}};
  material.onBeforeCompile=shader=>{
    shader.uniforms.uTrailAlong=uniforms.along;shader.uniforms.uTrailClock=uniforms.clock;
    shader.vertexShader=`attribute float trailAlong; varying float vTrailAlong;\n${shader.vertexShader}`.replace('#include <begin_vertex>','#include <begin_vertex>\nvTrailAlong = trailAlong;');
    shader.fragmentShader=`uniform float uTrailAlong; uniform float uTrailClock; varying float vTrailAlong;\n${shader.fragmentShader}`.replace('#include <map_fragment>',`#include <map_fragment>
      float ahead = vTrailAlong - uTrailAlong;
      float behindFade = smoothstep(-1.25, 0.15, ahead);
      float distantFade = 1.0 - 0.35 * smoothstep(12.0, 46.0, ahead);
      float inkBreath = 0.94 + 0.06 * sin(vTrailAlong * 0.68 - uTrailClock * 0.65);
      diffuseColor.a *= behindFade * distantFade * inkBreath;`);
  };
  material.customProgramCacheKey=()=> 'ground-ink-dabs-v1';
  return {material,uniforms};
}

function dotGeometry(path,heightAt,canWalk){
  const positions=[],uvs=[],distances=[],indices=[];
  const length=routeLength(path),spacing=1.04,segments=4;
  let dots=0;
  for(let along=.72;along<length-.10;along+=spacing){
    const center=pointOnRoute(path,along);if(!center||!canWalk(center.x,center.z))continue;
    const phase=dots*2.39996323,angle=phase+.45*Math.sin(dots*1.77);
    const sx=.35+.065*Math.sin(dots*1.67),sz=.33+.055*Math.cos(dots*2.13),cos=Math.cos(angle),sin=Math.sin(angle);
    // Small ground-conforming patches follow snow slopes without hovering or clipping.
    const first=positions.length/3;
    for(let row=0;row<=segments;row++)for(let col=0;col<=segments;col++){
      const u=col/segments,v=row/segments,px=(u-.5)*sx,pz=(v-.5)*sz;
      const x=center.x+px*cos-pz*sin,z=center.z+px*sin+pz*cos;
      positions.push(x,heightAt(x,z)+.046,z);uvs.push(u,v);distances.push(along);
    }
    for(let row=0;row<segments;row++)for(let col=0;col<segments;col++){
      const a=first+row*(segments+1)+col,b=a+1,c=a+segments+1,d=c+1;
      indices.push(a,c,b,b,c,d);
    }
    dots++;
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setAttribute('trailAlong',new THREE.Float32BufferAttribute(distances,1));geometry.setIndex(indices);geometry.computeBoundingSphere();
  return {geometry,dots};
}

export function createInkTrail({scene,journey,canWalk,heightAt,roads=[],spawn}){
  // A finer grid and stronger road cost keep the dots in the painted bends;
  // only the last approach leaves the road for a hidden object.
  const planner=createBirdRoute({canWalk,heightAt,roads,step:1,roadBias:8,roadMargin:.65}),{material,uniforms}=trailMaterial();
  const mesh=new THREE.Mesh(new THREE.BufferGeometry(),material);mesh.name='雪路上的淡墨點';mesh.renderOrder=2;mesh.visible=false;scene.add(mesh);
  let destination=null,targetId=null,path=[],length=0,dots=0,failedRoutes=0,replans=0,along=0,cooldown=0,clock=0;
  function makeRoute(from,goal){
    destination=goal?.key??'finished';targetId=goal?.id??null;along=0;uniforms.along.value=0;
    path=goal?planner.find(from,goal):[];length=routeLength(path);dots=0;cooldown=2;
    mesh.geometry.dispose();
    if(path.length>1){const batch=dotGeometry(path,heightAt,canWalk);mesh.geometry=batch.geometry;dots=batch.dots;}
    else {mesh.geometry=new THREE.BufferGeometry();if(goal)failedRoutes++;}
    mesh.visible=dots>0;replans++;
  }
  function reset(start=spawn){
    failedRoutes=0;replans=0;clock=0;uniforms.clock.value=0;
    makeRoute(start,inkTrailDestination(journey.getState(),journey.items,journey.depositPosition));
  }
  function update(dt,time,player,playing){
    const goal=inkTrailDestination(journey.getState(),journey.items,journey.depositPosition);
    // Task changes apply even while its story is open; only breathing and replans pause.
    if((goal?.key??'finished')!==destination)makeRoute(player,goal);
    if(!playing)return;
    clock+=dt;uniforms.clock.value=clock;cooldown=Math.max(0,cooldown-dt);
    if(goal&&cooldown===0){
      const nearest=nearestRouteDistance(path,player);
      if(!path.length||nearest.distance>3.8)makeRoute(player,goal);
    }
    if(path.length>1){along=nearestRouteDistance(path,player).along;uniforms.along.value=along;}
  }
  reset();
  return {update,reset,
    getState:()=>({mode:destination==='finished'?'finished':dots?'marked':'blocked',destination,targetId,dots,routeLength:length,routeProgress:length?along/length:0,routeNodes:path.length,failedRoutes,replans,graphNodes:planner.nodeCount,groundOffset:.046,points:path.map(p=>({...p,y:heightAt(p.x,p.z)}))}),
    routeTo:(from,to)=>planner.find(from,to).map(p=>({...p,y:heightAt(p.x,p.z)})),
    inspectRoutes:()=>inkTrailLegs(journey.items,spawn,journey.depositPosition).map(leg=>{const points=planner.find(leg.from,leg.to);return {...leg,points,length:routeLength(points),valid:points.length>1&&points.every((p,i)=>canWalk(p.x,p.z)&&(!i||planner.clear(points[i-1],p)))};}),
  };
}
