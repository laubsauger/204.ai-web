// Procedural walker simulation (handoff §11/§12/§18-§23, SPEC V19).
//
// Architecture (user 2026-07-21): explicit foot/seek TARGETS + kinematic
// FABRIK chains. Limb joints carry no velocity and run through no solver —
// same inputs, same pose, zero jitter by construction. Only the CORE is
// dynamic (Verlet + springs). Legs: plant targets on surfaces, swing arcs
// between plants. Seekers: eased seek points at varying extension with
// curvature bias — snaky, never rigidly extended.
//
// Obstacles are sampled analytically (math/sdf.ts) — no GPU readback (V19).

import { ParticleBuffer, mulberry32 } from './simulation/ParticleBuffer'
import { obstacleNormal, sdObstacles, type SimRect, type Vec2 } from './math/sdf'
import type { NavigationField, RouteResult } from './navigation/NavigationField'
import type { OrganismConfig } from './OrganismParameters'

type LimbDriver = {
  swayFreq: number
  swayPhase: number
  swayAmp: number
  curlFreq: number
  curlPhase: number
  restAngle: number
  rootDriftFreq: number
  rootDriftAmp: number
}

type Swing = { active: boolean; fromX: number; fromY: number; toX: number; toY: number; t: number }

const LEGS = 3
const SWING_TIME = 0.34 // softer arcs
/* jumps off until walking earns trust — they read as erratic zips
   (user 2026-07-21); re-enable for true gap-crossings later */
const JUMP_ENABLED = true // safe now: progress-gated + arc-clear + absolute speed cap

export class OrganismSimulation {
  private restLengths: Float32Array
  private chainLen: Float32Array
  private maxReach: number
  private drivers: LimbDriver[] = []
  private breathePhase = 0
  private breathePhase2 = 0
  private time = 0
  private normal: Vec2 = { x: 0, y: 0 }
  private normal2: Vec2 = { x: 0, y: 0 }
  private smNX = 0
  private smNY = -1
  obstacles: SimRect[] = []
  obstacleRounding = 0.02
  viewportAspect = 1.6
  anchorX = 1.02
  anchorY = 0.42
  coreVelX = 0
  coreVelY = 0

  /* pointer */
  pointerRawX = 0
  pointerRawY = 0
  pointerActive = false
  private pointerX = 0
  private pointerY = 0
  private slowPX = 0
  private slowPY = 0
  private pointerInit = false
  private pointerRampStart = -1

  /* intention / navigation */
  intentX = 1.02
  intentY = 0.42
  nav: NavigationField | null = null
  route: RouteResult | null = null
  routeIdx = 0
  private routeGoalX = 0
  private routeGoalY = 0
  private lastRouteTime = -10
  private sniffing = false
  private lastPointerDist = Infinity
  private lastProgressTime = 0
  /* discrete locomotion decisions (user 2026-07-21: self-propelled, no
     rubber band) — the body commits to a local destination and walks it */
  private localSet = false
  private localStaleAt = 0
  private decisionGoalX = 1e9
  private decisionGoalY = 1e9
  private lastDecisionAt = -10
  private pauseUntil = -1
  private rng = mulberry32(4211)
  private nextGestureAt = 3
  private gestureUntil = -1
  private gestureLimb = -1
  private creepAt = 5
  private stanceFixes = 0

  /* state machine (M9) */
  state: 'rest' | 'pursue' | 'settle' | 'sniff' | 'jump' = 'rest'
  private stateSince = 0
  private pursueBestDist = Infinity
  private pursueBestAt = 0
  private failedGoalX = 1e9
  private failedGoalY = 1e9
  private jumpT = 0
  private jumpDur = 1
  private jumpSX = 0
  private jumpSY = 0
  private jumpEX = 0
  private jumpEY = 0

  /* feet */
  plants: Array<{ x: number; y: number; active: boolean }> = []
  private swings: Swing[] = []
  private lastReleaseTime = -10
  private lastPlantTime = -10
  private surgeUntil = -10
  private stanceX = 1.02
  private stanceY = 0.42
  private smTX = 0
  private smTY = 0
  private stanceInit = false
  private lastJumpEnd = -10
  private lastJumpFromX = 1e9
  private lastJumpFromY = 1e9
  /* seekers: eased targets */
  private seekX: Float32Array
  private seekY: Float32Array

  /* proximity glow (user 2026-07-21): nearest tip heats toward the brand
     accent as it approaches the cursor's touch radius */
  glowX = 0
  glowY = 0
  glowI = 0

  dbgReleases = 0
  dbgMoving = false
  dbgGoalDist = 0
  dbgTravel: [number, number] = [0, 0]
  dbgStride = ''

  constructor(
    private particles: ParticleBuffer,
    private config: OrganismConfig,
    seed = 907,
  ) {
    const rnd = mulberry32(seed)
    const p = particles
    this.restLengths = new Float32Array(p.count)
    this.chainLen = new Float32Array(p.appendageCount)
    this.seekX = new Float32Array(p.appendageCount)
    this.seekY = new Float32Array(p.appendageCount)
    for (let a = 0; a < p.appendageCount; a++) {
      for (let j = 0; j < p.jointsPerAppendage - 1; j++) {
        const i0 = p.indexOf(a, j)
        const i1 = p.indexOf(a, j + 1)
        this.restLengths[i1] = Math.hypot(p.posX[i1] - p.posX[i0], p.posY[i1] - p.posY[i0])
        this.chainLen[a] += this.restLengths[i1]
      }
      const root = p.indexOf(a, 0)
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
      this.swings.push({ active: false, fromX: 0, fromY: 0, toX: 0, toY: 0, t: 0 })
      const tip = p.indexOf(a, p.jointsPerAppendage - 1)
      this.seekX[a] = p.posX[tip]
      this.seekY[a] = p.posY[tip]
    }
    this.maxReach = Math.max(...Array.from(this.chainLen)) + particles.radius[0]
  }

  invalidateRoute() {
    this.route = null
    // layout changed — failed goals may be reachable now
    this.failedGoalX = 1e9
    this.failedGoalY = 1e9
  }

  shiftPageY(dySim: number) {
    const p = this.particles
    for (let i = 0; i < p.count; i++) {
      p.posY[i] += dySim
      p.prevY[i] += dySim
      p.renderY[i] += dySim
    }
    this.anchorY += dySim
    this.intentY += dySim
    for (const pl of this.plants) if (pl.active) pl.y += dySim
    for (const sw of this.swings) {
      if (sw.active) {
        sw.fromY += dySim
        sw.toY += dySim
      }
    }
    for (let a = 0; a < this.particles.appendageCount; a++) this.seekY[a] += dySim
  }

  /* ---------------- fields ---------------- */

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

  private clear(x: number, y: number, margin: number): boolean {
    if (x < margin || x > this.viewportAspect - margin || y < margin || y > 1 - margin) return false
    if (!this.obstacles.length) return true
    return sdObstacles(x, y, this.obstacles, this.obstacleRounding) >= margin
  }

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

  private bridgeClear(ax: number, ay: number, bx: number, by: number): boolean {
    if (!this.obstacles.length) return true
    for (const t of [0.25, 0.45, 0.65, 0.82]) {
      const x = ax + (bx - ax) * t
      const y = ay + (by - ay) * t
      if (sdObstacles(x, y, this.obstacles, this.obstacleRounding) < 0.008) return false
    }
    return true
  }

  private hasLOS = (ax: number, ay: number, bx: number, by: number): boolean => {
    for (let k = 1; k <= 8; k++) {
      const t = k / 8
      if (!this.clear(ax + (bx - ax) * t, ay + (by - ay) * t, this.particles.radius[0] * 1.1)) return false
    }
    return true
  }

  private setState(next: 'rest' | 'pursue' | 'settle' | 'sniff' | 'jump') {
    if (this.state !== next) {
      this.state = next
      this.stateSince = this.time
      if (next === 'pursue') {
        this.pursueBestDist = Infinity
        this.pursueBestAt = this.time
      }
      if (next === 'settle') this.stanceFixes = 0
    }
  }

  /** Project a point onto the surface, standing off by `standoff`. */
  private projectToSurface(x: number, y: number, standoff: number): Vec2 {
    let px = x
    let py = y
    for (let it = 0; it < 3; it++) {
      const d = this.surfaceDist(px, py)
      this.surfaceNormalInto(px, py, this.normal2)
      px -= this.normal2.x * (d - standoff)
      py -= this.normal2.y * (d - standoff)
    }
    return { x: px, y: py }
  }

  /**
   * FABRIK solve for one limb: root pinned, tip toward target, joints
   * kinematic (pos AND prev written — zero velocity, zero jitter by
   * construction). `bend` arcs the chain perpendicular to root→target.
   */
  private solveLimb(a: number, rootX: number, rootY: number, tx: number, ty: number, bend: number, waveScale = 1) {
    const p = this.particles
    const n = p.jointsPerAppendage
    const X: number[] = []
    const Y: number[] = []
    for (let j = 0; j < n; j++) {
      X.push(p.posX[p.indexOf(a, j)])
      Y.push(p.posY[p.indexOf(a, j)])
    }
    const dx = tx - rootX
    const dy = ty - rootY
    const dist = Math.hypot(dx, dy)
    const reach = this.chainLen[a]
    let gx = tx
    let gy = ty
    if (dist > reach) {
      gx = rootX + (dx / dist) * reach
      gy = rootY + (dy / dist) * reach
    }
    for (let pass = 0; pass < 2; pass++) {
      X[n - 1] = gx
      Y[n - 1] = gy
      for (let j = n - 2; j >= 0; j--) {
        const r = this.restLengths[p.indexOf(a, j + 1)]
        const vx = X[j] - X[j + 1]
        const vy = Y[j] - Y[j + 1]
        const l = Math.hypot(vx, vy) || 1
        X[j] = X[j + 1] + (vx / l) * r
        Y[j] = Y[j + 1] + (vy / l) * r
      }
      X[0] = rootX
      Y[0] = rootY
      for (let j = 1; j < n; j++) {
        const r = this.restLengths[p.indexOf(a, j)]
        const vx = X[j] - X[j - 1]
        const vy = Y[j] - Y[j - 1]
        const l = Math.hypot(vx, vy) || 1
        X[j] = X[j - 1] + (vx / l) * r
        Y[j] = Y[j - 1] + (vy / l) * r
      }
    }
    if (bend !== 0) {
      // Smitner pattern (user repo 2026-07-21): TRAVELING perpendicular
      // wave along the chain, re-constrained afterwards — flowing organic
      // curvature instead of a static bend lobe
      const bx = gx - rootX
      const by = gy - rootY
      const bl = Math.hypot(bx, by) || 1
      const px2 = -by / bl
      const py2 = bx / bl
      const d2 = this.drivers[a]
      // two incommensurate components traveling in OPPOSITE directions +
      // slowly drifting amplitude — interference never repeats, so the
      // motion weaves instead of pulsing on a beat (user 2026-07-21)
      const sp1 = (0.28 + d2.curlFreq * 1.6) * Math.PI
      const sp2 = sp1 * 0.618
      const ampMod = 0.55 + 0.45 * Math.sin(this.time * 0.043 * Math.PI * 2 + d2.curlPhase * 1.7)
      for (let j = 1; j < n - 1; j++) {
        const t = j / (n - 1)
        // waveScale 0 = structural limb, no undulation at all (legs —
        // user 2026-07-21: feet undulation was residual jiggle)
        const env = waveScale
        const w =
          (Math.sin(t * Math.PI * 1.15 + this.time * sp1 + d2.curlPhase) * 0.7 +
            Math.sin(t * Math.PI * 2.1 - this.time * sp2 + d2.curlPhase * 2.3) * 0.3) *
          Math.sin(t * Math.PI) *
          ampMod *
          env
        X[j] += px2 * w * bend
        Y[j] += py2 * w * bend
      }
      X[0] = rootX
      Y[0] = rootY
      for (let j = 1; j < n; j++) {
        const r = this.restLengths[p.indexOf(a, j)]
        const vx = X[j] - X[j - 1]
        const vy = Y[j] - Y[j - 1]
        const l = Math.hypot(vx, vy) || 1
        X[j] = X[j - 1] + (vx / l) * r
        Y[j] = Y[j - 1] + (vy / l) * r
      }
    }
    if (this.obstacles.length) {
      // joints AND segment midpoints stay out of solids
      for (let j = 1; j < n; j++) {
        const dj = sdObstacles(X[j], Y[j], this.obstacles, this.obstacleRounding)
        if (dj < 0) {
          obstacleNormal(X[j], Y[j], this.obstacles, this.obstacleRounding, this.normal2)
          X[j] -= this.normal2.x * dj
          Y[j] -= this.normal2.y * dj
        }
      }
      for (let j = 0; j < n - 1; j++) {
        const mx = (X[j] + X[j + 1]) / 2
        const my = (Y[j] + Y[j + 1]) / 2
        const dm = sdObstacles(mx, my, this.obstacles, this.obstacleRounding)
        if (dm < 0) {
          obstacleNormal(mx, my, this.obstacles, this.obstacleRounding, this.normal2)
          X[j] -= this.normal2.x * dm
          Y[j] -= this.normal2.y * dm
          X[j + 1] -= this.normal2.x * dm
          Y[j + 1] -= this.normal2.y * dm
        }
      }
    }
    for (let j = 0; j < n; j++) {
      const i = p.indexOf(a, j)
      p.posX[i] = X[j]
      p.posY[i] = Y[j]
      p.prevX[i] = X[j]
      p.prevY[i] = Y[j]
    }
  }

  /* ---------------- step ---------------- */

  step(dt: number) {
    const p = this.particles
    const cfg = this.config
    this.time += dt
    this.breathePhase += (dt * Math.PI * 2) / 6.4
    this.breathePhase2 += (dt * Math.PI * 2) / 9.7

    /* core Verlet (the only dynamic particle) */
    {
      const restful = this.state === 'rest' || this.state === 'settle' || this.state === 'sniff'
      const damp = restful ? 0.9 : cfg.simulation.damping
      const vx = (p.posX[0] - p.prevX[0]) * damp
      const vy = (p.posY[0] - p.prevY[0]) * damp
      p.prevX[0] = p.posX[0]
      p.prevY[0] = p.posY[0]
      p.posX[0] += vx
      p.posY[0] += vy
    }

    /* pointer smoothing: fast (attention) + slow strategic (body) */
    if (this.pointerActive) {
      if (!this.pointerInit) {
        this.pointerX = this.pointerRawX
        this.pointerY = this.pointerRawY
        this.slowPX = this.pointerRawX
        this.slowPY = this.pointerRawY
        this.pointerInit = true
        this.pointerRampStart = this.time
        p.posX[1] = this.pointerRawX
        p.posY[1] = this.pointerRawY
        p.prevX[1] = p.posX[1]
        p.prevY[1] = p.posY[1]
      }
      const k = 1 - Math.exp((-dt / 0.12) * Math.LN2)
      this.pointerX += (this.pointerRawX - this.pointerX) * k
      this.pointerY += (this.pointerRawY - this.pointerY) * k
      const ks = 1 - Math.exp((-dt / 0.45) * Math.LN2)
      this.slowPX += (this.pointerX - this.slowPX) * ks
      this.slowPY += (this.pointerY - this.slowPY) * ks
      const at = this.reachableTowards(p.posX[0], p.posY[0], this.pointerX, this.pointerY, 0.02)
      const ak = 1 - Math.exp((-dt / 0.18) * Math.LN2)
      p.posX[1] += (at.x - p.posX[1]) * ak
      p.posY[1] += (at.y - p.posY[1]) * ak
      p.prevX[1] = p.posX[1]
      p.prevY[1] = p.posY[1]
    }

    /* surface frame (smoothed — no face-flip thrash) */
    const sd = this.surfaceDist(p.posX[0], p.posY[0])
    const inRange = sd < this.maxReach * 1.05
    const nRaw = this.surfaceNormalInto(p.posX[0], p.posY[0], this.normal)
    const nk = Math.min(1, dt * (this.state === 'rest' ? 0.5 : 2.5)) // frozen frame at rest — no hover-direction sway
    this.smNX += (nRaw.x - this.smNX) * nk
    this.smNY += (nRaw.y - this.smNY) * nk
    const nl = Math.hypot(this.smNX, this.smNY) || 1
    const surfNX = this.smNX / nl
    const surfNY = this.smNY / nl
    const tangX = -surfNY
    const tangY = surfNX

    /* strategic goal */
    let ix = this.anchorX
    let iy = this.anchorY
    let pointerDirX = 0
    let pointerDirY = 0
    if (this.pointerActive) {
      const dx = this.slowPX - p.posX[0]
      const dy = this.slowPY - p.posY[0]
      const dist = Math.hypot(dx, dy)
      if (dist > 0.05) {
        pointerDirX = dx / dist
        pointerDirY = dy / dist
        const ramp = this.pointerRampStart < 0 ? 0 : Math.min(1, (this.time - this.pointerRampStart) / 1.5)
        const interest = cfg.behavior.pointerInterest * ramp
        if (ramp >= 0.6) {
          // full attention: the pointer IS the goal — the residual anchor
          // blend once dragged goals into blocked clearance rings and
          // false-flagged reachable cursors as unreachable (sniff-lock)
          ix = this.slowPX
          iy = this.slowPY
        } else {
          ix = ix * (1 - interest) + this.slowPX * interest
          iy = iy * (1 - interest) + this.slowPY * interest
        }
      }
    }

    /* hunger watchdog */
    this.sniffing = false
    let finalGoalDist = -1
    let starved = false
    if (this.pointerActive) {
      const dNow = Math.hypot(this.pointerX - p.posX[0], this.pointerY - p.posY[0])
      if (dNow < this.lastPointerDist - 0.015) this.lastProgressTime = this.time
      this.lastPointerDist = dNow
      starved = dNow > 0.25 && this.time - this.lastProgressTime > 2
    } else {
      this.lastPointerDist = Infinity
    }

    /* routing (on demand, with route memory) */
    if (this.nav) {
      const pts0 = this.route?.points ?? []
      const exhaustedFar = this.route !== null && this.routeIdx >= pts0.length && Math.hypot(ix - p.posX[0], iy - p.posY[0]) > 0.12
      const stale =
        !this.route ||
        Math.hypot(ix - this.routeGoalX, iy - this.routeGoalY) > Math.max(cfg.navigation.rerouteThreshold, 0.15) ||
        exhaustedFar ||
        (starved && this.time - this.lastRouteTime > 2)
      if (stale) {
        if (starved) this.lastProgressTime = this.time
        this.route = this.nav.route(p.posX[0], p.posY[0], ix, iy, this.hasLOS, starved ? undefined : this.route?.points)
        this.routeGoalX = ix
        this.routeGoalY = iy
        this.lastRouteTime = this.time
        this.routeIdx = 0
      }
      const pts = this.route!.points
      while (this.routeIdx < pts.length && Math.hypot(pts[this.routeIdx].x - p.posX[0], pts[this.routeIdx].y - p.posY[0]) < 0.1) this.routeIdx++
      if (this.routeIdx < pts.length) {
        finalGoalDist = Math.hypot(ix - p.posX[0], iy - p.posY[0])
        ix = pts[this.routeIdx].x
        iy = pts[this.routeIdx].y
      }
      if (this.route!.goalUnreachable && this.pointerActive) {
        const end = pts.length ? pts[pts.length - 1] : { x: p.posX[0], y: p.posY[0] }
        if (Math.hypot(end.x - p.posX[0], end.y - p.posY[0]) < 0.16) this.sniffing = true
      }
    }

    /* DISCRETE destination commitment — no continuous cursor servo.
       The body picks a local destination ~1 body-length ahead along the
       route, walks it at its own rhythm, micro-pauses, then re-decides.
       Cursor motion affects DECISIONS, never in-flight travel. */
    const shellBand = this.maxReach * 0.34
    const decide = () => {
      // accumulate ~0.28 along the remaining route; fallback = goal
      let cx = p.posX[0]
      let cy = p.posY[0]
      let acc = 0
      let px2 = ix
      let py2 = iy
      if (this.route) {
        for (let k = this.routeIdx; k < this.route.points.length; k++) {
          const wp = this.route.points[k]
          acc += Math.hypot(wp.x - cx, wp.y - cy)
          cx = wp.x
          cy = wp.y
          if (acc >= 0.28) {
            px2 = wp.x
            py2 = wp.y
            break
          }
          px2 = wp.x
          py2 = wp.y
        }
      }
      // shell projection at DECISION time (walk destinations live on walls);
      // corner slide if it collapsed next to the body
      let dest = { x: px2, y: py2 }
      const dsd = this.surfaceDist(dest.x, dest.y)
      if (dsd > shellBand) dest = this.projectToSurface(dest.x, dest.y, shellBand * 0.8)
      if (Math.hypot(dest.x - p.posX[0], dest.y - p.posY[0]) < 0.08 && Math.hypot(ix - p.posX[0], iy - p.posY[0]) > 0.15) {
        this.surfaceNormalInto(dest.x, dest.y, this.normal2)
        const tgX = -this.normal2.y
        const tgY = this.normal2.x
        const sgn = tgX * (ix - dest.x) + tgY * (iy - dest.y) >= 0 ? 1 : -1
        dest = this.projectToSurface(dest.x + tgX * sgn * 0.14, dest.y + tgY * sgn * 0.14, shellBand * 0.8)
      }
      this.intentX = dest.x
      this.intentY = dest.y
      this.localSet = true
      this.localStaleAt = this.time + 4
      this.decisionGoalX = ix
      this.decisionGoalY = iy
      this.lastDecisionAt = this.time
      this.pauseUntil = -1
    }
    if (this.state === 'pursue') {
      const reached = Math.hypot(this.intentX - p.posX[0], this.intentY - p.posY[0]) < 0.06
      const goalJumped = Math.hypot(ix - this.decisionGoalX, iy - this.decisionGoalY) > 0.35 && this.time - this.lastDecisionAt > 0.5
      if (!this.localSet || this.time > this.localStaleAt || goalJumped) decide()
      else if (reached) {
        if (this.pauseUntil < 0) this.pauseUntil = this.time + 0.15 + this.rng() * 0.3 // deliberate beat
        else if (this.time > this.pauseUntil) decide()
      }
    } else if (this.state === 'rest' || this.state === 'settle' || this.state === 'sniff') {
      // parked: the carrot sits where the body is — nothing tugs
      this.localSet = false
      this.intentX = p.posX[0]
      this.intentY = p.posY[0]
    }
    const tdx = this.intentX - p.posX[0]
    const tdy = this.intentY - p.posY[0]
    const tlen = Math.hypot(tdx, tdy)
    const goalDist = finalGoalDist >= 0 ? finalGoalDist : tlen
    const moving = goalDist > (this.pointerActive ? 0.13 : 0.05)
    const rawTX = moving && tlen > 1e-4 ? tdx / tlen : 0
    const rawTY = moving && tlen > 1e-4 ? tdy / tlen : 0
    // stalking: travel direction is EASED — waypoint switches turn the
    // body, they never yank it sideways (user 2026-07-21)
    const tvk = 1 - Math.exp((-dt / 0.5) * Math.LN2)
    this.smTX += (rawTX - this.smTX) * tvk
    this.smTY += (rawTY - this.smTY) * tvk
    const tl2 = Math.hypot(this.smTX, this.smTY)
    let travelDirX = tl2 > 0.05 ? this.smTX / tl2 : 0
    let travelDirY = tl2 > 0.05 ? this.smTY / tl2 : 0
    // corner steering: a travel direction pointing INTO the surface fights
    // the hard projection (corner jiggle → yeet). Deflect it along the
    // tangent — the body rounds the apex on the shell arc instead.
    {
      const into = travelDirX * surfNX + travelDirY * surfNY
      if (into < -0.2 && sd < this.maxReach * 0.6) {
        travelDirX -= surfNX * into
        travelDirY -= surfNY * into
        const tn = Math.hypot(travelDirX, travelDirY) || 1
        travelDirX /= tn
        travelDirY /= tn
      }
    }
    this.dbgMoving = moving
    this.dbgGoalDist = goalDist
    this.dbgTravel = [travelDirX, travelDirY]
    if (this.state === 'pursue' && goalDist < this.pursueBestDist - 0.02) {
      this.pursueBestDist = goalDist
      this.pursueBestAt = this.time
    }

    /* state transitions (min durations + hysteresis) */
    const inState = this.time - this.stateSince
    if (this.state !== 'jump') {
      const goalIsNew = Math.hypot(ix - this.failedGoalX, iy - this.failedGoalY) > 0.15
      // creep: resting near the cursor, occasionally take one small,
      // deliberate step closer — circling in (user 2026-07-21)
      const creep = this.state === 'rest' && this.pointerActive && goalDist > 0.15 && goalDist < 0.35 && this.time > this.creepAt && inState > 2
      if (creep) this.creepAt = this.time + 5 + this.rng() * 5
      if (this.sniffing && this.state !== 'sniff') this.setState('sniff')
      else if (this.state === 'rest' && ((goalDist > 0.22 && inState > 1.5 && goalIsNew) || creep)) this.setState('pursue')
      else if (this.state === 'pursue' && goalDist < 0.14 && inState > 1) this.setState('settle')
      else if (this.state === 'pursue' && inState > 1 && this.time - this.pursueBestAt > 2.5) {
        // remember the failed goal — no lurching retry loop (§18 hysteresis)
        this.failedGoalX = ix
        this.failedGoalY = iy
        this.setState('settle')
      }
      else if (this.state === 'settle' && inState > 1) this.setState('rest')
      else if ((this.state === 'settle' || this.state === 'sniff') && goalDist > 0.35 && !this.sniffing) this.setState('pursue')
      else if (this.state === 'sniff' && !this.sniffing && inState > 1) this.setState('pursue')
      if (JUMP_ENABLED && this.state === 'pursue' && this.route && this.routeIdx < this.route.points.length) {
        const wp = this.route.points[this.routeIdx]
        if (this.surfaceDist(wp.x, wp.y) > this.maxReach * 0.6) {
          let land: Vec2 | null = null
          for (let k = this.routeIdx; k < this.route.points.length; k++) {
            const c = this.route.points[k]
            if (this.surfaceDist(c.x, c.y) <= this.maxReach * 0.45) {
              land = c
              break
            }
          }
          if (!land) {
            const g = this.route.points[this.route.points.length - 1]
            land = this.projectToSurface(g.x, g.y, this.maxReach * 0.3)
          }
          const gap = Math.hypot(land.x - p.posX[0], land.y - p.posY[0])
          // a jump that doesn't close distance to the goal is never taken
          const progressJump = Math.hypot(land.x - ix, land.y - iy) < Math.hypot(p.posX[0] - ix, p.posY[0] - iy) - 0.05
          const landSane = progressJump && land.x > 0.02 && land.x < this.viewportAspect - 0.02 && land.y > 0.02 && land.y < 0.98
          let arcClear = true
          if (this.obstacles.length) {
            const upx0 = -(land.y - p.posY[0])
            const upy0 = land.x - p.posX[0]
            const ul0 = Math.hypot(upx0, upy0) || 1
            for (const t of [0.2, 0.35, 0.5, 0.65, 0.8]) {
              const arcH = Math.sin(t * Math.PI) * 0.12 * gap
              const ax = p.posX[0] + (land.x - p.posX[0]) * t + (upx0 / ul0) * arcH
              const ay = p.posY[0] + (land.y - p.posY[0]) * t + (upy0 / ul0) * arcH
              if (sdObstacles(ax, ay, this.obstacles, this.obstacleRounding) < p.radius[0] * 0.8) {
                arcClear = false
                break
              }
            }
          }
          const cooled = this.time - this.lastJumpEnd > 3
          const notReturn = Math.hypot(land.x - this.lastJumpFromX, land.y - this.lastJumpFromY) > 0.25
          if (cooled && notReturn && arcClear && landSane && goalDist > 0.2 && gap > this.maxReach * 1.1 && gap < 0.4) {
            this.jumpSX = p.posX[0]
            this.jumpSY = p.posY[0]
            this.jumpEX = land.x
            this.jumpEY = land.y
            this.jumpDur = Math.max(0.35, gap / 0.5)
            this.jumpT = 0
            for (const pl of this.plants) pl.active = false
            for (const sw of this.swings) sw.active = false
            this.setState('jump')
          }
        }
      }
    }
    const S = this.state

    /* role angles reorganize around the surface */
    const downAngle = Math.atan2(-surfNY, -surfNX)
    const upAngle = Math.atan2(surfNY, surfNX)
    const WALKER_SPREAD = [-0.9, 0, 0.9]
    const UPPER_SPREAD = [-0.6, 0, 0.6]
    const yearnEarly = this.pointerActive && (pointerDirX !== 0 || pointerDirY !== 0)
    const pointerAngle = Math.atan2(pointerDirY, pointerDirX)
    for (let a = 0; a < p.appendageCount; a++) {
      const d = this.drivers[a]
      const seekerWant = yearnEarly ? pointerAngle + UPPER_SPREAD[(a - LEGS) % 3] * 0.55 : upAngle + UPPER_SPREAD[(a - LEGS) % 3]
      const want = inRange ? (a < LEGS ? downAngle + WALKER_SPREAD[a % 3] : seekerWant) : d.restAngle
      let delta = want - d.restAngle
      while (delta > Math.PI) delta -= Math.PI * 2
      while (delta < -Math.PI) delta += Math.PI * 2
      d.restAngle += delta * Math.min(1, dt * 0.8)
    }

    /* ---- core motion ---- */
    if (S === 'jump') {
      this.jumpT += dt / this.jumpDur
      const t01 = Math.min(1, this.jumpT)
      const ease = t01 * t01 * (3 - 2 * t01)
      const upx = -(this.jumpEY - this.jumpSY)
      const upy = this.jumpEX - this.jumpSX
      const ul = Math.hypot(upx, upy) || 1
      const arc = Math.sin(t01 * Math.PI) * 0.12 * Math.hypot(this.jumpEX - this.jumpSX, this.jumpEY - this.jumpSY)
      p.posX[0] = this.jumpSX + (this.jumpEX - this.jumpSX) * ease + (upx / ul) * arc
      p.posY[0] = this.jumpSY + (this.jumpEY - this.jumpSY) * ease + (upy / ul) * arc
      p.prevX[0] = p.posX[0]
      p.prevY[0] = p.posY[0]
      if (t01 >= 1) {
        this.lastJumpEnd = this.time
        this.lastJumpFromX = this.jumpSX
        this.lastJumpFromY = this.jumpSY
        this.setState('pursue')
      }
    } else {
      if (S === 'pursue' && tlen > 0.015) {
        let planted = 0
        let sumX = 0
        let sumY = 0
        for (let a = 0; a < LEGS; a++) {
          const pl = this.plants[a]
          if (!pl.active) continue
          planted++
          sumX += pl.x
          sumY += pl.y
        }
        const maxStep = cfg.behavior.maximumCoreSpeed * this.viewportAspect * dt
        if (planted > 0) {
          // smoothed stance centroid: lifting a foot must never teleport
          // the pull target half a stance-width (the flip-flop source)
          const cX = sumX / planted
          const cY = sumY / planted
          if (!this.stanceInit) {
            this.stanceX = cX
            this.stanceY = cY
            this.stanceInit = true
          }
          const ck = 1 - Math.exp((-dt / 0.7) * Math.LN2)
          this.stanceX += (cX - this.stanceX) * ck
          this.stanceY += (cY - this.stanceY) * ck
          const surge = this.time < this.surgeUntil
          const gain = surge ? 1.35 : 1.2 // overlapping soft pulses = glide-walk
          const pullX = this.stanceX + travelDirX * this.maxReach * 0.5
          const pullY = this.stanceY + travelDirY * this.maxReach * 0.5
          let mx = (pullX - p.posX[0]) * Math.min(1, dt * gain)
          let my = (pullY - p.posY[0]) * Math.min(1, dt * gain)
          const mlen = Math.hypot(mx, my)
          const cap = maxStep * 1.35
          if (mlen > cap) {
            mx = (mx / mlen) * cap
            my = (my / mlen) * cap
          }
          p.posX[0] += mx
          p.posY[0] += my
        } else {
          p.posX[0] += travelDirX * maxStep * 0.35
          p.posY[0] += travelDirY * maxStep * 0.35
        }
      }
      {
        let anyPlant = false
        for (const pl of this.plants) if (pl.active) anyPlant = true
        const speedNorm = Math.min(1, Math.hypot(this.coreVelX, this.coreVelY) / 0.08)
        const dip = 0.02 * Math.exp(-(this.time - this.lastPlantTime) / 0.35)
        const crouch = this.state === 'sniff' ? 0.09 : 0
        const hover = this.maxReach * (0.3 - crouch + Math.sin(this.time * 0.11 * Math.PI * 2 + 0.7) * 0.02 - speedNorm * 0.08 - dip)
        const clampE = anyPlant ? 0.05 : 0.07
        const gainE = anyPlant ? 1.6 : 1.2
        const err = Math.max(-clampE, Math.min(clampE, sd - hover))
        p.posX[0] -= surfNX * err * Math.min(1, dt * gainE)
        p.posY[0] -= surfNY * err * Math.min(1, dt * gainE)
      }
      if (this.obstacles.length) {
        const d0 = sdObstacles(p.posX[0], p.posY[0], this.obstacles, this.obstacleRounding) - p.radius[0]
        if (d0 < 0) {
          obstacleNormal(p.posX[0], p.posY[0], this.obstacles, this.obstacleRounding, this.normal2)
          p.posX[0] -= this.normal2.x * d0
          p.posY[0] -= this.normal2.y * d0
        }
        const comfort = cfg.obstacles.comfortClearance
        const dc = sdObstacles(p.posX[0], p.posY[0], this.obstacles, this.obstacleRounding) - p.radius[0]
        if (dc >= 0 && dc < comfort) {
          obstacleNormal(p.posX[0], p.posY[0], this.obstacles, this.obstacleRounding, this.normal2)
          const push = (1 - dc / comfort) * 0.0015
          p.posX[0] += this.normal2.x * push
          p.posY[0] += this.normal2.y * push
        }
      }
      for (let a = 0; a < LEGS; a++) {
        const pl = this.plants[a]
        if (!pl.active) continue
        const dx = p.posX[0] - pl.x
        const dy = p.posY[0] - pl.y
        const dd = Math.hypot(dx, dy)
        const lim = this.chainLen[a] * 1.25 + p.radius[0]
        if (dd > lim) {
          p.posX[0] = pl.x + (dx / dd) * lim
          p.posY[0] = pl.y + (dy / dd) * lim
        }
      }
    }
    /* §24 hard guarantees for the core */
    {
      const bx0 = -0.2
      const bx1 = this.viewportAspect + 0.2
      const by0 = -1.5
      const by1 = 2.5
      if (p.posX[0] < bx0 || p.posX[0] > bx1 || p.posY[0] < by0 || p.posY[0] > by1) {
        p.posX[0] = Math.min(Math.max(p.posX[0], bx0), bx1)
        p.posY[0] = Math.min(Math.max(p.posY[0], by0), by1)
        p.prevX[0] = p.posX[0]
        p.prevY[0] = p.posY[0]
      }
      const dx = p.posX[0] - p.prevX[0]
      const dy = p.posY[0] - p.prevY[0]
      const dd = Math.hypot(dx, dy)
      // absolute speed limit — the final word on core velocity (§23/§24):
      // ~1.8x nominal walking speed, whatever any subsystem computed
      const speedCap = S === 'jump' ? 0.02 : cfg.behavior.maximumCoreSpeed * this.viewportAspect * dt * 1.8
      if (dd > speedCap) {
        p.posX[0] = p.prevX[0] + (dx / dd) * speedCap
        p.posY[0] = p.prevY[0] + (dy / dd) * speedCap
      }
    }
    this.anchorX = Math.min(Math.max(this.anchorX, 0.14), this.viewportAspect - 0.14)
    this.anchorY = Math.min(Math.max(this.anchorY, 0.14), 0.86)

    /* ---- feet: deterministic targets + swing arcs ---- */
    if (S !== 'jump') {
      // stagnation breaker (T41): traveling but no step for 1.2s = the
      // mid-stride equilibrium — force the most-behind foot to step
      let forceStep = -1
      if (S === 'pursue' && moving && this.time - this.lastReleaseTime > 1.4) {
        let worstDot = Infinity
        for (let a = 0; a < LEGS; a++) {
          const pl = this.plants[a]
          if (!pl.active) continue
          const dot = (pl.x - p.posX[0]) * travelDirX + (pl.y - p.posY[0]) * travelDirY
          if (dot < worstDot) {
            worstDot = dot
            forceStep = a
          }
        }
      }
      for (let a = 0; a < LEGS; a++) {
        const pl = this.plants[a]
        if (!pl.active) continue
        const rootI = p.indexOf(a, 0)
        const stretch = Math.hypot(pl.x - p.posX[rootI], pl.y - p.posY[rootI])
        const bad = !this.bridgeClear(p.posX[rootI], p.posY[rootI], pl.x, pl.y) || stretch > this.chainLen[a] * 1.3
        const behind = (pl.x - p.posX[0]) * travelDirX + (pl.y - p.posY[0]) * travelDirY < -this.chainLen[a] * 0.3
        const gait = S === 'pursue' && (stretch > this.chainLen[a] * 1.06 || behind) && this.time - this.lastReleaseTime > 0.5
        if (bad || gait || a === forceStep) {
          pl.active = false
          this.lastReleaseTime = this.time
          this.dbgReleases++
        }
      }
      if (S === 'settle' && inRange && this.time - this.lastReleaseTime > 0.4) {
        const act: Array<{ a: number; proj: number }> = []
        for (let a = 0; a < LEGS; a++) {
          const pl = this.plants[a]
          if (pl.active) act.push({ a, proj: (pl.x - p.posX[0]) * tangX + (pl.y - p.posY[0]) * tangY })
        }
        if (act.length >= 2 && this.stanceFixes < 3) {
          const spread = Math.max(...act.map((x) => x.proj)) - Math.min(...act.map((x) => x.proj))
          if (spread < this.chainLen[0] * 0.7) {
            this.stanceFixes++
            act.sort((x, y) => Math.abs(x.proj) - Math.abs(y.proj))
            this.plants[act[0].a].active = false
            this.lastReleaseTime = this.time
            this.dbgReleases++
          }
        }
      }
      const SLOT = [-0.55, 0, 0.55]
      for (let a = 0; a < LEGS; a++) {
        const pl = this.plants[a]
        const sw = this.swings[a]
        if (pl.active || sw.active || !inRange) continue
        if (S === 'rest' && inState > 0.3) continue
        const rootI = p.indexOf(a, 0)
        const sgn = moving ? Math.sign(tangX * travelDirX + tangY * travelDirY || 1) : 1
        const lead = moving ? sgn * this.chainLen[a] * [0.55, 0.8, 0.65][a % 3] : 0
        let c = this.projectToSurface(
          p.posX[rootI] + tangX * (SLOT[a % 3] * this.chainLen[a] * 1.15 + lead),
          p.posY[rootI] + tangY * (SLOT[a % 3] * this.chainLen[a] * 1.15 + lead),
          0,
        )
        const tipR = p.radius[p.indexOf(a, p.jointsPerAppendage - 1)]
        this.surfaceNormalInto(c.x, c.y, this.normal2)
        c = { x: c.x + this.normal2.x * tipR * 1.2, y: c.y + this.normal2.y * tipR * 1.2 }
        let ok = Math.hypot(c.x - p.posX[rootI], c.y - p.posY[rootI]) < this.chainLen[a] * 0.95
        if (ok) {
          for (let o = 0; o < LEGS; o++) {
            if (o === a) continue
            // separation vs planted feet AND in-flight swing targets —
            // simultaneous swings raced onto the same landing spot
            if (this.plants[o].active && Math.hypot(this.plants[o].x - c.x, this.plants[o].y - c.y) < this.chainLen[a] * 0.35) ok = false
            if (this.swings[o].active && Math.hypot(this.swings[o].toX - c.x, this.swings[o].toY - c.y) < this.chainLen[a] * 0.35) ok = false
          }
        }
        if (ok) ok = this.bridgeClear(p.posX[rootI], p.posY[rootI], c.x, c.y)
        if (ok) {
          const tipI = p.indexOf(a, p.jointsPerAppendage - 1)
          sw.active = true
          sw.fromX = p.posX[tipI]
          sw.fromY = p.posY[tipI]
          sw.toX = c.x
          sw.toY = c.y
          sw.t = 0
        }
      }
      for (let a = 0; a < LEGS; a++) {
        const sw = this.swings[a]
        if (!sw.active) continue
        sw.t += dt / SWING_TIME
        if (sw.t >= 1) {
          sw.active = false
          this.plants[a].x = sw.toX
          this.plants[a].y = sw.toY
          this.plants[a].active = true
          this.lastPlantTime = this.time
          this.surgeUntil = this.time + 0.45
        }
      }
    }

    /* lurk gestures (§19): in restful states one seeker occasionally
       performs a deep probe — alive, watching, wanting */
    if ((S === 'rest' || S === 'settle' || S === 'sniff') && this.time > this.nextGestureAt) {
      this.gestureLimb = LEGS + Math.floor(this.rng() * (p.appendageCount - LEGS))
      this.gestureUntil = this.time + 1.1 + this.rng() * 0.6
      this.nextGestureAt = this.time + 5 + this.rng() * 6
    }

    /* ---- limbs: pure kinematic IK ---- */
    const calm = S === 'rest' || S === 'settle' || S === 'sniff' ? 0.45 : 1
    // yearn: pointer present but the body holds short — seekers strain
    // toward it (the seething sniff-poke feel, user 2026-07-21)
    const yearn = this.pointerActive && goalDist > 0.12
    const jdx0 = this.jumpEX - this.jumpSX
    const jdy0 = this.jumpEY - this.jumpSY
    const jl0 = Math.hypot(jdx0, jdy0) || 1
    const jumpDirX = jdx0 / jl0
    const jumpDirY = jdy0 / jl0
    for (let a = 0; a < p.appendageCount; a++) {
      const d = this.drivers[a]
      const rootX = p.posX[0] + Math.cos(d.restAngle) * p.radius[0] * 0.7
      const rootY = p.posY[0] + Math.sin(d.restAngle) * p.radius[0] * 0.7
      if (S === 'jump') {
        // spider leap: everything TRAILS the core; in the last quarter the
        // legs swing forward toward the landing zone (legs-first touchdown)
        const t01 = Math.min(1, this.jumpT)
        const landing = a < LEGS && t01 > 0.72
        let tx: number
        let ty: number
        if (landing) {
          const SLOT_L = [-0.55, 0, 0.55]
          const c = this.projectToSurface(this.jumpEX + -jumpDirY * SLOT_L[a % 3] * this.chainLen[a], this.jumpEY + jumpDirX * SLOT_L[a % 3] * this.chainLen[a], 0)
          tx = c.x
          ty = c.y
        } else {
          tx = rootX - jumpDirX * this.chainLen[a] * (0.75 + 0.1 * Math.sin(a * 2.3))
          ty = rootY - jumpDirY * this.chainLen[a] * (0.75 + 0.1 * Math.sin(a * 2.3))
        }
        this.solveLimb(a, rootX, rootY, tx, ty, this.chainLen[a] * 0.12, 0.3)
        continue
      }
      if (a < LEGS) {
        const pl = this.plants[a]
        const sw = this.swings[a]
        let tx: number
        let ty: number
        let bend: number
        if (pl.active) {
          tx = pl.x
          ty = pl.y
          bend = this.chainLen[a] * 0.05 // taut standing leg, slight arc
        } else if (sw.active) {
          const e = sw.t * sw.t * (3 - 2 * sw.t)
          const lift = Math.sin(sw.t * Math.PI) * this.chainLen[a] * 0.35
          tx = sw.fromX + (sw.toX - sw.fromX) * e + surfNX * lift
          ty = sw.fromY + (sw.toY - sw.fromY) * e + surfNY * lift
          bend = this.chainLen[a] * 0.12
        } else {
          tx = rootX + Math.cos(d.restAngle) * this.chainLen[a] * 0.55
          ty = rootY + Math.sin(d.restAngle) * this.chainLen[a] * 0.55
          bend = this.chainLen[a] * 0.06
        }
        this.solveLimb(a, rootX, rootY, tx, ty, bend, sw.active ? 0.35 : 0)
      } else {
        let desX: number
        let desY: number
        if ((this.sniffing || yearn) && this.pointerActive) {
          // investigate from all sides: each seeker aims at its own slowly
          // orbiting point on a ring AROUND the cursor — poking, curving
          // behind it, sniffing it from all sides (user 2026-07-21)
          const near = Math.hypot(this.pointerX - p.posX[0], this.pointerY - p.posY[0]) < 0.45
          if (near) {
            const ang = a * 2.1 + this.time * 0.11 * Math.PI * 2 * (a % 2 === 0 ? 1 : -1)
            const rr = 0.05 + 0.025 * Math.sin(this.time * 0.07 * Math.PI * 2 + a * 1.4)
            desX = this.pointerX + Math.cos(ang) * rr
            desY = this.pointerY + Math.sin(ang) * rr
          } else {
            desX = this.pointerX
            desY = this.pointerY
          }
        } else if (this.pointerActive && (pointerDirX !== 0 || pointerDirY !== 0)) {
          desX = this.slowPX
          desY = this.slowPY
        } else {
          const sweep =
            d.restAngle +
            (Math.sin(this.time * (0.05 + (a - LEGS) * 0.021) * Math.PI * 2 + a * 2.6) * 0.75 +
              Math.sin(this.time * (0.031 + (a - LEGS) * 0.013) * Math.PI * 2 + a * 1.3) * 0.45) *
              calm
          desX = rootX + Math.cos(sweep) * this.chainLen[a]
          desY = rootY + Math.sin(sweep) * this.chainLen[a]
        }
        // extension: breathes while idle; STRAINS with poke pulses when
        // yearning/sniffing — visible wanting, not a passive stretch
        const poke = this.sniffing || yearn ? 0.07 * Math.sin(this.time * 0.55 * Math.PI * 2 + a * 2.1) : 0
        const strain = this.sniffing || yearn ? 0.92 + 0.08 * Math.sin(this.time * 0.045 * Math.PI * 2 + a * 1.3) + poke : 0
        // peaks touch FULL extension (clamped by the solver), then relax —
        // able to fully stretch, never parked there (user 2026-07-21)
        const gesturing = a === this.gestureLimb && this.time < this.gestureUntil
        const ext = this.chainLen[a] * (gesturing ? 0.95 : this.sniffing || yearn ? Math.min(1, strain) : this.pointerActive ? 0.85 + 0.08 * Math.sin(this.time * 0.11 * Math.PI * 2 + a) : 0.72 + 0.2 * Math.sin(this.time * 0.07 * Math.PI * 2 + a * 1.9))
        const ddx = desX - rootX
        const ddy = desY - rootY
        const dl = Math.hypot(ddx, ddy) || 1
        const gx = rootX + (ddx / dl) * Math.min(dl, ext)
        const gy = rootY + (ddy / dl) * Math.min(dl, ext)
        const sk = 1 - Math.exp((-dt / 0.5) * Math.LN2)
        this.seekX[a] += (gx - this.seekX[a]) * sk
        this.seekY[a] += (gy - this.seekY[a]) * sk
        const snakeCalm = this.sniffing || yearn ? 1 : calm
        const extFrac = Math.min(1, ext / this.chainLen[a])
        const tension = Math.max(0.12, 1.15 - extFrac) // taut at full strain
        const snake = Math.sin(this.time * (0.16 + (a - LEGS) * 0.05) * Math.PI * 2 + d.curlPhase) * this.chainLen[a] * 0.1 * snakeCalm * tension
        this.solveLimb(a, rootX, rootY, this.seekX[a], this.seekY[a], snake)
      }
    }

    /* breathing + squash (visual radii only) */
    const breathe = 1 + Math.sin(this.breathePhase) * 0.03 + Math.sin(this.breathePhase2) * 0.025
    p.activation[0] = breathe
    for (let a = 0; a < p.appendageCount; a++) {
      const rootI = p.indexOf(a, 0)
      const tipI = p.indexOf(a, p.jointsPerAppendage - 1)
      const span = Math.hypot(p.posX[tipI] - p.posX[rootI], p.posY[tipI] - p.posY[rootI])
      const ratio = span / (this.chainLen[a] * 0.85)
      const squash = Math.max(-0.45, Math.min(0.45, 1 - ratio))
      const planted = a < LEGS && this.plants[a].active
      for (let j = 0; j < p.jointsPerAppendage; j++) {
        const i = p.indexOf(a, j)
        const t = j / (p.jointsPerAppendage - 1)
        const profile = Math.sin(t * Math.PI)
        const pad = planted && t > 0.55 ? 1 + (t - 0.55) * 0.7 : 1
        p.activation[i] = (1 + Math.sin(this.breathePhase2 + a * 1.3) * 0.04) * (1 + squash * 0.5 * profile) * pad
      }
    }

    /* proximity glow: nearest tip to the pointer, intensity by closeness
       (starts ~0.22 out, saturates at the 0.05 touch radius) */
    {
      let gi = 0
      let gx = this.glowX
      let gy = this.glowY
      if (this.pointerActive) {
        let best = Infinity
        for (let a = 0; a < p.appendageCount; a++) {
          const tipI = p.indexOf(a, p.jointsPerAppendage - 1)
          const dd = Math.hypot(p.posX[tipI] - this.pointerX, p.posY[tipI] - this.pointerY)
          if (dd < best) {
            best = dd
            gx = p.posX[tipI]
            gy = p.posY[tipI]
          }
        }
        const t = Math.max(0, Math.min(1, (0.16 - best) / (0.16 - 0.045)))
        gi = Math.pow(t, 1.6)
      }
      const gk = 1 - Math.exp((-dt / 0.08) * Math.LN2)
      this.glowX += (gx - this.glowX) * gk
      this.glowY += (gy - this.glowY) * gk
      this.glowI += (gi - this.glowI) * gk
    }

    /* core velocity for motion stretch */
    const cvx = (p.posX[0] - p.prevX[0]) / dt
    const cvy = (p.posY[0] - p.prevY[0]) / dt
    this.coreVelX += (cvx - this.coreVelX) * Math.min(1, dt * 3)
    this.coreVelY += (cvy - this.coreVelY) * Math.min(1, dt * 3)
  }

  /** Render upload: sim interpolation + global low-pass softener (limbs are
      kinematic; the low-pass rounds off swing starts and core pulses). */
  writeUniforms(alpha: number, frameDt: number) {
    const p = this.particles
    const tau = this.state === 'rest' || this.state === 'settle' || this.state === 'sniff' ? 0.09 : 0.045
    const k = 1 - Math.exp((-Math.max(frameDt, 1e-3) / tau) * Math.LN2)
    for (let i = 0; i < p.count; i++) {
      const x = p.prevX[i] + (p.posX[i] - p.prevX[i]) * alpha
      const y = p.prevY[i] + (p.posY[i] - p.prevY[i]) * alpha
      p.renderX[i] += (x - p.renderX[i]) * k
      p.renderY[i] += (y - p.renderY[i]) * k
      const renderR = i === 0 ? p.radius[i] * 0.5 : p.radius[i]
      p.uniformData[i].set(p.renderX[i], p.renderY[i], renderR, p.activation[i])
    }
  }
}
