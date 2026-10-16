import * as THREE from './vendor/three.module.js';
import { BrushBatch, tube } from './props.js?v=1.0.0';
import { brushRibbon } from './journey-props.js?v=1.0.0';
import { createRigPaint } from './painted-rig.js?v=1.0.0';
import { createBirdRoute, routeLength } from './bird-route.js?v=1.0.0';
import { flightLength, pointOnFlight, advanceFlight, flightEase } from './perch-flight.js?v=1.0.0';

function buildInkBird(){
  const root=new THREE.Group(),p=createRigPaint(),body=new BrushBatch();root.name='幾筆墨鳥・落足停棲';
  // A comma, a head dash, two broken wing strokes and a tail flick. No solid feather fan.
  body.add(brushRibbon([[0,.085,-.062],[0,.135,-.005],[0,.164,.065]],.073,6),p.stroke);
  body.add(tube([[0,.10,-.03],[0,.143,.015],[0,.16,.060]],.013,.005,19,7),p.hat);
  body.add(brushRibbon([[0,.183,.052],[0,.194,.085],[0,.184,.126]],.045,12),p.stroke);
  body.add(brushRibbon([[0,.112,-.045],[.015,.105,-.12],[.035,.091,-.19]],.044,32),p.stroke);
  for(const side of [-1,1]){
    body.add(tube([[side*.022,.095,-.016],[side*.027,.027,.003],[side*.026,.006,.035]],.0027,.001,12,5),p.dark);
    body.add(tube([[side*.026,.006,.035],[side*.048,.005,.045]],.0018,.0006,7,5),p.dark);
  }
  body.finish(root,'墨點與細足');
  const wings=[];
  for(const side of [-1,1]){
    const wing=new THREE.Group(),b=new BrushBatch();wing.position.set(side*.022,.144,.005);
    b.add(brushRibbon([[0,0,0],[side*.103,.041,-.016],[side*.215,.045,-.12]],.084,side+16),p.stroke);
    b.add(brushRibbon([[side*.055,.01,-.023],[side*.142,.025,-.09],[side*.19,.013,-.16]],.034,side+26),p.stroke);
    b.finish(wing,'一劃飛白翼');root.add(wing);wings.push({wing,side});
  }
  return {root,wings};
}
export function createInkBird({scene,journey,canWalk,heightAt,roads,spawn}){
  const planner=createBirdRoute({canWalk,heightAt,roads}),bird=buildInkBird();scene.add(bird.root);
  let mode='perched',destination='wagon',targetId=null,progress=1,duration=1,points=[],length=0,opening=0,failedRoutes=0;
  let sourceGround={...journey.depositPosition},target=journey.birdDestination();
  function seed(){
    const goal=journey.birdDestination();
    // The player starts behind the cart and sees the first departure from its rear post.
    const saved=journey.wagon.body.getObjectByName('墨鳥停棲・車後立柱');scene.updateMatrixWorld(true);
    bird.root.position.copy(saved.getWorldPosition(new THREE.Vector3()));bird.root.rotation.set(0,Math.PI,0);bird.root.visible=true;
    sourceGround={...journey.depositPosition};target={key:'wagon',position:bird.root.position.clone(),ground:sourceGround,yaw:Math.PI};destination='wagon';targetId=null;mode='perched';progress=1;points=[];length=0;opening=0;failedRoutes=0;foldWings();
  }
  function foldWings(){for(const {wing,side} of bird.wings){wing.rotation.y=side*1.2;wing.rotation.z=-side*.12;}}
  function depart(goal){
    const land=planner.find(sourceGround,goal.ground);
    if(!land.length){failedRoutes++;return false;}
    const start=bird.root.position.clone(),end=goal.position;
    points=[{x:start.x,y:start.y,z:start.z},{x:start.x,y:Math.max(start.y+1.0,heightAt(start.x,start.z)+3.5),z:start.z},
      ...land.map(p=>({x:p.x,y:Math.max(heightAt(p.x,p.z)+3.5,start.y+.65*(1-Math.min(1,Math.hypot(p.x-start.x,p.z-start.z)/4))),z:p.z})),
      {x:end.x,y:Math.max(end.y+1.0,heightAt(end.x,end.z)+3.2),z:end.z},{x:end.x,y:end.y,z:end.z}];
    length=flightLength(points);duration=THREE.MathUtils.clamp(length/6.5,3.4,22);progress=0;target=goal;destination=goal.key;targetId=goal.id;mode='flying';return true;
  }
  function update(dt,time,player,playing){
    if(!playing)return;
    const goal=journey.birdDestination();
    if(goal.key==='finished'){mode='finished';foldWings();return;}
    opening+=dt;if(opening<.8)return;
    if(goal.key!==destination&&opening>.8)depart(goal);
    if(mode==='flying'){
      progress=advanceFlight(progress,dt,duration,true);
      const t=flightEase(progress),at=pointOnFlight(points,t),ahead=pointOnFlight(points,Math.min(1,t+.004));
      bird.root.position.set(at.x,at.y,at.z);
      const dx=ahead.x-at.x,dz=ahead.z-at.z;
      if(Math.hypot(dx,dz)>.001){const yaw=Math.atan2(dx,dz);bird.root.rotation.y+=Math.atan2(Math.sin(yaw-bird.root.rotation.y),Math.cos(yaw-bird.root.rotation.y))*Math.min(1,dt*10);}
      const landing=THREE.MathUtils.smoothstep(progress,.86,.98),flap=Math.sin(time*13.0)*.72;
      for(const {wing,side} of bird.wings){wing.rotation.y=side*1.2*landing;wing.rotation.z=side*THREE.MathUtils.lerp(.13+flap,-.12,landing);}
      if(progress===1){mode='perched';sourceGround={...target.ground};bird.root.position.copy(goal.position);bird.root.rotation.y=goal.yaw;foldWings();}
    }else{
      // The feet remain on their real branch, stone or cart post. No hovering or player leash.
      target=goal;bird.root.position.copy(goal.position);bird.root.rotation.y=goal.yaw+Math.sin(time*.49)*.035;foldWings();
    }
  }
  seed();
  return {update,reset:seed,
    getState:()=>({mode,targetId,destination,waiting:mode==='perched',x:bird.root.position.x,y:bird.root.position.y,z:bird.root.position.z,feetY:bird.root.position.y,perchY:target.position.y,wingAngle:bird.wings[0].wing.rotation.z,routeLength:length,routeProgress:progress,routeNodes:points.length,failedRoutes,graphNodes:planner.nodeCount,span:.474}),
    routeTo:(from,to)=>planner.find(from,to).map(p=>({...p,y:heightAt(p.x,p.z)})),
    inspectRoutes:()=>journey.items.flatMap(item=>[
      {item:item.id,direction:'to-item',points:planner.find(journey.depositPosition,item)},
      {item:item.id,direction:'to-wagon',points:planner.find(item,journey.depositPosition)},
    ]).map(leg=>({...leg,length:routeLength(leg.points),valid:leg.points.length>1&&leg.points.every((p,i)=>canWalk(p.x,p.z)&&(!i||planner.clear(leg.points[i-1],p)))})),
  };
}
