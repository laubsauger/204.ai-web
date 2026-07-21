// Canonical coordinate conversions (SPEC I.organism, handoff §7).
//
// Spaces:
//   viewport px : CSS pixels, origin TOP-left (DOM convention)
//   simulation  : x ∈ [0, aspect], y ∈ [0, 1], origin BOTTOM-left
//   obstacle uv : [0,1]², origin BOTTOM-left (GL/texture convention;
//                 the mask canvas is drawn top-left and uploaded with
//                 flipY so sampling matches this space)
//
// Every cross-space conversion in the organism goes through these four
// functions — never inline the math elsewhere.

export type Viewport = { width: number; height: number }

export function viewportAspect(v: Viewport): number {
  return v.width / Math.max(v.height, 1)
}

export function viewportPxToSimulation(px: number, py: number, v: Viewport): { x: number; y: number } {
  const h = Math.max(v.height, 1)
  return { x: px / h, y: 1 - py / h }
}

export function simulationToViewportPx(sx: number, sy: number, v: Viewport): { x: number; y: number } {
  const h = Math.max(v.height, 1)
  return { x: sx * h, y: (1 - sy) * h }
}

export function viewportPxToObstacleUv(px: number, py: number, v: Viewport): { x: number; y: number } {
  return { x: px / Math.max(v.width, 1), y: 1 - py / Math.max(v.height, 1) }
}

export function simulationToObstacleUv(sx: number, sy: number, v: Viewport): { x: number; y: number } {
  return { x: sx / viewportAspect(v), y: sy }
}
