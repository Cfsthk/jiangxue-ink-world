import * as THREE from './vendor/three.module.js';

/** Thin wind-lifted powder follows the actual snow surface, with soft broken edges. */
export function createGroundSnow({scene,heightAt,shelterAt,reducedMotion=false,coarse=false}) {
  const count=coarse?48:86, columns=4, rows=2, points=(columns+1)*(rows+1);
  const position=new Float32Array(count*points*3), uv=new Float32Array(count*points*2);
  const opacity=new Float32Array(count*points), seeds=[], indices=[];
  let seed=74203;
  const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<count;i++) {
    seeds.push({x:random()*54,z:random()*54,phase:random()*Math.PI*2,length:2.8+random()*3.8,width:.55+random()*.8,speed:.55+random()*.9});
    for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++) {
      const index=i*points+row*(columns+1)+col;
      uv[index*2]=col/columns;uv[index*2+1]=row/rows;
      if(row<rows&&col<columns)indices.push(index,index+columns+1,index+1,index+1,index+columns+1,index+columns+2);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(position,3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  geometry.setAttribute('aOpacity',new THREE.BufferAttribute(opacity,1).setUsage(THREE.DynamicDrawUsage));
  geometry.setIndex(indices);
  const material=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{uTime:{value:0}},
    vertexShader:`attribute float aOpacity; varying vec2 vUv; varying float vAlpha; varying float vDepth;
      void main(){vUv=uv;vAlpha=aOpacity;vec4 p=modelViewMatrix*vec4(position,1.);vDepth=-p.z;gl_Position=projectionMatrix*p;}`,
    fragmentShader:`uniform float uTime;varying vec2 vUv;varying float vAlpha;varying float vDepth;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      void main(){vec2 q=vUv*2.-1.;float fibre=noise(vec2(vUv.x*5.-uTime*.6,vUv.y*7.));
        float edge=1.-smoothstep(.30,1.,length(q*vec2(.96,1.04))+(fibre-.5)*.19);
        float wisps=.32+.68*noise(vec2(vUv.x*3.-uTime*.42,vUv.y*13.));
        float alpha=edge*wisps*vAlpha*(1.-smoothstep(19.,34.,vDepth));if(alpha<.002)discard;
        gl_FragColor=vec4(vec3(.955,.96,.951),alpha);
        #include <colorspace_fragment>
      }`
  });
  const mesh=new THREE.Mesh(geometry,material);mesh.name='貼地飛雪・薄粉墨暈';mesh.frustumCulled=false;scene.add(mesh);
  const wrap=(n,centre)=>((n-centre+27)%54+54)%54-27+centre;
  const dx=1/Math.hypot(1,.2),dz=.2*dx;
  let previousTime=0, travel=0;
  function update(dt,time,player,gust) {
    travel+=dt*(.42+gust*1.85)*(reducedMotion ? .35 : 1);
    previousTime=time;
    material.uniforms.uTime.value=time;
    for(let i=0;i<count;i++) {
      const s=seeds[i],x=wrap(s.x+travel*s.speed*dx,player.x),z=wrap(s.z+travel*s.speed*dz,player.z);
      const shelter=shelterAt(x,z),pulse=.5+.5*Math.sin(time*.9+s.phase);
      const level=(.055+gust*.19)*(.35+pulse*.65)*(1-shelter*.96);
      const lift=.035+Math.pow(pulse,2)*(.13+gust*.19)*(1-shelter*.85);
      for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++) {
        const index=i*points+row*(columns+1)+col,u=col/columns-.5,v=row/rows-.5;
        const px=x+u*s.length*dx-v*s.width*dz,pz=z+u*s.length*dz+v*s.width*dx;
        const bank=1+Math.sin(pz*.035)*2.7;
        const onLand=px<bank-.5&&px>-74&&pz>-73&&pz<69;
        position[index*3]=px;position[index*3+1]=heightAt(px,pz)+lift;position[index*3+2]=pz;
        opacity[index]=onLand?level:0;
      }
    }
    geometry.attributes.position.needsUpdate=true;geometry.attributes.aOpacity.needsUpdate=true;
  }
  return {update,diagnostics:()=>({patches:count,time:previousTime,travel})};
}
