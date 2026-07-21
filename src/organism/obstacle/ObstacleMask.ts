// Rasterizes collected obstacles into a low-res RGBA mask (handoff §9).
// Channels: R hard occupancy, G comfort occupancy, B weight (0..1 = w/4)
// + tendril-permission high bit. Canvas draws top-left; CanvasTexture
// uploads with flipY so GPU sampling lives in bottom-left obstacle-uv
// space. The mask stays a FIXED square (fieldWidth²) across resizes —
// texel anisotropy is compensated in the SDF's distance metric, which
// keeps GPU texture allocations and shader node references stable.

import * as THREE from 'three/webgpu'
import type { CollectedObstacle } from './DomObstacleCollector'
import type { Viewport } from './ObstacleCoordinates'

export class ObstacleMask {
  readonly texture: THREE.CanvasTexture
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  width: number
  height: number

  constructor(fieldWidth: number) {
    this.canvas = document.createElement('canvas')
    this.width = fieldWidth
    this.height = fieldWidth
    this.canvas.width = this.width
    this.canvas.height = this.height
    const ctx = this.canvas.getContext('2d', { willReadFrequently: false })
    if (!ctx) throw new Error('organism: 2d context unavailable for obstacle mask')
    this.ctx = ctx
    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.flipY = true
    this.texture.magFilter = THREE.LinearFilter
    this.texture.minFilter = THREE.LinearFilter
    this.texture.generateMipmaps = false
  }

  /**
   * Draw obstacles. comfortClearanceSim widens the comfort band around each
   * hard region (uniform → the SDF derives comfort as hard − clearance, C14).
   */
  rasterize(obstacles: CollectedObstacle[], viewport: Viewport, comfortClearanceSim: number) {
    const { ctx, width, height } = this
    ctx.clearRect(0, 0, width, height)
    // sim units → mask px: sim y span 1 ↔ height px
    const s = height
    const aspect = viewport.width / Math.max(viewport.height, 1)
    const toMask = (sx: number, sy: number) => [(sx / aspect) * width, (1 - sy) * height] as const

    // comfort (G) first, hard (R) over it; weight → B, tendril → A.
    // Painter order with 'lighter' keeps channels independent.
    ctx.globalCompositeOperation = 'lighter'
    const fillShape = (rect: CollectedObstacle['rect'], pad: number, style: string) => {
      ctx.fillStyle = style
      if (rect.circle) {
        const [ccx, ccy] = toMask(rect.cx, rect.cy)
        const [ex] = toMask(rect.cx + rect.hw + pad, rect.cy)
        const [, ey] = toMask(rect.cx, rect.cy - rect.hh - pad)
        ctx.beginPath()
        ctx.ellipse(ccx, ccy, Math.abs(ex - ccx), Math.abs(ey - ccy), 0, 0, Math.PI * 2)
        ctx.fill()
      } else {
        const [x0, y0] = toMask(rect.cx - rect.hw - pad, rect.cy + rect.hh + pad)
        const [x1, y1] = toMask(rect.cx + rect.hw + pad, rect.cy - rect.hh - pad)
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
      }
    }
    for (const { rect, paddingSim } of obstacles) {
      fillShape(rect, paddingSim + comfortClearanceSim, 'rgb(0, 255, 0)')
      const weight = Math.round(Math.min(rect.weight / 4, 1) * 255)
      fillShape(rect, paddingSim, `rgba(255, 0, ${weight}, 1)`)
      if (rect.allowTendrils) fillShape(rect, paddingSim, 'rgba(0, 0, 128, 1)')
    }
    ctx.globalCompositeOperation = 'source-over'
    void s
    this.texture.needsUpdate = true
  }

  dispose() {
    this.texture.dispose()
  }
}
