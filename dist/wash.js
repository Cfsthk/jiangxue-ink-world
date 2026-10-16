import * as THREE from './vendor/three.module.js';

// One small screen pass softens the render and adds irregular, faint ink edges.
// It never overlays the reference image onto the playable scene.
export class InkWash {
  constructor(renderer) {
    this.renderer = renderer;
    this.target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.target.samples = Math.min(matchMedia('(pointer:coarse)').matches ? 2 : 4, renderer.capabilities.maxSamples);
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.material = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false, toneMapped: false,
      uniforms: { image: { value: this.target.texture }, pixel: { value: new THREE.Vector2(1, 1) } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader: `
        uniform sampler2D image;
        uniform vec2 pixel;
        varying vec2 vUv;
        float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
        float l(vec3 c){return dot(c,vec3(.299,.587,.114));}
        void main(){
          // Sub-pixel paper fibres break perfectly straight render edges.
          vec2 fibres=vec2(n(gl_FragCoord.xy*.23),n(gl_FragCoord.yx*.19+17.))-.5;
          vec2 uv=vUv+fibres*pixel*.65;
          vec3 c=texture2D(image,uv).rgb;
          float bloom=.75+n(gl_FragCoord.xy*.055)*1.15;
          vec2 stepUv=pixel*bloom;
          vec3 left=texture2D(image,uv-vec2(stepUv.x,0.)).rgb;
          vec3 right=texture2D(image,uv+vec2(stepUv.x,0.)).rgb;
          vec3 up=texture2D(image,uv+vec2(0.,stepUv.y)).rgb;
          vec3 down=texture2D(image,uv-vec2(0.,stepUv.y)).rgb;
          float edge=length(vec2(l(left)-l(right),l(up)-l(down)));
          float pigment=n(gl_FragCoord.xy*.15)*.65+n(gl_FragCoord.xy*.045)*.35;
          float stroke=clamp(edge*.42,0.,.065)*smoothstep(.34,.71,pigment);
          float wetEdge=smoothstep(.025,.20,edge);
          c=mix(c,(left+right+up+down)*.25,.075+wetEdge*.23);
          c-=stroke;
          c+=(h(gl_FragCoord.xy)-.5)*.006;
          gl_FragColor=vec4(c,1.);
          #include <colorspace_fragment>
        }`,
    });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
  }
  resize(width, height, ratio) {
    this.target.setSize(Math.round(width * ratio), Math.round(height * ratio));
    this.material.uniforms.pixel.value.set(1 / (width * ratio), 1 / (height * ratio));
  }
  render(scene, camera) {
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
  }
}
