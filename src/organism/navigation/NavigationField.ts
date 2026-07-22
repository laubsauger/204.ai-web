// Coarse navigation grid + A* (handoff §21, SPEC C14). Rebuilt only when
// the obstacle layout changes; A* runs on demand (reroute conditions),
// never per frame. Costs come from the same analytic obstacle field the
// solver uses — grid resolution only affects ROUTING granularity, not
// contact precision.

import { sdObstacles, type SimRect } from '../math/sdf'

export type RouteResult = {
  /* smoothed waypoints, start exclusive */
  points: Array<{ x: number; y: number }>
  /* true when the goal itself is unreachable and the route ends at the
     nearest reachable point instead (→ sniff-tendril behavior) */
  goalUnreachable: boolean
}

export class NavigationField {
  private cols: number
  private rows: number
  private blocked: Uint8Array
  private cost: Float32Array
  private aspect = 1.6

  constructor(cols: number, rows: number) {
    this.cols = cols
    this.rows = rows
    this.blocked = new Uint8Array(cols * rows)
    this.cost = new Float32Array(cols * rows)
  }

  rebuild(obstacles: SimRect[], rounding: number, aspect: number, torsoClearance: number, comfort: number) {
    this.aspect = aspect
    const { cols, rows } = this
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = ((c + 0.5) / cols) * aspect
        const y = (r + 0.5) / rows
        const edge = Math.min(x, aspect - x, y, 1 - y)
        const d = Math.min(edge + torsoClearance /* edges are walkable shells */, obstacles.length ? sdObstacles(x, y, obstacles, rounding) : Infinity)
        const i = r * cols + c
        this.blocked[i] = d < torsoClearance ? 1 : 0
        // discourage the comfort band without forbidding it; prefer cells
        // near surfaces (shell affinity — the creature walks, it doesn't
        // cut across open space it would have to jump)
        const offShell = Math.min(edge, d) > 0.12 ? 6 : 1 // strongly prefer wall paths (climb > jump, user 2026-07-22)
        this.cost[i] = (1 + (d < comfort ? 3 * (1 - Math.max(d, 0) / comfort) : 0)) * offShell
      }
    }
  }

  private cellOf(x: number, y: number): number {
    const c = Math.min(this.cols - 1, Math.max(0, Math.floor((x / this.aspect) * this.cols)))
    const r = Math.min(this.rows - 1, Math.max(0, Math.floor(y * this.rows)))
    return r * this.cols + c
  }

  private center(i: number): { x: number; y: number } {
    const c = i % this.cols
    const r = Math.floor(i / this.cols)
    return { x: ((c + 0.5) / this.cols) * this.aspect, y: (r + 0.5) / this.rows }
  }

  /** Nearest unblocked cell via BFS ring (goal may sit inside an obstacle).
   * `towards` breaks ties toward the seeker's side: a cursor parked mid-
   * obstacle must resolve to a STABLE exit cell, not whichever side the BFS
   * happens to pop first (intent ping-pong paralysis, user 2026-07-22). */
  private nearestOpen(start: number, towards = -1): number {
    if (!this.blocked[start]) return start
    let q = [start]
    const seen = new Set<number>([start])
    const tc = towards >= 0 ? towards % this.cols : 0
    const tr = towards >= 0 ? Math.floor(towards / this.cols) : 0
    while (q.length) {
      // full BFS depth level at a time: collect ALL open cells of this ring,
      // then pick the one nearest `towards`
      const opens: number[] = []
      const next: number[] = []
      for (const i of q) {
        if (!this.blocked[i]) {
          opens.push(i)
          continue
        }
        const c = i % this.cols
        const r = Math.floor(i / this.cols)
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nc = c + dc
          const nr = r + dr
          if (nc < 0 || nc >= this.cols || nr < 0 || nr >= this.rows) continue
          const ni = nr * this.cols + nc
          if (!seen.has(ni)) {
            seen.add(ni)
            next.push(ni)
          }
        }
      }
      if (opens.length) {
        if (towards < 0 || opens.length === 1) return opens[0]
        let best = opens[0]
        let bd = Infinity
        for (const i of opens) {
          const dc = (i % this.cols) - tc
          const dr = Math.floor(i / this.cols) - tr
          const dd = dc * dc + dr * dr
          if (dd < bd) {
            bd = dd
            best = i
          }
        }
        return best
      }
      q = next
    }
    return start
  }

  /** A* with octile heuristic; smoothed by line-of-sight shortcutting. */
  route(
    sx: number,
    sy: number,
    gx: number,
    gy: number,
    hasLineOfSight: (ax: number, ay: number, bx: number, by: number) => boolean,
    prev?: Array<{ x: number; y: number }>,
  ): RouteResult {
    // previous-route preference (§21): cells near the old path cost less —
    // symmetric obstacles no longer flip sides on every recompute
    const prefer = new Uint8Array(this.cols * this.rows)
    if (prev) {
      for (const pt of prev) {
        const ci = this.cellOf(pt.x, pt.y)
        const c0 = ci % this.cols
        const r0 = Math.floor(ci / this.cols)
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const c = c0 + dc
            const r = r0 + dr
            if (c >= 0 && c < this.cols && r >= 0 && r < this.rows) prefer[r * this.cols + c] = 1
          }
        }
      }
    }
    const start = this.nearestOpen(this.cellOf(sx, sy))
    const goalCellRaw = this.cellOf(gx, gy)
    const goal = this.nearestOpen(goalCellRaw, start)
    const goalUnreachable = goal !== goalCellRaw

    const { cols, rows } = this
    const n = cols * rows
    const g = new Float32Array(n).fill(Infinity)
    const from = new Int32Array(n).fill(-1)
    const closed = new Uint8Array(n)
    const inOpen = new Uint8Array(n)
    g[start] = 0
    // tiny binary-heap-free open list is fine at 64×36 — but it MUST be
    // deduplicated: duplicate pushes exploded past the safety cap in large
    // off-shell frontiers and A* aborted mid-search (ceiling-stuck bug)
    const open: number[] = [start]
    inOpen[start] = 1
    const gc = goal % cols
    const gr = Math.floor(goal / cols)
    const h = (i: number) => {
      const dc = Math.abs((i % cols) - gc)
      const dr = Math.abs(Math.floor(i / cols) - gr)
      return Math.max(dc, dr) + 0.41 * Math.min(dc, dr)
    }
    while (open.length) {
      let bi = 0
      let bf = Infinity
      for (let k = 0; k < open.length; k++) {
        const f = g[open[k]] + h(open[k])
        if (f < bf) {
          bf = f
          bi = k
        }
      }
      const cur = open.splice(bi, 1)[0]
      inOpen[cur] = 0
      if (cur === goal) break
      if (closed[cur]) continue
      closed[cur] = 1
      const cc = cur % cols
      const cr = Math.floor(cur / cols)
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dc && !dr) continue
          const nc = cc + dc
          const nr = cr + dr
          if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue
          const ni = nr * cols + nc
          if (this.blocked[ni] || closed[ni]) continue
          const step = (dc && dr ? 1.41 : 1) * this.cost[ni] * (prefer[ni] ? 0.85 : 1)
          if (g[cur] + step < g[ni]) {
            g[ni] = g[cur] + step
            from[ni] = cur
            if (!inOpen[ni]) {
              inOpen[ni] = 1
              open.push(ni)
            }
          }
        }
      }
      if (open.length > n) break // safety (unreachable with dedupe)
    }

    // reconstruct
    const cells: number[] = []
    let cur = goal
    while (cur !== -1 && cur !== start) {
      cells.push(cur)
      cur = from[cur]
    }
    cells.reverse()
    let points = cells.map((i) => this.center(i))

    // line-of-sight smoothing: keep only necessary waypoints. A shortcut
    // must also STAY NEAR THE SHELL — pure geometric LOS collapsed wall
    // detours into "fly straight across open space", which a wall-walker
    // cannot execute (ceiling-shuffle bug, user 2026-07-22)
    const nearShell = (x: number, y: number) => this.cost[this.cellOf(x, y)] < 6
    const shellCut = (ax0: number, ay0: number, bx: number, by: number) => {
      for (const t of [0.25, 0.5, 0.75]) {
        if (!nearShell(ax0 + (bx - ax0) * t, ay0 + (by - ay0) * t)) return false
      }
      return hasLineOfSight(ax0, ay0, bx, by)
    }
    const smoothed: Array<{ x: number; y: number }> = []
    let ax = sx
    let ay = sy
    for (let i = 0; i < points.length; i++) {
      const isLast = i === points.length - 1
      const next = points[i + 1]
      if (!isLast && next && shellCut(ax, ay, next.x, next.y)) continue
      smoothed.push(points[i])
      ax = points[i].x
      ay = points[i].y
    }
    points = smoothed

    return { points, goalUnreachable }
  }
}
