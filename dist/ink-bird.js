import * as THREE from './vendor/three.module.js';
import { BrushBatch, tube } from './props.js?v=0.9.0';
import { createBirdRoute, routeLength, pointOnRoute, nearestRouteDistance } from './bird-route.js?v=0.9.0';

function buildInkBird(){
  const opacity={value:1};
  const material=new THREE.ShaderMaterial({name:'引路墨鳥・飛白羽緣',side:THREE.DoubleSide,transparent:true,depthWrite:false,toneMapped:false,
    uniforms:{uOpacity:opacity},
    vertexShader:`varying vec3 vInk;varying vec2 vUv;void main(){vInk=position;vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform float uOpacity;varying vec3 vInk;varying vec2 vUv;
      float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
      void main(){float grain=hash(floor(vInk*220.));float wash=.5+.5*sin(vInk.x*17.+vInk.z*11.);
        float edge=smoothstep(0.,.08,vUv.x)*smoothstep(0.,.08,1.-vUv.x);
        float a=uOpacity*mix(.66,.98,grain)*mix(.6,1.,edge);
        gl_FragColor=vec4(vec3(.095,.13,.118)+wash*.035+grain*.025,a);
        #include <colorspace_fragment>
      }`,
  });
  const root=new THREE.Group();root.name='墨鳥・依序引路';
  const body=new BrushBatch();
  body.add(new THREE.SphereGeometry(1,24,16),material,[0,0,.01],[.18,0,0],[.10,.105,.24]);
  body.add(new THREE.SphereGeometry(1,20,14),material,[0,.075,.21],[0,0,0],[.082,.078,.10]);
  body.add(tube([[0,.077,.27],[0,.067,.36]],.028,.001,9,7),material);
  for(const side of [-1,1])body.add(tube([[side*.03,-.005,-.17],[side*.07,-.02,-.31],[side*.085,-.04,-.43]],.035,.001,16,7),material);
  body.finish(root,'一點淡墨・鳥身與尾羽');
  const wings=[];
  for(const side of [-1,1]){
    const wing=new THREE.Group(),batch=new BrushBatch();wing.position.set(side*.055,.025,.04);
    // Overlapping tapered, curved quills make a ragged brush tip, not a triangle.
    for(let feather=0;feather<7;feather++){
      const positions=[],uv=[],idx=[],length=.43+Math.sin(feather/6*Math.PI)*.17-feather*.018;
      for(let j=0;j<=18;j++){
        const t=j/18,span=t*length,width=(.035+feather*.001)*Math.pow(Math.sin(t*Math.PI),.55)+.002;
        for(let k=0;k<3;k++){
          const cross=(k-1)*width,z=.06-feather*.037-t*t*(.13+feather*.016)+cross;
          positions.push(side*span,.06*Math.sin(t*Math.PI)-t*.025,z);uv.push(k/2,t);
          if(j<18&&k<2){const a=j*3+k,b=a+3;idx.push(a,b,a+1,a+1,b,b+1);}
        }
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();batch.add(g,material);
    }
    batch.finish(wing,'斷續飛白羽');root.add(wing);wings.push({wing,side});
  }
  root.scale.setScalar(.60);
  return {root,wings,opacity};
}

export function createInkBird({scene,journey,canWalk,heightAt,roads,spawn}){
  const planner=createBirdRoute({canWalk,heightAt,roads}),bird=buildInkBird();scene.add(bird.root);
  let route=[],length=0,along=0,goalKey=null,invite=0,checkTime=0,waiting=false,recovering=false,mode='invite',targetId=null,failedRoutes=0;
  function seed(player){
    let x=player.x-Math.sin(player.yaw)*3,z=player.z-Math.cos(player.yaw)*3;
    if(!canWalk(x,z)||!planner.clear(player,{x,z})){x=player.x;z=player.z;}
    bird.root.position.set(x,Math.max(heightAt(x,z)+1.8,heightAt(player.x,player.z)+1.8),z);
    bird.root.rotation.set(0,player.yaw+Math.PI,0);
    bird.opacity.value=1;route=[];length=along=invite=checkTime=0;goalKey=null;waiting=false;recovering=false;mode='invite';targetId=null;failedRoutes=0;
  }
  seed(spawn);
  function plan(player,goal,viaPlayer=false,opening=false){
    const from=bird.root.position;
    if(viaPlayer){
      const join=planner.find(from,player),rest=planner.find(player,goal);
      route=join.length&&rest.length?[...join,...rest.slice(1)]:[];
    }else if(opening){
      // The first item is behind the cart. Lead around the child at arm's
      // length, rather than flying through the camera on a direct return leg.
      const onward=planner.find(player,goal),joinDistance=4.5,join=pointOnRoute(onward,joinDistance);
      const startAngle=Math.atan2(from.x-player.x,from.z-player.z),endAngle=join?Math.atan2(join.x-player.x,join.z-player.z):startAngle;
      const turn=Math.atan2(Math.sin(endAngle-startAngle),Math.cos(endAngle-startAngle));
      const count=Math.max(2,Math.ceil(Math.abs(turn)/.10)),radius=Math.hypot(from.x-player.x,from.z-player.z);
      const orbit=Array.from({length:count+1},(_,i)=>({x:player.x+Math.sin(startAngle+turn*i/count)*radius,z:player.z+Math.cos(startAngle+turn*i/count)*radius}));
      const tail=[];let travelled=0;
      for(let i=1;i<onward.length;i++){travelled+=Math.hypot(onward[i].x-onward[i-1].x,onward[i].z-onward[i-1].z);if(travelled>joinDistance)tail.push(onward[i]);}
      const safe=join&&orbit.every((p,i)=>canWalk(p.x,p.z)&&(!i||planner.clear(orbit[i-1],p)))&&planner.clear(orbit.at(-1),join);
      route=safe?[...orbit,join,...tail]:planner.find(from,goal);
    }else route=planner.find(from,goal);
    if(!route.length){failedRoutes++;return false;}
    length=routeLength(route);along=0;return true;
  }
  function update(dt,time,player,playing){
    const state=journey.getState();
    if(state.complete){bird.opacity.value=Math.max(0,bird.opacity.value-dt*.7);bird.root.position.y+=dt*.25;mode='finished';return;}
    const current=journey.items.find(i=>i.id===state.activeId);
    targetId=current?.id??null;
    const returning=Boolean(state.carried),key=returning?'return:'+state.carried:state.activeId;
    const goal=returning?journey.depositPosition:current;
    if(!goal)return;
    if(!playing){
      // Keep it in sight during the opening transition, without starting a route.
      if(!goalKey)bird.root.position.y=heightAt(player.x,player.z)+1.9+Math.sin(time*2)*.07;
      return;
    }
    invite+=dt;checkTime+=dt;
    if(invite<1.35){mode='invite';bird.root.position.y+=Math.sin(time*3)*dt*.08;}
    else {
      if(key!==goalKey){const opening=goalKey===null;goalKey=key;recovering=false;plan(player,goal,false,opening);}
      if(checkTime>1.8){
        checkTime=0;
        const near=nearestRouteDistance(route,player);
        if(!route.length||near.distance>6){recovering=true;plan(player,goal,true);}
      }
      if(route.length){
        const nearest=nearestRouteDistance(route,player),desired=Math.min(length,nearest.along+3.8);
        const distance=Math.hypot(bird.root.position.x-player.x,bird.root.position.z-player.z);
        const bearing=Math.atan2(Math.sin(Math.atan2(player.x-bird.root.position.x,player.z-bird.root.position.z)-player.yaw),Math.cos(Math.atan2(player.x-bird.root.position.x,player.z-bird.root.position.z)-player.yaw));
        const viewEdge=Math.atan(Math.tan(28*Math.PI/180)*innerWidth/innerHeight)*.35;
        // Give the child time to turn and follow before the bird leaves view.
        const outsideView=Math.abs(bearing)>viewEdge&&distance>2.7;
        waiting=!recovering&&((distance>6.5&&along>nearest.along+2)||outsideView);
        const speed=recovering?5.4:4.7,delta=waiting?0:THREE.MathUtils.clamp(desired-along,-speed*dt,speed*dt);
        along=THREE.MathUtils.clamp(along+delta,0,length);
        const point=pointOnRoute(route,along),ahead=pointOnRoute(route,Math.min(length,along+.6));
        const dx=point.x-bird.root.position.x,dz=point.z-bird.root.position.z;
        bird.root.position.x=point.x;bird.root.position.z=point.z;
        const altitude=heightAt(point.x,point.z)+1.95+Math.sin(time*2.8)*.09;
        bird.root.position.y=Math.max(heightAt(point.x,point.z)+1.15,THREE.MathUtils.damp(bird.root.position.y,altitude,6,dt));
        if(Math.hypot(dx,dz)>.003){
          const yaw=Math.atan2(ahead.x-point.x||dx,ahead.z-point.z||dz);
          bird.root.rotation.y+=Math.atan2(Math.sin(yaw-bird.root.rotation.y),Math.cos(yaw-bird.root.rotation.y))*Math.min(1,dt*7);
        }
        if(recovering&&distance<6)recovering=false;
        mode=along>length-.65?'arrived':waiting?'waiting':recovering?'returning-to-player':returning?'to-wagon':'to-item';
      }else mode='waiting';
    }
    const resting=mode==='arrived',flap=time*(resting||waiting?6.2:9);
    for(const {wing,side} of bird.wings)wing.rotation.z=side*(resting?.94+Math.sin(flap)*.10:.16+Math.sin(flap)*.66);
    bird.root.rotation.x=Math.sin(flap)*.025;
  }
  return {update,reset:seed,
    getState:()=>({mode,targetId,destination:goalKey,waiting,x:bird.root.position.x,y:bird.root.position.y,z:bird.root.position.z,wingAngle:bird.wings[0].wing.rotation.z,routeLength:length,routeProgress:along,routeNodes:route.length,failedRoutes,graphNodes:planner.nodeCount}),
    // Read-only route diagnostics also let QA verify every guide leg uses land.
    routeTo:(from,to)=>planner.find(from,to).map(p=>({...p,y:heightAt(p.x,p.z)})),
    inspectRoutes:()=>journey.items.flatMap((item,index)=>{
      const out=planner.find(index===0?spawn:journey.depositPosition,item),back=planner.find(item,journey.depositPosition);
      return [{item:item.id,direction:'to-item',points:out},{item:item.id,direction:'to-wagon',points:back}].map(leg=>({...leg,length:routeLength(leg.points),valid:leg.points.length>1&&leg.points.every((p,i)=>canWalk(p.x,p.z)&&(!i||planner.clear(leg.points[i-1],p)))}));
    }),
  };
}
