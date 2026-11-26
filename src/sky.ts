import * as THREE from 'three'

export const noise = /* glsl */ `
float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(.13, .31, .57));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise3(vec3 p) {
  vec3 id = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(id), hash(id+vec3(1,0,0)), f.x), mix(hash(id+vec3(0,1,0)), hash(id+vec3(1,1,0)), f.x), f.y),
    mix(mix(hash(id+vec3(0,0,1)), hash(id+vec3(1,0,1)), f.x), mix(hash(id+vec3(0,1,1)), hash(id+vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float n = .53 * noise3(p);
  n += .27 * noise3(p * 2.1 + 4.7);
  n += .13 * noise3(p * 4.3 + 7.1);
  n += .07 * noise3(p * 8.8 + 13.2);
  return n;
}`

let seed = 7189
function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
  return seed / 4294967296
}

function renderNebula(renderer: THREE.WebGLRenderer) {
  const background = new THREE.WebGLRenderTarget(1024, 512, {
    depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
  })
  const stage = new THREE.Scene()
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec2 sampleUv;
      void main() {
        sampleUv = uv;
        gl_Position = vec4(position.xy, 0., 1.);
      }`,
    fragmentShader: noise + /* glsl */ `
      varying vec2 sampleUv;
      void main() {
        float azimuth = sampleUv.x * 6.2831853;
        float polar = (1. - sampleUv.y) * 3.1415927;
        vec3 d = vec3(-cos(azimuth) * sin(polar), cos(polar), sin(azimuth) * sin(polar));
        // Bake the dust lanes and their embedded star field once, not per frame.
        float plane = dot(d, normalize(vec3(-.56,.60,-.57)));
        float cloud = fbm(d * 8. + vec3(3.,5.,-9.));
        float band = plane - .13 + (cloud - .5) * .23;
        vec3 stretched = d + vec3(-.56,.60,-.57) * plane * 2.6;
        float filament = fbm(stretched * 29. + vec3(4.,-2.,7.));
        float density = smoothstep(.26,.76,cloud * .66 + filament * .47);
        float core = exp(-band * band * 101.);
        float glow = exp(-band * band * 17.);
        float lane = exp(-pow(abs(band + .021 + (filament - .5) * .11) * 23., 2.));
        float clear = 1. - .79 * lane;
        float warm = pow(max(0., dot(d, normalize(vec3(.33,-.39,-.86)))), 45.);
        float cool = pow(max(0., dot(d, normalize(vec3(-.51,-.72,-.47)))), 18.);
        float pin = pow(smoothstep(.44,1.,noise3(d * 232.)), 7.) * density;
        vec3 col = vec3(.009,.017,.036) + vec3(.014,.027,.061) * glow * cloud;
        col += glow * density * vec3(.036,.062,.130);
        col += core * density * clear * vec3(.105,.101,.237);
        col += core * clear * density * cool * vec3(.026,.109,.22);
        col += warm * glow * (.38 + .62 * clear) * density * vec3(.43,.196,.097);
        col += pin * glow * vec3(.29,.37,.63);
        gl_FragColor = vec4(col, 1.);
      }`,
  }))
  quad.frustumCulled = false
  stage.add(quad)
  renderer.setRenderTarget(background)
  renderer.render(stage, new THREE.Camera())
  renderer.setRenderTarget(null)
  quad.material.dispose()
  quad.geometry.dispose()
  return background
}

export function addSky(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
  const background = renderNebula(renderer)
  const sky = new THREE.Mesh(new THREE.SphereGeometry(164, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { effects: { value: 1 }, nebula: { value: background.texture } },
    vertexShader: /* glsl */ `
      varying vec2 sampleUv;
      void main() {
        sampleUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
      }`,
    fragmentShader: /* glsl */ `
      uniform float effects;
      uniform sampler2D nebula;
      varying vec2 sampleUv;
      void main() {
        vec3 col = mix(vec3(.009,.017,.036), texture2D(nebula, sampleUv).rgb, effects);
        gl_FragColor = vec4(col, 1.);
      }`,
  }))
  sky.renderOrder = -3
  scene.add(sky)

  const count = 5900
  const positions = new Float32Array(count * 3)
  const starData = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const z = 2 * random() - 1
    const angle = 2 * Math.PI * random()
    const planar = Math.sqrt(1 - z * z)
    const radius = 92 + 37 * random()
    positions.set([radius * planar * Math.cos(angle), radius * z, radius * planar * Math.sin(angle)], i * 3)
    const brightness = random() ** 3
    starData.set([0.72 + brightness * 3.35, 0.23 + brightness * 0.75, random()], i * 3)
  }
  const starGeometry = new THREE.BufferGeometry()
  starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  starGeometry.setAttribute('starData', new THREE.BufferAttribute(starData, 3))
  const stars = new THREE.Points(starGeometry, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { pixelRatio: { value: 1 }, effects: sky.material.uniforms.effects },
    vertexShader: /* glsl */ `
      attribute vec3 starData;
      varying vec2 info;
      uniform float pixelRatio;
      void main() {
        info = starData.yz;
        gl_PointSize = starData.x * pixelRatio;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.);
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 info;
      uniform float effects;
      void main() {
        float r = length(gl_PointCoord - .5) * 2.;
        vec3 tint = mix(vec3(.55,.76,1.), vec3(1.,.82,.65), smoothstep(.44,.96,info.y));
        float core = 1. - smoothstep(.02,.78,r);
        float bloom = (1. - smoothstep(.10,1.,r)) * smoothstep(.78,.95,info.x) * .30;
        gl_FragColor = vec4(tint, max(core,bloom) * info.x * mix(.6,1.,effects));
      }`,
  }))
  stars.renderOrder = -2
  scene.add(stars)
  return { sky, stars, background }
}
