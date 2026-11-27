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

export function addSky(scene: THREE.Scene, onReady: () => void) {
  // Tilt the surveyed galactic plane across the default Solar System view.
  const forward = new THREE.Vector3(0, -.58, -.81).normalize()
  const right = new THREE.Vector3(1, 0, 0)
  const up = new THREE.Vector3().crossVectors(right, forward)
  const north = up.multiplyScalar(.86).addScaledVector(right, -.49).addScaledVector(forward, -.15).normalize()
  const east = new THREE.Vector3().crossVectors(forward, north).normalize()
  const center = new THREE.Vector3().crossVectors(north, east)
  const ready = { value: 0 }
  let disposed = false
  const background = new THREE.TextureLoader().load(import.meta.env.BASE_URL + 'sky/milky-way.webp', () => {
    if (disposed) return
    ready.value = 1
    onReady()
  })
  background.wrapS = THREE.RepeatWrapping
  background.anisotropy = 2
  background.addEventListener('dispose', () => { disposed = true })

  const sky = new THREE.Mesh(new THREE.SphereGeometry(164, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      effects: { value: 1 }, ready, nebula: { value: background },
    },
    vertexShader: /* glsl */ `
      varying vec2 sampleUv;
      void main() {
        sampleUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
      }`,
    fragmentShader: /* glsl */ `
      uniform float effects, ready;
      uniform sampler2D nebula;
      varying vec2 sampleUv;
      void main() {
        vec3 col = vec3(.006,.012,.027);
        if (effects > .0 && ready > .0) {
          float latitude = (sampleUv.y - .5) * 3.1415927;
          float longitude = (.5 - sampleUv.x) * 6.2831853;
          vec3 photo = texture2D(nebula, vec2(.938 - sampleUv.x, sampleUv.y)).rgb;
          float luma = dot(photo, vec3(.2126,.7152,.0722));
          float violet = smoothstep(-.26,.36,sin(longitude));
          vec3 tint = mix(vec3(.46,.64,.89), vec3(.66,.57,.82), violet);
          vec3 starlight = pow(mix(vec3(luma), photo, .55), vec3(1.12));
          float arm = exp(-latitude * latitude * 24.);
          col += (starlight * tint * .70 + vec3(.012,.022,.049) * arm) * effects;
        }
        gl_FragColor = vec4(col, 1.);
      }`,
  }))
  sky.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(center, north, east))
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
