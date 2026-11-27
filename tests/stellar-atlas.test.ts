import { describe, expect, it } from 'vitest'
import { catalogEntries } from '../src/library'
import { atlasMap, atlasObjects, atlasScenarios, localPosition } from '../src/stellar-atlas'
import { Simulation } from '../src/physics'

describe('Звёздный атлас', () => {
  it('сохраняет расстояние и переводит северный галактический полюс в +Y', () => {
    const [x, y, z] = localPosition([192.85948, 27.12825, 10])
    expect(x).toBeCloseTo(0, 7)
    expect(y).toBeCloseTo(10, 7)
    expect(z).toBeCloseTo(0, 7)
    for (const object of atlasObjects) {
      const point = atlasMap.find(item => item.id === object.id)!
      expect(Math.hypot(...point.local)).toBeCloseTo(object.coordinates[2], 5)
      const host = atlasMap.find(item => item.id === object.hostId)
      if (host) expect(point.galactic).toEqual(host.galactic)
      expect(object.sources.length).toBeGreaterThan(0)
    }
  })

  it('связывает интерактивные тела с каталогом и сохраняет связность орбит', () => {
    const entries = catalogEntries([])
    for (const scenario of atlasScenarios) {
      const simulation = new Simulation(scenario.objects, scenario.stepSize, undefined, scenario.softening)
      for (const body of scenario.objects) {
        expect(entries.find(item => item.id === body.id)?.scene?.scenario).toBe(scenario)
      }
      const duration = Math.max(...scenario.objects.map(body => body.period))
      while (simulation.elapsed < duration) simulation.step()
      for (const body of simulation.bodies) {
        expect(Math.hypot(...body.position)).toBeLessThan(scenario.frame)
      }
    }
  })
})
