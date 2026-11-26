const YEARS_PER_SECOND = 0.16

export class SimulationClock {
  rate = 1
  running: boolean

  constructor(private previous: number, running: boolean, private visible: boolean) {
    this.running = running
  }

  rebase(now: number) {
    this.previous = Math.max(this.previous, now)
  }

  setVisible(visible: boolean, now: number) {
    this.visible = visible
    this.rebase(now)
  }

  sample(now: number) {
    const seconds = (now - this.previous) / 1000
    if (seconds <= 0) return 0
    this.previous = now
    return this.running && this.visible ? seconds * YEARS_PER_SECOND * this.rate : 0
  }
}
