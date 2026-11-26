import { describe, expect, it } from 'vitest'
import { G, Simulation, STEP, SOFTENING, type BodyInput, type Vector } from '../src/physics'
import { scenarios } from '../src/data'

function body(id: string, mass: number, position: Vector, velocity: Vector = [0, 0, 0]): BodyInput {
  return { id, mass, position, velocity }
}

function pair() {
  return [body('a', 2, [0, 0, 0]), body('b', 3, [2, 0, 0])]
}

function totalMomentum(bodies: Simulation['bodies'], axis: number) {
  return bodies.reduce((total, item) => total + item.mass * item.velocity[axis], 0)
}

function separation(a: BodyInput, b: BodyInput) {
  return Math.hypot(
    a.position[0] - b.position[0],
    a.position[1] - b.position[1],
    a.position[2] - b.position[2],
  )
}

function energy(simulation: Simulation) {
  const { bodies, gravity, softening } = simulation
  let value = 0
  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i]
    value += 0.5 * body.mass * body.velocity.reduce((total, component) => total + component ** 2, 0)
    for (let j = i + 1; j < bodies.length; j++) {
      const other = bodies[j]
      value -= gravity * body.mass * other.mass / Math.hypot(separation(body, other), softening)
    }
  }
  return value
}

function centerOfMass(bodies: readonly BodyInput[]) {
  const totalMass = bodies.reduce((total, item) => total + item.mass, 0)
  return [0, 1, 2].map(axis => bodies.reduce(
    (total, item) => total + item.mass * item.position[axis], 0,
  ) / totalMass)
}

const momentum = (bodies: Simulation['bodies']) => [0, 1, 2].map(axis => totalMomentum(bodies, axis))
const distance = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

describe('Newtonian gravity', () => {
  it('calculates acceleration from the other mass and inverse square of distance', () => {
    const sim = new Simulation(pair(), STEP, G, 0)
    expect(sim.bodies[0].acceleration).toEqual([G * 3 / 4, 0, 0])
    expect(sim.bodies[1].acceleration).toEqual([-G * 2 / 4, 0, 0])
  })

  it('calculates equal and opposite forces in three dimensions', () => {
    const sim = new Simulation([body('a', 2, [0, 0, 0]), body('b', 3, [1, -2, 3])])
    for (let axis = 0; axis < 3; axis++) {
      const [a, b] = sim.bodies
      expect(a.acceleration[axis] * a.mass + b.acceleration[axis] * b.mass).toBeCloseTo(0, 12)
    }
  })

  it('handles coincident bodies and follows the softened acceleration law nearby', () => {
    const near = SOFTENING / 2
    const sim = new Simulation([
      body('a', 1, [0, 0, 0]), body('b', 2, [0, 0, 0]), body('c', 0, [near, 0, 0]),
    ])
    expect(sim.bodies[0].acceleration).toEqual([0, 0, 0])
    expect(sim.bodies[1].acceleration).toEqual([0, 0, 0])
    expect(sim.bodies[2].acceleration[0]).toBeCloseTo(-G * 3 * near / (near ** 2 + SOFTENING ** 2) ** 1.5, 6)
  })
})

describe('fixed-step Velocity Verlet', () => {
  it('changes position with acceleration and averages the old and new accelerations for velocity', () => {
    const initial = pair()
    const sim = new Simulation(initial)
    const [a, b] = sim.bodies
    const oldAcceleration = a.acceleration[0]
    sim.step()
    expect(a.position[0]).toBeCloseTo(oldAcceleration * STEP ** 2 / 2, 13)
    expect(a.position[0]).toBeGreaterThan(0)
    expect(b.position[0]).toBeLessThan(2)
    expect(a.velocity[0]).toBeCloseTo((oldAcceleration + a.acceleration[0]) * STEP / 2, 12)
    expect(initial[0].position).toEqual([0, 0, 0])
    expect(initial[0].velocity).toEqual([0, 0, 0])
  })

  it('preserves uniform motion in the absence of a force', () => {
    const sim = new Simulation([body('a', 1, [1, 2, 3], [4, -2, 1])])
    for (let i = 0; i < 2048; i++) sim.step()
    expect(sim.elapsed).toBe(1)
    expect(sim.bodies[0].position).toEqual([5, 0, 4])
  })

  it('retains fractional time and gives the same result for different frame partitions', () => {
    const a = new Simulation(pair())
    const b = new Simulation(pair())
    a.advance(STEP * 0.25)
    expect(a.elapsed).toBe(0)
    a.advance(STEP * 3.75)
    b.advance(STEP * 4)
    expect(a.elapsed).toBe(STEP * 4)
    expect(a.bodies).toEqual(b.bodies)
  })

  it('reaches an exact tick boundary even when fractional frames round down', () => {
    const split = new Simulation(pair())
    const whole = new Simulation(pair())
    for (let frame = 0; frame < 30; frame++) split.advance(STEP / 30)
    whole.advance(STEP)
    expect(split.elapsed).toBe(whole.elapsed)
    expect(split.bodies).toEqual(whole.bodies)
  })

  it('limits a long frame without extending the integration step', () => {
    const sim = new Simulation(pair())
    let completed = 0
    sim.advance(1000, () => completed++)
    expect(completed).toBe(192)
    expect(sim.elapsed).toBe(192 * STEP)
    sim.advance(0)
    expect(sim.elapsed).toBe(192 * STEP)
  })

  it('advances the same number of fixed ticks across ordinary frame rates at every time scale', () => {
    for (const rate of [0.25, 0.5, 1, 2, 4, 8]) {
      const slow = new Simulation(pair())
      const fast = new Simulation(pair())
      for (let frame = 0; frame < 30; frame++) slow.advance(0.16 * rate / 30)
      for (let frame = 0; frame < 144; frame++) fast.advance(0.16 * rate / 144)
      expect(slow.elapsed).toBe(Math.floor(0.16 * rate / STEP) * STEP)
      expect(fast.elapsed).toBe(slow.elapsed)
      expect(fast.bodies).toEqual(slow.bodies)
    }
  })

  it('rejects invalid time without corrupting the remaining accumulator', () => {
    for (const stepSize of [0, -STEP, NaN, Infinity]) {
      expect(() => new Simulation(pair(), stepSize)).toThrow(RangeError)
    }
    const sim = new Simulation(pair())
    sim.advance(STEP / 2)
    expect(() => sim.advance(NaN)).toThrow(RangeError)
    expect(() => sim.advance(Infinity)).toThrow(RangeError)
    sim.advance(STEP / 2)
    expect(sim.elapsed).toBe(STEP)
  })

  it('continues from a copied live state without copying the clock or changing the source', () => {
    const sim = new Simulation(pair(), STEP * 2, G / 2, 0.12)
    sim.advance(sim.stepSize * 10.5)
    const snapshot = structuredClone(sim.bodies)
    const forecast = sim.fork()
    expect(forecast.elapsed).toBe(0)
    expect(forecast.stepSize).toBe(sim.stepSize)
    expect(forecast.gravity).toBe(sim.gravity)
    expect(forecast.softening).toBe(sim.softening)
    expect(forecast.bodies).toEqual(sim.bodies)
    forecast.step()
    expect(sim.bodies).toEqual(snapshot)
    expect(sim.elapsed).toBe(10 * sim.stepSize)
    sim.advance(sim.stepSize / 2)
    expect(forecast.bodies).toEqual(sim.bodies)
  })

  it('resolves a close, softened pair without changing the external clock', () => {
    const radius = SOFTENING
    const speed = Math.sqrt(G * 2 * radius ** 2 / (radius ** 2 + SOFTENING ** 2) ** 1.5) / 2
    const sim = new Simulation([
      body('a', 1, [-radius / 2, 0, 0], [0, -speed, 0]),
      body('b', 1, [radius / 2, 0, 0], [0, speed, 0]),
    ])
    const initialEnergy = energy(sim)
    let maxEnergyError = 0
    let maxSeparationError = 0
    let ticks = 0
    for (let i = 0; i < 20; i++) {
      sim.advance(64 * STEP, () => {
        ticks++
        maxEnergyError = Math.max(maxEnergyError, Math.abs(energy(sim) / initialEnergy - 1))
        maxSeparationError = Math.max(maxSeparationError, Math.abs(separation(sim.bodies[0], sim.bodies[1]) / radius - 1))
      })
    }
    expect(ticks).toBe(1280)
    expect(sim.elapsed).toBe(1280 * STEP)
    expect(maxEnergyError).toBeLessThan(0.001)
    expect(maxSeparationError).toBeLessThan(0.01)
    expect(Math.hypot(...momentum(sim.bodies))).toBeLessThan(1e-12)
  })

  it('subdivides a fast flyby that starts outside the close range', () => {
    const sim = new Simulation([
      body('a', 1, [-0.075, -0.002, 0], [50, 0, 0]),
      body('b', 1, [0.075, 0.002, 0], [-50, 0, 0]),
    ])
    const initialEnergy = energy(sim)
    let maxEnergyError = 0
    for (let step = 0; step < 20; step++) {
      sim.step()
      maxEnergyError = Math.max(maxEnergyError, Math.abs(energy(sim) / initialEnergy - 1))
    }
    expect(sim.bodies[0].position[0]).toBeGreaterThan(0)
    expect(sim.elapsed).toBe(20 * STEP)
    expect(maxEnergyError).toBeLessThan(0.01)
    expect(Math.hypot(...momentum(sim.bodies))).toBeLessThan(1e-12)
  })

  it('keeps a circular two-body orbit and preserves momentum and energy over twelve revolutions', () => {
    const sim = new Simulation([
      body('star', 1, [0, 0, 0], [0, 0, 0]),
      body('planet', 3e-6, [1, 0, 0], [0, 0, Math.sqrt(G * (1 + 3e-6))]),
    ], STEP, G, 0)
    const initialMomentum = totalMomentum(sim.bodies, 2)
    const [star, planet] = sim.bodies
    const distance = () => Math.hypot(planet.position[0] - star.position[0], planet.position[2] - star.position[2])
    const initialEnergy = energy(sim)
    let deviation = 0
    for (let i = 0; i < 12 / STEP; i++) {
      sim.step()
      deviation = Math.max(deviation, Math.abs(distance() - 1))
    }
    expect(deviation).toBeLessThan(0.00002)
    expect(energy(sim) / initialEnergy).toBeCloseTo(1, 8)
    expect(totalMomentum(sim.bodies, 2)).toBeCloseTo(initialMomentum, 12)
  })
})

describe('preset systems', () => {
  it('keeps catalogue and appearance metadata out of live and forecast state', () => {
    const scenario = scenarios[0]
    const simulation = new Simulation(scenario.objects)
    const index = scenario.objects.findIndex(spec => spec.id === 'venus')
    const spec = scenario.objects[index]
    expect(spec.profile).toMatchObject({ name: 'Venus', category: 'planet', classification: 'Terrestrial planet' })
    expect(spec.appearance.kind).toBe('gas')
    expect(simulation.bodies[index]).toEqual({
      id: spec.id, mass: spec.mass, position: spec.position, velocity: spec.velocity,
      acceleration: simulation.bodies[index].acceleration,
    })
    expect(simulation.bodies[index].position).not.toBe(spec.position)
    expect(simulation.fork().bodies[index]).toEqual(simulation.bodies[index])
  })

  it.each(scenarios)('$name preserves invariants and stays bounded over 250 simulated years', scenario => {
    const sim = new Simulation(scenario.objects)
    const initialEnergy = energy(sim)
    const initialMomentum = momentum(sim.bodies)
    const initialCenter = centerOfMass(sim.bodies)
    const initialRadii = sim.bodies.map(item => Math.hypot(...item.position))
    const dune = sim.bodies.find(item => item.id === 'dune')
    const ember = sim.bodies.find(item => item.id === 'ember')
    let furthest = 0
    let maxEnergyError = 0
    let maxMomentumError = 0
    let maxCenterDrift = 0
    let maxRadialError = 0
    let minMoonDistance = Infinity
    let maxMoonDistance = 0

    expect(initialEnergy).toBeLessThan(0)
    expect(Math.hypot(...initialCenter)).toBeLessThan(1e-14)
    expect(Math.hypot(...initialMomentum)).toBeLessThan(1e-14)
    for (const item of sim.bodies) {
      expect(Number.isFinite(item.mass) && item.mass > 0 && item.velocity.every(Number.isFinite)).toBe(true)
    }

    for (let i = 1; i <= 250 / STEP; i++) {
      sim.step()
      if (i % 128 === 0) {
        maxEnergyError = Math.max(maxEnergyError, Math.abs(energy(sim) / initialEnergy - 1))
        maxMomentumError = Math.max(maxMomentumError, distance(momentum(sim.bodies), initialMomentum))
        maxCenterDrift = Math.max(maxCenterDrift, distance(centerOfMass(sim.bodies), initialCenter))
        for (let j = 0; j < sim.bodies.length; j++) {
          const radius = Math.hypot(...sim.bodies[j].position)
          furthest = Math.max(furthest, radius)
          if (scenario.objects[j].period > 0) {
            maxRadialError = Math.max(maxRadialError, Math.abs(radius / initialRadii[j] - 1))
          }
        }
        if (dune && ember) {
          const range = separation(dune, ember)
          minMoonDistance = Math.min(minMoonDistance, range)
          maxMoonDistance = Math.max(maxMoonDistance, range)
        }
      }
    }
    expect(furthest).toBeLessThan(scenario.frame * 1.3)
    expect(maxEnergyError).toBeLessThan(1e-7)
    expect(maxMomentumError).toBeLessThan(1e-11)
    expect(maxCenterDrift).toBeLessThan(1e-9)
    expect(maxRadialError).toBeLessThan(0.2)
    if (dune && ember) {
      expect(minMoonDistance).toBeGreaterThan(0.08)
      expect(maxMoonDistance).toBeLessThan(0.5)
    }
  })
})
