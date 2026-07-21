// Entry point for the organism background layer (SPEC C14 / I.organism).
// Framework-agnostic: mountOrganism(container) gates on WebGPU (adapter
// check — NO WebGL fallback), assembles controller + renderer, wires
// resize, returns a disposable handle. React glue lives in
// components/OrganismLayer.tsx.

import { OrganismRenderer } from './OrganismRenderer'
import { OrganismController } from './OrganismController'
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

function debugViewFromQuery(): number {
  if (!import.meta.env.DEV) return 0
  const v = new URLSearchParams(location.search).get('organism')
  return { final: 0, mask: 1, sdf: 2, field: 3, skeleton: 4, outline: 5 }[v ?? 'final'] ?? 0
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

  let gpu: Awaited<ReturnType<typeof OrganismRenderer.initGpu>>
  try {
    gpu = await OrganismRenderer.initGpu(canvas)
  } catch (err) {
    // fail loud in dev, clean in prod — never render broken output (C14)
    if (import.meta.env.DEV) console.error(err)
    canvas.remove()
    return null
  }

  const controller = new OrganismController(gpu, config)
  const renderer = new OrganismRenderer(
    gpu,
    config,
    controller.particles,
    controller.lobeData,
    controller.creaseData,
    controller.mask.texture,
    controller.field.texture,
  )
  renderer.debugView.value = debugViewFromQuery()
  controller.deriveTorso()
  controller.deriveCreases()

  const applySize = () => {
    const { width, height } = container.getBoundingClientRect()
    const w = Math.max(1, Math.round(width))
    const h = Math.max(1, Math.round(height))
    renderer.setSize(w, h, window.devicePixelRatio)
    controller.resize({ width: w, height: h })
  }
  applySize()
  const resizeObserver = new ResizeObserver(applySize)
  resizeObserver.observe(container)

  const onPointerMove = (e: PointerEvent) => controller.setPointer(e.clientX, e.clientY, true)
  const onPointerOut = () => controller.setPointer(0, 0, false)
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  document.documentElement.addEventListener('pointerleave', onPointerOut)

  renderer.start((timeMs) => {
    controller.beforeFrame(timeMs)
  })

  return {
    capabilities,
    rescanObstacles: () => controller.rescanObstacles(),
    dispose() {
      window.removeEventListener('pointermove', onPointerMove)
      document.documentElement.removeEventListener('pointerleave', onPointerOut)
      resizeObserver.disconnect()
      controller.dispose()
      renderer.dispose()
      canvas.remove()
    },
  }
}
