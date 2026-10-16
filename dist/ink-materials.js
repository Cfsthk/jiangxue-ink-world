import * as THREE from './vendor/three.module.js';

// The pigment is part of each object's surface.  World-space triplanar mapping
// covers crags without stretched UV seams; timber, bark and straw use their UVs.
const kinds = { rock: 0, snow: 1, bark: 2, foliage: 3, wood: 4, straw: 5, cloth: 6 };
const vertexShader = `
  attribute float snowHeight;
  varying vec3 vWorld;
  varying vec3 vNormalWorld;
  varying vec3 vView;
  varying vec2 vBrushUv;
  varying float vSnowHeight;
  void main(){
    vec3 p=position;
    vec3 n=normal;
    #ifdef USE_INSTANCING
      p=(instanceMatrix*vec4(p,1.)).xyz;
      vec3 scale2=vec3(dot(instanceMatrix[0].xyz,instanceMatrix[0].xyz),dot(instanceMatrix[1].xyz,instanceMatrix[1].xyz),dot(instanceMatrix[2].xyz,instanceMatrix[2].xyz));
      n=mat3(instanceMatrix)*(n/max(scale2,vec3(.00001)));
    #endif
    vec4 world=modelMatrix*vec4(p,1.);
    vWorld=world.xyz;
    vec3 modelScale2=vec3(dot(modelMatrix[0].xyz,modelMatrix[0].xyz),dot(modelMatrix[1].xyz,modelMatrix[1].xyz),dot(modelMatrix[2].xyz,modelMatrix[2].xyz));
    vNormalWorld=normalize(mat3(modelMatrix)*(n/max(modelScale2,vec3(.00001))));
    vView=(viewMatrix*world).xyz;
    vBrushUv=uv;
    vSnowHeight=snowHeight;
    gl_Position=projectionMatrix*vec4(vView,1.);
  }
`;
const fragmentShader = `
  uniform vec3 uColor;
  uniform vec3 uShadow;
  uniform sampler2D uPigment;
  uniform float uKind;
  uniform float uShade;
  uniform float uSnow;
  uniform float uOpacity;
  uniform float uFog;
  uniform float uDistant;
  uniform float uStrength;
  uniform vec2 uRepeat;
  varying vec3 vWorld;
  varying vec3 vNormalWorld;
  varying vec3 vView;
  varying vec2 vBrushUv;
  varying float vSnowHeight;
  float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
  float noise(vec3 p){
    vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  vec3 paintedRock(vec3 p,vec3 n){
    vec3 w=pow(abs(n),vec3(2.6));w/=max(w.x+w.y+w.z,.00001);
    p.x+=sin(p.y*.31+p.z*.17)*.52;
    p.z+=sin(p.y*.23+p.x*.41)*.43;
    // Long vertical brush marks stay vertical on both cliff-facing projections.
    vec3 a=texture2D(uPigment,vec2(p.z*uRepeat.x,p.y*uRepeat.y)).rgb;
    vec3 b=texture2D(uPigment,p.xz*uRepeat.x).rgb;
    vec3 c=texture2D(uPigment,vec2(p.x*uRepeat.x,p.y*uRepeat.y)).rgb;
    vec3 broadA=texture2D(uPigment,vec2(p.z*uRepeat.x*.47+p.y*.004,p.y*uRepeat.y*.53)+vec2(.23,.61)).rgb;
    vec3 broadB=texture2D(uPigment,p.xz*uRepeat.x*.43+vec2(.23,.61)).rgb;
    vec3 broadC=texture2D(uPigment,vec2(p.x*uRepeat.x*.47-p.y*.005,p.y*uRepeat.y*.53)+vec2(.23,.61)).rgb;
    return mix(a*w.x+b*w.y+c*w.z,broadA*w.x+broadB*w.y+broadC*w.z,.31);
  }
  vec3 snowPigment(vec3 p,vec3 n){
    float light=max(0.,dot(n,normalize(vec3(-.43,.83,.34))));
    float drift=noise(p*vec3(.41,.19,.17));
    float mottling=noise(p*.83)*.65+noise(p*2.7)*.35;
    float fibres=noise(p*vec3(23.,7.,14.));
    float brush=smoothstep(.30,.77,noise(p*vec3(.7,.28,2.1)));
    float paperInk=dot(texture2D(uPigment,p.xz*.19+vec2(.17,.61)).rgb,vec3(.299,.587,.114));
    float shade=(1.-light)*.104+(1.-drift)*.029+(mottling-.5)*.038+(1.-paperInk)*.067;
    vec3 c=vec3(.938,.939,.928)-vec3(shade);
    c-=vec3((fibres-.5)*.026+brush*.015);
    return c;
  }
  void main(){
    vec3 n=normalize(vNormalWorld);
    float diffuse=max(0.,dot(n,normalize(vec3(-.43,.83,.34))));
    float grain=noise(vWorld*11.1);
    float wash=noise(vWorld*.43);
    vec3 color=uColor;
    if(uKind<.5){
      vec3 pigment=paintedRock(vWorld,n);
      color=mix(uColor,pigment,uStrength);
      // Broad translucent washes describe folds, rather than small hard facets.
      color*=1.-(1.-diffuse)*uShade*.17;
      color=mix(color,vec3(.91,.918,.903),smoothstep(.52,.89,wash)*.12);
      float crease=smoothstep(.61,.85,noise(vec3(vWorld.x*1.9,vWorld.y*.09,vWorld.z*1.9)));
      color=mix(color,uShadow,crease*.065);
    } else if(uKind<1.5){
      // Layered dilute pigment gives snow a wind-brushed surface and soft shade.
      color=snowPigment(vWorld,n);
    } else if(uKind<2.5){
      vec2 uv=vBrushUv*uRepeat;
      uv.x+=sin(uv.y*5.7+vWorld.y*.21)*.043+sin(uv.y*13.3+vWorld.z*.7)*.014;
      vec3 pigment=texture2D(uPigment,uv).rgb;
      vec3 broad=texture2D(uPigment,uv*vec2(.41,.67)+vec2(uv.y*.13+.29,.47)).rgb;
      pigment=mix(pigment,broad,.41);
      pigment=mix(pigment,vec3(.94),smoothstep(.55,.83,wash)*.22);
      color=mix(uColor,pigment,uStrength);
      color*=.89+diffuse*.11;
    } else if(uKind<3.5){
      float fibre=noise(vWorld*16.);
      color=mix(uColor,uShadow,.10+(1.-diffuse)*.15);
      color=mix(color,vec3(.92,.93,.91),smoothstep(.62,.85,fibre)*.35);
    } else {
      vec3 pigment=texture2D(uPigment,vBrushUv*uRepeat).rgb;
      color=mix(uColor,pigment,uStrength);
      color*=.87+diffuse*.13;
      // Wood and straw remain clear grey accents against the snowy river.
      color*=uKind<4.5?.80:.76;
    }
    if(uKind<.5 && uSnow>.001){
      // Snow follows the same curved rock surface: no separate polygonal cap.
      float edgeWash=noise(vWorld*vec3(1.3,.42,1.1))*.65+noise(vWorld*3.9)*.35;
      float snowLine=.56+(wash-.5)*.18+(edgeWash-.5)*.085;
      float heightCover=smoothstep(snowLine-.075,snowLine+.14,vSnowHeight);
      float ledge=smoothstep(-.08,.66,n.y+(edgeWash-.5)*.16);
      float cap=clamp(heightCover*ledge*uSnow*1.26,0.,1.);
      color=mix(color,snowPigment(vWorld,n),cap);
      // A dilute grey seam makes the melting, broken snow edge readable.
      float seam=exp(-pow((vSnowHeight-snowLine)/.065,2.))*ledge;
      color=mix(color,vec3(.69,.72,.715),seam*.055);
    }
    // Uneven dry-brush contour is attached to the surface, not a uniform toon line.
    vec3 eye=normalize(cameraPosition-vWorld);
    float edge=1.-smoothstep(.025,.16,abs(dot(n,eye)));
    float broken=smoothstep(.36,.70,noise(vWorld*9.7));
    float edgeStrength=uKind> .5 && uKind<1.5 ? .035 : .13;
    color=mix(color,uShadow,edge*broken*edgeStrength);
    float distance=length(vView);
    if(uKind<.5){
      // Distant rock keeps its ink skin but loses fine contrast in the grey air.
      float soft=smoothstep(36.,125.,distance)*.42;
      color=mix(color,vec3(.82,.823,.82),soft);
    }
    float fog=1.-exp(-dot(vView,vView)*uFog*uFog);
    float valley=(1.-smoothstep(0.,24.,vWorld.y))*uDistant*.6;
    color=mix(color,vec3(.929,.929,.922),clamp(fog+valley,0.,.92));
    gl_FragColor=vec4(max(color,vec3(0.)),uOpacity);
    #include <colorspace_fragment>
  }
`;

export function createBrushMaterials(){
  const loader=new THREE.TextureLoader();
  const pending=[];
  const white=new THREE.DataTexture(new Uint8Array([244,244,242,255]),1,1,THREE.RGBAFormat);
  white.colorSpace=THREE.SRGBColorSpace;white.needsUpdate=true;
  const textures={};
  const materials=[];
  const textureFor={ rock:'rock',snow:'rock',bark:'bark',wood:'wood',straw:'straw',cloth:'straw' };
  const textureFiles={rock:'brush-rock-v2.png',bark:'brush-bark-v2.png',wood:'brush-wood.png',straw:'brush-straw.png'};
  for(const name of ['rock','bark','wood','straw']){
    pending.push(loader.loadAsync(new URL(`./assets/${textureFiles[name]}`,import.meta.url).href).then(texture=>{
      texture.colorSpace=THREE.SRGBColorSpace;
      texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
      texture.anisotropy=8;
      texture.minFilter=THREE.LinearMipmapLinearFilter;
      texture.magFilter=THREE.LinearFilter;
      textures[name]=texture;
      for(const material of materials){
        if(textureFor[material.userData.brushKind]===name)material.uniforms.uPigment.value=texture;
      }
      return texture;
    }));
  }

  function inkMaterial(color,shade=.4,snow=0,opacity=1,fog=.0024,distant=0,kind='rock'){
    const type=Object.hasOwn(kinds,kind)?kind:'rock';
    const repeat=type==='rock'?new THREE.Vector2(.19,.16):type==='bark'?new THREE.Vector2(1.3,4.0):type==='wood'?new THREE.Vector2(1,1.2):new THREE.Vector2(1.4,1.3);
    const strength=type==='rock'?.92:type==='bark'?.86:type==='wood'?.48:type==='straw'||type==='cloth'?.54:0;
    const material=new THREE.ShaderMaterial({
      name:`毛筆表皮・${type}`,vertexShader,fragmentShader,
      uniforms:{
        uColor:{value:new THREE.Color(color)},uShadow:{value:new THREE.Color('#737674')},
        uPigment:{value:textures[textureFor[type]]||white},uKind:{value:kinds[type]},
        uShade:{value:shade},uSnow:{value:snow},uOpacity:{value:opacity},uFog:{value:fog},
        uDistant:{value:distant},uStrength:{value:strength},uRepeat:{value:repeat},
      },
      side:THREE.DoubleSide,transparent:opacity<1,depthWrite:opacity>=1,toneMapped:false,
    });
    material.defaultAttributeValues.snowHeight=[0];
    material.userData.brushKind=type;
    materials.push(material);
    return material;
  }
  const palette={
    inkMaterial,
    withSnow(material,amount=.85){
      const painted=material.clone();
      painted.uniforms.uSnow.value=amount;
      painted.defaultAttributeValues.snowHeight=[0];
      materials.push(painted);
      return painted;
    },
    snowMaterial:inkMaterial('#fafaf7',.2,0,1,.002,0,'snow'),
    stoneMaterial:inkMaterial('#e4e4e0',.55,0,1,.0023,0,'rock'),
    cliffMaterial:inkMaterial('#e6e6e2',.6,0,1,.0025,0,'rock'),
    branchMaterial:inkMaterial('#8d908a',.38,0,1,.0024,0,'bark'),
    foliageMaterial:inkMaterial('#9da69c',.3,0,1,.003,0,'foliage'),
    distantMaterials:[inkMaterial('#c6c7c5',.4,0,1,.003,1,'rock'),inkMaterial('#b9bcba',.3,0,1,.002,1,'rock'),inkMaterial('#aeb3b1',.3,0,1,.0016,1,'rock')],
    hullMaterial:inkMaterial('#7f827f',.5,0,1,.002,0,'wood'),
    hullInsideMaterial:inkMaterial('#626762',.5,0,1,.002,0,'wood'),
    rimMaterial:inkMaterial('#636963',.4,0,1,.002,0,'wood'),
    cloakMaterial:inkMaterial('#858783',.5,0,1,.002,0,'straw'),
    hatMaterial:inkMaterial('#b8b8b5',.4,0,1,.002,0,'straw'),
    ready:Promise.all(pending),
  };
  palette.cliffMaterial.uniforms.uRepeat.value.set(.105,.10);
  palette.stoneMaterial.uniforms.uRepeat.value.set(.43,.24);
  return palette;
}
