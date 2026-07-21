/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — three@0.185.1 TSL .d.ts is missing several node ops that
// exist at runtime (bool.notEqual, ivec2 arithmetic/clamp cross-typing,
// textureLoad on canvas textures). This file is a self-contained GPU graph;
// its behavior is verified through the mask/sdf debug views + alignment
// check rather than the incomplete published types. Remove when three's
// TSL typings catch up.
//
// GPU obstacle SDF via jump flooding (handoff §10, SPEC C14).
// seed → log2(maxDim) ping-pong passes → resolve. Runs ONLY when the mask
// is dirty — never per frame. Output texture (rgba16f):
//   R: signed distance to hard boundary, simulation units (+outside/−inside)
//   G,B: outward boundary normal
//   A: hard occupancy
// Comfort distance derives analytically as R − comfortClearance (C14).
//
// Seeds are stored as texel coords (exact in half float up to 2048);
// sentinel = -1. The pipeline mirrors three's webgpu compute-texture
// ping-pong example patterns.

import * as THREE from 'three/webgpu'
import { Fn, If, float, instanceIndex, ivec2, texture, textureLoad, textureStore, uniform, uvec2, vec2, vec4 } from 'three/tsl'

export class ObstacleDistanceField {
  readonly texture: THREE.StorageTexture
  private ping: THREE.StorageTexture
  private pong: THREE.StorageTexture
  private seedPass: { compute: unknown }
  private jfaPingToPong: { compute: unknown }
  private jfaPongToPing: { compute: unknown }
  private resolveFromPing: { compute: unknown }
  private step = uniform(1)
  /* viewport aspect — feeds the anisotropic texel→sim distance metric */
  readonly aspect = uniform(1)
  readonly width: number
  readonly height: number

  constructor(
    private renderer: THREE.WebGPURenderer,
    maskTexture: THREE.Texture,
    width: number,
    height: number,
  ) {
    this.width = width
    this.height = height

    const makeTex = () => {
      const t = new THREE.StorageTexture(width, height)
      t.type = THREE.HalfFloatType
      t.magFilter = THREE.LinearFilter
      t.minFilter = THREE.LinearFilter
      t.generateMipmaps = false
      return t
    }
    this.ping = makeTex()
    this.pong = makeTex()
    this.texture = makeTex()

    const W = width
    const H = height
    const count = W * H

    const texelCoord = () => uvec2(instanceIndex.mod(W), instanceIndex.div(W))

    const clampTexel = (c) => c.clamp(ivec2(0, 0), ivec2(W - 1, H - 1))

    const hardAt = (coord) => textureLoad(maskTexture, coord, 0).r

    /* seed: boundary texels (hard value differs from any 4-neighbor) seed
       themselves; everything else gets the sentinel */
    this.seedPass = Fn(() => {
      const c = texelCoord()
      const here = hardAt(c).greaterThan(0.5)
      const ci = ivec2(c)
      const nb = (ox, oy) => hardAt(uvec2(clampTexel(ci.add(ivec2(ox, oy))))).greaterThan(0.5)
      const isBoundary = here.notEqual(nb(-1, 0)).or(here.notEqual(nb(1, 0))).or(here.notEqual(nb(0, -1))).or(here.notEqual(nb(0, 1)))
      const seed = vec4(-1, -1, 0, 0).toVar()
      If(isBoundary, () => {
        seed.assign(vec4(vec2(c).add(0.5), 1, 0))
      })
      textureStore(this.ping, c, seed).toWriteOnly()
    })().compute(count)

    /* texel → sim-unit scale: the mask is a fixed square, so texels are
       anisotropic in sim space. Distances are always measured through this
       scale (x stretched by aspect), keeping the JFA metric correct. */
    const texelScale = () => vec2(this.aspect.div(W), float(1).div(H))

    /* one JFA step: examine 9 candidates at ±step, keep nearest valid seed */
    const jfa = (src: THREE.StorageTexture, dst: THREE.StorageTexture) =>
      Fn(() => {
        const c = texelCoord()
        const here = vec2(c).add(0.5)
        const scale = texelScale()
        const best = vec4(-1, -1, 0, 0).toVar()
        const bestDist = float(1e20).toVar()
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const sample = ivec2(c)
              .add(ivec2(ox, oy).mul(this.step))
              .clamp(ivec2(0, 0), ivec2(W - 1, H - 1))
            const cand = textureLoad(src, uvec2(sample), 0)
            const valid = cand.z.greaterThan(0.5)
            const dd = cand.xy.sub(here).mul(scale).length()
            If(valid.and(dd.lessThan(bestDist)), () => {
              bestDist.assign(dd)
              best.assign(cand)
            })
          }
        }
        textureStore(dst, c, best).toWriteOnly()
      })().compute(count)

    this.jfaPingToPong = jfa(this.ping, this.pong)
    this.jfaPongToPing = jfa(this.pong, this.ping)

    /* resolve: texel distance → sim units (sim y span 1 ↔ H texels), sign
       from occupancy, outward normal from seed direction */
    this.resolveFromPing = Fn(() => {
      const c = texelCoord()
      const here = vec2(c).add(0.5)
      const seed = textureLoad(this.ping, c, 0)
      const occupied = hardAt(c).greaterThan(0.5)
      const valid = seed.z.greaterThan(0.5)
      const delta = seed.xy.sub(here).mul(texelScale())
      const distSim = delta.length()
      const sign = occupied.select(float(-1), float(1))
      // outward normal: away from boundary outside, toward it inside
      const dir = delta.normalize().mul(sign.negate())
      const far = float(10)
      const out = vec4(
        valid.select(distSim.mul(sign), far),
        valid.select(dir.x, 0),
        valid.select(dir.y, 0),
        occupied.select(float(1), float(0)),
      )
      textureStore(this.texture, c, out).toWriteOnly()
    })().compute(count)
  }

  /** Recompute the field. Call only when the mask changed (dirty flag). */
  update() {
    this.renderer.compute(this.seedPass as never)
    let step = 1
    while (step * 2 < Math.max(this.width, this.height)) step *= 2
    let fromPing = true
    while (step >= 1) {
      this.step.value = step
      this.renderer.compute((fromPing ? this.jfaPingToPong : this.jfaPongToPing) as never)
      fromPing = !fromPing
      step = step >> 1
    }
    // ensure final result sits in ping for the resolve pass
    if (!fromPing) {
      this.step.value = 1
      this.renderer.compute(this.jfaPongToPing as never)
    }
    this.renderer.compute(this.resolveFromPing as never)
  }

  /** TSL node sampling the resolved field at an obstacle-uv position. */
  sampleNode(uvNode: ReturnType<typeof vec2>) {
    return texture(this.texture, uvNode)
  }

  dispose() {
    this.ping.dispose()
    this.pong.dispose()
    this.texture.dispose()
  }
}
