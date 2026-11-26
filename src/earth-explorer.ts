/// <reference types="vite/client" />
import * as THREE from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { DetailedAppearance } from './data'

export type ExplorerState = 'overview' | 'entering' | 'exploring' | 'exiting'
export type ExplorerQuality = 'unavailable' | 'available' | 'loading' | 'high'
export type ExplorerUpdate = (state: ExplorerState, quality: ExplorerQuality, error?: string) => void

export function applyEarthCameraKey(controls: OrbitControls, key: string) {
  const angle = Math.PI / 24
  const scale = 0.88
  switch (key) {
    case 'ArrowLeft': controls.rotateLeft(angle); break
    case 'ArrowRight': controls.rotateLeft(-angle); break
    case 'ArrowUp': controls.rotateUp(angle); break
    case 'ArrowDown': controls.rotateUp(-angle); break
    case '+':
    case '=': controls.dollyIn(scale); break
    case '-': controls.dollyOut(scale); break
    default: return false
  }
  return true
}

export async function loadEarthTexture(file: string, signal: AbortSignal, color = false) {
  const response = await fetch(import.meta.env.BASE_URL + file, { signal })
  if (!response.ok) throw new Error('Earth texture unavailable: ' + response.status)
  const blob = await response.blob()
  signal.throwIfAborted()
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'flipY', colorSpaceConversion: 'none' })
  if (signal.aborted) {
    bitmap.close()
    signal.throwIfAborted()
  }
  const texture = new THREE.Texture(bitmap)
  texture.wrapS = THREE.RepeatWrapping
  texture.minFilter = THREE.LinearMipmapLinearFilter
  if (color) texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

function release(texture: THREE.Texture | null) {
  if (!texture) return
  texture.dispose()
  const bitmap = texture.image as ImageBitmap
  bitmap.close()
}

const vertex = /* glsl */ `
  varying vec2 uvEarth;
  varying vec3 worldNormal, worldPoint;
  void main() {
    uvEarth = uv;
    worldNormal = normalize(mat3(modelMatrix) * normal);
    worldPoint = (modelMatrix * vec4(position, 1.)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(worldPoint, 1.);
  }
`

export class EarthGlobe {
  readonly mesh = new THREE.Group()
  readonly direction = new THREE.Vector3(1, 0, 0)
  private readonly requests = new AbortController()
  private readonly geometry = new THREE.SphereGeometry(1, 80, 56)
  private readonly maps = {
    sun: { value: this.direction },
    albedo: { value: null as THREE.Texture | null },
    terrain: { value: null as THREE.Texture | null },
    night: { value: null as THREE.Texture | null },
    hasTerrain: { value: false },
    hasNight: { value: false },
  }
  private readonly surface = new THREE.ShaderMaterial({
    uniforms: this.maps,
    vertexShader: vertex,
    fragmentShader: /* glsl */ `
      varying vec2 uvEarth;
      varying vec3 worldNormal, worldPoint;
      uniform sampler2D albedo, terrain, night;
      uniform vec3 sun;
      uniform bool hasTerrain, hasNight;
      void main() {
        vec3 N = normalize(worldNormal);
        vec3 V = normalize(cameraPosition - worldPoint);
        float solar = dot(N, sun);
        vec3 rgb = texture2D(albedo, uvEarth).rgb;
        vec3 relief = N;
        vec3 east = vec3(N.z, 0., -N.x);
        if (hasTerrain && dot(east,east) > .00001) {
          east = normalize(east);
          vec3 texel = texture2D(terrain, uvEarth).xyz * 2. - 1.;
          relief = normalize(N + .32 * (east * texel.x + cross(N, east) * texel.y));
        }
        float day = smoothstep(-.14, .16, solar);
        float diffuse = max(dot(relief, sun), 0.);
        vec3 col = rgb * (.059 + .24 * day + .82 * diffuse * day);
        float water = smoothstep(.009,.085,rgb.b - max(rgb.r,rgb.g));
        float shine = pow(max(dot(N, normalize(sun + V + vec3(.00001))), 0.), 48.);
        col += vec3(.52,.72,1.) * shine * water * day * .20;
        if (hasNight) {
          float cities = texture2D(night, uvEarth).r;
          col += vec3(1.,.69,.30) * pow(cities, 1.65) * (1. - day) * .78;
        }
        float rim = pow(1. - max(dot(N,V),0.), 3.5);
        col += vec3(.10,.39,.86) * rim * (.035 + .31 * day);
        gl_FragColor = vec4(col, 1.);
        #include <colorspace_fragment>
      }
    `,
  })
  private readonly atmosphere = new THREE.ShaderMaterial({
    uniforms: { sun: this.maps.sun },
    vertexShader: vertex,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fragmentShader: /* glsl */ `
      varying vec3 worldNormal, worldPoint;
      uniform vec3 sun;
      void main() {
        vec3 N = normalize(worldNormal);
        vec3 V = normalize(cameraPosition - worldPoint);
        float edge = abs(dot(N, V));
        float air = sin(clamp(edge * 4.5, 0., 1.) * 1.570796) * exp(-12. * edge);
        float day = smoothstep(-.42,.34,dot(N,sun));
        gl_FragColor = vec4(.19,.53,1., air * (.066 + .69 * day));
      }
    `,
  })

  constructor(radius: number, private readonly detail: DetailedAppearance) {
    const ground = new THREE.Mesh(this.geometry, this.surface)
    const air = new THREE.Mesh(this.geometry, this.atmosphere)
    air.scale.setScalar(1.042)
    this.mesh.add(ground, air)
    // Align the prime meridian with the default sunward view of the solar preset.
    this.mesh.rotation.y = Math.PI
    this.mesh.scale.setScalar(radius)
    this.mesh.visible = false
  }

  async loadBase() {
    await this.install('albedo', this.detail.surfaceMap!.url)
  }

  async loadExtras(desktop: boolean, update: () => void) {
    const normal = this.detail.normalMap
    const night = this.detail.nightMap
    try {
      if (normal) {
        await this.install('terrain', desktop ? normal.highResolutionUrl ?? normal.url : normal.url)
        this.maps.hasTerrain.value = true
        update()
      }
    } catch { /* Preserve the base rendering when a supplementary map is unavailable. */ }
    if (this.requests.signal.aborted) return
    try {
      if (night) {
        await this.install('night', night.url)
        this.maps.hasNight.value = true
        update()
      }
    } catch { /* The day/night lighting still works without the lights map. */ }
  }

  async upgrade() {
    const file = this.detail.surfaceMap?.highResolutionUrl
    if (!file) throw new Error('High-resolution Earth map is unavailable')
    await this.install('albedo', file)
  }

  abort() {
    this.requests.abort()
  }

  dispose() {
    this.abort()
    this.mesh.removeFromParent()
    this.geometry.dispose()
    this.surface.dispose()
    this.atmosphere.dispose()
    release(this.maps.albedo.value)
    release(this.maps.terrain.value)
    release(this.maps.night.value)
  }

  private async install(slot: 'albedo' | 'terrain' | 'night', file: string) {
    const signal = this.requests.signal
    const texture = await loadEarthTexture(file, signal, slot === 'albedo')
    if (signal.aborted) {
      release(texture)
      signal.throwIfAborted()
    }
    release(this.maps[slot].value)
    this.maps[slot].value = texture
  }
}

// Interpolate direction and radius separately so a long arc cannot cut through the globe.
export class EarthCameraArc {
  private readonly start = new THREE.Vector3()
  private readonly end = new THREE.Vector3()
  private readonly turn = new THREE.Quaternion()
  private readonly rotation = new THREE.Quaternion()

  point(output: THREE.Vector3, from: THREE.Vector3, to: THREE.Vector3, t: number) {
    const a = from.length()
    const b = to.length()
    if (a < 0.001 || b < 0.001) return output.lerpVectors(from, to, t)
    this.start.copy(from).divideScalar(a)
    this.end.copy(to).divideScalar(b)
    this.turn.setFromUnitVectors(this.start, this.end)
    this.rotation.identity().slerp(this.turn, t)
    return output.copy(this.start).applyQuaternion(this.rotation).multiplyScalar(THREE.MathUtils.lerp(a, b, t))
  }
}
