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
      uWater: { value: new THREE.Color('#c9dce0') },
      uWash: { value: new THREE.Color('#d1d4d1') },
      uInk: { value: new THREE.Color('#94acb0') },
      uPaper: { value: new THREE.Color('#fcfcf8') },
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
        // The current runs down the river at 0.21 m/s. A short observation
        // reveals the moving broken strokes, without rapid shimmer or waves.
        vec2 flow = p - vec2(t * 0.046, t * 0.205);
        flow.x += sin(p.y * 0.028 + t * 0.12) * 0.34;

        // Three substantial paint regions: blue wash, neutral grey wash and
        // genuinely blank paper. Anisotropic domain warping stretches their
        // irregular shapes along the river instead of making blue-on-blue noise.
        vec2 regionUV = flow * vec2(0.112, 0.030);
        regionUV.x += sin(regionUV.y * 1.71 + t * 0.065) * 0.34;
        regionUV.y += sin(regionUV.x * 1.33) * 0.13;
        float broad = softNoise(regionUV + vec2(3.7, 8.1));
        float wash = softNoise(regionUV * vec2(1.83, 1.37) + vec2(21.0, 7.0));
        // Two finer scales disturb the wet edges, rather than tracing hard
        // contour bands around each broad wash. Their world-space grain moves
        // with the current, so the ragged fringes do not stick to the screen.
        float bleed = softNoise(flow * vec2(0.61, 0.22) + vec2(19.0, 43.0));
        float edgeFibre = softNoise(flow * vec2(1.9, 0.71) + vec2(51.0, 6.0));
        float region = broad * 0.78 + wash * 0.22
                     + (bleed - 0.5) * 0.085 + (edgeFibre - 0.5) * 0.029;
        // Wet-on-wet transitions are about three times wider than the former
        // colour boundaries, with large pure-colour reserves inside the washes.
        float blueRegion = 1.0 - smoothstep(0.325, 0.515, region);
        float paperRegion = smoothstep(0.438, 0.632, region);
        float paperBites = smoothstep(0.62, 0.82, bleed)
                         * smoothstep(0.43, 0.54, region) * 0.32;
        paperRegion = min(1.0 - blueRegion, paperRegion + (1.0 - paperRegion) * paperBites);
        float greyRegion = max(0.0, 1.0 - blueRegion - paperRegion);
        vec3 color = uWater * blueRegion + uWash * greyRegion + uPaper * paperRegion;

        // A restrained ink bloom inside the washes adds depth while keeping
        // the paper patches white; it is not a surface shine or reflection map.
        float pigment = softNoise(flow * vec2(0.26, 0.074) + vec2(11.0, 36.0));
        color = mix(color, uInk, (1.0 - paperRegion) * smoothstep(0.56, 0.86, pigment) * 0.065);
        // A continuous thin stain and tiny dry-ink flecks stop each colour
        // reserve looking like an untextured sheet of ice. High paper cores
        // remain untouched, preserving actual white instead of tinting it grey.
        float paperCore = smoothstep(0.64, 0.70, region);
        float thinStain = softNoise(flow * vec2(2.7, 0.93) + vec2(7.0, 61.0));
        float inkFlecks = smoothstep(0.57, 0.82, softNoise(flow * vec2(6.1, 2.2) + vec2(27.0, 17.0)));
        float stain = (0.007 + thinStain * 0.022 + inkFlecks * 0.019) * (1.0 - paperCore);
        color = mix(color, uInk, stain);

        float phaseA = flow.x * 0.63
                     + sin(flow.y * 0.145 + t * 0.13) * 0.90
                     + sin(flow.y * 0.041 - flow.x * 0.022) * 0.61
                     + (broad - 0.5) * 0.45;
        float phaseB = flow.x * 0.91
                     + sin(flow.y * 0.187 - t * 0.09) * 0.64
                     + sin(flow.y * 0.067 + flow.x * 0.031) * 0.29
                     + wash * 0.58;

        // These roughly 0.12–0.23 m strokes are wide enough to survive the
        // mountain-top view. The long broken masks prevent a regular grid.
        float islands = softNoise(flow * vec2(0.28, 0.13) + vec2(4.0, 2.0));
        float fibres = softNoise(flow * vec2(1.5, 0.91));
        float gapsA = smoothstep(0.25, 0.58, islands)
                    * (0.38 + 0.62 * smoothstep(0.18, 0.56, fibres));
        float gapsB = smoothstep(0.39, 0.69, softNoise(flow * vec2(0.41, 0.16) + 32.0))
                    * smoothstep(0.15, 0.60, softNoise(flow * vec2(1.9, 1.1) + 9.0));
        float breathA = 0.82 + 0.18 * sin(t * 0.58 + broad * 5.0);
        float breathB = 0.79 + 0.21 * sin(t * 0.71 + wash * 6.0);
        float inkA = rippleStroke(phaseA, 0.071) * gapsA * breathA;
        float inkB = rippleStroke(phaseB, 0.055) * gapsB * breathB;
        float distanceFade = 1.0 - smoothstep(100.0, 360.0, vRiverDepth) * 0.18;
        color = mix(color, uInk, clamp((inkA * 0.67 + inkB * 0.48) * distanceFade, 0.0, 0.73));

        // A few pale companion strokes join the broad paper reserves. Their
        // strength stays constant: no sparkling, pulsing specular highlights.
        float whiteStroke = rippleStroke(phaseA + 0.19, 0.11) * gapsA;
        color = mix(color, uPaper, whiteStroke * 0.44 * distanceFade);

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
