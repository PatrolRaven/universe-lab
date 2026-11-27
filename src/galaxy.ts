import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { applyPlanetCameraKey } from './planet-explorer'
import { galacticCenterDistance, nearbyRadius, type AtlasMapPoint } from './stellar-atlas'

const solarDistance = galacticCenterDistance
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

function neighborhoodRings() {
  const points: number[] = []
  for (const distance of [5, 10, 20, nearbyRadius]) {
    const segments = 96
    for (let index = 0; index < segments; index++) {
      const from = index * Math.PI * 2 / segments
      const to = (index + 0.78) * Math.PI * 2 / segments
      points.push(distance * Math.cos(from), 0, distance * Math.sin(from),
        distance * Math.cos(to), 0, distance * Math.sin(to))
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: '#34506a', transparent: true, opacity: 0.65 }))
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
  private nearby = false
  private readonly nearbyGuide = neighborhoodRings()
  private visibleIds = new Set<string>()
  private selectedId = ''

  constructor(canvas: HTMLCanvasElement, private readonly marker: HTMLButtonElement, compact: boolean,
    private readonly atlasMarkers: readonly { point: AtlasMapPoint; button: HTMLButtonElement }[] = []) {
    const controls = this.controls = new OrbitControls(this.camera, canvas)
    controls.enabled = false
    this.scene.background = new THREE.Color('#050910')
    this.nearbyGuide.visible = false
    this.scene.add(this.nearbyGuide)
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
    if (this.nearby) this.camera.position.multiplyScalar(nearbyRadius / radius)
    this.controls.update()
  }

  locateSun() {
    this.stopMotion()
    const center = this.nearby ? new THREE.Vector3() : sun
    this.camera.position.sub(this.controls.target).setLength(19).add(center)
    this.controls.target.copy(center)
    this.controls.update()
  }

  setAtlas(ids: readonly string[], selected: string, nearby: boolean, focus?: AtlasMapPoint) {
    this.visibleIds = new Set(ids)
    this.selectedId = selected
    if (this.nearby !== nearby) {
      this.nearby = nearby
      this.nearbyGuide.visible = nearby
      this.clouds.slice(1).forEach(cloud => { cloud.visible = !nearby })
      this.overview()
    }
    if (focus) {
      this.stopMotion()
      const target = new THREE.Vector3(...(nearby ? focus.local : focus.galactic))
      this.camera.position.sub(this.controls.target).setLength(nearby ? 12 : 11).add(target)
      this.controls.target.copy(target)
      this.controls.update()
    }
    this.dirty = true
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
    const used: [number, number][] = []
    const hosts = new Set<string>()
    const selected = this.atlasMarkers.find(item => item.point.id === this.selectedId)
    const markers = selected ? this.atlasMarkers.filter(item => item !== selected) : this.atlasMarkers
    if (selected && this.visibleIds.has(selected.point.id)) {
      const host = selected.point.hostId ?? selected.point.id
      this.placeMarker(selected.button, this.nearby ? selected.point.local : selected.point.galactic, width, height, used, true)
      if (!selected.button.hidden) hosts.add(host)
    }
    if (this.atlasMarkers.length) this.marker.hidden = !this.visibleIds.has('solar')
    if (!this.marker.hidden || !this.atlasMarkers.length) {
      this.placeMarker(this.marker, this.nearby ? [0, 0, 0] : galaxyDestinations[0].position, width, height, used)
    }
    for (const { point, button } of markers) {
      const host = point.hostId ?? point.id
      if (!this.visibleIds.has(point.id) || hosts.has(host)) {
        button.hidden = true
        continue
      }
      this.placeMarker(button, this.nearby ? point.local : point.galactic, width, height, used, point.id === this.selectedId)
      if (!button.hidden) hosts.add(host)
    }
  }

  private placeMarker(button: HTMLButtonElement, position: readonly [number, number, number],
    width: number, height: number, used: [number, number][], selected = false) {
    const point = this.projected.set(...position).project(this.camera)
    const x = (point.x + 1) * width / 2
    const y = (1 - point.y) * height / 2
    button.hidden = point.z < -1 || point.z > 1 || x < 22 || x > width - 22 || y < 22 || y > height - 22 ||
      (!selected && used.some(([px, py]) => Math.hypot(px - x, py - y) < 34))
    if (button.hidden) return
    used.push([x, y])
    button.style.left = x + 'px'
    button.style.top = y + 'px'
    button.classList.toggle('marker-left', x > width / 2)
  }

  dispose() {
    this.controls.dispose()
    this.nearbyGuide.geometry.dispose()
    this.nearbyGuide.material.dispose()
    for (const { geometry, material } of this.clouds) {
      geometry.dispose()
      material.dispose()
    }
    this.scene.clear()
  }
}
