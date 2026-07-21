// Fixed-timestep accumulator (handoff §12, SPEC V19). Render interpolates
// between the last two sim states via alpha; long gaps (tab restore) are
// clamped so the sim never explodes.

export class FixedTimestep {
  private accumulator = 0
  private lastMs: number | null = null

  constructor(
    readonly fixedDelta: number,
    private maxAccumulated: number,
    private maxSubsteps: number,
  ) {}

  /** Returns number of sim steps to run this frame. */
  advance(nowMs: number): number {
    if (this.lastMs === null) {
      this.lastMs = nowMs
      return 1
    }
    const dt = Math.min((nowMs - this.lastMs) / 1000, this.maxAccumulated)
    this.lastMs = nowMs
    this.accumulator = Math.min(this.accumulator + dt, this.maxAccumulated)
    let steps = 0
    while (this.accumulator >= this.fixedDelta && steps < this.maxSubsteps) {
      this.accumulator -= this.fixedDelta
      steps++
    }
    // drop overflow beyond substep budget instead of spiraling
    if (this.accumulator >= this.fixedDelta) this.accumulator = this.fixedDelta * 0.5
    return steps
  }

  /** Interpolation factor between previous and current sim state. */
  get alpha(): number {
    return this.accumulator / this.fixedDelta
  }
}
