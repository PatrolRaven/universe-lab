import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { ObjectSpec, Scenario } from './data'
import type { Simulation } from './physics'
import { haloMaterial, ringMaterial, surfaceMaterial } from './materials'
import { addSky } from './sky'
import { OrbitForecasts, TrailHistory } from './trajectories'
import { applyEarthCameraKey, EarthCameraArc, EarthGlobe, type ExplorerQuality, type ExplorerState, type ExplorerUpdate } from './earth-explorer'

export interface Layers {
  orbits: boolean
  trails: boolean
  labels: boolean
  effects: boolean
}

const TRAIL_LENGTH = 256
const MIN_CAMERA_DISTANCE = 0.4
const setBodyPosition = (point: THREE.Vector3, body: { position: number[] }) =>
  point.set(body.position[0], body.position[1], body.position[2])

function disposeTree(root: THREE.Object3D, retained?: ReadonlySet<THREE.BufferGeometry>) {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  root.traverse(object => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
      if (!retained?.has(object.geometry)) geometries.add(object.geometry)
      materials.add(object.material)
    }
  })
  for (const geometry of geometries) geometry.dispose()
  for (const material of materials) material.dispose()
}

type Visual = ReturnType<SpaceScene['createObject']>

interface EarthSession {
  earth: Visual
  globe: EarthGlobe
  state: Exclude<ExplorerState, 'overview'>
  quality: ExplorerQuality
  error?: string
  ready: boolean
  progress: number
  from: THREE.Vector3
  fromTarget: THREE.Vector3
  savedPosition: THREE.Vector3
  savedTarget: THREE.Vector3
  savedView: 'overview' | 'focus' | 'free'
  savedFocus: Visual | undefined
  minDistance: number
  maxDistance: number
}

export class SpaceScene {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.025, 245)
  private readonly controls: OrbitControls
  private readonly contents = new THREE.Group()
  private readonly sky: ReturnType<typeof addSky>
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointer = new THREE.Vector2()
  private readonly down = new THREE.Vector2()
  private readonly projected = new THREE.Vector3()
  private readonly direction = new THREE.Vector3(0, 0.72, 0.69).normalize()
  private readonly cameraOffset = new THREE.Vector3()
  private readonly aim = new THREE.Vector3()
  private readonly delta = new THREE.Vector3()
  private readonly anchor = new THREE.Vector3()
  private readonly axisVector = new THREE.Vector3()
  private readonly inverseView = new THREE.Quaternion()
  private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
  private readonly axisLines: NodeListOf<HTMLElement>
  private readonly axisLabels: NodeListOf<HTMLElement>
  private readonly resizeObserver: ResizeObserver
  private readonly lifecycle = new AbortController()
  private readonly lightPositions = [new THREE.Vector3(), new THREE.Vector3()]
  private readonly lightColors = [new THREE.Color(0), new THREE.Color(0)]
  private readonly forecasts = new OrbitForecasts()
  private readonly sphere = new THREE.SphereGeometry(1, 48, 32)
  private readonly plane = new THREE.PlaneGeometry(2, 2)
  private readonly ring = new THREE.RingGeometry(1.3, 2.32, 112)
  private readonly sharedGeometries = new Set<THREE.BufferGeometry>([this.sphere, this.plane, this.ring])
  private activeScenario: Scenario | undefined
  private earthSession: EarthSession | undefined
  private readonly earthDirection = new THREE.Vector3()
  private readonly earthArc = new EarthCameraArc()
  private visuals: Visual[] = []
  private labelOrder: Visual[] = []
  private meshes: THREE.Object3D[] = []
  private width = 1
  private height = 1
  private frame = 10
  private focused: Visual | undefined
  private view: 'overview' | 'focus' | 'free' = 'overview'
  private transition = false
  private dirty = true
  private applyingCamera = false
  private renderedTime = -Infinity
  private sampleTime = -Infinity
  private layers: Layers = { orbits: true, trails: true, labels: true, effects: true }

  constructor(
    private readonly viewport: HTMLElement,
    private readonly labels: HTMLElement,
    onSelect: (id: string) => void,
    onContextLoss: () => void,
    private readonly onExplorer: ExplorerUpdate,
  ) {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('webgl2', { antialias: true, alpha: false })
    if (!context) throw new Error('WebGL 2 is unavailable')
    this.renderer = new THREE.WebGLRenderer({ canvas, context })
    this.sky = addSky(this.scene, this.renderer)
    this.renderer.domElement.className = 'space-canvas'
    this.renderer.domElement.setAttribute('aria-hidden', 'true')
    viewport.prepend(this.renderer.domElement)
    this.axisLines = viewport.querySelectorAll('.view-axis span')
    this.axisLabels = viewport.querySelectorAll('.view-axis i')
    this.scene.add(this.contents)
    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.12
    this.controls.minDistance = MIN_CAMERA_DISTANCE
    this.controls.maxDistance = 48
    this.controls.zoomSpeed = 0.8

    this.controls.addEventListener('change', () => {
      this.dirty = true
      if (!this.applyingCamera && (this.transition || this.view === 'overview')) {
        this.view = 'free'
        this.transition = false
      }
    })

    const { signal } = this.lifecycle
    let pressed = false
    let activePointers = 0
    canvas.addEventListener('pointerdown', event => {
      activePointers++
      pressed = activePointers === 1 && event.button === 0
      this.down.set(event.clientX, event.clientY)
    }, { signal })
    canvas.addEventListener('pointercancel', () => {
      activePointers = Math.max(0, activePointers - 1)
      pressed = false
    }, { signal })
    canvas.addEventListener('pointerup', event => {
      activePointers = Math.max(0, activePointers - 1)
      const pick = pressed && this.down.distanceTo(this.pointer.set(event.clientX, event.clientY)) <= 5
      pressed = false
      if (!pick || this.earthSession) return
      const rect = canvas.getBoundingClientRect()
      this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2)
      this.raycaster.setFromCamera(this.pointer, this.camera)
      const hit = this.raycaster.intersectObjects(this.meshes, false)[0]
      if (hit) onSelect(hit.object.name)
    }, { signal })
    labels.addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button[data-object]')
      if (button?.dataset.object) onSelect(button.dataset.object)
    }, { signal })
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault()
      onContextLoss()
    }, { signal })

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(viewport)
    this.resize()
  }

  private createObject(spec: ObjectSpec, path: Float32Array) {
    const group = new THREE.Group()
    const { appearance } = spec
    const surface = new THREE.Mesh(this.sphere, surfaceMaterial(appearance, this.lightPositions, this.lightColors))
    surface.name = spec.id
    surface.scale.setScalar(appearance.size)
    group.add(surface)

    let halo: THREE.Mesh | null = null
    let light: THREE.PointLight | null = null
    if (appearance.kind === 'star') {
      halo = new THREE.Mesh(this.plane, haloMaterial(appearance.color))
      halo.scale.setScalar(appearance.size * 10.8)
      halo.renderOrder = 2
      group.add(halo)
      light = new THREE.PointLight(appearance.accent, 1)
      group.add(light)
    }
    if (appearance.ring) {
      const ring = new THREE.Mesh(this.ring, ringMaterial(appearance))
      ring.scale.setScalar(appearance.size)
      ring.rotation.set(-1.75, -0.32, 0)
      group.add(ring)
    }

    const orbitGeometry = new THREE.BufferGeometry()
    orbitGeometry.setAttribute('position', new THREE.BufferAttribute(path, 3))
    const orbit = new THREE.Line(orbitGeometry, new THREE.LineBasicMaterial({
      color: '#658bab', transparent: true, opacity: 0.33, depthWrite: false,
    }))
    orbit.renderOrder = -1

    const trailHistory = new TrailHistory(TRAIL_LENGTH)
    const history = new THREE.BufferAttribute(trailHistory.points, 3).setUsage(THREE.DynamicDrawUsage)
    const addHistoryRange = (start: number, count: number) => history.addUpdateRange(start, count)
    const trailGeometry = new THREE.BufferGeometry()
    trailGeometry.setAttribute('position', history)
    trailGeometry.setDrawRange(0, 0)
    const trail = new THREE.Line(trailGeometry, new THREE.LineBasicMaterial({
      color: appearance.color, transparent: true, opacity: 0.64, depthWrite: false,
    }))
    trail.frustumCulled = false
    trail.renderOrder = 1

    const label = document.createElement('button')
    label.type = 'button'
    label.className = 'object-label'
    label.dataset.object = spec.id
    label.textContent = spec.profile.name
    this.labels.append(label)
    this.contents.add(group, orbit, trail)
    const labelBox = { x: 0, y: 0, width: spec.profile.name.length * 6.1 + 14, visible: false }
    const disc = { x: 0, y: 0, radius: 0 }
    return { spec, group, surface, light, halo, orbit, trail, history, trailHistory, addHistoryRange, label, labelBox, disc }
  }

  load(scenario: Scenario, simulation: Simulation) {
    this.finishExplorer()
    const paths = this.forecasts.get(scenario, simulation, scenario.objects.map(spec => spec.period))
    if (scenario !== this.activeScenario) {
      disposeTree(this.contents, this.sharedGeometries)
      this.contents.clear()
      this.labels.replaceChildren()
      this.visuals = scenario.objects.map((spec, i) => this.createObject(spec, paths[i]))
      this.labelOrder = [...this.visuals]
      this.meshes = this.visuals.map(visual => visual.surface)
      this.activeScenario = scenario
    } else {
      for (let i = 0; i < this.visuals.length; i++) {
        const visual = this.visuals[i]
        visual.trailHistory.clear()
        visual.history.clearUpdateRanges()
        visual.trail.geometry.setDrawRange(0, 0)
        if (visual.orbit.geometry.getAttribute('position').array !== paths[i]) {
          visual.orbit.geometry.dispose()
          visual.orbit.geometry = new THREE.BufferGeometry()
          visual.orbit.geometry.setAttribute('position', new THREE.BufferAttribute(paths[i], 3))
        }
      }
    }
    this.renderedTime = -Infinity
    this.sampleTime = -Infinity
    this.frame = scenario.frame
    this.sampleTrails(simulation)
    this.setLayers(this.layers)
    this.overview(true)
  }

  select(id: string) {
    this.dirty = true
    const priority = (visual: Visual) => visual.spec.id === id ? 2 : Number(visual.light !== null)
    this.labelOrder.sort((a, b) => priority(b) - priority(a))
    for (const visual of this.visuals) {
      const selected = visual.spec.id === id
      visual.label.classList.toggle('selected', selected)
      visual.label.setAttribute('aria-pressed', String(selected))
      visual.orbit.material.color.set(selected ? '#66dce9' : '#658bab')
      visual.orbit.material.opacity = selected ? 0.72 : 0.34
      visual.trail.material.opacity = selected ? 0.88 : 0.56
    }
  }

  setLayers(layers: Layers) {
    this.dirty = true
    this.layers = layers
    this.labels.hidden = !layers.labels
    this.sky.sky.material.uniforms.effects.value = layers.effects ? 1 : 0
    for (const visual of this.visuals) {
      visual.orbit.visible = layers.orbits && visual.orbit.geometry.getAttribute('position').count > 0
      visual.trail.visible = layers.trails
      if (visual.halo) visual.halo.visible = layers.effects
    }
    if (this.earthSession?.globe.mesh.visible) this.showEarthDetail(this.earthSession, true)
  }

  sampleTrails(simulation: Simulation) {
    if (simulation.elapsed - this.sampleTime < 1 / 192) return
    this.sampleTime = simulation.elapsed
    for (let i = 0; i < this.visuals.length; i++) {
      this.visuals[i].trailHistory.append(simulation.bodies[i].position)
    }
  }

  focus(id: string) {
    if (this.earthSession) return
    this.focused = this.visuals.find(visual => visual.spec.id === id)
    if (!this.focused) return
    this.controls.minDistance = Math.max(MIN_CAMERA_DISTANCE, this.focused.spec.appearance.size * 1.18)
    this.anchor.copy(this.focused.group.position)
    this.view = 'focus'
    this.transition = true
  }

  overview(immediate = false) {
    if (this.earthSession) return
    this.controls.minDistance = MIN_CAMERA_DISTANCE
    this.dirty = true
    this.view = 'overview'
    this.focused = undefined
    this.transition = !immediate
    if (immediate) {
      // Consume any residual drag before replacing the camera pose.
      this.controls.enableDamping = false
      this.updateControls(0)
      this.controls.target.set(0, 0, 0)
      this.camera.position.copy(this.direction).multiplyScalar(this.overviewDistance())
      this.updateControls(0)
      this.controls.enableDamping = true
    }
  }

  exploreEarth() {
    if (this.earthSession) return
    const earth = this.visuals.find(visual => visual.spec.id === 'earth')
    const detail = earth?.spec.detail
    if (!earth || !detail?.surfaceMap) return
    const globe = new EarthGlobe(earth.spec.appearance.size, detail)
    const savedFocus = this.view === 'focus' ? this.focused : undefined
    const savedPosition = this.camera.position.clone()
    const savedTarget = this.controls.target.clone()
    if (savedFocus) {
      savedPosition.sub(savedFocus.group.position)
      savedTarget.sub(savedFocus.group.position)
    }
    const session: EarthSession = {
      earth, globe, state: 'entering', ready: false, progress: 0,
      quality: detail.surfaceMap.highResolutionUrl && this.renderer.capabilities.maxTextureSize >= 4096
        && matchMedia('(pointer: fine)').matches && Math.min(this.width, this.height) * this.renderer.getPixelRatio() >= 1000
        ? 'available' : 'unavailable',
      from: this.camera.position.clone().sub(earth.group.position),
      fromTarget: this.controls.target.clone().sub(earth.group.position),
      savedPosition, savedTarget, savedView: this.view, savedFocus,
      minDistance: this.controls.minDistance, maxDistance: this.controls.maxDistance,
    }
    this.earthSession = session
    this.transition = false
    this.controls.enabled = false
    this.controls.enablePan = false
    this.controls.enableDamping = false
    this.updateControls(0)
    this.controls.enableDamping = true
    earth.group.add(globe.mesh)
    this.notifyExplorer(session)
    void globe.loadBase().then(() => {
      if (this.earthSession !== session || session.state !== 'entering') return
      session.ready = true
      this.dirty = true
    }).catch(() => {
      if (this.earthSession !== session || session.state !== 'entering') return
      session.error = 'The Earth surface map could not be loaded. Try again.'
      this.exitExplorer()
    })
  }

  exitExplorer() {
    const session = this.earthSession
    if (!session || session.state === 'exiting') return
    session.globe.abort()
    session.state = 'exiting'
    session.progress = 0
    session.from.copy(this.camera.position).sub(session.earth.group.position)
    session.fromTarget.copy(this.controls.target).sub(session.earth.group.position)
    this.controls.enabled = false
    this.controls.maxDistance = session.maxDistance
    this.controls.minDistance = Math.min(session.minDistance, this.controls.minDistance)
    this.notifyExplorer(session)
  }

  earthCameraKey(key: string) {
    return this.earthSession?.state === 'exploring' && applyEarthCameraKey(this.controls, key)
  }

  upgradeEarth() {
    const session = this.earthSession
    if (!session || session.state !== 'exploring' || session.quality !== 'available') return
    session.quality = 'loading'
    session.error = undefined
    this.notifyExplorer(session)
    void session.globe.upgrade().then(() => {
      if (this.earthSession !== session || session.state !== 'exploring') return
      session.quality = 'high'
      this.dirty = true
      this.notifyExplorer(session)
    }).catch(() => {
      if (this.earthSession !== session || session.state !== 'exploring') return
      session.quality = 'available'
      session.error = 'The 4K map could not be loaded. The current map is still available.'
      this.notifyExplorer(session)
    })
  }

  private notifyExplorer(session: EarthSession) {
    this.dirty = true
    this.onExplorer(session.state, session.quality, session.error)
  }

  private showEarthDetail(session: EarthSession, visible: boolean) {
    session.globe.mesh.visible = visible
    session.earth.surface.visible = !visible
    this.labels.hidden = visible || !this.layers.labels
    for (const visual of this.visuals) {
      visual.group.visible = !visible || visual === session.earth
      visual.orbit.visible = !visible && this.layers.orbits && visual.orbit.geometry.getAttribute('position').count > 0
      visual.trail.visible = !visible && this.layers.trails
    }
    this.dirty = true
  }

  private finishExplorer(restore = false) {
    const session = this.earthSession
    if (!session) return
    this.showEarthDetail(session, false)
    session.globe.dispose()
    this.earthSession = undefined
    this.controls.enabled = true
    this.controls.enablePan = true
    this.controls.minDistance = session.minDistance
    this.controls.maxDistance = session.maxDistance
    this.view = session.savedView
    this.focused = session.savedFocus
    if (this.focused) this.anchor.copy(this.focused.group.position)
    if (restore) this.updateControls(0)
    this.onExplorer('overview', 'unavailable', restore ? session.error : undefined)
  }

  private updateEarthCamera(session: EarthSession, seconds: number) {
    const position = session.earth.group.position
    session.globe.direction.subVectors(this.lightPositions[0], position).normalize()
    if (session.state === 'exploring') {
      this.delta.subVectors(position, this.anchor)
      this.camera.position.add(this.delta)
      this.controls.target.add(this.delta)
      this.anchor.copy(position)
      return this.updateControls(seconds)
    }
    const previous = session.progress
    const entering = session.state === 'entering'
    session.progress = this.reducedMotion.matches ? 1 : Math.min(1, previous + seconds / 0.84)
    const t = session.progress * session.progress * (3 - 2 * session.progress)
    this.camera.position.copy(session.from).add(position)
    this.controls.target.copy(session.fromTarget).add(position)
    if (entering) {
      const radius = session.earth.spec.appearance.size
      const distance = radius * 3.5 / Math.min(1, this.camera.aspect)
      this.earthDirection.copy(session.globe.direction).multiplyScalar(0.83)
      this.earthDirection.y += 0.54
      this.cameraOffset.copy(this.earthDirection.normalize()).multiplyScalar(distance)
      this.earthArc.point(this.camera.position, session.from, this.cameraOffset, t).add(position)
      this.controls.target.lerp(position, t)
      this.updateControls(seconds)
      if (session.progress === 1 && session.ready) {
        this.anchor.copy(position)
        this.controls.minDistance = radius * 1.55
        this.controls.maxDistance = Math.max(1.75, distance)
        this.controls.enabled = true
        this.showEarthDetail(session, true)
        session.state = 'exploring'
        this.notifyExplorer(session)
        void session.globe.loadExtras(session.quality !== 'unavailable', () => { this.dirty = true })
      }
    } else {
      this.cameraOffset.copy(session.savedPosition)
      this.aim.copy(session.savedTarget)
      if (session.savedFocus) {
        this.cameraOffset.add(session.savedFocus.group.position)
        this.aim.add(session.savedFocus.group.position)
      }
      this.cameraOffset.sub(position)
      this.earthArc.point(this.camera.position, session.from, this.cameraOffset, t).add(position)
      this.controls.target.lerp(this.aim, t)
      this.updateControls(seconds)
      if (t >= 0.62 && session.globe.mesh.visible) this.showEarthDetail(session, false)
      if (session.progress === 1) this.finishExplorer(true)
    }
    return previous !== session.progress
  }

  private overviewDistance() {
    return this.frame * 2.04 / Math.min(1, this.camera.aspect / 1.08)
  }

  private resize() {
    this.dirty = true
    const previousOverview = this.overviewDistance()
    const previousAspect = this.camera.aspect
    this.width = Math.max(1, this.viewport.clientWidth)
    this.height = Math.max(1, this.viewport.clientHeight)
    const ratio = Math.min(window.devicePixelRatio || 1, 1.65)
    this.renderer.setPixelRatio(ratio)
    this.renderer.setSize(this.width, this.height, false)
    this.sky.stars.material.uniforms.pixelRatio.value = ratio
    this.camera.aspect = this.width / this.height
    this.camera.updateProjectionMatrix()
    if (this.earthSession?.state === 'exploring') {
      const scale = Math.min(1, previousAspect) / Math.min(1, this.camera.aspect)
      this.camera.position.sub(this.controls.target).multiplyScalar(scale).add(this.controls.target)
      this.controls.maxDistance = Math.max(1.75, this.earthSession.earth.spec.appearance.size * 3.5 / Math.min(1, this.camera.aspect))
      this.updateControls(0)
      return
    }
    if (this.earthSession) return
    if (this.view === 'overview' && !this.transition) {
      this.camera.position.sub(this.controls.target)
        .multiplyScalar(this.overviewDistance() / previousOverview)
        .add(this.controls.target)
    }
  }

  private updatePositions(simulation: Simulation) {
    this.lightColors[0].set(0)
    this.lightColors[1].set(0)
    let star = 0
    for (let i = 0; i < this.visuals.length; i++) {
      const visual = this.visuals[i]
      setBodyPosition(visual.group.position, simulation.bodies[i])
      visual.surface.material.uniforms.angle.value = simulation.elapsed * (0.49 + i * 0.08)
      if (visual.light) {
        this.lightPositions[star].copy(visual.group.position)
        this.lightColors[star].copy(visual.light.color).multiplyScalar(visual.light.intensity)
        star++
      }
    }
  }

  private updateCamera(deltaSeconds: number) {
    if (this.earthSession) return this.updateEarthCamera(this.earthSession, deltaSeconds)
    const focused = this.focused
    const wasMoving = this.transition
    if (this.view === 'focus' && focused) {
      this.delta.subVectors(focused.group.position, this.anchor)
      this.camera.position.add(this.delta)
      this.controls.target.add(this.delta)
      this.anchor.copy(focused.group.position)
    }
    if (this.transition) {
      this.aim.set(0, 0, 0)
      let distance = this.overviewDistance()
      if (focused) {
        this.aim.copy(focused.group.position)
        distance = Math.max(1.15, focused.spec.appearance.size * 7) / Math.min(1, this.camera.aspect)
      }
      const ease = this.reducedMotion.matches ? 1 : 1 - Math.exp(-8 * deltaSeconds)
      this.cameraOffset.copy(this.direction).multiplyScalar(distance).add(this.aim)
      this.camera.position.lerp(this.cameraOffset, ease)
      this.controls.target.lerp(this.aim, ease)
      if (ease === 1 || (this.camera.position.distanceToSquared(this.cameraOffset) < 0.002
        && this.controls.target.distanceToSquared(this.aim) < 0.002)) {
        this.camera.position.copy(this.cameraOffset)
        this.controls.target.copy(this.aim)
        this.transition = false
      }
    }
    return this.updateControls(deltaSeconds) || wasMoving
  }

  private updateControls(deltaSeconds: number) {
    this.applyingCamera = true
    const moved = this.controls.update(deltaSeconds)
    this.applyingCamera = false
    return moved
  }

  render(simulation: Simulation, deltaSeconds: number) {
    const stepped = simulation.elapsed !== this.renderedTime
    if (stepped) this.updatePositions(simulation)
    const cameraMoved = this.updateCamera(deltaSeconds)
    if (!stepped && !this.dirty && !cameraMoved) return
    if (this.dirty || cameraMoved) {
      this.camera.updateMatrixWorld()
      this.updateAxes()
      for (const visual of this.visuals) {
        if (visual.halo) visual.halo.quaternion.copy(this.camera.quaternion)
      }
    }
    this.dirty = false
    this.renderedTime = simulation.elapsed
    if (this.layers.trails && !this.earthSession?.globe.mesh.visible) {
      for (const visual of this.visuals) {
        const { trailHistory, history, trail, addHistoryRange } = visual
        if (!trailHistory.pending) continue
        history.clearUpdateRanges()
        trailHistory.uploadRanges(addHistoryRange)
        history.needsUpdate = true
        trail.geometry.setDrawRange(trailHistory.first, trailHistory.length)
      }
    }
    if (!this.labels.hidden) this.positionLabels()
    this.renderer.render(this.scene, this.camera)
  }

  private positionLabels() {
    const { width, height } = this
    const pixelScale = height / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)))
    for (const { group, disc, labelBox, spec } of this.labelOrder) {
      labelBox.visible = false
      this.projected.copy(group.position).applyMatrix4(this.camera.matrixWorldInverse)
      const depth = -this.projected.z
      this.projected.applyMatrix4(this.camera.projectionMatrix)
      disc.radius = depth > this.camera.near && depth < this.camera.far ? pixelScale * spec.appearance.size / depth : 0
      disc.x = (this.projected.x * 0.5 + 0.5) * width
      disc.y = (0.5 - this.projected.y * 0.5) * height
    }
    for (const visual of this.labelOrder) {
      const { labelBox: box, disc: { x, y, radius } } = visual
      if (radius > 0 && x >= 0 && x <= width && y >= 0 && y <= height) {
        const offset = Math.min(radius * (visual.spec.appearance.ring ? 1.35 : 1.05) + 5, height * 0.39)
        box.x = x
        box.y = y + offset
        if (!this.fitsLabel(visual)) box.y = y - offset - 20
        if (!this.fitsLabel(visual)) {
          const sideOffset = radius + box.width * 0.5 + 5
          box.y = y - 10
          box.x = x - sideOffset
          if (!this.fitsLabel(visual)) box.x = x + sideOffset
        }
        box.visible = this.fitsLabel(visual)
      }
      visual.label.hidden = !box.visible
      if (box.visible) {
        visual.label.style.transform = 'translate3d(' + box.x.toFixed(1) + 'px,' + box.y.toFixed(1) + 'px,0) translateX(-50%)'
      }
    }
  }

  private fitsLabel(visual: Visual) {
    const { x, y, width } = visual.labelBox
    if (x < width * 0.5 || x > this.width - width * 0.5 || y < 12 || y > this.height - 56) return false
    for (const other of this.labelOrder) {
      const box = other.labelBox
      if (box.visible && Math.abs(y - box.y) < 21 && Math.abs(x - box.x) < (width + box.width) * 0.5) return false
      const { disc } = other
      if (disc.radius > 0) {
        const dx = Math.max(0, Math.abs(x - disc.x) - width * 0.5)
        const dy = Math.max(0, Math.abs(y + 10 - disc.y) - 10)
        if (dx * dx + dy * dy < (disc.radius + 2) ** 2) return false
      }
    }
    return true
  }

  private updateAxes() {
    this.inverseView.copy(this.camera.quaternion).invert()
    for (let axis = 0; axis < this.axisLines.length; axis++) {
      this.axisVector.set(axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? 1 : 0)
      this.axisVector.applyQuaternion(this.inverseView)
      const x = this.axisVector.x
      const y = -this.axisVector.y
      this.axisLines[axis].style.transform = 'rotate(' + Math.atan2(y, x) + 'rad) scaleX(' + Math.hypot(x, y) + ')'
      this.axisLabels[axis].style.transform = 'translate(' + x * 20 + 'px,' + y * 20 + 'px)'
    }
  }

  dispose() {
    this.finishExplorer()
    this.resizeObserver.disconnect()
    this.lifecycle.abort()
    this.controls.dispose()
    disposeTree(this.scene, this.sharedGeometries)
    for (const geometry of this.sharedGeometries) geometry.dispose()
    this.sky.background.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
    this.labels.replaceChildren()
  }
}
