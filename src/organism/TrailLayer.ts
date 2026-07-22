// Slime residue trail (user 2026-07-22: "slight feedback effect during
// motions"). A fixed-square canvas accumulates soft deposits at the core +
// limb tips, decays over ~1.5s, and the creature shader samples it as a
// faint pale film behind the body. Deposit strength scales with core speed
// — a parked creature leaves nothing.

import * as THREE from 'three/webgpu'
import type { Viewport } from './obstacle/ObstacleCoordinates'

export class TrailLayer {
  readonly texture: THREE.CanvasTexture
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private size: number
  private lastX = -1
  private lastY = -1

  constructor(size: number) {
    this.size = size
    this.canvas = document.createElement('canvas')
    this.canvas.width = size
    this.canvas.height = size
    const ctx = this.canvas.getContext('2d')
    if (!ctx) throw new Error('organism: 2d context unavailable for trail layer')
    this.ctx = ctx
    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.flipY = true
    this.texture.magFilter = THREE.LinearFilter
    this.texture.minFilter = THREE.LinearFilter
    this.texture.generateMipmaps = false
  }

  /** Decay + deposit. Points are sim-space [x, y, radiusSim]. */
  update(dt: number, viewport: Viewport, coreX: number, coreY: number, points: Array<[number, number, number]>) {
    const { ctx, size } = this
    // exponential fade — 'destination-out' subtracts alpha
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = `rgba(0,0,0,${Math.min(1, dt * 1.6)})`
    ctx.fillRect(0, 0, size, size)

    // motion gating: deposits scale with core travel this frame
    const aspect = viewport.width / Math.max(viewport.height, 1)
    if (this.lastX >= 0) {
      const speed = Math.hypot(coreX - this.lastX, coreY - this.lastY) / Math.max(dt, 1e-4)
      const strength = Math.min(1, speed / 0.05)
      if (strength > 0.05) {
        ctx.globalCompositeOperation = 'source-over'
        for (const [x, y, r] of points) {
          const px = (x / aspect) * size
          const py = (1 - y) * size
          const pr = Math.max(1.2, r * size * 1.3)
          const g = ctx.createRadialGradient(px, py, 0, px, py, pr)
          g.addColorStop(0, `rgba(255,255,255,${0.06 * strength})`)
          g.addColorStop(1, 'rgba(255,255,255,0)')
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(px, py, pr, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
    this.lastX = coreX
    this.lastY = coreY
    this.texture.needsUpdate = true
  }

  dispose() {
    this.texture.dispose()
  }
}
