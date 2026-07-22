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
  const p = simPos.add(vec2(wx, wy).mul(R * 0.1))

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
      const k = j === 0 ? R * 0.7 : t < 0.55 ? R * 0.45 : R * 0.3
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
    const web1 = sdTaperedSegment(p, a1.xy, b1.xy, float(R * 0.05), float(R * 0.05))
    d = sminN(d, web1, R * 0.4)
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
  appendageCount: number
  jointsPerAppendage: number
  indexOf: (a: number, j: number) => number
  opacity: number
  edgeSoftnessPx: number
  internalShadingStrength: number
  includeDebug: boolean
  glow: Node
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
  // crisp cut (user 2026-07-22): the wide blend read as a smeared half-tone
  // wall at contact — tiny k keeps the clip clean, membrane wraps naturally
  const distance = smaxN(rawDistance, boundaryD.negate(), R * 0.09)

  /* analytic AA: edge width from derivatives, floored at edgeSoftness px
     converted to sim units (1 sim unit = viewport height in px) (§16) */
  const edgeSim = float(opts.edgeSoftnessPx).div(viewportHeightPx)
  const w = max(distance.fwidth(), edgeSim)
  const coverage = float(1).sub(smoothstep(w.negate(), w, distance))

  /* interior anatomy (user 2026-07-21): bright rim shell → markedly
     darker interior, with each limb's CORE reading as a lighter ridge —
     internal structure, not a flat white blotch */
  const rim = float(1).sub(smoothstep(0, R * 0.12, distance.negate())) // tight membrane band
  // per-limb core ridges: light along each limb's centerline
  let limbCore: Node = float(0)
  for (let a = 0; a < opts.appendageCount; a++) {
    let dA: Node = float(1e5)
    for (let j = 0; j < opts.jointsPerAppendage; j++) {
      const pp = opts.particles.element(opts.indexOf(a, j))
      dA = min(dA, simPos.sub(pp.xy).length().sub(pp.z.mul(0.35)))
    }
    limbCore = max(limbCore, float(1).sub(smoothstep(0, R * 0.3, dA)))
  }
  // two mottle octaves: single low-freq product left flat "empty" mid-gray
  // patches (user 2026-07-22) — the second octave fills the gaps
  const m1 = simPos.x.mul(34).add(time.mul(0.05)).sin()
  const m2 = simPos.y.mul(29).sub(time.mul(0.037)).sin()
  const m3 = simPos.x.mul(61).sub(time.mul(0.043)).sin().mul(simPos.y.mul(53).add(time.mul(0.031)).sin())
  const mottle = m1.mul(m2).mul(0.5).add(0.5).mul(0.6).add(m3.mul(0.5).add(0.5).mul(0.4))
  const interiorBase = 1 - opts.internalShadingStrength * 2.0 // deep interior (user: darker still)
  /* contact-pressure highlight retired (user 2026-07-22): the bright smear
     at obstacle contact read as an artifact, not squish */
  const tone = float(interiorBase)
    .add(rim.mul(1 - interiorBase))
    .add(limbCore.mul(0.05))
    .add(mottle.mul(0.06)) // additive: cells stay visible over near-black base
    .clamp(0.02, 1)
  const shaded = vec3(tone)
  /* proximity glow: ONLY the nearest tip heats toward the accent
     (#c9442b) as it nears the cursor's touch radius — localized want */
  const ACCENT: Node = vec3(0.788, 0.267, 0.169)
  // NOTE: smoothstep with reversed edges is undefined in WGSL — invert
  const gd = simPos.sub(opts.glow.xy).length()
  const glowF = float(1).sub(smoothstep(0, opts.glow.z, gd)).mul(opts.glow.w).clamp(0, 0.85)
  // aura: soft accent haze AROUND the tip, outside the silhouette too —
  // an 8px tentacle tip can't carry a glow on its own
  const haze = float(1).sub(smoothstep(0, opts.glow.z.mul(1.6), gd)).mul(opts.glow.w)
  const accentW = glowF.add(haze.mul(float(1).sub(coverage))).clamp(0, 0.9)
  // glow core brightens toward hot orange-white at the very center
  const hot = float(1).sub(smoothstep(0, opts.glow.z.mul(0.35), gd)).mul(opts.glow.w).mul(0.5)
  const glowColor = ACCENT.add(vec3(hot))
  const bodyColor = shaded.mul(float(1).sub(accentW)).add(glowColor.mul(accentW))
  // interior breathes slightly translucent — depth without heaviness
  const insideAlpha = float(1).sub(smoothstep(0, R * 0.5, distance.negate()).mul(0.16))
  const opacityWithHaze = coverage.mul(opts.opacity).mul(insideAlpha).add(haze.mul(haze).mul(0.4)).clamp(0, 1)

  if (!opts.includeDebug) {
    return { colorNode: bodyColor, opacityNode: opacityWithHaze }
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

  // 6: colored skeleton — joint discs tinted per appendage over a faint
  // silhouette (the earlier nearest-limb fill tinted the whole screen)
  const PALETTE = [vec3(1, 0.3, 0.25), vec3(1, 0.75, 0.2), vec3(0.35, 1, 0.4), vec3(0.3, 0.75, 1), vec3(0.7, 0.4, 1), vec3(1, 0.4, 0.85)]
  let limbsView: Node = vec3(0.16).mul(coverage)
  for (let a = 0; a < opts.appendageCount; a++) {
    for (let j = 0; j < opts.jointsPerAppendage; j++) {
      const pp = opts.particles.element(opts.indexOf(a, j))
      const hit = smoothstep(0.004, 0, simPos.sub(pp.xy).length().sub(0.006))
      limbsView = limbsView.add(PALETTE[a % PALETTE.length].mul(hit))
    }
  }

  const dv = debugView
  const colorNode = dv
    .equal(1)
    .select(
      maskS.xyz,
      dv.equal(2).select(sdfView, dv.equal(3).select(fieldView, dv.equal(4).select(skelView, dv.equal(5).select(vec3(1, 0.35, 0.2), dv.equal(6).select(limbsView, bodyColor))))),
    )
  const opacityNode = dv
    .equal(0)
    .select(opacityWithHaze, dv.equal(5).select(outlineHit.add(coverage.mul(0.12)), float(1)))

  return { colorNode, opacityNode }
}
