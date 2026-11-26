import type { Simulation, Vector } from './physics'

const ORBIT_POINTS = 320

export class OrbitForecasts {
  private readonly recent = new WeakMap<object, { signature: string; paths: Float32Array[] }>()

  get(scenario: object, simulation: Simulation, periods: readonly number[]) {
    const signature = JSON.stringify([
      simulation.stepSize, simulation.gravity, simulation.softening, periods,
      simulation.bodies.map(({ id, mass, position, velocity }) => [id, mass, position, velocity]),
    ])
    const cached = this.recent.get(scenario)
    if (cached?.signature === signature) return cached.paths

    const future = simulation.fork()
    const samples = periods.map(period => {
      const end = Math.round(period / future.stepSize)
      const count = end > 0 ? Math.min(ORBIT_POINTS, end + 1) : 0
      return { end, count, points: new Float32Array(count * 3), index: 0, next: count ? 0 : Infinity }
    })
    const end = Math.max(0, ...samples.map(sample => sample.end))
    for (let tick = 0; tick <= end; tick++) {
      for (let i = 0; i < samples.length; i++) {
        const sample = samples[i]
        if (tick !== sample.next) continue
        sample.points.set(future.bodies[i].position, sample.index * 3)
        sample.index++
        sample.next = sample.index < sample.count
          ? Math.round(sample.end * sample.index / (sample.count - 1))
          : Infinity
      }
      if (tick < end) future.step()
    }

    const paths = samples.map(sample => sample.points)
    this.recent.set(scenario, { signature, paths })
    return paths
  }
}

export class TrailHistory {
  readonly points: Float32Array
  length = 0
  pending = 0
  private cursor = 0

  constructor(readonly capacity: number) {
    // A mirrored ring keeps the draw range contiguous when the cursor wraps.
    this.points = new Float32Array(capacity * 6)
  }

  get first() {
    return (this.cursor - this.length + this.capacity) % this.capacity
  }

  clear() {
    this.cursor = 0
    this.length = 0
    this.pending = 0
  }

  append(position: Vector) {
    this.points.set(position, this.cursor * 3)
    this.points.set(position, (this.cursor + this.capacity) * 3)
    this.cursor = (this.cursor + 1) % this.capacity
    this.length = Math.min(this.length + 1, this.capacity)
    this.pending = Math.min(this.pending + 1, this.capacity)
  }

  uploadRanges(addRange: (start: number, count: number) => void) {
    if (this.pending === 0) return false
    const start = (this.cursor - this.pending + this.capacity) % this.capacity
    const firstRun = Math.min(this.pending, this.capacity - start)
    addRange(start * 3, firstRun * 3)
    addRange((start + this.capacity) * 3, firstRun * 3)
    const wrapped = this.pending - firstRun
    if (wrapped > 0) {
      addRange(0, wrapped * 3)
      addRange(this.capacity * 3, wrapped * 3)
    }
    this.pending = 0
    return true
  }
}
