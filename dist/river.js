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
      uWater: { value: new THREE.Color('#becfd4') },
      uWash: { value: new THREE.Color('#c7ccca') },
      uInk: { value: new THREE.Color('#8da5ab') },
      uLightWash: { value: new THREE.Color('#d5dfdf') },
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
      uniform vec3 uLightWash;
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
        // The current runs down the river at 0.23 m/s. A short observation
        // reveals the moving broken strokes, without rapid shimmer or waves.
        vec2 flow = p - vec2(t * 0.050, t * 0.220);
        flow.x += sin(p.y * 0.028 + t * 0.12) * 0.34;

        // Three substantial paint regions are all grey or grey-blue, including
        // the lightest wash. The river contains no white paper core or bright
        // highlight. Domain warping keeps the painted patches irregular.
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
        // Broad wet-on-wet transitions and frayed light-grey wash edges.
        float blueRegion = 1.0 - smoothstep(0.325, 0.515, region);
        float lightRegion = smoothstep(0.438, 0.632, region);
        float lightBites = smoothstep(0.62, 0.82, bleed)
                         * smoothstep(0.43, 0.54, region) * 0.32;
        lightRegion = min(1.0 - blueRegion, lightRegion + (1.0 - lightRegion) * lightBites);
        float greyRegion = max(0.0, 1.0 - blueRegion - lightRegion);
        vec3 color = uWater * blueRegion + uWash * greyRegion + uLightWash * lightRegion;

        // Thin ink bloom and fine pigment remain visible inside every shade,
        // including the light-grey regions; none of them is blank white.
        float pigment = softNoise(flow * vec2(0.26, 0.074) + vec2(11.0, 36.0));
        color = mix(color, uInk, smoothstep(0.52, 0.86, pigment) * 0.075);
        float thinStain = softNoise(flow * vec2(2.7, 0.93) + vec2(7.0, 61.0));
        float inkFlecks = smoothstep(0.57, 0.82, softNoise(flow * vec2(6.1, 2.2) + vec2(27.0, 17.0)));
        float stain = 0.009 + thinStain * 0.025 + inkFlecks * 0.020;
        color = mix(color, uInk, stain);

        float strokeWarp = softNoise(flow * vec2(0.15, 0.081) + vec2(64.0, 13.0));
        float phaseA = flow.x * 0.61
                     + sin(flow.y * 0.145 + t * 0.16) * 0.96
                     + sin(flow.y * 0.041 - flow.x * 0.022) * 0.61
                     + (strokeWarp - 0.5) * 1.65;
        float phaseB = flow.x * 0.88
                     + sin(flow.y * 0.187 - t * 0.11) * 0.72
                     + sin(flow.y * 0.067 + flow.x * 0.031) * 0.29
                     + wash * 0.58 + (bleed - 0.5) * 0.45;

        // These roughly 0.12–0.23 m strokes are wide enough to survive the
        // mountain-top view. The long broken masks prevent a regular grid.
        float islands = softNoise(flow * vec2(0.28, 0.13) + vec2(4.0, 2.0));
        float fibres = softNoise(flow * vec2(1.5, 0.91));
        float gapsA = smoothstep(0.28, 0.61, islands)
                    * smoothstep(0.16, 0.55, fibres);
        float gapsB = smoothstep(0.39, 0.69, softNoise(flow * vec2(0.41, 0.16) + 32.0))
                    * smoothstep(0.15, 0.60, softNoise(flow * vec2(1.9, 1.1) + 9.0));
        float breathA = 0.82 + 0.18 * sin(t * 0.58 + broad * 5.0);
        float breathB = 0.79 + 0.21 * sin(t * 0.71 + wash * 6.0);
        float inkA = rippleStroke(phaseA, 0.078) * gapsA * breathA;
        float inkB = rippleStroke(phaseB, 0.055) * gapsB * breathB;
        float distanceFade = 1.0 - smoothstep(100.0, 360.0, vRiverDepth) * 0.13;
        color = mix(color, uInk, clamp((inkA * 0.73 + inkB * 0.51) * distanceFade, 0.0, 0.77));

        // Light-grey companion strokes stay inside the muted grey-blue
        // palette. They never become white foam or sparkling highlights.
        float paleStroke = rippleStroke(phaseA + 0.19, 0.11) * gapsA;
        color = mix(color, uLightWash, paleStroke * 0.25 * distanceFade);

        // Match the world's low opposite bank. Broken mist dissolves the
        // otherwise ruler-straight join between the water and snowy land.
        float oppositeBank=67.0+sin(p.y*0.019)*6.0+sin(p.y*0.041)*2.5;
        float shoreDistance=oppositeBank-p.x;
        float mistWidth=8.0+softNoise(p*vec2(0.08,0.13))*6.0;
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
