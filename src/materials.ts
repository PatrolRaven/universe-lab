import * as THREE from 'three'
import type { ObjectSpec } from './data'
import { noise } from './sky'

export const sphereVertex = /* glsl */ `
  varying vec3 worldPosition;
  varying vec3 worldNormal;
  varying vec3 surface;
  void main() {
    surface = normalize(position);
    worldPosition = (modelMatrix * vec4(position,1.)).xyz;
    worldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * vec4(worldPosition,1.);
  }`

export function surfaceMaterial(
  appearance: ObjectSpec['appearance'], stellarPositions: THREE.Vector3[], stellarColors: THREE.Color[],
) {
  return new THREE.ShaderMaterial({
    vertexShader: sphereVertex,
    uniforms: {
      base: { value: new THREE.Color(appearance.color) },
      dark: { value: new THREE.Color(appearance.dark) },
      accent: { value: new THREE.Color(appearance.accent) },
      lights: { value: stellarPositions },
      lightColors: { value: stellarColors },
      angle: { value: 0 },
      style: { value: ['star', 'rock', 'gas', 'ice', 'terrestrial'].indexOf(appearance.kind) },
    },
    fragmentShader: noise + /* glsl */ `
      uniform vec3 base, dark, accent;
      uniform vec3 lights[2], lightColors[2];
      uniform float angle;
      uniform int style;
      varying vec3 worldPosition, worldNormal, surface;
      void main() {
        vec3 N = normalize(worldNormal);
        vec3 V = normalize(cameraPosition - worldPosition);
        vec3 p = vec3(surface.x*cos(angle)-surface.z*sin(angle),surface.y,surface.x*sin(angle)+surface.z*cos(angle));
        float broad = fbm(p * 4. + 9.);
        float fine = fbm(p * 22. - 6.);
        float limb = max(0.,dot(N,V));
        vec3 col;
        if (style == 0) {
          float cells = fbm(p * 15. + broad * 3. + 3.);
          float granules = mix(noise3(p * 76.), .5, smoothstep(.012,.048,length(fwidth(p))));
          float heat = .55*cells + .28*fine + .17*granules;
          col = mix(dark * .43, base * 1.32, smoothstep(.20,.63,heat));
          col = mix(col, accent * 1.16, smoothstep(.45,.80,heat) * .90);
          col *= .90 + .21*limb;
          col += accent * pow(1. - limb, 4.) * .50;
        } else {
          col = mix(dark, base, smoothstep(.27,.69,broad));
          if (style == 2 || style == 3) {
            float drift = fbm(p * vec3(5.,21.,5.) + vec3(6.,-3.,9.));
            float bands = .5 + .5*sin(p.y * (style == 2 ? 36. : 17.) + broad * 3. + drift * 1.65);
            float narrow = .5 + .5*sin(p.y * 79. + drift * 2.);
            col = mix(col, accent, bands * (style == 2 ? .68 : .29));
            col *= .86 + .19*drift + .12*narrow;
          } else if (style == 4) {
            col = mix(dark, base, smoothstep(.24,.68,broad));
            col = mix(col, accent, smoothstep(.47,.56,fbm(p * 5. + fine * .4)));
            float clouds = fbm(p * vec3(7.,15.,7.) + vec3(14.,2.,9.));
            col = mix(col, vec3(.77,.88,.99), smoothstep(.52,.71,clouds) * .78);
          } else {
            col *= .72 + fine * .56;
            col = mix(col, accent, smoothstep(.55,.83,fine) * .34);
          }
          vec3 lighting = vec3(.107,.119,.146);
          float reflectance = 0.;
          for(int i=0; i<2; i++) {
            vec3 L = normalize(lights[i] - worldPosition + vec3(.0001));
            lighting += mix(lightColors[i], vec3(length(lightColors[i]) * .54), .26) * (1.08 * max(0., dot(N,L)));
            reflectance += length(lightColors[i]) * pow(max(0., dot(N,normalize(L + V))),38.) * .085;
          }
          col = col * lighting + reflectance;
          vec3 haze = style == 4 ? vec3(.11,.44,1.) : base;
          col += haze * pow(1. - limb, 4.) * (style == 4 ? .32 : .12);
        }
        gl_FragColor = vec4(col,1.);
        #include <colorspace_fragment>
      }`,
  })
}

export function haloMaterial(color: string) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { hue: { value: new THREE.Color(color) } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 hue;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2. - 1.;
        float r = length(p);
        float angle = atan(p.y, p.x + .000001);
        float plumes = .65 + .35 * sin(angle * 9. + sin(angle * 17.) * 1.6);
        float edge = max(0., r - .091);
        float corona = exp(-edge * (35. - 14. * plumes)) * (.19 + .18 * plumes);
        float rimDistance = (r - .094) * 115.;
        float rim = exp(-rimDistance * rimDistance) * .38;
        float aura = exp(-r * 5.1) * .52;
        float flare = exp(-abs(p.y) * 115. - abs(p.x) * 4.8) * .13;
        gl_FragColor = vec4(hue, (corona + rim + aura + flare) * (1. - smoothstep(.48,.98,r)));
      }`,
  })
}

export function ringMaterial(appearance: ObjectSpec['appearance']) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide, transparent: true, depthWrite: false,
    uniforms: { color: { value: new THREE.Color(appearance.accent) } },
    vertexShader: /* glsl */ `
      varying vec2 ringPosition;
      void main() {
        ringPosition = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.);
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 ringPosition;
      uniform vec3 color;
      void main() {
        float r = length(ringPosition);
        float pixel = fwidth(r);
        float detail = 1. - smoothstep(.006,.027,pixel);
        float rings = .60 + .18 * sin(r * 114.) * detail + .16 * sin(r * 31.);
        float gap = smoothstep(.015,.035,abs(r - 1.86));
        float edge = smoothstep(1.3,1.45,r) * (1. - smoothstep(2.18,2.32,r));
        vec3 dust = mix(color * vec3(.65,.71,.81), color, smoothstep(1.36,2.15,r));
        gl_FragColor = vec4(dust, rings * gap * edge * .82);
        #include <colorspace_fragment>
      }`,
  })
}
