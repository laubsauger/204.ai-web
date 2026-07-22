// Entry point for the organism background layer (SPEC C14 / I.organism).
// Framework-agnostic: mountOrganism(container) gates on WebGPU (adapter
// check — NO WebGL fallback), assembles controller + renderer, wires
// resize, returns a disposable handle. React glue lives in
// components/OrganismLayer.tsx.

import { OrganismRenderer } from './OrganismRenderer'
import { OrganismController } from './OrganismController'
import { defaultOrganismConfig, type OrganismConfig } from './OrganismParameters'
import type { OrganismQuality } from './types'

/** Quality scaling (handoff §25): resolution + solver cost tiers. */
function applyQuality(config: OrganismConfig, q: OrganismQuality): OrganismConfig {
  if (q === 'high') return config
  return {
    ...config,
    quality: q,
    obstacles: { ...config.obstacles, fieldWidth: q === 'balanced' ? 256 : 128 },
    simulation: { ...config.simulation, constraintIterations: q === 'balanced' ? 6 : 4 },
    rendering: { maxPixelRatio: q === 'balanced' ? 1.25 : 1 },
  }
}
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

const LAB_PAGE = typeof location !== 'undefined' && /organism-(lab|game)/.test(location.pathname)

function debugViewFromQuery(): number {
  if (!import.meta.env.DEV && !LAB_PAGE) return 0
  const v = new URLSearchParams(location.search).get('organism')
  return { final: 0, mask: 1, sdf: 2, field: 3, skeleton: 4, outline: 5, limbs: 6 }[v ?? 'final'] ?? 0
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
  const deviceMemory = (navigator as { deviceMemory?: number }).deviceMemory ?? 8
  const quality: OrganismQuality = deviceMemory >= 8 ? 'high' : deviceMemory >= 4 ? 'balanced' : 'low'
  capabilities.quality = quality
  config = applyQuality(config, quality)

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
  controller.prewarm()
  const resizeObserver = new ResizeObserver(applySize)
  resizeObserver.observe(container)

  const onPointerMove = (e: PointerEvent) => controller.setPointer(e.clientX, e.clientY, true)
  const onPointerOut = () => controller.setPointer(0, 0, false)
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  document.documentElement.addEventListener('pointerleave', onPointerOut)

  let cpuAcc = 0
  let cpuN = 0
  let lastReport = 0
  renderer.start((timeMs) => {
    const t0 = performance.now()
    controller.beforeFrame(timeMs)
    renderer.glow.value.set(controller.simulation.glowX, controller.simulation.glowY, 0.06, controller.simulation.glowI)
    if (import.meta.env.DEV) {
      cpuAcc += performance.now() - t0
      cpuN++
      if (timeMs - lastReport > 5000 && cpuN > 0) {
        console.info('organism: avg CPU/frame', (cpuAcc / cpuN).toFixed(2) + 'ms (target <1ms, handoff §25)')
        cpuAcc = 0
        cpuN = 0
        lastReport = timeMs
      }
    }
  })
  if (import.meta.env.DEV || LAB_PAGE) {
    ;(window as unknown as Record<string, unknown>).__organismDebug = { controller }
  }

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
