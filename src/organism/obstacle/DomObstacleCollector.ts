// Collects opt-in DOM obstacles (SPEC I.organism, handoff §6/§8).
// Only elements carrying data-organism-obstacle participate. Layout reads
// happen exclusively when the dirty flag is set — never per render frame
// on a static page (V19).

import { viewportPxToSimulation, type Viewport } from './ObstacleCoordinates'
import type { SimRect } from '../math/sdf'

export type CollectedObstacle = {
  rect: SimRect
  /* extra protected spacing, sim units (from data-organism-padding, CSS px) */
  paddingSim: number
}

export class DomObstacleCollector {
  private dirty = true
  private observers: ResizeObserver
  private mutationObserver: MutationObserver | null = null
  private scrollScheduled = false
  private onInvalidateCallbacks: Array<() => void> = []
  private elements: HTMLElement[] = []

  private periodicId: number

  constructor(private root: Document = document, observeMutations = false) {
    this.observers = new ResizeObserver(() => this.invalidate())
    window.addEventListener('resize', this.invalidate, { passive: true })
    window.addEventListener('scroll', this.onScroll, { passive: true })
    // safety net: transforms/animations move elements without resizing them
    // — a low-frequency revalidation catches drift (a handful of rect reads
    // every few seconds, far from per-frame — V19)
    this.periodicId = window.setInterval(this.invalidate, 2500)
    if (observeMutations) {
      this.mutationObserver = new MutationObserver(() => this.invalidate())
      this.mutationObserver.observe(this.root.body, {
        subtree: true,
        attributes: true,
        attributeFilter: ['data-organism-obstacle', 'data-organism-hidden'],
      })
    }
    this.rescan()
  }

  /** Re-query the document for obstacle elements (route changes etc.). */
  rescan = () => {
    this.observers.disconnect()
    this.elements = Array.from(this.root.querySelectorAll<HTMLElement>('[data-organism-obstacle]'))
    for (const el of this.elements) this.observers.observe(el)
    this.invalidate()
  }

  invalidate = () => {
    this.dirty = true
    for (const cb of this.onInvalidateCallbacks) cb()
  }

  onInvalidate(cb: () => void) {
    this.onInvalidateCallbacks.push(cb)
  }

  private onScroll = () => {
    // throttle to one invalidation per frame (handoff §8)
    if (this.scrollScheduled) return
    this.scrollScheduled = true
    requestAnimationFrame(() => {
      this.scrollScheduled = false
      this.invalidate()
    })
  }

  get isDirty() {
    return this.dirty
  }

  /** Reads layout. Only call when dirty (beforeFrame pattern). */
  collect(viewport: Viewport): CollectedObstacle[] {
    this.dirty = false
    const out: CollectedObstacle[] = []
    const h = Math.max(viewport.height, 1)
    for (const el of this.elements) {
      if (el.dataset.organismHidden === 'true') continue
      const r = el.getBoundingClientRect()
      if (r.width <= 0 || r.height <= 0) continue
      if (r.bottom < 0 || r.top > viewport.height || r.right < 0 || r.left > viewport.width) continue
      const paddingPx = Number(el.dataset.organismPadding ?? '16')
      const weight = Number(el.dataset.organismWeight ?? '1')
      const allowTendrils = el.dataset.organismAllowTendrils === 'true'
      const circle = el.dataset.organismShape === 'circle'
      // convert DOM rect (top-left) to sim-space center + half extents
      const a = viewportPxToSimulation(r.left, r.top, viewport)
      const b = viewportPxToSimulation(r.right, r.bottom, viewport)
      out.push({
        rect: {
          cx: (a.x + b.x) / 2,
          cy: (a.y + b.y) / 2,
          hw: Math.abs(b.x - a.x) / 2,
          hh: Math.abs(a.y - b.y) / 2,
          weight: Number.isFinite(weight) ? weight : 1,
          allowTendrils,
          circle,
        },
        paddingSim: (Number.isFinite(paddingPx) ? paddingPx : 16) / h,
      })
    }
    return out
  }

  dispose() {
    window.clearInterval(this.periodicId)
    this.observers.disconnect()
    this.mutationObserver?.disconnect()
    window.removeEventListener('resize', this.invalidate)
    window.removeEventListener('scroll', this.onScroll)
    this.onInvalidateCallbacks.length = 0
  }
}
