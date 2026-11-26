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
        float band = dot(d, normalize(vec3(.43, .83, -.22)));
        float dust = fbm(d * 7. + vec3(3.,5.,-9.));
        float filaments = fbm(d * 24. + vec3(dust * 4., 3., -9.));
        float midBand = (band + .22) * 4.;
        float wideBand = (band + .50) * 2.2;
        float cloud = exp(-midBand * midBand) * smoothstep(.29,.77,dust + .23 * filaments);
        float farCloud = exp(-wideBand * wideBand) * dust;
        float knot = pow(max(0.,dot(d,normalize(vec3(-.2,-.83,-.55)))),6.);
        vec3 col = vec3(.013,.022,.042);
        col += cloud * vec3(.047,.085,.152) + farCloud * vec3(.02,.034,.08);
        col += cloud * knot * vec3(.091,.080,.049);
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
        vec3 col = mix(vec3(.013,.022,.042), texture2D(nebula, sampleUv).rgb, effects);
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
    starData.set([0.85 + brightness * 2.65, 0.28 + brightness * 0.66, random()], i * 3)
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
        gl_FragColor = vec4(tint, (1. - smoothstep(.02,.95,r)) * info.x * mix(.6,1.,effects));
      }`,
  }))
  stars.renderOrder = -2
  scene.add(stars)
  return { sky, stars, background }
}
