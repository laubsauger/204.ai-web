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
  private normal2: Vec2 = { x: 0, y: 0 }
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
    this.chainLen = new Float32Array(p.appendageCount)
    for (let a = 0; a < p.appendageCount; a++) {
      for (let j = 0; j < p.jointsPerAppendage - 1; j++) {
        const i0 = p.indexOf(a, j)
        const i1 = p.indexOf(a, j + 1)
        this.restLengths[i1] = Math.hypot(p.posX[i1] - p.posX[i0], p.posY[i1] - p.posY[i0])
        this.chainLen[a] += this.restLengths[i1]
      }
      const root = p.indexOf(a, 0)
      // slow, heavy cadence (§23) — fast oscillators read as nervous
      this.drivers.push({
        swayFreq: 0.06 + rnd() * 0.11,
        swayPhase: rnd() * Math.PI * 2,
        swayAmp: 0.12 + rnd() * 0.18,
        curlFreq: 0.04 + rnd() * 0.08,
        curlPhase: rnd() * Math.PI * 2,
        restAngle: Math.atan2(p.posY[root] - p.posY[0], p.posX[root] - p.posX[0]),
        rootDriftFreq: 0.02 + rnd() * 0.03,
        rootDriftAmp: 0.15 + rnd() * 0.25,
      })
      this.plants.push({ x: 0, y: 0, active: false })
    }
    this.maxReach = Math.max(...Array.from(this.chainLen)) + particles.radius[0]
  }

  private chainLen: Float32Array
  private maxReach: number
  /* planted tip anchors — the walking substrate (§22, user 2026-07-21) */
  private plants: Array<{ x: number; y: number; active: boolean }> = []
  private lastReleaseTime = -10
  private lastPlantTime = -10

  /** Page anchoring: on scroll the whole state shifts so the creature stays
      glued to the DOCUMENT, then walks back into view organically. */
  shiftPageY(dySim: number) {
    const p = this.particles
    for (let i = 0; i < p.count; i++) {
      p.posY[i] += dySim
      p.prevY[i] += dySim
    }
    this.anchorY += dySim
    for (const pl of this.plants) if (pl.active) pl.y += dySim
  }

  /* nearest walkable surface = obstacle boundaries + viewport edges */
  private surfaceDist(x: number, y: number): number {
    const edge = Math.min(x, this.viewportAspect - x, y, 1 - y)
    const obs = this.obstacles.length ? sdObstacles(x, y, this.obstacles, this.obstacleRounding) : Infinity
    return Math.min(edge, obs)
  }

  private surfaceNormalInto(x: number, y: number, out: Vec2): Vec2 {
    const e = 1e-3
    const dx = this.surfaceDist(x + e, y) - this.surfaceDist(x - e, y)
    const dy = this.surfaceDist(x, y + e) - this.surfaceDist(x, y - e)
    const len = Math.hypot(dx, dy) || 1
    out.x = dx / len
    out.y = dy / len
    return out
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

    // surface probe first — intention + corner-following both need it
    const sd = this.surfaceDist(p.posX[0], p.posY[0])
    const inRange = sd < this.maxReach * 1.05
    const n = this.surfaceNormalInto(p.posX[0], p.posY[0], this.normal)
    const surfNX = n.x
    const surfNY = n.y

    // core intention: idle orbit around the anchor; when the pointer is
    // present and outside a dead zone, lean toward a point short of it —
    // interested, never cursor-glued (§17/§23)
    let ix = this.anchorX + Math.sin(this.time * 0.05 + 1.7) * 0.04 + Math.sin(this.time * 0.023) * 0.025
    let iy = this.anchorY + Math.cos(this.time * 0.041 + 0.4) * 0.032 + Math.sin(this.time * 0.017 + 2.1) * 0.022
    let pointerDirX = 0
    let pointerDirY = 0
    if (this.pointerActive) {
      const dx = this.pointerX - p.posX[0]
      const dy = this.pointerY - p.posY[0]
      const dist = Math.hypot(dx, dy)
      if (dist > 0.05) {
        pointerDirX = dx / dist
        pointerDirY = dy / dist
        const interest = this.config.behavior.pointerInterest
        // stop short: hold ~0.12 sim units away from the cursor
        ix = ix * (1 - interest) + (this.pointerX - pointerDirX * 0.18) * interest
        iy = iy * (1 - interest) + (this.pointerY - pointerDirY * 0.18) * interest
      }
    }
    // torso needs real clearance — a pocket tighter than the body is not a
    // destination (reachability-lite; M8 A* replaces this)
    let rawTarget = this.reachableTowards(p.posX[0], p.posY[0], ix, iy, p.radius[0] * 1.35)
    // corner following (until M8 A*): if the straight ray is blocked but the
    // desire is far, walk along the wall tangent toward it — the creature
    // rounds corners instead of idling at them
    const desireDist = Math.hypot(ix - p.posX[0], iy - p.posY[0])
    const progress = Math.hypot(rawTarget.x - p.posX[0], rawTarget.y - p.posY[0])
    if (desireDist > 0.12 && progress < 0.03 && inRange) {
      const sign = -surfNY * (ix - p.posX[0]) + surfNX * (iy - p.posY[0]) >= 0 ? 1 : -1
      rawTarget = this.reachableTowards(
        p.posX[0],
        p.posY[0],
        p.posX[0] - surfNY * sign * 0.22,
        p.posY[0] + surfNX * sign * 0.22,
        p.radius[0] * 1.2,
      )
    }
    // ease the effective target: losing line of sight must not snap the
    // destination (user 2026-07-21) — the body drifts, never jerks
    const tk = 1 - Math.exp((-dt / 0.55) * Math.LN2)
    this.intentX += (rawTarget.x - this.intentX) * tk
    this.intentY += (rawTarget.y - this.intentY) * tk
    // NO FLIGHT (user 2026-07-21): destinations live on the hover shell
    // around surfaces — far targets become "crawl along the wall toward it"
    const shellBand = this.maxReach * 0.34
    const tsd = this.surfaceDist(this.intentX, this.intentY)
    if (tsd > shellBand) {
      this.surfaceNormalInto(this.intentX, this.intentY, this.normal2)
      const pullIn = tsd - shellBand
      this.intentX -= this.normal2.x * pullIn
      this.intentY -= this.normal2.y * pullIn
    }
    const target = { x: this.intentX, y: this.intentY }
    // heavy body: bounded approach speed (§23: 2–12% viewport width/s)
    const maxStep = this.config.behavior.maximumCoreSpeed * this.viewportAspect * dt
    const tdx = target.x - p.posX[0]
    const tdy = target.y - p.posY[0]
    const tlen = Math.hypot(tdx, tdy)
    const step = Math.min(tlen * dt * 1.2, maxStep)
    if (tlen > 0.015) {
      p.posX[0] += (tdx / tlen) * step
      p.posY[0] += (tdy / tlen) * step
    }

    // ---- surface rest + planting (walking substrate — §20/§22) ----
    {
      // carry height breathes slowly, crouches while moving; spring is
      // ALWAYS on (clamped) — detached bodies sink to the nearest surface
      const speedNorm = Math.min(1, Math.hypot(this.coreVelX, this.coreVelY) / 0.08)
      const dip = 0.08 * Math.exp(-(this.time - this.lastPlantTime) / 0.35)
      const hover = this.maxReach * (0.3 + Math.sin(this.time * 0.11 * Math.PI * 2 + 0.7) * 0.06 - speedNorm * 0.08 - dip)
      const err = Math.max(-0.05, Math.min(0.05, sd - hover))
      p.posX[0] -= surfNX * err * Math.min(1, dt * 1.6)
      p.posY[0] -= surfNY * err * Math.min(1, dt * 1.6)
    }
    // role-based anatomy (user 2026-07-21): first 3 limbs are WALKERS that
    // hang toward the surface, the rest are UPPER tentacles — rest angles
    // slowly reorganize around the surface normal, so the same rig walks
    // floors, walls and obstacle edges without ever reading as a starfish
    const downAngle = Math.atan2(-surfNY, -surfNX)
    const upAngle = Math.atan2(surfNY, surfNX)
    const WALKER_SPREAD = [-0.85, 0, 0.85]
    const UPPER_SPREAD = [-0.55, 0.55]
    for (let a = 0; a < p.appendageCount; a++) {
      const d = this.drivers[a]
      const isWalker = a < 3
      const want = inRange
        ? isWalker
          ? downAngle + WALKER_SPREAD[a % 3]
          : upAngle + UPPER_SPREAD[(a - 3) % 2]
        : d.restAngle
      let delta = want - d.restAngle
      while (delta > Math.PI) delta -= Math.PI * 2
      while (delta < -Math.PI) delta += Math.PI * 2
      d.restAngle += delta * Math.min(1, dt * 0.8)
    }
    const wantPlant = new Set<number>()
    if (inRange) for (let a = 0; a < Math.min(3, p.appendageCount); a++) wantPlant.add(a)
    for (let a = 0; a < p.appendageCount; a++) {
      const plant = this.plants[a]
      const rootI = p.indexOf(a, 0)
      if (plant.active) {
        const stretch = Math.hypot(plant.x - p.posX[rootI], plant.y - p.posY[rootI])
        // release when overstretched or misaligned — but stagger releases
        // (one foot at a time = walk rhythm, not scramble)
        const may = this.time - this.lastReleaseTime > 0.45
        // EMERGENCY: badly overstretched grips let go immediately — a tip
        // pinned across an obstacle bridges the body through it (B14)
        if (stretch > this.chainLen[a] * 1.3 || !wantPlant.has(a) || (stretch > this.chainLen[a] * 1.06 && may)) {
          plant.active = false
          this.lastReleaseTime = this.time
        }
      }
      if (!plant.active && wantPlant.has(a)) {
        // plant ahead of travel: tip projected onto the surface with a lead
        // along the tangent in the movement direction
        const tipI = p.indexOf(a, p.jointsPerAppendage - 1)
        let tx = p.posX[tipI]
        let ty = p.posY[tipI]
        const tangX = -surfNY
        const tangY = surfNX
        const lead = Math.sign(tangX * this.coreVelX + tangY * this.coreVelY) * this.chainLen[a] * 0.3
        tx += tangX * lead
        ty += tangY * lead
        for (let it = 0; it < 3; it++) {
          const td = this.surfaceDist(tx, ty)
          this.surfaceNormalInto(tx, ty, this.normal)
          tx -= this.normal.x * td
          ty -= this.normal.y * td
        }
        if (Math.hypot(tx - p.posX[rootI], ty - p.posY[rootI]) < this.chainLen[a]) {
          plant.x = tx
          plant.y = ty
          plant.active = true
          this.lastPlantTime = this.time
        }
      }
    }

    // limbs: serpentine traveling wave along the chain (anatomy-aligned,
    // per-limb seeded — §15.2); planted limbs grip their anchor, the limb
    // best aligned with the pointer extends toward it, others trail
    for (let a = 0; a < p.appendageCount; a++) {
      const d = this.drivers[a]
      const sway = Math.sin(this.time * d.swayFreq * Math.PI * 2 + d.swayPhase) * d.swayAmp
      let targetAngle = d.restAngle + sway * 0.45
      let reachScale = 1
      // walkers (a<3) keep their feet — only UPPER tentacles reach for the
      // pointer, stretching MORE when it is farther away (planted reach-out,
      // user 2026-07-21)
      if (a >= 3 && this.pointerActive && (pointerDirX !== 0 || pointerDirY !== 0)) {
        const pointerAngle = Math.atan2(pointerDirY, pointerDirX)
        let delta = pointerAngle - d.restAngle
        while (delta > Math.PI) delta -= Math.PI * 2
        while (delta < -Math.PI) delta += Math.PI * 2
        const align = Math.max(0, Math.cos(delta))
        const dx0 = this.pointerX - p.posX[0]
        const dy0 = this.pointerY - p.posY[0]
        const farness = Math.min(1, Math.hypot(dx0, dy0) / 0.5)
        const bias = align * align * (0.3 + 0.7 * farness)
        targetAngle += delta * 0.7 * bias
        reachScale = 1 + bias * 1.1
      }
      const rootI = p.indexOf(a, 0)
      const plant = this.plants[a]
      const tipIdx = p.jointsPerAppendage - 1
      let cx = p.posX[rootI]
      let cy = p.posY[rootI]
      for (let j = 1; j < p.jointsPerAppendage; j++) {
        const i = p.indexOf(a, j)
        const t = j / tipIdx
        if (plant.active) {
          // gripping limb: tip locks to the plant, mid joints relax into a
          // catenary-ish sag between root and plant (wave damped)
          if (j === tipIdx) {
            p.posX[i] += (plant.x - p.posX[i]) * Math.min(1, dt * 16)
            p.posY[i] += (plant.y - p.posY[i]) * Math.min(1, dt * 16)
          } else {
            const sag = Math.sin(t * Math.PI) * this.chainLen[a] * 0.08
            const bx = p.posX[rootI] + (plant.x - p.posX[rootI]) * t + surfNX * sag
            const by = p.posY[rootI] + (plant.y - p.posY[rootI]) * t + surfNY * sag
            p.posX[i] += (bx - p.posX[i]) * Math.min(1, dt * 2.2)
            p.posY[i] += (by - p.posY[i]) * Math.min(1, dt * 2.2)
          }
          continue
        }
        // free limb: slow traveling wave — wriggle, not rigid pointing
        const wave = Math.sin(t * 2.8 + d.curlPhase + this.time * d.curlFreq * Math.PI * 2) * 0.26 * (0.3 + 0.7 * t)
        const desired = targetAngle + wave
        cx += Math.cos(desired) * this.restLengths[i] * reachScale
        cy += Math.sin(desired) * this.restLengths[i] * reachScale
        const raw = this.reachableTowards(p.posX[rootI], p.posY[rootI], cx, cy, p.radius[i])
        const k = Math.min(1, 0.4 * dt * (0.3 + t))
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

      // NOTE: no hard viewport clamp — the creature is page-anchored and may
      // be scrolled out of view; the in-view anchor walks it back (§scroll)
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
        const maxLen = this.restLengths[i1] * 1.06
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

    // tip speed cap (§23/§24): free joints never exceed maximumTipSpeed —
    // kills the "accelerates like crazy" whip
    const maxTip = this.config.behavior.maximumTipSpeed * this.viewportAspect * dt
    for (let a = 0; a < p.appendageCount; a++) {
      if (this.plants[a].active) continue
      for (let j = 1; j < p.jointsPerAppendage; j++) {
        const i = p.indexOf(a, j)
        const dx = p.posX[i] - p.prevX[i]
        const dy = p.posY[i] - p.prevY[i]
        const disp = Math.hypot(dx, dy)
        if (disp > maxTip) {
          const s = maxTip / disp
          p.posX[i] = p.prevX[i] + dx * s
          p.posY[i] = p.prevY[i] + dy * s
        }
      }
    }

    // anchor stays in view: after scrolling away, the creature has an
    // in-viewport destination to walk back to (organic catch-up, no snap)
    this.anchorX = Math.min(Math.max(this.anchorX, 0.14), this.viewportAspect - 0.14)
    this.anchorY = Math.min(Math.max(this.anchorY, 0.14), 0.86)

    // sleep threshold: microscopic displacements collapse to rest — the
    // creature holds a pose without shimmering (§24)
    for (let i = 0; i < p.count; i++) {
      if (Math.hypot(p.posX[i] - p.prevX[i], p.posY[i] - p.prevY[i]) < 0.00006) {
        p.posX[i] = p.prevX[i]
        p.posY[i] = p.prevY[i]
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
          const push = (1 - d / comfort) * 0.0015 * (p.invMass[i] > 1 ? 0.5 : 1)
          p.posX[i] += this.normal.x * push
          p.posY[i] += this.normal.y * push
        }
      }
    }

    /* ---- breathing + squash/stretch (volume feel) ---- */
    const breathe = 1 + Math.sin(this.breathePhase) * 0.03 + Math.sin(this.breathePhase2) * 0.025
    p.activation[0] = breathe
    for (let a = 0; a < p.appendageCount; a++) {
      const rootI = p.indexOf(a, 0)
      const tipI = p.indexOf(a, p.jointsPerAppendage - 1)
      const span = Math.hypot(p.posX[tipI] - p.posX[rootI], p.posY[tipI] - p.posY[rootI])
      // compressed limb → thicker mid (squash); extended → slimmer (stretch)
      const ratio = span / (this.chainLen[a] * 0.85)
      const squash = Math.max(-0.25, Math.min(0.45, 1 - ratio))
      const planted = this.plants[a].active
      for (let j = 0; j < p.jointsPerAppendage; j++) {
        const i = p.indexOf(a, j)
        const t = j / (p.jointsPerAppendage - 1)
        const profile = Math.sin(t * Math.PI)
        // load-bearing limbs bulge toward the foot — visible weight
        const pad = planted && t > 0.55 ? 1 + (t - 0.55) * 0.7 : 1
        p.activation[i] = (1 + Math.sin(this.breathePhase2 + a * 1.3) * 0.04) * (1 + squash * 0.5 * profile) * pad
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
  /* smoothed intention target (no LOS-loss snapping) */
  private intentX = 1.02
  private intentY = 0.42

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
