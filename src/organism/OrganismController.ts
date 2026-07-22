// CPU orchestration (SPEC I.organism): owns obstacle collection → mask →
// SDF dirty pipeline, skeleton buffers, torso lobes + creases derivation.
// The renderer consumes what this produces; simulation (M5) will plug in
// between update() steps.

import * as THREE from 'three/webgpu'
import { DomObstacleCollector, type CollectedObstacle } from './obstacle/DomObstacleCollector'
import { ObstacleMask } from './obstacle/ObstacleMask'
import { ObstacleDistanceField } from './obstacle/ObstacleDistanceField'
import { TrailLayer } from './TrailLayer'
import { ParticleBuffer, mulberry32 } from './simulation/ParticleBuffer'
import { OrganismSimulation } from './OrganismSimulation'
import { NavigationField } from './navigation/NavigationField'
import { FixedTimestep } from './simulation/FixedTimestep'
import type { OrganismConfig } from './OrganismParameters'
import { viewportPxToSimulation, type Viewport } from './obstacle/ObstacleCoordinates'

export const LOBE_COUNT = 3
/* creases retired: they severed thin tentacles crossing their channel —
   concavity now comes from limb gaps + webbing (user 2026-07-21).
   Count stays 1 with an off-screen dummy (uniformArray([]) crashes three) */
export const CREASE_COUNT = 1

export class OrganismController {
  readonly particles: ParticleBuffer
  readonly mask: ObstacleMask
  readonly field: ObstacleDistanceField
  readonly trail: TrailLayer
  readonly lobeData: THREE.Vector4[]
  readonly creaseData: THREE.Vector4[]
  private collector: DomObstacleCollector
  private obstacles: CollectedObstacle[] = []
  private lobeSeeds: Array<{ ang: number; dist: number; r: number }>
  readonly simulation: OrganismSimulation
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
    this.trail = new TrailLayer(256)
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

  /** Game mode growth: scales body radii + solver reach; the next dirty
      pass rebuilds nav with the larger clearance (corridors close). */
  setCreatureScale(scale: number) {
    const rel = scale / this.simulation.creatureScale
    if (!(rel > 0) || Math.abs(rel - 1) < 1e-4) return
    const p = this.particles
    for (let i = 0; i < p.count; i++) p.radius[i] *= rel
    this.simulation.applyScale(rel)
    this.collector.invalidate()
  }

  private lastScrollY: number | null = null
  private lastFrameMs: number | null = null

  /** Per-frame: DOM/GPU obstacle work only when dirty; sim at fixed step. */
  beforeFrame(timeMs: number) {
    // page anchoring: scroll shifts the whole sim state so the creature
    // stays glued to the document, then walks back into view on its own
    const sy = window.scrollY
    if (this.lastScrollY === null) {
      // first frame: adopt restored scroll silently — shifting here streaked
      // the creature across the whole screen on load (B16)
      this.lastScrollY = sy
    } else if (sy !== this.lastScrollY) {
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
        pad: paddingSim,
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
    {
      const p = this.particles
      const pts: Array<[number, number, number]> = [[p.renderX[0], p.renderY[0], p.radius[0] * 0.5]]
      for (let a = 0; a < p.appendageCount; a++) {
        const t = p.indexOf(a, p.jointsPerAppendage - 1)
        pts.push([p.renderX[t], p.renderY[t], p.radius[t] * 1.6])
      }
      this.trail.update(frameDt, this.viewport, p.renderX[0], p.renderY[0], pts)
    }
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
    // retired — park the dummy crease far off-screen (see CREASE_COUNT)
    for (let c = 0; c < CREASE_COUNT; c++) this.creaseData[c].set(-5, -5, -5, -5)
    void coreX
    void coreY
  }

  dispose() {
    this.collector.dispose()
    this.mask.dispose()
    this.trail.dispose()
    this.field.dispose()
  }
}
