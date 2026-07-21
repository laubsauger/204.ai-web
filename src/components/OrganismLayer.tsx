// React glue for the organism background (SPEC C14, V17, V18).
// Idle-mounts the lazy organism chunk only when WebGPU exists; StrictMode
// double-invoke and HMR safe: every effect run owns exactly one mount and
// disposes it on cleanup.

import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import type { OrganismHandle } from '../organism/types'

export function OrganismLayer() {
  const containerRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<OrganismHandle | null>(null)
  const { pathname } = useLocation()

  // route change → new DOM → re-query obstacle elements once content mounts.
  // Second pass after the entrance choreography settles: rects read during
  // transform animations are phantom walls (ResizeObserver won't re-fire —
  // transforms don't change layout size)
  useEffect(() => {
    const t1 = window.setTimeout(() => handleRef.current?.rescanObstacles(), 150)
    const t2 = window.setTimeout(() => handleRef.current?.rescanObstacles(), 1500)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [pathname])

  useEffect(() => {
    let cancelled = false
    let handle: OrganismHandle | null = null

    const start = async () => {
      // build kill-switch: VITE_ORGANISM=off ships the site without the
      // feature (and without the chunk ever downloading)
      if (import.meta.env.VITE_ORGANISM === 'off') return
      // pre-gates run BEFORE the dynamic import so excluded devices never
      // download the three chunk (V18): WebGPU, pointer type, screen size.
      // Mobile is out by design (user call 2026-07-21).
      if (!('gpu' in navigator)) return
      if (window.matchMedia('(pointer: coarse)').matches) return
      if (window.matchMedia('(max-width: 900px)').matches) return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        // reduced-motion breathing mode lands in M10
        return
      }
      const mod = await import('../organism/OrganismBackground')
      if (cancelled || !containerRef.current) return
      handle = await mod.mountOrganism(containerRef.current)
      if (cancelled) {
        handle?.dispose()
        return
      }
      handleRef.current = handle
    }

    const hasRic = typeof window.requestIdleCallback === 'function'
    const id = hasRic ? window.requestIdleCallback(() => void start(), { timeout: 4000 }) : window.setTimeout(() => void start(), 2500)

    return () => {
      cancelled = true
      if (hasRic) window.cancelIdleCallback(id)
      else window.clearTimeout(id)
      handle?.dispose()
      handle = null
      handleRef.current = null
    }
  }, [])

  return <div ref={containerRef} className="organism-background" aria-hidden="true" />
}
