import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BufferGeometry, Points, ShaderMaterial, WebGLRenderer } from 'three'
import { Galaxy, galaxyDestinations } from '../src/galaxy'

function setupGalaxy() {
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  const document = new EventTarget()
  const canvas = Object.assign(new EventTarget(), {
    style: {},
    ownerDocument: document,
    getRootNode: () => document,
    clientHeight: 800,
  }) as unknown as HTMLCanvasElement
  const marker = { hidden: true, style: { left: '', top: '' }, classList: { toggle: vi.fn() } }
  const galaxy = new Galaxy(canvas, marker as unknown as HTMLButtonElement, true)
  const render = vi.fn(() => galaxy.camera.updateMatrixWorld())
  const renderer = { render } as unknown as WebGLRenderer
  return { galaxy, marker, render, renderer }
}

afterEach(() => vi.unstubAllGlobals())

describe('galaxy overview', () => {
  it('places only the observed system on the map', () => {
    const [solar, binary, sandbox] = galaxyDestinations
    expect(solar.kind).toBe('observed')
    expect(Math.hypot(...solar.position)).toBeCloseTo(8.178, 3)
    expect(binary).not.toHaveProperty('position')
    expect(sandbox).not.toHaveProperty('position')
  })

  it('keeps the camera on re-entry, redraws on movement, and releases its batches', () => {
    const { galaxy, marker, render, renderer } = setupGalaxy()
    galaxy.setActive(true)
    galaxy.resize(1000, 800, 1)
    galaxy.render(renderer, 1000, 800)
    galaxy.render(renderer, 1000, 800)
    expect(render).toHaveBeenCalledTimes(1)

    galaxy.locateSun()
    galaxy.controls.enableDamping = true
    galaxy.key('ArrowLeft', false)
    galaxy.key('+', false)
    galaxy.key('ArrowUp', true)
    galaxy.render(renderer, 1000, 800)
    expect(render).toHaveBeenCalledTimes(2)
    expect(marker.hidden).toBe(false)
    const position = galaxy.camera.position.clone()
    const target = galaxy.controls.target.clone()
    const markerPosition = { ...marker.style }

    galaxy.setActive(false)
    galaxy.setActive(true)
    galaxy.resize(1000, 800, 1)
    galaxy.render(renderer, 1000, 800)
    expect(galaxy.camera.position.distanceTo(position)).toBeLessThan(1e-9)
    expect(galaxy.controls.target.distanceTo(target)).toBeLessThan(1e-9)
    expect(parseFloat(marker.style.top)).toBeCloseTo(parseFloat(markerPosition.top))

    const disposed = galaxy.scene.children.flatMap(child => {
      const { geometry, material } = child as Points<BufferGeometry, ShaderMaterial>
      return [vi.spyOn(geometry, 'dispose'), vi.spyOn(material, 'dispose')]
    })
    galaxy.dispose()
    expect(disposed.length).toBeGreaterThan(0)
    for (const resource of disposed) expect(resource).toHaveBeenCalledOnce()
    expect(galaxy.scene.children).toHaveLength(0)
  })
})
