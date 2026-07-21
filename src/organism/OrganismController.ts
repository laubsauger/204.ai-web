// CPU orchestration (SPEC I.organism): owns obstacle collection → mask →
// SDF dirty pipeline, skeleton buffers, torso lobes + creases derivation.
// The renderer consumes what this produces; simulation (M5) will plug in
// between update() steps.

import * as THREE from 'three/webgpu'
import { DomObstacleCollector, type CollectedObstacle } from './obstacle/DomObstacleCollector'
import { ObstacleMask } from './obstacle/ObstacleMask'
import { ObstacleDistanceField } from './obstacle/ObstacleDistanceField'
import { ParticleBuffer, mulberry32 } from './simulation/ParticleBuffer'
import { OrganismSimulation } from './OrganismSimulation'
import { NavigationField } from './navigation/NavigationField'
import { FixedTimestep } from './simulation/FixedTimestep'
import type { OrganismConfig } from './OrganismParameters'
import { viewportPxToSimulation, type Viewport } from './obstacle/ObstacleCoordinates'

export const LOBE_COUNT = 3
export const CREASE_COUNT = 2

export class OrganismController {
  readonly particles: ParticleBuffer
  readonly mask: ObstacleMask
  readonly field: ObstacleDistanceField
  readonly lobeData: THREE.Vector4[]
  readonly creaseData: THREE.Vector4[]
  private collector: DomObstacleCollector
  private obstacles: CollectedObstacle[] = []
  private lobeSeeds: Array<{ ang: number; dist: number; r: number }>
  private simulation: OrganismSimulation
  private nav: NavigationField
  private timestep: FixedTimestep
  viewport: Viewport = { width: 1, height: 1 }

  constructor(
    renderer: THREE.WebGPURenderer,
    private config: OrganismConfig,
  ) {
    this.particles = new ParticleBuffer(config)
    this.mask = new ObstacleMask(config.obstacles.fieldWidth)
    this.collector = new DomObstacleCollector(document)
    this.lobeData = Array.from({ length: LOBE_COUNT }, () => new THREE.Vector4())
    this.creaseData = Array.from({ length: CREASE_COUNT }, () => new THREE.Vector4())

    const rnd = mulberry32(511)
    this.lobeSeeds = Array.from({ length: LOBE_COUNT }, () => ({
      ang: rnd() * Math.PI * 2,
      dist: 0.25 + rnd() * 0.3,
      r: 0.14 + rnd() * 0.08,
    }))

    this.field = new ObstacleDistanceField(renderer, this.mask.texture, this.mask.width, this.mask.height)
    this.simulation = new OrganismSimulation(this.particles, config)
    this.nav = new NavigationField(config.navigation.gridWidth, config.navigation.gridHeight)
    this.simulation.nav = this.nav
    this.timestep = new FixedTimestep(config.simulation.fixedDelta, 0.1, config.simulation.maxSubsteps)
    this.deriveTorso()
    this.deriveCreases()
  }

  /** Settle the creature invisibly before the first rendered frame — no
      caramel-smear intro (B15). Call after the first resize. */
  prewarm(steps = 150) {
    this.beforeFrame(0)
    for (let i = 0; i < steps; i++) this.simulation.step(this.config.simulation.fixedDelta)
    this.simulation.writeUniforms(1, 1 / 4) /* prewarm: converge low-pass */
    this.deriveTorso()
    this.deriveCreases()
  }

  /** Route change etc. — re-query obstacle elements. */
  rescanObstacles() {
    this.collector.rescan()
  }

  /** Pointer in viewport px (top-left origin) → simulation space. */
  setPointer(px: number, py: number, active: boolean) {
    if (active) {
      const s = viewportPxToSimulation(px, py, this.viewport)
      this.simulation.pointerRawX = s.x
      this.simulation.pointerRawY = s.y
    }
    this.simulation.pointerActive = active
  }

  resize(viewport: Viewport) {
    this.viewport = viewport
    this.field.aspect.value = viewport.width / Math.max(viewport.height, 1)
    this.collector.invalidate()
  }

  private lastScrollY = typeof window !== 'undefined' ? window.scrollY : 0
  private lastFrameMs: number | null = null

  /** Per-frame: DOM/GPU obstacle work only when dirty; sim at fixed step. */
  beforeFrame(timeMs: number) {
    // page anchoring: scroll shifts the whole sim state so the creature
    // stays glued to the document, then walks back into view on its own
    const sy = window.scrollY
    if (sy !== this.lastScrollY) {
      this.simulation.shiftPageY((sy - this.lastScrollY) / Math.max(this.viewport.height, 1))
      this.lastScrollY = sy
    }
    if (this.collector.isDirty) {
      this.obstacles = this.collector.collect(this.viewport)
      this.mask.rasterize(this.obstacles, this.viewport, this.config.obstacles.comfortClearance)
      this.field.update()
      // CPU mirror for the solver: rects expanded by their padding (V19)
      this.simulation.obstacles = this.obstacles.map(({ rect, paddingSim }) => ({
        ...rect,
        hw: rect.hw + paddingSim,
        hh: rect.hh + paddingSim,
      }))
      const aspect = this.viewport.width / Math.max(this.viewport.height, 1)
      this.nav.rebuild(
        this.simulation.obstacles,
        this.simulation.obstacleRounding,
        aspect,
        this.particles.radius[0] * 1.05,
        this.config.obstacles.comfortClearance,
      )
      this.simulation.invalidateRoute()
    }
    this.simulation.viewportAspect = this.viewport.width / Math.max(this.viewport.height, 1)
    const steps = this.timestep.advance(timeMs)
    for (let s = 0; s < steps; s++) this.simulation.step(this.config.simulation.fixedDelta)
    const frameDt = this.lastFrameMs === null ? 1 / 60 : Math.min(0.1, (timeMs - this.lastFrameMs) / 1000)
    this.lastFrameMs = timeMs
    this.simulation.writeUniforms(this.timestep.alpha, frameDt)
    this.deriveTorso()
    this.deriveCreases()
  }

  /** Torso lobes hang off the core with seeded asymmetry (§14.1).
      Reads the INTERPOLATED render state so lobes track breathing. */
  deriveTorso() {
    const u = this.particles.uniformData
    const coreX = u[0].x
    const coreY = u[0].y
    const coreR = u[0].z
    const breathe = u[0].w
    // motion stretch (§15.1): leading lobe pushes forward, trailing lobe
    // becomes a tail — the body reads directional while moving
    const vx = this.simulation.coreVelX
    const vy = this.simulation.coreVelY
    const speed = Math.hypot(vx, vy)
    const sn = Math.min(1, speed / 0.1)
    const dirX = speed > 1e-4 ? vx / speed : 0
    const dirY = speed > 1e-4 ? vy / speed : 0
    const MOTION_BIAS = [0.3, -0.5, 0.1]
    for (let l = 0; l < LOBE_COUNT; l++) {
      const s = this.lobeSeeds[l]
      const bias = MOTION_BIAS[l % MOTION_BIAS.length] * coreR * sn
      this.lobeData[l].set(
        coreX + Math.cos(s.ang) * coreR * s.dist + dirX * bias,
        coreY + Math.sin(s.ang) * coreR * s.dist + dirY * bias,
        coreR * s.r * (1 - sn * 0.12),
        breathe,
      )
    }
  }

  /** Creases sit between adjacent limb roots, cutting inward (§14.3). */
  deriveCreases() {
    const p = this.particles
    const u = p.uniformData
    const coreX = u[0].x
    const coreY = u[0].y
    for (let c = 0; c < CREASE_COUNT; c++) {
      // pick root pairs spread across appendages deterministically
      const a0 = (c * 2) % p.appendageCount
      const a1 = (a0 + 1) % p.appendageCount
      const r0 = p.indexOf(a0, 0)
      const r1 = p.indexOf(a1, 0)
      const mx = (u[r0].x + u[r1].x) / 2
      const my = (u[r0].y + u[r1].y) / 2
      const dx = mx - coreX
      const dy = my - coreY
      const len = Math.hypot(dx, dy) || 1
      // channel from just outside the core toward the midpoint, pointing out
      this.creaseData[c].set(coreX + (dx / len) * u[0].z * 0.55, coreY + (dy / len) * u[0].z * 0.55, mx + (dx / len) * 0.12, my + (dy / len) * 0.12)
    }
  }

  dispose() {
    this.collector.dispose()
    this.mask.dispose()
    this.field.dispose()
  }
}
