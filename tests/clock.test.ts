import { describe, expect, it } from 'vitest'
import { SimulationClock } from '../src/clock'
import { scenarios } from '../src/data'
import { Simulation } from '../src/physics'

describe('simulation wall clock', () => {
  it.each([1, 8])('matches physics at 15 and 60 FPS at %s× within the step budget', rate => {
    const run = (fps: number) => {
      const simulation = new Simulation(scenarios[1].objects)
      const clock = new SimulationClock(0, true, true)
      clock.rate = rate
      for (let frame = 1; frame <= fps * 2; frame++) {
        simulation.advance(clock.sample(frame * 1000 / fps))
      }
      return simulation
    }
    const slow = run(15)
    const fast = run(60)
    expect(slow.elapsed).toBe(fast.elapsed)
    expect(slow.elapsed).toBeCloseTo(0.32 * rate, 3)
    expect(slow.bodies).toEqual(fast.bodies)
  })

  it('applies rate and pause at the input boundary and ignores stale frame timestamps', () => {
    const clock = new SimulationClock(0, true, true)
    expect(clock.sample(50)).toBeCloseTo(0.008)
    clock.rate = 8
    expect(clock.sample(48)).toBe(0)
    expect(clock.sample(60)).toBeCloseTo(0.0128)
    clock.running = false
    expect(clock.sample(950)).toBe(0)
    clock.running = true
    expect(clock.sample(975)).toBeCloseTo(0.032)
  })

  it('does not replay hidden time or time spent loading a reset', () => {
    const clock = new SimulationClock(0, true, true)
    expect(clock.sample(100)).toBeCloseTo(0.016)
    clock.setVisible(false, 100)
    expect(clock.sample(10_000)).toBe(0)
    clock.setVisible(true, 25_000)
    expect(clock.sample(25_100)).toBeCloseTo(0.016)
    clock.rebase(25_400)
    expect(clock.sample(25_500)).toBeCloseTo(0.016)
  })
})
