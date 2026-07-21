// Skeleton particle storage (handoff §11). CPU-owned typed arrays; render
// uploads happen through a Vector4 uniform array (pos.xy, radius,
// activation). Topology is fixed at construction: core, attention, then
// appendages × joints.

import * as THREE from 'three/webgpu'
import type { OrganismConfig } from '../OrganismParameters'

export enum ParticleRole {
  Core = 0,
  Attention = 1,
  LimbRoot = 2,
  LimbJoint = 3,
  LimbTip = 4,
}

/* deterministic seeded PRNG (mulberry32) — no unseeded randomness (§19/§24) */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class ParticleBuffer {
  readonly count: number
  readonly appendageCount: number
  readonly jointsPerAppendage: number
  /* SoA state */
  readonly posX: Float32Array
  readonly posY: Float32Array
  readonly prevX: Float32Array
  readonly prevY: Float32Array
  readonly radius: Float32Array
  readonly activation: Float32Array
  readonly invMass: Float32Array
  readonly role: Uint8Array
  readonly appendageId: Int8Array
  /* GPU mirror */
  readonly uniformData: THREE.Vector4[]

  constructor(config: OrganismConfig, seed = 204) {
    const { appendageCount, jointsPerAppendage } = config.anatomy
    this.appendageCount = appendageCount
    this.jointsPerAppendage = jointsPerAppendage
    this.count = 2 + appendageCount * jointsPerAppendage

    this.posX = new Float32Array(this.count)
    this.posY = new Float32Array(this.count)
    this.prevX = new Float32Array(this.count)
    this.prevY = new Float32Array(this.count)
    this.radius = new Float32Array(this.count)
    this.activation = new Float32Array(this.count)
    this.invMass = new Float32Array(this.count)
    this.role = new Uint8Array(this.count)
    this.appendageId = new Int8Array(this.count).fill(-1)
    this.uniformData = Array.from({ length: this.count }, () => new THREE.Vector4())

    this.role[0] = ParticleRole.Core
    this.invMass[0] = 0.35
    this.role[1] = ParticleRole.Attention
    this.invMass[1] = 2.0

    for (let a = 0; a < appendageCount; a++) {
      for (let j = 0; j < jointsPerAppendage; j++) {
        const i = this.indexOf(a, j)
        this.appendageId[i] = a
        this.role[i] = j === 0 ? ParticleRole.LimbRoot : j === jointsPerAppendage - 1 ? ParticleRole.LimbTip : ParticleRole.LimbJoint
        this.invMass[i] = j === 0 ? 0.6 : 1 + (j / jointsPerAppendage) * 2.2
      }
    }

    this.installIdlePose(config, seed)
  }

  indexOf(appendage: number, joint: number): number {
    return 2 + appendage * this.jointsPerAppendage + joint
  }

  /**
   * Seeded organic rest pose: limbs leave the torso at uneven angles, curl
   * with per-limb curvature, taper per config. Differentiated thickness +
   * length so no two limbs read identical (§34 failure cases).
   */
  installIdlePose(config: OrganismConfig, seed: number, coreX = 1.02, coreY = 0.42) {
    const rnd = mulberry32(seed)
    const { torsoRadius, minimumTipRadius, maximumTipRadius, jointsPerAppendage, appendageCount } = config.anatomy

    this.posX[0] = coreX
    this.posY[0] = coreY
    this.radius[0] = torsoRadius
    this.activation[0] = 1
    this.posX[1] = coreX + 0.12
    this.posY[1] = coreY + 0.1
    this.radius[1] = 0.02
    this.activation[1] = 1

    // serpentine growth (Blender-technique analog: iterative tangent steps
    // with per-limb seeded curvature). Spawn DIRECTLY in role pose —
    // walkers (a<3) hang down, uppers rise — so no on-screen morph (B15)
    const WALKER_SPREAD = [-0.85, 0, 0.85]
    const UPPER_SPREAD = [-0.55, 0.55]
    const DOWN = -Math.PI / 2
    const UP = Math.PI / 2
    for (let a = 0; a < appendageCount; a++) {
      const angle = (a < 3 ? DOWN + WALKER_SPREAD[a % 3] : UP + UPPER_SPREAD[(a - 3) % 2]) + (rnd() - 0.5) * 0.3
      const lengthScale = 0.8 + rnd() * 0.7 // limbs differ substantially
      const thickness = 0.55 + rnd() * 0.8
      const serpFreq = 1.8 + rnd() * 1.6
      const serpPhase = rnd() * Math.PI * 2
      const serpAmp = 0.35 + rnd() * 0.5
      const rootR = torsoRadius * (0.62 + rnd() * 0.33) * thickness
      const tipR = minimumTipRadius + rnd() * (maximumTipRadius - minimumTipRadius)
      const segLen = torsoRadius * (0.34 + rnd() * 0.18) * lengthScale

      let x = this.posX[0] + Math.cos(angle) * torsoRadius * 0.55
      let y = this.posY[0] + Math.sin(angle) * torsoRadius * 0.55
      for (let j = 0; j < jointsPerAppendage; j++) {
        const i = this.indexOf(a, j)
        const t = j / (jointsPerAppendage - 1)
        this.posX[i] = x
        this.posY[i] = y
        // float-curve taper (§13): strong root, slim mid, pinched tip
        this.radius[i] = rootR * Math.pow(1 - t, 1.35) + tipR * Math.pow(t, 0.6)
        this.activation[i] = 1
        const dir = angle + Math.sin(t * serpFreq * Math.PI + serpPhase) * serpAmp
        x += Math.cos(dir) * segLen * (1 - t * 0.3)
        y += Math.sin(dir) * segLen * (1 - t * 0.3)
      }
    }

    this.prevX.set(this.posX)
    this.prevY.set(this.posY)
    this.syncUniforms()
  }

  syncUniforms() {
    for (let i = 0; i < this.count; i++) {
      this.uniformData[i].set(this.posX[i], this.posY[i], this.radius[i], this.activation[i])
    }
  }
}
