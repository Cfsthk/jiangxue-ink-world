import * as THREE from './vendor/three.module.js';

// These materials belong only to the travelling horse and cart. The landscape,
// luggage and fishing boat keep their own pigment, lighting and texture scale.
const vertexShader=`
  uniform float uBleed;
  varying vec3 vLocal;
  varying vec3 vWorld;
  varying vec3 vEye;
  varying vec3 vNormal;
  varying vec2 vUv;
  void main(){
    vLocal=position;vUv=uv;
    vec3 p=position+normal*uBleed;
    vec4 world=modelMatrix*vec4(p,1.);
    vec4 view=modelViewMatrix*vec4(p,1.);
    vWorld=world.xyz;vEye=-view.xyz;vNormal=normalize(normalMatrix*normal);
    gl_Position=projectionMatrix*view;
  }
`;
const fragmentShader=`
  uniform sampler2D uAtlas;
  uniform vec3 uInk;
  uniform float uBand;
  uniform float uDensity;
  uniform float uBleed;
  varying vec3 vLocal;
  varying vec3 vWorld;
  varying vec3 vEye;
  varying vec3 vNormal;
  varying vec2 vUv;
  float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
  float noise(vec3 p){
    vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  float pigment(vec2 uv){
    // Inset each third so mip filtering cannot borrow a neighbouring material.
    vec2 tile=fract(uv);
    return 1.-dot(texture2D(uAtlas,vec2(.005+tile.x*.99,(uBand+.025+tile.y*.95)/3.)).rgb,vec3(.299,.587,.114));
  }
  void main(){
    vec3 n=normalize(vNormal),p=vLocal;
    float wash=noise(p*vec3(1.8,2.3,1.4));
    vec2 uv=vUv;
    uv.x+=sin(uv.y*6.4+p.z*.6)*.022;
    float paint=pigment(uv);
    float bloom=pigment(uv*.47+vec2(.31,.19));
    float fibres=noise(p*vec3(93.,67.,83.));
    float facing=abs(dot(n,normalize(vEye)));
    float edge=1.-smoothstep(.025,.32,facing);
    float dry=smoothstep(.27,.76,noise(p*36.));
    float stroke=smoothstep(.31,.68,noise(p*vec3(9.,3.,12.)));
    // Almost-flat washes and paper gaps, rather than solid diffuse shading.
    float density=uDensity*(.32+paint*.76+bloom*.22+(wash-.5)*.12);
    density+=edge*stroke*.10;
    vec3 color=mix(vec3(.90,.909,.894),uInk,clamp(density,0.,.94));
    color-=vec3((fibres-.5)*.025);
    color=mix(color,vec3(.90,.909,.894),smoothstep(.64,.86,wash)*.13);
    float alpha=smoothstep(.006,.125+(dry-.5)*.07,facing);
    if(uBleed>.001){
      alpha=(1.-smoothstep(.03,.32,facing))*(.045+dry*.11);
      color=mix(color,vec3(.86,.875,.862),.45);
    }
    float fog=1.-exp(-dot(vEye,vEye)*.0024*.0024);
    color=mix(color,vec3(.929,.929,.922),fog);
    if(alpha<.008)discard;
    gl_FragColor=vec4(color,alpha);
    #include <colorspace_fragment>
  }
`;

export function createRigPaint(){
  const white=new THREE.DataTexture(new Uint8Array([245,245,243,255]),1,1);
  white.colorSpace=THREE.SRGBColorSpace;white.needsUpdate=true;
  const atlas={value:white};
  function material(name,band,ink,density,side=THREE.FrontSide){
    const m=new THREE.ShaderMaterial({name,vertexShader,fragmentShader,
      uniforms:{uAtlas:atlas,uBand:{value:band},uInk:{value:new THREE.Color(ink)},uDensity:{value:density},uBleed:{value:0}},
      side,transparent:true,depthWrite:true,toneMapped:false,
    });
    m.userData.rigPaint=true;return m;
  }
  const materials={
    horse:material('馬毛・飛白與淡墨',2,'#6e7b74',.72),
    wood:material('舊木・斷筆木紋',1,'#56655e',.88),
    dark:material('鬃毛與繫帶・濃淡墨線',2,'#293b33',1.27),
    cloth:material('車篷・薄墨布紋',0,'#a5afa3',.44,THREE.DoubleSide),
  };
  const ready=new THREE.TextureLoader().loadAsync(new URL('./assets/rig-brush-atlas-v1.png',import.meta.url).href).then(texture=>{
    texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
    texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;atlas.value=texture;
  });
  return {...materials,ready};
}

// One translucent wash outside each merged surface softens the silhouette.
// Its pigment is object-anchored; it never sparkles when the camera moves.
export function addRigBleed(group){
  const cores=[];group.traverse(o=>{if(o.isMesh&&o.material.userData.rigPaint)cores.push(o);});
  const haloMaterials=new Map();
  for(const core of cores){
    let material=haloMaterials.get(core.material);
    if(!material){material=core.material.clone();material.uniforms.uAtlas=core.material.uniforms.uAtlas;material.uniforms.uBleed.value=.018;material.depthWrite=false;material.side=THREE.FrontSide;haloMaterials.set(core.material,material);}
    const halo=new THREE.Mesh(core.geometry,material);halo.name='邊緣淡墨暈';halo.renderOrder=-1;
    core.add(halo);
  }
}
