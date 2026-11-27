import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { applyPlanetCameraKey } from './planet-explorer'

const solarDistance = 8.178
export const galaxyDestinations = [
  { id: 'solar', kind: 'observed', position: [0, 0, solarDistance] },
  { id: 'binary', kind: 'educational' },
  { id: 'sandbox', kind: 'scenario' },
] as const

const radius = 17
const sun = new THREE.Vector3(...galaxyDestinations[0].position)
const offset = new THREE.Vector3(0.38, 1.3, 1).normalize()

function galaxyOverview(camera: THREE.PerspectiveCamera, controls: OrbitControls) {
  const halfFov = THREE.MathUtils.degToRad(camera.fov / 2)
  const halfWidth = Math.atan(Math.tan(halfFov) * camera.aspect)
  controls.target.set(0, 0, 0)
  camera.position.copy(offset).multiplyScalar(radius / Math.sin(Math.min(halfFov, halfWidth)) * 1.02)
  controls.update()
}

function randomSequence() {
  let seed = 17291
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
}

interface Particle {
  x: number
  y: number
  z: number
  color: THREE.Color
  size: number
  opacity: number
}

function cloud(count: number, sample: () => Particle, diffuse = false, dust = false) {
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const appearance = new Float32Array(count * 2)
  for (let i = 0; i < count; i++) {
    const { x, y, z, color, size, opacity } = sample()
    positions.set([x, y, z], i * 3)
    color.toArray(colors, i * 3)
    appearance.set([size, opacity], i * 2)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('tint', new THREE.BufferAttribute(colors, 3))
  geometry.setAttribute('appearance', new THREE.BufferAttribute(appearance, 2))
  const material = new THREE.ShaderMaterial({
    uniforms: { pixelRatio: { value: 1 }, projectionScale: { value: 1 } },
    defines: { DIFFUSE: diffuse ? 1 : 0 },
    transparent: true,
    depthWrite: false,
    blending: dust ? THREE.NormalBlending : THREE.AdditiveBlending,
    vertexShader: `
      uniform float pixelRatio, projectionScale;
      attribute vec3 tint;
      attribute vec2 appearance;
      varying vec4 light;
      void main() {
        vec4 view = modelViewMatrix * vec4(position, 1.);
        gl_Position = projectionMatrix * view;
        float scale = DIFFUSE == 1 ? projectionScale : 40. * pixelRatio;
        float limit = DIFFUSE == 1 ? 160. : 9.;
        gl_PointSize = clamp(appearance.x * scale / max(1., -view.z), 1., limit * pixelRatio);
        light = vec4(tint, appearance.y);
      }
    `,
    fragmentShader: `
      varying vec4 light;
      void main() {
        vec2 p = gl_PointCoord * 2. - 1.;
        float d = dot(p, p);
        float alpha = exp(-d * (DIFFUSE == 1 ? 3.8 : 4.5)) * (1. - smoothstep(.55, 1., d));
        gl_FragColor = vec4(light.rgb, light.a * alpha);
        #include <colorspace_fragment>
      }
    `,
  })
  return new THREE.Points(geometry, material)
}

export class Galaxy {
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 360)
  readonly controls: OrbitControls
  private dirty = true
  private framed = false
  private readonly projected = new THREE.Vector3()
  private readonly clouds: ReturnType<typeof cloud>[]

  constructor(canvas: HTMLCanvasElement, private readonly marker: HTMLButtonElement, compact: boolean) {
    const controls = this.controls = new OrbitControls(this.camera, canvas)
    controls.enabled = false
    this.scene.background = new THREE.Color('#050910')
    controls.enableDamping = !matchMedia('(prefers-reduced-motion: reduce)').matches
    controls.dampingFactor = 0.13
    controls.minDistance = 2.6
    controls.maxDistance = 160
    controls.zoomSpeed = 0.85
    controls.addEventListener('change', () => { this.dirty = true })

    const random = randomSequence()
    const tau = Math.PI * 2
    const spread = () => random() + random() + random() - 1.5
    const blue = new THREE.Color('#85b6ec')
    const ice = new THREE.Color('#cfe4ff')
    const gold = new THREE.Color('#ffd196')
    const warm = new THREE.Color('#ffedcd')
    const rose = new THREE.Color('#e3949f')
    const dark = new THREE.Color('#171117')
    const ends = [17, 14.2, 16.5, 13.5]
    const turns = [3.62, 3.85, 3.7, 4.08]
    const orbit = (r: number, angle: number, y: number) => ({ x: r * Math.cos(angle), y, z: r * Math.sin(angle) })
    const arm = (lane = 0) => {
      const local = random() < 0.09
      const index = Math.floor(random() * 4)
      const r = local ? solarDistance + spread() * 3.3 : 3.1 + (ends[index] - 3.1) * random() ** 0.85
      const phase = local
        ? Math.PI / 2 + 3.95 * Math.log(r / solarDistance)
        : 0.62 + index * tau / 4 + turns[index] * Math.log(r / 3.1) + 0.13 * Math.sin(r + index)
      const width = 0.36 + r * 0.034
      const angle = phase + (spread() * width + lane) / r
      return orbit(r, angle, spread() * (0.34 + r * 0.019))
    }
    const core = () => {
      const bar = random() < 0.62
      const along = spread() * (bar ? 5.2 : 2.15)
      const across = spread() * (bar ? 1.06 : 1.72)
      return {
        x: along * 0.81 - across * 0.59,
        y: spread() * (bar ? 0.60 : 1.30),
        z: along * 0.59 + across * 0.81,
      }
    }
    const count = (large: number) => compact ? Math.round(large * 0.52) : large
    this.clouds = [
      cloud(count(2300), () => {
        const y = random() * 2 - 1
        const p = orbit(Math.sqrt(1 - y * y) * 225, random() * tau, y * 225)
        return { ...p, color: random() < 0.65 ? ice : gold, size: 6 + random() ** 4 * 22, opacity: 0.22 + random() ** 3 * 0.72 }
      }),
      cloud(count(3900), () => ({
        ...(random() < 0.14 ? core() : arm()),
        color: random() < 0.18 ? rose : blue, size: 0.6 + random() ** 2 * 2.9, opacity: 0.009 + random() * 0.046,
      }), true),
      cloud(count(2050), () => ({
        ...arm(0.48), color: dark, size: 0.48 + random() ** 2 * 1.65, opacity: 0.026 + random() * 0.07,
      }), true, true),
      cloud(count(3400), () => ({
        ...core(), color: random() < 0.37 ? warm : gold, size: 0.35 + random() ** 3 * 1.0, opacity: 0.010 + random() * 0.035,
      }), true),
      cloud(count(72000), () => {
        const central = random() < 0.22
        const p = central ? core() : random() < 0.76 ? arm() : orbit(radius * Math.sqrt(random()), random() * tau, spread() * 0.9)
        const color = central ? (random() < 0.36 ? warm : gold) : (random() < 0.74 ? blue : ice)
        return { ...p, color, size: 0.40 + random() ** 7 * 2.35, opacity: 0.021 + random() ** 3 * 0.29 }
      }),
    ]
    this.clouds.forEach((points, index) => {
      points.renderOrder = index
      this.scene.add(points)
    })
  }

  resize(width: number, height: number, ratio: number) {
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.controls.maxDistance = Math.max(160, 100 / this.camera.aspect)
    if (!this.framed) {
      this.framed = true
      this.overview()
    }
    for (const { material } of this.clouds) {
      material.uniforms.pixelRatio.value = ratio
      material.uniforms.projectionScale.value = height * ratio * this.camera.projectionMatrix.elements[5] * 0.5
    }
    this.dirty = true
  }

  setActive(active: boolean) {
    if (!active && this.controls.enabled) this.stopMotion()
    this.controls.enabled = active
  }

  private stopMotion() {
    if (!this.controls.enableDamping) return
    // Consume OrbitControls' pending movement, then restore the displayed pose.
    this.controls.saveState()
    this.controls.enableDamping = false
    this.controls.update()
    this.controls.reset()
    this.controls.enableDamping = true
  }

  overview() {
    this.stopMotion()
    galaxyOverview(this.camera, this.controls)
  }

  locateSun() {
    this.stopMotion()
    this.camera.position.sub(this.controls.target).setLength(19).add(sun)
    this.controls.target.copy(sun)
    this.controls.update()
  }

  key(key: string, shift: boolean) {
    if (!shift) return applyPlanetCameraKey(this.controls, key)
    switch (key) {
      case 'ArrowLeft': this.controls.pan(36, 0); break
      case 'ArrowRight': this.controls.pan(-36, 0); break
      case 'ArrowUp': this.controls.pan(0, 36); break
      case 'ArrowDown': this.controls.pan(0, -36); break
      default: return false
    }
    return true
  }

  render(renderer: THREE.WebGLRenderer, width: number, height: number) {
    this.controls.update()
    if (!this.dirty) return
    this.dirty = false
    renderer.render(this.scene, this.camera)
    const point = this.projected.copy(sun).project(this.camera)
    const x = (point.x + 1) * width / 2
    const y = (1 - point.y) * height / 2
    this.marker.hidden = point.z < -1 || point.z > 1 || x < 22 || x > width - 22 || y < 22 || y > height - 22
    this.marker.style.left = x + 'px'
    this.marker.style.top = y + 'px'
    this.marker.classList.toggle('marker-left', x > width / 2)
  }

  dispose() {
    this.controls.dispose()
    for (const { geometry, material } of this.clouds) {
      geometry.dispose()
      material.dispose()
    }
    this.scene.clear()
  }
}
