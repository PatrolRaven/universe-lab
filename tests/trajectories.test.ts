import { describe, expect, it } from 'vitest'
import { scenarios } from '../src/data'
import { Simulation } from '../src/physics'
import { OrbitForecasts, TrailHistory } from '../src/trajectories'

describe('orbital forecasts', () => {
  it('starts from the active state and matches the fixed-step integrator across the whole path', () => {
    const scenario = scenarios[0]
    const simulation = new Simulation(scenario.objects, 1 / 1024, 28, 0.015)
    for (let tick = 0; tick < 20; tick++) simulation.step()
    const reference = simulation.fork()
    const unchanged = structuredClone(simulation.bodies)
    const before = simulation.elapsed
    const paths = new OrbitForecasts().get(scenario, simulation, scenario.objects.map(spec => spec.period))
    expect(paths[0]).toHaveLength(0)
    const path = paths[1]
    const horizon = Math.round(scenario.objects[1].period / reference.stepSize)
    const count = path.length / 3
    let tick = 0
    for (let i = 0; i < count; i++) {
      const sampleTick = Math.round(i * horizon / (count - 1))
      for (; tick < sampleTick; tick++) reference.step()
      expect(Array.from(path.subarray(i * 3, i * 3 + 3))).toEqual(reference.bodies[1].position.map(Math.fround))
    }
    expect(tick).toBe(horizon)
    expect(simulation.bodies).toEqual(unchanged)
    expect(simulation.elapsed).toBe(before)
  })

  it('reuses identical forecasts and invalidates them when physics or periods change', () => {
    const scenario = scenarios[1]
    const forecast = new OrbitForecasts()
    const periods = [0.12, 0.2, 0]
    const initial = new Simulation(scenario.objects)
    const paths = forecast.get(scenario, initial, periods)
    expect(forecast.get(scenario, initial.fork(), periods)).toBe(paths)
    const changedGravity = new Simulation(scenario.objects, initial.stepSize, initial.gravity * 0.9)
    const changedPaths = forecast.get(scenario, changedGravity, periods)
    expect(changedPaths[0]).not.toEqual(paths[0])
    changedGravity.bodies[0].velocity[2] += 0.05
    const changedVelocity = forecast.get(scenario, changedGravity, periods)
    expect(changedVelocity[0]).not.toEqual(changedPaths[0])
    expect(forecast.get(scenario, changedGravity, [0.001, 0.2, 0])[0]).toHaveLength(9)
  })
})

describe('trail history', () => {
  it('bounds deferred uploads while hidden and stores the latest samples in order after wrapping', () => {
    const trail = new TrailHistory(4)
    for (let n = 0; n < 1003; n++) trail.append([n, n * 2, n * 3])
    expect(trail.length).toBe(4)
    expect(trail.pending).toBe(4)
    expect(Array.from(trail.points.slice(trail.first * 3, (trail.first + trail.length) * 3))).toEqual(
      [999, 1000, 1001, 1002].flatMap(n => [n, n * 2, n * 3]),
    )
    const ranges: number[][] = []
    expect(trail.uploadRanges((start, count) => ranges.push([start, count]))).toBe(true)
    expect(ranges).toEqual([[9, 3], [21, 3], [0, 9], [12, 9]])
    expect(trail.pending).toBe(0)
  })

  it('starts the next run with just its new position', () => {
    const trail = new TrailHistory(4)
    trail.append([10, 20, 30])
    trail.append([11, 21, 31])
    trail.clear()
    expect(trail.first).toBe(0)
    expect(trail.length).toBe(0)
    expect(trail.pending).toBe(0)
    trail.append([0, 1, 2])
    expect(Array.from(trail.points.slice(0, 3))).toEqual([0, 1, 2])
    expect(trail.length).toBe(1)
  })
})
