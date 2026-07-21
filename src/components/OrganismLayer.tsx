// React glue for the organism background (SPEC C14, V17, V18).
// Idle-mounts the lazy organism chunk only when WebGPU exists; StrictMode
// double-invoke and HMR safe: every effect run owns exactly one mount and
// disposes it on cleanup.

import { useEffect, useRef } from 'react'
import type { OrganismHandle } from '../organism/types'

export function OrganismLayer() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    let handle: OrganismHandle | null = null

    const start = async () => {
      // cheap pre-gate: skip even the dynamic import without WebGPU (V18)
      if (!('gpu' in navigator)) return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        // M1: nothing to show yet — reduced-motion breathing mode lands in M10
        return
      }
      const mod = await import('../organism/OrganismBackground')
      if (cancelled || !containerRef.current) return
      handle = await mod.mountOrganism(containerRef.current)
      if (cancelled) handle?.dispose()
    }

    const hasRic = typeof window.requestIdleCallback === 'function'
    const id = hasRic ? window.requestIdleCallback(() => void start(), { timeout: 4000 }) : window.setTimeout(() => void start(), 2500)

    return () => {
      cancelled = true
      if (hasRic) window.cancelIdleCallback(id)
      else window.clearTimeout(id)
      handle?.dispose()
      handle = null
    }
  }, [])

  return <div ref={containerRef} className="organism-background" aria-hidden="true" />
}
