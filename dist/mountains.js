import * as THREE from './vendor/three.module.js';

// Four continuous circular paintings and a soft outer ridge surround the world.
// The player always remains inside them: there are no isolated background cards.
const TAU=Math.PI*2;
const vertexShader=`
  varying vec2 vMountUv;
  void main(){
    vMountUv=uv;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
  }
`;
const paintedFragment=`
  uniform sampler2D uMap;
  uniform float uRepeat;
  uniform float uOffset;
  uniform float uOpacity;
  uniform float uHaze;
  uniform vec3 uMist;
  varying vec2 vMountUv;
  void main(){
    float bend=sin(vMountUv.x*18.84956+uOffset*9.)*.018
              +sin(vMountUv.x*43.9823-uOffset*6.)*.009;
    vec2 uv=vec2(fract(vMountUv.x*uRepeat+uOffset),clamp(vMountUv.y+bend,0.,1.));
    vec4 paint=texture2D(uMap,uv);
    paint.rgb=mix(paint.rgb,vec3(dot(paint.rgb,vec3(.299,.587,.114))),.94);
    float density=clamp(1.-dot(paint.rgb,vec3(.299,.587,.114)),0.,1.);
    vec3 color=max(vec3(0.),paint.rgb-vec3(density*.18));
    color=mix(color,uMist,uHaze);
    float base=smoothstep(.015,.17,vMountUv.y);
    float top=1.-smoothstep(.97,1.,vMountUv.y);
    float side=smoothstep(0.,.065,uv.x)*(1.-smoothstep(.935,1.,uv.x));
    float alpha=paint.a*uOpacity*base*top*side;
    if(alpha<.002)discard;
    gl_FragColor=vec4(color,alpha);
    #include <colorspace_fragment>
  }
`;

function outerRidge(){
  const positions=[],uvs=[],indices=[],segments=360,rows=10,radius=553;
  for(let j=0;j<=rows;j++){
    const v=j/rows;
    for(let i=0;i<=segments;i++){
      const a=i/segments*TAU;
      const crest=112+24*Math.sin(a*5+.4)+17*Math.sin(a*9-1.1)+10*Math.sin(a*17+.7);
      positions.push(-18+Math.cos(a)*radius,-21+(crest+21)*v,-5+Math.sin(a)*radius);
      uvs.push(i/segments,v);
      if(j<rows&&i<segments){const n=j*(segments+1)+i,m=n+segments+1;indices.push(n,m,n+1,m,m+1,n+1);}
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);
  const material=new THREE.ShaderMaterial({
    vertexShader,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
    uniforms:{uInk:{value:new THREE.Color('#c0c7c2')}},
    fragmentShader:`
      uniform vec3 uInk;
      varying vec2 vMountUv;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      void main(){
        float fibre=noise(vMountUv*vec2(170.,22.));
        float alpha=smoothstep(.03,.25,vMountUv.y)*(1.-smoothstep(.90,1.,vMountUv.y))*(.29+fibre*.035);
        gl_FragColor=vec4(uInk+(fibre-.5)*.018,alpha);
        #include <colorspace_fragment>
      }
    `,
  });
  const ridge=new THREE.Mesh(geometry,material);ridge.name='最遠連綿淡墨山脊';ridge.renderOrder=-16;
  return ridge;
}

export function createMountainSurround(){
  const group=new THREE.Group();group.name='四方千山・層疊環景';group.add(outerRidge());
  const materials=[];
  const layers=[
    {radius:505,height:226,base:-17,repeat:6,offset:.27,opacity:.34,haze:.53,map:1},
    {radius:385,height:207,base:-15,repeat:5,offset:.63,opacity:.48,haze:.36,map:0},
    {radius:265,height:180,base:-16,repeat:4,offset:.12,opacity:.67,haze:.17,map:1},
    {radius:166,height:139,base:-14,repeat:3,offset:.46,opacity:.87,haze:.04,map:0},
  ];
  layers.forEach((layer,index)=>{
    const geometry=new THREE.CylinderGeometry(layer.radius,layer.radius,layer.height,240,1,true);
    const material=new THREE.ShaderMaterial({
      vertexShader,fragmentShader:paintedFragment,
      uniforms:{uMap:{value:null},uRepeat:{value:layer.repeat},uOffset:{value:layer.offset},uOpacity:{value:layer.opacity},uHaze:{value:layer.haze},uMist:{value:new THREE.Color('#d1d5cf')}},
      side:THREE.BackSide,transparent:true,depthWrite:false,toneMapped:false,
    });
    const range=new THREE.Mesh(geometry,material);
    range.position.set(-18,layer.height*.5+layer.base,-5);
    range.rotation.y=index*.71;
    range.name=`環繞水墨山巒・${layers.length-index}層`;
    range.renderOrder=-15+index;
    group.add(range);materials.push({material,map:layer.map});
  });
  const loader=new THREE.TextureLoader();
  const ready=Promise.all(['ink-mountains.png','ink-rounded-ranges.png'].map(file=>loader.loadAsync(new URL(`./assets/${file}`,import.meta.url).href))).then(textures=>{
    textures.forEach(texture=>{
      texture.colorSpace=THREE.SRGBColorSpace;
      texture.wrapS=THREE.RepeatWrapping;
      texture.wrapT=THREE.ClampToEdgeWrapping;
      texture.anisotropy=4;
    });
    materials.forEach(({material,map})=>{material.uniforms.uMap.value=textures[map];});
  });
  return {group,ready};
}
