import * as THREE from './vendor/three.module.js';

// Image pigments stay attached to the real curved surface as the player walks around it.
const vertexShader=`
  uniform float uBleed;
  varying vec3 vLocal; varying vec3 vObjectNormal; varying vec3 vEye; varying vec3 vNormal; varying vec2 vUv;
  void main(){
    vLocal=position; vObjectNormal=normal; vUv=uv;
    vec4 view=modelViewMatrix*vec4(position+normal*uBleed,1.);
    vEye=-view.xyz; vNormal=normalize(normalMatrix*normal);
    gl_Position=projectionMatrix*view;
  }
`;
const fragmentShader=`
  uniform sampler2D uAtlas; uniform vec2 uCell; uniform vec3 uInk;
  uniform float uDensity; uniform float uBleed; uniform float uMode; uniform vec2 uScale;
  varying vec3 vLocal; varying vec3 vObjectNormal; varying vec3 vEye; varying vec3 vNormal; varying vec2 vUv;
  float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
  float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
  float pigment(vec2 uv){
    // Insets prevent adjacent atlas cells leaking into paper, cloth or coat at a distance.
    vec2 tile=.035+fract(uv)*.93;
    return 1.-dot(texture2D(uAtlas,(uCell+tile)/vec2(3.,2.)).rgb,vec3(.299,.587,.114));
  }
  void main(){
    vec3 n=normalize(vNormal),p=vLocal;vec2 uv=vUv*uScale;
    uv.x+=sin(uv.y*5.2+p.z*.4)*.015;
    float paint=pigment(uv),wash=noise(p*vec3(3.1,2.6,2.2));
    if(uMode>.5&&uMode<1.5){
      vec3 w=pow(abs(normalize(vObjectNormal)),vec3(3.));w/=w.x+w.y+w.z;
      paint=pigment(p.zy*.51+vec2(.14,.16))*w.x+pigment(p.xz*.51+vec2(.28,.35))*w.y+pigment(p.xy*.51+vec2(.21,.11))*w.z;
    }
    float facing=abs(dot(n,normalize(vEye))),dry=noise(p*47.),edge=1.-smoothstep(.025,.24,facing);
    float density=clamp(uDensity*(.40+paint*.70+(wash-.5)*.12)+edge*.045,0.,.96);
    vec3 paper=vec3(.916,.923,.913),color=mix(paper,uInk,density);
    color-=vec3((noise(p*vec3(115.,83.,97.))-.5)*.016);
    if(uCell.y<.5&&uCell.x>.5&&uCell.x<1.5){float rim=1.-smoothstep(.002,.065,min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y)));color*=1.-rim*(.045+dry*.055);}
    color*=.982+.018*max(0.,dot(n,normalize(vec3(-.4,.8,.2))));
    float alpha=smoothstep(.002,.052+(dry-.5)*.022,facing);
    if(uMode>1.5){
      // Dry-brush gaps are actual transparency, rather than white rectangular feathers.
      float feather=smoothstep(0.,.13,vUv.x)*(1.-smoothstep(.85,1.,vUv.x));
      alpha=feather*smoothstep(.11,.69,paint)*(.65+.35*wash);
      color=mix(vec3(.48,.52,.50),uInk,.48+paint*.45);
    }
    if(uBleed>.001){alpha=(1.-smoothstep(.015,.21,facing))*(.027+dry*.07);color=mix(color,paper,.22);}
    color=mix(color,vec3(.929,.929,.922),1.-exp(-dot(vEye,vEye)*.0024*.0024));
    if(alpha<.012)discard;
    gl_FragColor=vec4(color,alpha);
    #include <colorspace_fragment>
  }
`;
let sharedAtlas,sharedReady;
function atlasSource(){
  if(!sharedAtlas){
    const blank=new THREE.DataTexture(new Uint8Array([235,235,233,255]),1,1);blank.colorSpace=THREE.SRGBColorSpace;blank.needsUpdate=true;
    sharedAtlas={value:blank};
    sharedReady=new THREE.TextureLoader().loadAsync(new URL('./assets/brush-surface-atlas-v2.png',import.meta.url).href).then(texture=>{
      texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;sharedAtlas.value=texture;
    });
  }
  return {atlas:sharedAtlas,ready:sharedReady};
}
export function createRigPaint(){
  const {atlas,ready}=atlasSource();
  function material(name,cell,ink,density,mode=0,scale=[1,1],side=THREE.FrontSide){
    const m=new THREE.ShaderMaterial({name,vertexShader,fragmentShader,uniforms:{uAtlas:atlas,uCell:{value:new THREE.Vector2(...cell)},uInk:{value:new THREE.Color(ink)},uDensity:{value:density},uBleed:{value:0},uMode:{value:mode},uScale:{value:new THREE.Vector2(...scale)}},side,transparent:true,depthWrite:true,toneMapped:false});
    m.userData.rigPaint=true;m.userData.mapping=mode===1?'triplanar':'uv';m.userData.atlasCell=cell;return m;
  }
  return {
    horse:material('馬毛・淡墨暈染',[0,1],'#65756e',.72,1),
    wood:material('舊木・順板木紋',[1,1],'#53625b',.95),
    dark:material('繫帶與馬蹄・斷墨',[0,0],'#293931',1.23,1),
    cloth:material('車篷與卷筒・亞麻纖維',[2,1],'#929b90',.47,0,[1.3,1.1],THREE.DoubleSide),
    hat:material('官帽・折布墨紋',[0,0],'#34423b',.88,0,[1,1],THREE.DoubleSide),
    paper:material('文書・宣紙纖維',[1,0],'#9aa799',.38,0,[1,1],THREE.DoubleSide),
    stroke:material('鬃毛與繫帶・飛白',[2,0],'#253b31',1.1,2,[1,1],THREE.DoubleSide),
    ready,
  };
}
export function addRigBleed(group,amount=.012){
  const cores=[];group.traverse(o=>{if(o.isMesh&&o.material.userData.rigPaint&&!o.userData.rigBleed&&!o.userData.hasBleed&&o.material.uniforms.uMode.value<1.5)cores.push(o);});
  const materials=new Map();
  for(const core of cores){
    let material=materials.get(core.material);
    if(!material){material=core.material.clone();material.uniforms.uAtlas=core.material.uniforms.uAtlas;material.uniforms.uBleed.value=amount;material.depthWrite=false;material.side=THREE.FrontSide;materials.set(core.material,material);}
    const halo=new THREE.Mesh(core.geometry,material);halo.name='細薄暈墨邊';halo.userData.rigBleed=true;halo.renderOrder=-1;core.userData.hasBleed=true;core.add(halo);
  }
}
export function paintDiagnostics(group){
  let meshes=0,triangles=0,painted=0,texturesLoaded=true;const mappings=new Set();
  group.traverse(o=>{if(!o.isMesh||o.userData.rigBleed)return;meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;
    if(o.material.userData.rigPaint){painted++;mappings.add(o.material.userData.mapping);texturesLoaded&&=!!o.material.uniforms.uAtlas.value.image?.width&&o.material.uniforms.uAtlas.value.image.width>1;}
  });return {meshes,triangles,painted,texturesLoaded,mappings:[...mappings]};
}
