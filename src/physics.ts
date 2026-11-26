export type Vector = [number, number, number]

export interface BodyInput {
  id: string
  name: string
  mass: number
  radius: number
  position: Vector
  velocity: Vector
}

export interface Body extends BodyInput {
  acceleration: Vector
}

export const G = 4 * Math.PI ** 2 // AU³ / (solar mass · year²)
export const STEP = 1 / 2048
export const SOFTENING = 0.004
const MAX_STEPS_PER_FRAME = 192
const MAX_LOCAL_ANGLE = 0.15
const MAX_LOCAL_TRAVEL = 0.04
const MAX_SPLIT_DEPTH = 8
const HALF_STEP_RANGE = 2 ** (-2 / 3)
const STEP_TOLERANCE = 1e-12

export function accelerations(bodies: Body[], gravity = G, softening = SOFTENING) {
  for (const body of bodies) body.acceleration.fill(0)
  const softSquared = softening ** 2
  let closestSquared = Infinity
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i]
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j]
      const dx = b.position[0] - a.position[0]
      const dy = b.position[1] - a.position[1]
      const dz = b.position[2] - a.position[2]
      const squared = dx * dx + dy * dy + dz * dz + softSquared
      if (squared === 0) continue
      if (squared < closestSquared) closestSquared = squared
      const factor = gravity / (squared * Math.sqrt(squared))
      const weightA = factor * b.mass
      const weightB = factor * a.mass
      a.acceleration[0] += dx * weightA
      a.acceleration[1] += dy * weightA
      a.acceleration[2] += dz * weightA
      b.acceleration[0] -= dx * weightB
      b.acceleration[1] -= dy * weightB
      b.acceleration[2] -= dz * weightB
    }
  }
  return closestSquared
}

export class Simulation {
  readonly bodies: Body[]
  private readonly closeRange: number
  private closestSquared: number
  private accumulator = 0
  private ticks = 0

  constructor(
    initial: readonly BodyInput[],
    readonly stepSize = STEP,
    readonly gravity = G,
    readonly softening = SOFTENING,
  ) {
    if (!Number.isFinite(stepSize) || stepSize <= 0) throw new RangeError('The simulation step must be finite and positive.')
    this.bodies = initial.map(body => ({
      ...body,
      position: [...body.position],
      velocity: [...body.velocity],
      acceleration: [0, 0, 0],
    }))
    const mass = this.bodies.reduce((total, body) => total + body.mass, 0)
    this.closeRange = Math.cbrt(Math.abs(gravity) * mass * (stepSize / MAX_LOCAL_ANGLE) ** 2)
    this.closestSquared = accelerations(this.bodies, gravity, softening)
  }

  get elapsed() {
    return this.ticks * this.stepSize
  }

  // Forecasts start a new clock at a copy of the current physical state.
  fork() {
    return new Simulation(this.bodies, this.stepSize, this.gravity, this.softening)
  }

  step() {
    this.resolveStep(this.stepSize, this.closeRange, MAX_SPLIT_DEPTH)
    this.ticks++
  }

  private resolveStep(dt: number, range: number, depth: number) {
    if (depth > 0 && this.needsSplit(dt, range)) {
      const half = dt * 0.5
      const halfRange = range * HALF_STEP_RANGE
      this.resolveStep(half, halfRange, depth - 1)
      this.resolveStep(half, halfRange, depth - 1)
    } else {
      this.integrate(dt)
    }
  }

  private needsSplit(dt: number, range: number) {
    if (this.closeRange === 0 || this.closestSquared === Infinity) return false

    // Bound how far the relative position of any pair can move during this drift.
    const half = dt * 0.5
    let maxSpeedSquared = 0
    for (const { velocity, acceleration } of this.bodies) {
      const x = velocity[0] + acceleration[0] * half
      const y = velocity[1] + acceleration[1] * half
      const z = velocity[2] + acceleration[2] * half
      maxSpeedSquared = Math.max(maxSpeedSquared, x * x + y * y + z * z)
    }
    const travel = 2 * dt * Math.sqrt(maxSpeedSquared)
    const nearest = Math.sqrt(this.closestSquared) - travel
    // Keep the external tick fixed and shorten only the piece that passes near a pair.
    return nearest < range || (nearest < this.closeRange && travel > nearest * MAX_LOCAL_TRAVEL)
  }

  private integrate(dt: number) {
    const halfStep = dt * 0.5
    for (const body of this.bodies) {
      for (let axis = 0; axis < 3; axis++) {
        body.velocity[axis] += body.acceleration[axis] * halfStep
        body.position[axis] += body.velocity[axis] * dt
      }
    }
    this.closestSquared = accelerations(this.bodies, this.gravity, this.softening)
    for (const body of this.bodies) {
      for (let axis = 0; axis < 3; axis++) {
        body.velocity[axis] += body.acceleration[axis] * halfStep
      }
    }
  }

  advance(years: number, afterStep?: () => void) {
    if (!Number.isFinite(years)) throw new RangeError('The elapsed interval must be finite.')
    this.accumulator = Math.min(
      this.accumulator + Math.max(0, years),
      MAX_STEPS_PER_FRAME * this.stepSize,
    )
    // Fractional frame intervals can sum to slightly less than one exact tick.
    // Retain the small negative remainder if rounding advances it early.
    while (this.accumulator >= this.stepSize * (1 - STEP_TOLERANCE)) {
      this.step()
      this.accumulator -= this.stepSize
      afterStep?.()
    }
  }
}
