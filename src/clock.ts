const YEARS_PER_SECOND = 0.16

export class SimulationClock {
  constructor(private previous: number, private reducedMotion: boolean, private visible: boolean) {}

  rebase(now: number) {
    this.previous = Math.max(this.previous, now)
  }

  setVisible(visible: boolean, now: number) {
    this.visible = visible
    this.rebase(now)
  }

  setReducedMotion(reduced: boolean, now: number) {
    this.reducedMotion = reduced
    this.rebase(now)
  }

  sample(now: number) {
    const seconds = (now - this.previous) / 1000
    if (seconds <= 0) return 0
    this.previous = now
    return !this.reducedMotion && this.visible ? seconds * YEARS_PER_SECOND : 0
  }
}
