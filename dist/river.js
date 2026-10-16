import * as THREE from './vendor/three.module.js';

/**
 * Sparse, gently advecting ink ripples. The water plane is never displaced, so
 * its meeting with the bank stays at the original level throughout the scene.
 */
export function createRiverMaterial() {
  return new THREE.ShaderMaterial({
    name: '寒江・緩流淡墨',
    uniforms: {
      uTime: { value: 0 },
      // THREE.Color converts these sRGB art colours to shader linear space.
      uWater: { value: new THREE.Color('#dce6e7') },
      uWash: { value: new THREE.Color('#d0dfe1') },
      uInk: { value: new THREE.Color('#a9c0c4') },
      uPaper: { value: new THREE.Color('#edf0ed') },
      uShoreMist: { value: new THREE.Color('#f4f4ef') },
    },
    vertexShader: /* glsl */`
      varying vec3 vRiverWorld;
      varying float vRiverDepth;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vec4 view = viewMatrix * world;
        vRiverWorld = world.xyz;
        vRiverDepth = length(view.xyz);
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform vec3 uWater;
      uniform vec3 uWash;
      uniform vec3 uInk;
      uniform vec3 uPaper;
      uniform vec3 uShoreMist;
      varying vec3 vRiverWorld;
      varying float vRiverDepth;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
      float softNoise(vec2 p) {
        vec2 cell = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash21(cell), hash21(cell + vec2(1.0, 0.0)), f.x),
                   mix(hash21(cell + vec2(0.0, 1.0)), hash21(cell + vec2(1.0)), f.x), f.y);
      }
      float rippleStroke(float phase, float width) {
        float d = abs(sin(phase));
        float aa = max(fwidth(d) * 0.8, 0.0025);
        return 1.0 - smoothstep(max(0.0, width - aa), width + aa, d);
      }

      void main() {
        float t = uTime;
        vec2 p = vRiverWorld.xz;
        // Water travels only a few centimetres per second. The two unequal
        // speeds, curved phases and broken masks prevent a fixed stripe grid.
        vec2 flow = p + vec2(-t * 0.045, t * 0.028);
        flow.x += sin(p.y * 0.027 + t * 0.031) * 0.9;
        float broad = softNoise(flow * vec2(0.028, 0.045));
        float wash = softNoise(flow * vec2(0.067, 0.103) + 17.0);
        vec3 color = mix(uWater, uWash, 0.045 + broad * 0.27 + wash * 0.055);

        float phaseA = flow.x * 0.68
                     + sin(flow.y * 0.072 + t * 0.026) * 1.30
                     + sin(flow.y * 0.137 - flow.x * 0.018 + t * 0.071) * 0.32
                     + (broad - 0.5) * 0.55;
        float phaseB = flow.x * 1.07
                     + sin(flow.y * 0.093 - t * 0.021) * 0.81
                     + sin(flow.y * 0.191 + flow.x * 0.037) * 0.21
                     + wash * 0.75 - t * 0.019;

        // Long gaps and short dry-brush flecks; most of the river stays blank.
        float islands = softNoise(flow * vec2(0.24, 0.10) + vec2(4.0, t * 0.003));
        float fibres = softNoise(flow * vec2(1.8, 0.72));
        float gapsA = smoothstep(0.28, 0.64, islands)
                    * smoothstep(0.16, 0.52, fibres);
        float gapsB = smoothstep(0.40, 0.74, softNoise(flow * vec2(0.36, 0.11) + 32.0))
                    * smoothstep(0.14, 0.57, softNoise(flow * vec2(2.3, 0.94) + 9.0));

        // Slow 11–18 second breathing gives a visible, soft rise and fall,
        // even while the much slower current carries each stroke downstream.
        float breathA = 0.69 + 0.31 * sin(t * 0.43 + broad * 5.0);
        float breathB = 0.70 + 0.30 * sin(t * 0.56 + wash * 6.0);
        float inkA = rippleStroke(phaseA, 0.067) * gapsA * breathA;
        float inkB = rippleStroke(phaseB, 0.035) * gapsB * breathB;
        float distanceFade = 1.0 - smoothstep(75.0, 310.0, vRiverDepth) * 0.60;
        color = mix(color, uInk, clamp((inkA * 0.56 + inkB * 0.31) * distanceFade, 0.0, 0.58));

        // A pale, broad neighbour to occasional ink strokes is a painted
        // reflection, rather than a glossy highlight or a sun reflection.
        float lightStroke = rippleStroke(phaseA + 0.15, 0.072) * gapsA;
        float palePatch = smoothstep(0.66, 0.90, softNoise(flow * vec2(0.039, 0.092) + 71.0));
        float glimmer = (0.63 + 0.37 * sin(t * 0.35 + wash * 4.0));
        color = mix(color, uPaper, (lightStroke * 0.18 + palePatch * 0.065) * glimmer * distanceFade);
        color = mix(color, uPaper, smoothstep(130.0, 380.0, vRiverDepth) * 0.27);

        // Match the world's low opposite bank. Broken mist dissolves the
        // otherwise ruler-straight join between the water and snowy land.
        float oppositeBank=67.0+sin(p.y*0.019)*6.0+sin(p.y*0.041)*2.5;
        float shoreDistance=oppositeBank-p.x;
        float mistWidth=13.0+softNoise(p*vec2(0.08,0.13))*7.0;
        float shoreMist=1.0-smoothstep(0.0,mistWidth,shoreDistance);
        color=mix(color,uShoreMist,shoreMist*0.98);

        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
    side: THREE.DoubleSide,
    toneMapped: false,
    transparent: false,
    depthWrite: true,
  });
}
