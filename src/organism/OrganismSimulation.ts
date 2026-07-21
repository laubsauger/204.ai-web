// Skeleton simulation (handoff §11/§12/§19, SPEC V19): Verlet integration +
// position-based constraints at a fixed timestep. Idle life = seeded slow
// oscillators driving limb sway, torso breathing and core drift — never
// unseeded randomness, never per-frame topology changes.
//
// Obstacles are sampled ANALYTICALLY from the collected rects (exact CPU
// mirror of the GPU field, math/sdf.ts) — no GPU readback (V19).

import { ParticleBuffer, mulberry32 } from './simulation/ParticleBuffer'
import { obstacleNormal, sdObstacles, type SimRect, type Vec2 } from './math/sdf'
import type { OrganismConfig } from './OrganismParameters'

type LimbDriver = {
  swayFreq: number
  swayPhase: number
  swayAmp: number
  curlFreq: number
  curlPhase: number
  restAngle: number
  /* root attachment slowly migrates around the torso (handoff §11) */
  rootDriftFreq: number
  rootDriftAmp: number
}

export class OrganismSimulation {
  private restLengths: Float32Array
  private drivers: LimbDriver[] = []
  private breathePhase = 0
  private breathePhase2 = 0
  private time = 0
  private normal: Vec2 = { x: 0, y: 0 }
  /* padded obstacle rects, refreshed by the controller after collection */
  obstacles: SimRect[] = []
  obstacleRounding = 0.02
  constructor(
    private particles: ParticleBuffer,
    private config: OrganismConfig,
    seed = 907,
  ) {
    const rnd = mulberry32(seed)
    const p = particles
    this.restLengths = new Float32Array(p.count)
    for (let a = 0; a < p.appendageCount; a++) {
      for (let j = 0; j < p.jointsPerAppendage - 1; j++) {
        const i0 = p.indexOf(a, j)
        const i1 = p.indexOf(a, j + 1)
        this.restLengths[i1] = Math.hypot(p.posX[i1] - p.posX[i0], p.posY[i1] - p.posY[i0])
      }
      const root = p.indexOf(a, 0)
      this.drivers.push({
        swayFreq: 0.14 + rnd() * 0.22,
        swayPhase: rnd() * Math.PI * 2,
        swayAmp: 0.25 + rnd() * 0.5,
        curlFreq: 0.09 + rnd() * 0.16,
        curlPhase: rnd() * Math.PI * 2,
        restAngle: Math.atan2(p.posY[root] - p.posY[0], p.posX[root] - p.posX[0]),
        rootDriftFreq: 0.02 + rnd() * 0.03,
        rootDriftAmp: 0.15 + rnd() * 0.25,
      })
    }
  }

  /** One fixed step. dt = config.simulation.fixedDelta. */
  step(dt: number) {
    const p = this.particles
    const cfg = this.config
    this.time += dt
    // irregular breathing: two incommensurate slow sines (§19: 4–9s period)
    this.breathePhase += (dt * Math.PI * 2) / 6.4
    this.breathePhase2 += (dt * Math.PI * 2) / 9.7

    /* ---- forces / drivers (velocity via Verlet position delta) ---- */
    const damping = cfg.simulation.damping
    for (let i = 0; i < p.count; i++) {
      const vx = (p.posX[i] - p.prevX[i]) * damping
      const vy = (p.posY[i] - p.prevY[i]) * damping
      p.prevX[i] = p.posX[i]
      p.prevY[i] = p.posY[i]
      p.posX[i] += vx
      p.posY[i] += vy
    }

    // pointer smoothing (halfLife ~0.12s position — handoff §17)
    if (this.pointerActive) {
      if (!this.pointerInit) {
        this.pointerX = this.pointerRawX
        this.pointerY = this.pointerRawY
        this.pointerInit = true
      }
      const k = 1 - Math.exp((-dt / 0.12) * Math.LN2)
      this.pointerX += (this.pointerRawX - this.pointerX) * k
      this.pointerY += (this.pointerRawY - this.pointerY) * k
    }

    // attention node: follows the pointer faster than the body (§17)
    if (this.pointerActive) {
      const at = this.reachableTowards(p.posX[0], p.posY[0], this.pointerX, this.pointerY, 0.02)
      p.posX[1] += (at.x - p.posX[1]) * Math.min(1, dt * 4)
      p.posY[1] += (at.y - p.posY[1]) * Math.min(1, dt * 4)
    }

    // core intention: idle orbit around the anchor; when the pointer is
    // present and outside a dead zone, lean toward a point short of it —
    // interested, never cursor-glued (§17/§23)
    let ix = this.anchorX + Math.sin(this.time * 0.05 + 1.7) * 0.04 + Math.sin(this.time * 0.023) * 0.025
    let iy = this.anchorY + Math.cos(this.time * 0.041 + 0.4) * 0.032 + Math.sin(this.time * 0.017 + 2.1) * 0.022
    let pointerDirX = 0
    let pointerDirY = 0
    let pointerNear = 0
    if (this.pointerActive) {
      const dx = this.pointerX - p.posX[0]
      const dy = this.pointerY - p.posY[0]
      const dist = Math.hypot(dx, dy)
      if (dist > 0.05) {
        pointerDirX = dx / dist
        pointerDirY = dy / dist
        pointerNear = Math.max(0, 1 - dist / 1.4)
        const interest = this.config.behavior.pointerInterest
        // stop short: hold ~0.12 sim units away from the cursor
        ix = ix * (1 - interest) + (this.pointerX - pointerDirX * 0.12) * interest
        iy = iy * (1 - interest) + (this.pointerY - pointerDirY * 0.12) * interest
      }
    }
    // torso needs real clearance — a pocket tighter than the body is not a
    // destination (reachability-lite; M8 A* replaces this)
    const target = this.reachableTowards(p.posX[0], p.posY[0], ix, iy, p.radius[0] * 1.35)
    // heavy body: bounded approach speed (§23: 2–12% viewport width/s)
    const maxStep = this.config.behavior.maximumCoreSpeed * this.viewportAspect * dt
    const tdx = target.x - p.posX[0]
    const tdy = target.y - p.posY[0]
    const tlen = Math.hypot(tdx, tdy)
    const step = Math.min(tlen * dt * 2.4, maxStep)
    if (tlen > 1e-4) {
      p.posX[0] += (tdx / tlen) * step
      p.posY[0] += (tdy / tlen) * step
    }

    // limbs: serpentine traveling wave along the chain (anatomy-aligned,
    // per-limb seeded — §15.2); the limb best aligned with the pointer
    // extends toward it, others trail (§13/§18)
    for (let a = 0; a < p.appendageCount; a++) {
      const d = this.drivers[a]
      const sway = Math.sin(this.time * d.swayFreq * Math.PI * 2 + d.swayPhase) * d.swayAmp
      let targetAngle = d.restAngle + sway * 0.45
      let reachScale = 1
      if (pointerNear > 0) {
        const pointerAngle = Math.atan2(pointerDirY, pointerDirX)
        let delta = pointerAngle - d.restAngle
        while (delta > Math.PI) delta -= Math.PI * 2
        while (delta < -Math.PI) delta += Math.PI * 2
        const align = Math.max(0, Math.cos(delta))
        // only well-aligned limbs react; blend angle toward the pointer
        const bias = align * align * pointerNear
        targetAngle += delta * 0.6 * bias
        reachScale = 1 + bias * 0.75
      }
      const rootI = p.indexOf(a, 0)
      let cx = p.posX[rootI]
      let cy = p.posY[rootI]
      for (let j = 1; j < p.jointsPerAppendage; j++) {
        const i = p.indexOf(a, j)
        const t = j / (p.jointsPerAppendage - 1)
        // slow traveling wave down the limb — wriggle, not rigid pointing
        const wave = Math.sin(t * 2.8 + d.curlPhase + this.time * d.curlFreq * Math.PI * 2) * 0.5 * (0.3 + 0.7 * t)
        const desired = targetAngle + wave
        cx += Math.cos(desired) * this.restLengths[i] * reachScale
        cy += Math.sin(desired) * this.restLengths[i] * reachScale
        const raw = this.reachableTowards(p.posX[rootI], p.posY[rootI], cx, cy, p.radius[i])
        const k = Math.min(1, 1.1 * dt * (0.3 + t))
        p.posX[i] += (raw.x - p.posX[i]) * k
        p.posY[i] += (raw.y - p.posY[i]) * k
      }
    }

    /* ---- constraint projection ---- */
    const iterations = cfg.simulation.constraintIterations
    for (let it = 0; it < iterations; it++) {
      // limb roots ride the torso surface at slowly migrating angles
      for (let a = 0; a < p.appendageCount; a++) {
        const d = this.drivers[a]
        const drift = Math.sin(this.time * d.rootDriftFreq * Math.PI * 2) * d.rootDriftAmp
        const ang = d.restAngle + drift
        const root = p.indexOf(a, 0)
        const rx = p.posX[0] + Math.cos(ang) * p.radius[0] * 0.6
        const ry = p.posY[0] + Math.sin(ang) * p.radius[0] * 0.6
        p.posX[root] += (rx - p.posX[root]) * 0.5
        p.posY[root] += (ry - p.posY[root]) * 0.5
      }

      // segment length constraints along each limb
      for (let a = 0; a < p.appendageCount; a++) {
        for (let j = 0; j < p.jointsPerAppendage - 1; j++) {
          const i0 = p.indexOf(a, j)
          const i1 = p.indexOf(a, j + 1)
          const dx = p.posX[i1] - p.posX[i0]
          const dy = p.posY[i1] - p.posY[i0]
          const len = Math.hypot(dx, dy) || 1e-6
          const rest = this.restLengths[i1]
          const diff = (len - rest) / len
          const w0 = p.invMass[i0]
          const w1 = p.invMass[i1]
          const s = w0 + w1 || 1
          p.posX[i0] += dx * diff * (w0 / s)
          p.posY[i0] += dy * diff * (w0 / s)
          p.posX[i1] -= dx * diff * (w1 / s)
          p.posY[i1] -= dy * diff * (w1 / s)
        }
      }

      // soft bend smoothing: joints ease toward neighbor midpoints
      for (let a = 0; a < p.appendageCount; a++) {
        for (let j = 1; j < p.jointsPerAppendage - 1; j++) {
          const i0 = p.indexOf(a, j - 1)
          const i1 = p.indexOf(a, j)
          const i2 = p.indexOf(a, j + 1)
          const mx = (p.posX[i0] + p.posX[i2]) / 2
          const my = (p.posY[i0] + p.posY[i2]) / 2
          p.posX[i1] += (mx - p.posX[i1]) * 0.12
          p.posY[i1] += (my - p.posY[i1]) * 0.12
        }
      }

      // hard obstacle projection: core must never clip protected DOM (V17)
      if (this.obstacles.length) {
        for (let i = 0; i < p.count; i++) {
          const d = sdObstacles(p.posX[i], p.posY[i], this.obstacles, this.obstacleRounding) - p.radius[i]
          if (d < 0) {
            obstacleNormal(p.posX[i], p.posY[i], this.obstacles, this.obstacleRounding, this.normal)
            p.posX[i] -= this.normal.x * d
            p.posY[i] -= this.normal.y * d
          }
        }
      }

      // viewport bounds
      const aspect = this.viewportAspect
      for (let i = 0; i < p.count; i++) {
        const m = 0.02 + p.radius[i]
        if (p.posX[i] < m) p.posX[i] = m
        if (p.posX[i] > aspect - m) p.posX[i] = aspect - m
        if (p.posY[i] < m) p.posY[i] = m
        if (p.posY[i] > 1 - m) p.posY[i] = 1 - m
      }
    }

    // max-extension guard (§12): whatever the projections did, a chain link
    // never exceeds 115% rest — the silhouette must not tear into islands
    for (let a = 0; a < p.appendageCount; a++) {
      for (let j = 0; j < p.jointsPerAppendage - 1; j++) {
        const i0 = p.indexOf(a, j)
        const i1 = p.indexOf(a, j + 1)
        const dx = p.posX[i1] - p.posX[i0]
        const dy = p.posY[i1] - p.posY[i0]
        const len = Math.hypot(dx, dy)
        const maxLen = this.restLengths[i1] * 1.15
        if (len > maxLen) {
          const s = maxLen / len
          p.posX[i1] = p.posX[i0] + dx * s
          p.posY[i1] = p.posY[i0] + dy * s
        }
      }
      // root itself stays glued to the torso
      const rootI = p.indexOf(a, 0)
      const rdx = p.posX[rootI] - p.posX[0]
      const rdy = p.posY[rootI] - p.posY[0]
      const rlen = Math.hypot(rdx, rdy)
      const rmax = p.radius[0] * 0.9
      if (rlen > rmax) {
        p.posX[rootI] = p.posX[0] + (rdx / rlen) * rmax
        p.posY[rootI] = p.posY[0] + (rdy / rlen) * rmax
      }
    }

    // smoothed core velocity → torso motion stretch (§15.1)
    const cvx = (p.posX[0] - p.prevX[0]) / dt
    const cvy = (p.posY[0] - p.prevY[0]) / dt
    this.coreVelX += (cvx - this.coreVelX) * Math.min(1, dt * 3)
    this.coreVelY += (cvy - this.coreVelY) * Math.min(1, dt * 3)

    // comfort repulsion ONCE per step (inside the iteration loop it
    // compounds ×iterations and shoves the creature across the page):
    // gentle normal push, tangential motion untouched → boundary sliding
    if (this.obstacles.length) {
      const comfort = this.config.obstacles.comfortClearance
      for (let i = 0; i < p.count; i++) {
        const d = sdObstacles(p.posX[i], p.posY[i], this.obstacles, this.obstacleRounding) - p.radius[i]
        if (d >= 0 && d < comfort) {
          obstacleNormal(p.posX[i], p.posY[i], this.obstacles, this.obstacleRounding, this.normal)
          const push = (1 - d / comfort) * 0.0035 * (p.invMass[i] > 1 ? 0.5 : 1)
          p.posX[i] += this.normal.x * push
          p.posY[i] += this.normal.y * push
        }
      }
    }

    /* ---- breathing: core + tips radius modulation (temporally stable) ---- */
    const breathe = 1 + Math.sin(this.breathePhase) * 0.03 + Math.sin(this.breathePhase2) * 0.025
    p.activation[0] = breathe
    for (let a = 0; a < p.appendageCount; a++) {
      for (let j = 0; j < p.jointsPerAppendage; j++) {
        const i = p.indexOf(a, j)
        p.activation[i] = 1 + Math.sin(this.breathePhase2 + a * 1.3) * 0.04
      }
    }
  }

  viewportAspect = 1.6
  /* home anchor — idle pocket the core orbits; M8 navigation moves this.
     Default = open zone right of the home strap type. */
  anchorX = 1.02
  anchorY = 0.42
  /* smoothed core velocity, consumed by the torso motion-stretch */
  coreVelX = 0
  coreVelY = 0

  /* pointer state (handoff §17): raw set from DOM, smoothed in-step */
  pointerRawX = 0
  pointerRawY = 0
  pointerActive = false
  private pointerX = 0
  private pointerY = 0
  private pointerInit = false

  private clear(x: number, y: number, margin: number): boolean {
    if (x < margin || x > this.viewportAspect - margin || y < margin || y > 1 - margin) return false
    if (!this.obstacles.length) return true
    return sdObstacles(x, y, this.obstacles, this.obstacleRounding) >= margin
  }

  /**
   * Reachable target: walk from `to` back toward `from` until the point —
   * and the midpoint of the ray — has `clearance`. Prevents pull targets
   * landing on the FAR side of thin obstacles (which stranded the body
   * across them) and targets inside walls (projection fights → jitter).
   */
  private reachableTowards(fromX: number, fromY: number, toX: number, toY: number, clearance: number): Vec2 {
    for (let s = 8; s >= 0; s--) {
      const t = s / 8
      const x = fromX + (toX - fromX) * t
      const y = fromY + (toY - fromY) * t
      const mx = fromX + (toX - fromX) * t * 0.5
      const my = fromY + (toY - fromY) * t * 0.5
      if (this.clear(x, y, clearance) && this.clear(mx, my, clearance * 0.6)) return { x, y }
    }
    return { x: fromX, y: fromY }
  }

  /** Upload render state, interpolated between prev and current (V19). */
  writeUniforms(alpha: number) {
    const p = this.particles
    for (let i = 0; i < p.count; i++) {
      const x = p.prevX[i] + (p.posX[i] - p.prevX[i]) * alpha
      const y = p.prevY[i] + (p.posY[i] - p.prevY[i]) * alpha
      p.uniformData[i].set(x, y, p.radius[i], p.activation[i])
    }
  }
}
