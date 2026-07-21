// Implicit creature field (handoff §14) + debug visualizations, all TSL.
// The silhouette is one continuous scalar field: anisotropic multi-lobe
// torso ∪ tapered curved limb chains, minus crease channels near limb
// roots. Primitive boundaries must never read individually (§34).

import * as THREE from 'three/webgpu'
import { float, max, min, smoothstep, texture, time, uniformArray, vec2, vec3 } from 'three/tsl'
import type { ParticleBuffer } from '../simulation/ParticleBuffer'

/* three@0.185.1 TSL .d.ts generics reject valid node graphs (VarNode vs
   Node mismatches, missing UniformArrayElementNode swizzles) — node-graph
   locals are typed loose on purpose; behavior is proven via debug views */
/* eslint-disable @typescript-eslint/no-explicit-any */
type Node = any
type Vec2Node = any

/* polynomial smooth min / subtractive smooth max */
const sminN = (a: Node, b: Node, k: number): Node => {
  const h = max(float(k).sub(a.sub(b).abs()), 0).div(k)
  return min(a, b).sub(h.mul(h).mul(k * 0.25))
}
const smaxN = (a: Node, b: Node, k: number): Node => sminN(a.negate(), b.negate(), k).negate()

const sdCircle = (p: Vec2Node, c: Vec2Node, r: Node): Node => p.sub(c).length().sub(r)

/* tapered capsule between a→b with radii ra→rb */
const sdTaperedSegment = (p: Vec2Node, a: Vec2Node, b: Vec2Node, ra: Node, rb: Node): Node => {
  const pa = p.sub(a)
  const ba = b.sub(a)
  const h = pa.dot(ba).div(ba.dot(ba).max(1e-8)).clamp(0, 1)
  return pa.sub(ba.mul(h)).length().sub(ra.mul(float(1).sub(h)).add(rb.mul(h)))
}

export type CreatureFieldUniforms = {
  particles: Node
  lobes: Node
  creases: Node
}

export function makeCreatureFieldUniforms(buffer: ParticleBuffer, lobeData: THREE.Vector4[], creaseData: THREE.Vector4[]): CreatureFieldUniforms {
  return {
    particles: uniformArray(buffer.uniformData),
    lobes: uniformArray(lobeData),
    creases: uniformArray(creaseData),
  }
}

/**
 * Scalar field of the whole creature at a simulation-space point.
 * Topology (counts) is static per build; positions/radii stream via
 * uniform arrays.
 */
export function creatureDistance(
  simPos: Vec2Node,
  u: CreatureFieldUniforms,
  layout: {
    appendageCount: number
    jointsPerAppendage: number
    lobeCount: number
    creaseCount: number
    /* all union softness scales off this — absolute k values turn a small
       creature into one melted blob */
    torsoRadius: number
    indexOf: (a: number, j: number) => number
  },
): Node {
  const part = (i: number): Node => u.particles.element(i)
  const core = part(0)
  const R = layout.torsoRadius

  // anatomy-aligned domain warp (§15.2): slow boundary undulation in
  // CREATURE space (coords anchored to the core, so the wobble travels
  // with the body) — this is what makes the silhouette read as goo
  const q = simPos.sub(core.xy)
  const ph1 = time.mul(0.11)
  const ph2 = time.mul(0.07).add(2.1)
  const wx = q.y.mul(6.3).add(ph1).sin().add(q.x.mul(9.1).add(ph2).sin().mul(0.6))
  const wy = q.x.mul(5.7).add(ph2).cos().add(q.y.mul(8.3).add(ph1).cos().mul(0.6))
  const p = simPos.add(vec2(wx, wy).mul(R * 0.14))

  // torso: core + lobes, generous smoothness — one mass, irregular contour
  let d = sdCircle(p, core.xy, core.z)
  for (let l = 0; l < layout.lobeCount; l++) {
    const lobe = u.lobes.element(l)
    d = sminN(d, sdCircle(p, lobe.xy, lobe.z.mul(lobe.w)), R * 1.4)
  }

  // limbs: chains of tapered capsules; union softness varies root→tip so
  // joins melt into the torso but tips stay defined (§14.2)
  for (let a = 0; a < layout.appendageCount; a++) {
    for (let j = 0; j < layout.jointsPerAppendage - 1; j++) {
      const p0 = part(layout.indexOf(a, j))
      const p1 = part(layout.indexOf(a, j + 1))
      const t = j / (layout.jointsPerAppendage - 1)
      const k = j === 0 ? R * 0.9 : t < 0.55 ? R * 0.65 : R * 0.45
      const seg = sdTaperedSegment(p, p0.xy, p1.xy, p0.z.mul(p0.w), p1.z.mul(p1.w))
      d = sminN(d, seg, k)
    }
  }

  // webbing (user 2026-07-21): thin membrane spanning adjacent walker legs
  // near the body — scalloped skin between distinct limbs, not extra fat
  const walkers = Math.min(4, layout.appendageCount)
  for (let a = 0; a < walkers - 1; a++) {
    const a1 = part(layout.indexOf(a, 1))
    const b1 = part(layout.indexOf(a + 1, 1))
    const web1 = sdTaperedSegment(p, a1.xy, b1.xy, float(R * 0.07), float(R * 0.07))
    d = sminN(d, web1, R * 0.55)
    const a2 = part(layout.indexOf(a, 2))
    const b2 = part(layout.indexOf(a + 1, 2))
    const web2 = sdTaperedSegment(p, a2.xy, b2.xy, float(R * 0.045), float(R * 0.045))
    d = sminN(d, web2, R * 0.45)
  }

  // creases: narrow subtractive channels between limb roots → concavity,
  // pinched joints (§14.3)
  for (let c = 0; c < layout.creaseCount; c++) {
    const crease = u.creases.element(c)
    const creaseD = sdTaperedSegment(p, crease.xy, crease.zw, float(R * 0.12), float(R * 0.3))
    d = smaxN(d, creaseD.negate(), R * 0.75)
  }

  return d
}

/**
 * Final silhouette + optional debug views (handoff §16/§28).
 * Debug graph is only built when includeDebug (dev builds) — prod carries
 * the silhouette path alone.
 * debugView: 0 final · 1 mask · 2 obstacle sdf · 3 raw field · 4 skeleton
 */
export function buildOutputNodes(opts: {
  distance: Node
  maskTex: THREE.Texture
  sdfTex: THREE.Texture
  uvNode: Vec2Node
  simPos: Vec2Node
  aspect: Node
  torsoRadius: number
  viewportHeightPx: Node
  debugView: Node
  particles: Node
  particleCount: number
  opacity: number
  edgeSoftnessPx: number
  includeDebug: boolean
}) {
  const { distance: rawDistance, uvNode, simPos, viewportHeightPx, debugView } = opts
  const R = opts.torsoRadius

  const sdfS = texture(opts.sdfTex, uvNode)

  /* contact press (§15.3/§20, user 2026-07-21): the creature field is cut
     by the obstacle SDF + viewport edges — anything touching a boundary
     flattens against it (firm planted contact) and can never visually
     enter a protected region */
  const edgeD = min(min(simPos.x, opts.aspect.sub(simPos.x)), min(simPos.y, float(1).sub(simPos.y)))
  const boundaryD = min(sdfS.x, edgeD)
  const distance = smaxN(rawDistance, boundaryD.negate(), R * 0.22)

  /* analytic AA: edge width from derivatives, floored at edgeSoftness px
     converted to sim units (1 sim unit = viewport height in px) (§16) */
  const edgeSim = float(opts.edgeSoftnessPx).div(viewportHeightPx)
  const w = max(distance.fwidth(), edgeSim)
  const coverage = float(1).sub(smoothstep(w.negate(), w, distance))

  if (!opts.includeDebug) {
    return { colorNode: vec3(1, 1, 1), opacityNode: coverage.mul(opts.opacity) }
  }

  const maskS = texture(opts.maskTex, uvNode)

  // 2: signed distance — blue outside bands, red inside, white boundary
  const bands = sdfS.x.mul(40).fract()
  const sdfView = vec3(
    smoothstep(0.02, 0, sdfS.x.abs()),
    bands.mul(0.5).add(sdfS.x.lessThan(0).select(float(0.5), float(0))),
    sdfS.x.greaterThan(0).select(bands, float(0)),
  )

  // 3: raw creature field bands
  const fieldBands = distance.mul(30).fract()
  const fieldView = vec3(fieldBands, distance.lessThan(0).select(float(1), fieldBands.mul(0.4)), fieldBands.mul(0.6))

  // 4: skeleton — disc per particle over a faint silhouette
  let skelD: Node = float(1e5)
  for (let i = 0; i < opts.particleCount; i++) {
    const p = opts.particles.element(i)
    skelD = min(skelD, simPos.sub(p.xy).length().sub(0.006))
  }
  const skelHit = smoothstep(0.004, 0, skelD)
  const skelView = vec3(skelHit).add(vec3(0.22).mul(coverage))

  // 5: outline — stroke along the zero isoline, shape readable over content
  const outlineHit = smoothstep(w.mul(3), float(0), distance.abs())

  const dv = debugView
  const colorNode = dv
    .equal(1)
    .select(
      maskS.xyz,
      dv.equal(2).select(sdfView, dv.equal(3).select(fieldView, dv.equal(4).select(skelView, dv.equal(5).select(vec3(1, 0.35, 0.2), vec3(1, 1, 1))))),
    )
  const opacityNode = dv
    .equal(0)
    .select(coverage.mul(opts.opacity), dv.equal(5).select(outlineHit.add(coverage.mul(0.12)), float(1)))

  return { colorNode, opacityNode }
}
