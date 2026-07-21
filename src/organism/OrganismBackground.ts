// Entry point for the organism background layer (SPEC C14 / I.organism).
// Framework-agnostic: mountOrganism(container) creates the canvas, gates on
// WebGPU (adapter check — NO WebGL fallback), wires resize, and returns a
// disposable handle. React glue lives in components/OrganismLayer.tsx.

import { OrganismRenderer } from './OrganismRenderer'
import { defaultOrganismConfig, type OrganismConfig } from './OrganismParameters'
import type { OrganismCapabilities, OrganismHandle } from './types'

export async function detectCapabilities(): Promise<OrganismCapabilities> {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
    return { backend: 'none', computeSupported: false, quality: 'low' }
  }
  try {
    const adapter = await navigator.gpu.requestAdapter()
    if (!adapter) return { backend: 'none', computeSupported: false, quality: 'low' }
    return { backend: 'webgpu', computeSupported: true, quality: 'high' }
  } catch {
    return { backend: 'none', computeSupported: false, quality: 'low' }
  }
}

export async function mountOrganism(
  container: HTMLElement,
  config: OrganismConfig = defaultOrganismConfig,
): Promise<OrganismHandle | null> {
  const capabilities = await detectCapabilities()
  if (capabilities.backend !== 'webgpu') {
    if (import.meta.env.DEV) console.info('organism: WebGPU unavailable — feature disabled (C14)')
    return null
  }

  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'
  container.appendChild(canvas)

  let renderer: OrganismRenderer
  try {
    renderer = await OrganismRenderer.create(canvas, config, new URLSearchParams(location.search).get('organism') === 'test')
  } catch (err) {
    // fail loud in dev, clean in prod — never render broken output (C14)
    if (import.meta.env.DEV) console.error(err)
    canvas.remove()
    return null
  }

  const applySize = () => {
    const { width, height } = container.getBoundingClientRect()
    renderer.setSize(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)), window.devicePixelRatio)
  }
  applySize()
  const resizeObserver = new ResizeObserver(applySize)
  resizeObserver.observe(container)

  renderer.start(() => {
    /* M1: no simulation yet — loop kept so later milestones slot in */
  })

  return {
    capabilities,
    dispose() {
      resizeObserver.disconnect()
      renderer.dispose()
      canvas.remove()
    },
  }
}
