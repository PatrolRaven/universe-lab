import { afterEach, describe, expect, it, vi } from 'vitest'
import { PerspectiveCamera, Vector3 } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { applyPlanetCameraKey, PlanetCameraArc, PlanetGlobe, loadPlanetTexture } from '../src/planet-explorer'
import { scenarios } from '../src/data'
import { Simulation } from '../src/physics'

afterEach(() => vi.unstubAllGlobals())

describe('Planet camera keyboard controls', () => {
  function cameraControls() {
    const camera = new PerspectiveCamera()
    camera.position.set(0, 0, 1)
    const controls = new OrbitControls(camera)
    controls.minDistance = 0.5
    controls.maxDistance = 2
    controls.update()
    return controls
  }

  it.each([
    ['ArrowLeft', 'x', -1], ['ArrowRight', 'x', 1],
    ['ArrowUp', 'y', 1], ['ArrowDown', 'y', -1],
  ] as const)('rotates with %s around the existing target', (key, axis, sign) => {
    const controls = cameraControls()
    expect(applyPlanetCameraKey(controls, key)).toBe(true)
    expect(Math.sign(controls.object.position[axis])).toBe(sign)
    expect(controls.getDistance()).toBeCloseTo(1)
    expect(controls.target).toEqual(new Vector3())
  })

  it('zooms with +, = and - and respects the existing distance limits', () => {
    const controls = cameraControls()
    expect(applyPlanetCameraKey(controls, 'Tab')).toBe(false)
    expect(controls.getDistance()).toBeCloseTo(1)
    applyPlanetCameraKey(controls, '+')
    const firstDistance = controls.getDistance()
    expect(firstDistance).toBeLessThan(1)
    applyPlanetCameraKey(controls, '=')
    expect(controls.getDistance()).toBeLessThan(firstDistance)
    for (let i = 0; i < 20; i++) applyPlanetCameraKey(controls, '+')
    expect(controls.getDistance()).toBeCloseTo(0.5)
    applyPlanetCameraKey(controls, '-')
    expect(controls.getDistance()).toBeGreaterThan(0.5)
    for (let i = 0; i < 20; i++) applyPlanetCameraKey(controls, '-')
    expect(controls.getDistance()).toBeCloseTo(2)
  })
})

describe('Planet camera arc', () => {
  it('keeps an opposite-side transition outside the planet and restores its exact ends', () => {
    const arc = new PlanetCameraArc()
    const out = new Vector3()
    const from = new Vector3(0.6, 0, 0)
    const to = new Vector3(-1.4, 0, 0)
    expect(arc.point(out, from, to, 0).distanceTo(from)).toBeCloseTo(0)
    for (let i = 0; i <= 100; i++) {
      expect(arc.point(out, from, to, i / 100).length()).toBeGreaterThan(0.59)
    }
    expect(arc.point(out, from, to, 1).distanceTo(to)).toBeCloseTo(0)
  })
})

describe('Planet map lifecycle', () => {
  it('defers the fetch until explicitly loaded, preserves 2K on upgrade failure and releases its bitmap', async () => {
    const close = vi.fn()
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(new Blob()))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
    vi.stubGlobal('fetch', fetch)
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ close, width: 2048, height: 1024 }))
    const globe = new PlanetGlobe(0.2, { surfaceMap: { url: 'earth/low.webp', highResolutionUrl: 'earth/high.webp' } })
    expect(fetch).not.toHaveBeenCalled()
    await globe.loadBase()
    await expect(globe.upgrade()).rejects.toThrow('404')
    expect(close).not.toHaveBeenCalled()
    globe.dispose()
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('closes a decode that completes after cancellation', async () => {
    const controller = new AbortController()
    const close = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Blob())))
    vi.stubGlobal('createImageBitmap', vi.fn(async () => {
      controller.abort()
      return { close }
    }))
    await expect(loadPlanetTexture('earth/low.webp', controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('replaces the old bitmap on a successful 4K upgrade', async () => {
    const low = vi.fn()
    const high = vi.fn()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Blob())))
    vi.stubGlobal('createImageBitmap', vi.fn()
      .mockResolvedValueOnce({ close: low, width: 2048, height: 1024 })
      .mockResolvedValueOnce({ close: high, width: 4096, height: 2048 }))
    const globe = new PlanetGlobe(0.2, { surfaceMap: { url: 'earth/low.webp', highResolutionUrl: 'earth/high.webp' } })
    await globe.loadBase()
    await globe.upgrade()
    expect(low).toHaveBeenCalledTimes(1)
    expect(high).not.toHaveBeenCalled()
    globe.dispose()
    expect(high).toHaveBeenCalledTimes(1)
  })

  it('uses the same physical planet state as a run without the detailed globe', () => {
    const solar = scenarios[0]
    const reference = new Simulation(solar.objects)
    const active = new Simulation(solar.objects)
    const earth = solar.objects.find(body => body.id === 'earth')!
    for (let tick = 0; tick < 1200; tick++) {
      const visual = tick % 60 === 0 ? new PlanetGlobe(earth.appearance.size, earth.detail!) : undefined
      reference.step()
      active.step()
      visual?.dispose()
    }
    expect(active.elapsed).toBe(reference.elapsed)
    expect(active.bodies).toEqual(reference.bodies)
  })
})
