// Brain overlay (?organism=brain, lab tooling — user 2026-07-23): draws the
// creature's plan and internal state over the page so route decisions,
// stalls and mode flips are visible instead of inferred from wiggles.

import type { OrganismController } from './OrganismController'

export function mountBrainOverlay(controller: OrganismController): () => void {
  const cv = document.createElement('canvas')
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9'
  document.body.appendChild(cv)
  const ctx = cv.getContext('2d')!
  let raf = 0

  const draw = () => {
    const vh = Math.max(window.innerHeight, 1)
    const w = window.innerWidth
    if (cv.width !== w || cv.height !== vh) {
      cv.width = w
      cv.height = vh
    }
    ctx.clearRect(0, 0, w, vh)
    const s = controller.simulation.debugSnapshot()
    const X = (x: number) => x * vh
    const Y = (y: number) => (1 - y) * vh

    // route: cyan; hop legs dashed orange; waypoint squares, current filled
    if (s.route.length) {
      ctx.lineWidth = 1.5
      let px = X(s.core[0])
      let py = Y(s.core[1])
      for (let i = s.routeIdx; i < s.route.length; i++) {
        const q = s.route[i]
        ctx.beginPath()
        ctx.moveTo(px, py)
        ctx.setLineDash(q.jump ? [6, 5] : [])
        ctx.strokeStyle = q.jump ? '#ff8c3b' : '#39c6d6'
        ctx.lineTo(X(q.x), Y(q.y))
        ctx.stroke()
        px = X(q.x)
        py = Y(q.y)
      }
      ctx.setLineDash([])
      for (let i = s.routeIdx; i < s.route.length; i++) {
        const q = s.route[i]
        ctx.fillStyle = q.jump ? '#ff8c3b' : '#39c6d6'
        if (i === s.routeIdx) ctx.fillRect(X(q.x) - 4, Y(q.y) - 4, 8, 8)
        else ctx.strokeRect(X(q.x) - 3, Y(q.y) - 3, 6, 6)
      }
    }

    // shelled goal: pink ring · raw pointer: pink cross
    ctx.strokeStyle = '#ff4fd8'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(X(s.goal[0]), Y(s.goal[1]), 9, 0, Math.PI * 2)
    ctx.stroke()
    if (s.pointer) {
      const cx = X(s.pointer[0])
      const cy = Y(s.pointer[1])
      ctx.beginPath()
      ctx.moveTo(cx - 7, cy - 7)
      ctx.lineTo(cx + 7, cy + 7)
      ctx.moveTo(cx + 7, cy - 7)
      ctx.lineTo(cx - 7, cy + 7)
      ctx.stroke()
    }

    // intent (local destination): yellow dot + leader from core
    ctx.strokeStyle = '#ffd23b'
    ctx.fillStyle = '#ffd23b'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(X(s.core[0]), Y(s.core[1]))
    ctx.lineTo(X(s.intent[0]), Y(s.intent[1]))
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(X(s.intent[0]), Y(s.intent[1]), 4, 0, Math.PI * 2)
    ctx.fill()

    // travel dir arrow (white) + stance centroid (white cross)
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(X(s.core[0]), Y(s.core[1]))
    ctx.lineTo(X(s.core[0]) + s.travel[0] * 34, Y(s.core[1]) - s.travel[1] * 34)
    ctx.stroke()
    const sx = X(s.stance[0])
    const sy = Y(s.stance[1])
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(sx - 5, sy)
    ctx.lineTo(sx + 5, sy)
    ctx.moveTo(sx, sy - 5)
    ctx.lineTo(sx, sy + 5)
    ctx.stroke()

    // feet: planted green, swinging lime→target
    for (let a = 0; a < s.plants.length; a++) {
      const pl = s.plants[a]
      if (pl.active) {
        ctx.fillStyle = '#3bd66a'
        ctx.beginPath()
        ctx.arc(X(pl.x), Y(pl.y), 3.5, 0, Math.PI * 2)
        ctx.fill()
      }
      const sw = s.swings[a]
      if (sw.active) {
        ctx.strokeStyle = '#a4e83b'
        ctx.strokeRect(X(sw.toX) - 3, Y(sw.toY) - 3, 6, 6)
      }
    }

    // status panel
    const lines = [
      `state ${s.state}  (${s.inState.toFixed(1)}s)`,
      `goalDist ${s.goalDist.toFixed(2)}  unreach ${s.goalUnreachable}`,
      `sniffing ${s.sniffing}  starved ${s.starved}  stalled ${s.walkStalled}`,
      `progress ${s.stallAgo.toFixed(1)}s ago  best ${s.hungerBest === Infinity ? '—' : s.hungerBest.toFixed(2)}`,
      `decision ${s.decisionAgo.toFixed(1)}s ago  route ${s.routeIdx}/${s.route.length}${s.route.some((q) => q.jump) ? ' +hop' : ''}`,
      `planted ${s.plants.filter((q) => q.active).length}  scale ${s.scale.toFixed(2)}  reach ${s.maxReach.toFixed(2)}`,
      s.jumpGates ? `jump: ${s.jumpGates}` : '',
    ].filter(Boolean)
    ctx.font = '11px "JetBrains Mono", monospace'
    const pw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 16
    ctx.fillStyle = 'rgba(10,10,10,0.82)'
    ctx.fillRect(w - pw - 10, 34, pw, lines.length * 16 + 12)
    ctx.fillStyle = '#ececec'
    lines.forEach((l, i) => ctx.fillText(l, w - pw - 2, 52 + i * 16))

    raf = requestAnimationFrame(draw)
  }
  raf = requestAnimationFrame(draw)
  return () => {
    cancelAnimationFrame(raf)
    cv.remove()
  }
}
