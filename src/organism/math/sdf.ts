// CPU-side signed distance primitives (SPEC C14). The PBD solver samples
// obstacles ANALYTICALLY from collected rects (exact, no GPU readback —
// V19); the GPU jump-flood field mirrors the same convention for rendering
// and debug. Sign convention everywhere: positive outside, zero boundary,
// negative inside.

export type Vec2 = { x: number; y: number }

export type SimRect = {
  /* center + half extents in simulation units */
  cx: number
  cy: number
  hw: number
  hh: number
  weight: number
  allowTendrils: boolean
  /* circle obstacles: radius = hw (data-organism-shape="circle") */
  circle?: boolean
}

/** Signed distance from point to an axis-aligned rounded rect. */
export function sdRoundedRect(px: number, py: number, rect: SimRect, radius: number): number {
  const qx = Math.abs(px - rect.cx) - rect.hw + radius
  const qy = Math.abs(py - rect.cy) - rect.hh + radius
  const ax = Math.max(qx, 0)
  const ay = Math.max(qy, 0)
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - radius
}

/** Signed distance to the union of all obstacles (hard field). */
export function sdObstacles(px: number, py: number, rects: SimRect[], rounding: number): number {
  let d = Infinity
  for (const r of rects) {
    d = Math.min(d, r.circle ? Math.hypot(px - r.cx, py - r.cy) - r.hw : sdRoundedRect(px, py, r, rounding))
  }
  return d
}

/** Outward normal of the obstacle field via central differences. */
export function obstacleNormal(px: number, py: number, rects: SimRect[], rounding: number, out: Vec2): Vec2 {
  const e = 1e-3
  const dx = sdObstacles(px + e, py, rects, rounding) - sdObstacles(px - e, py, rects, rounding)
  const dy = sdObstacles(px, py + e, rects, rounding) - sdObstacles(px, py - e, rects, rounding)
  const len = Math.hypot(dx, dy) || 1
  out.x = dx / len
  out.y = dy / len
  return out
}

export function smin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}
