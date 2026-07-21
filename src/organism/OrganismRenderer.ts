// Renderer layer (SPEC C14): owns the WebGPURenderer, a fullscreen ortho
// quad and the TSL output pass. M1 scope: blank transparent pass + an
// opt-in test pattern (?organism=test) proving the pipeline end to end.
// Simulation/behavior never live here.

import * as THREE from 'three/webgpu'
import { float, uv, vec3, length, smoothstep, time, uniform } from 'three/tsl'
import type { OrganismConfig } from './OrganismParameters'

export class OrganismRenderer {
  private renderer: THREE.WebGPURenderer
  private scene = new THREE.Scene()
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private material: THREE.MeshBasicNodeMaterial
  private geometry = new THREE.PlaneGeometry(2, 2)
  private config: OrganismConfig
  /* viewport aspect (width / height) — simulation space is x:[0,aspect] y:[0,1] */
  readonly aspect = uniform(1)

  private constructor(renderer: THREE.WebGPURenderer, config: OrganismConfig, testPattern: boolean) {
    this.renderer = renderer
    this.config = config

    this.material = new THREE.MeshBasicNodeMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })
    this.material.colorNode = vec3(1, 1, 1)
    this.material.opacityNode = testPattern ? this.testPatternNode() : float(0)

    const quad = new THREE.Mesh(this.geometry, this.material)
    quad.frustumCulled = false
    this.scene.add(quad)
  }

  /** Throws when WebGPU init fails — caller decides how loud to be. */
  static async create(canvas: HTMLCanvasElement, config: OrganismConfig, testPattern: boolean): Promise<OrganismRenderer> {
    const renderer = new THREE.WebGPURenderer({ canvas, alpha: true, antialias: false })
    await renderer.init()
    // isWebGPUBackend exists on WebGPUBackend (three@0.185.1 source,
    // WebGPUBackend.js:88) — the published .d.ts just types `backend` as the
    // base class, hence the cast
    if (!(renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend) {
      // three silently falls back to WebGL2 — C14 forbids that path
      renderer.dispose()
      throw new Error('organism: WebGPU backend unavailable (WebGL fallback disabled by design)')
    }
    return new OrganismRenderer(renderer, config, testPattern)
  }

  /* breathing disc — only used with ?organism=test to verify the pass */
  private testPatternNode() {
    const centered = uv().sub(0.5).mul(2)
    const r = length(centered)
    const pulse = time.mul(0.8).sin().mul(0.05).add(0.28)
    return smoothstep(pulse, pulse.sub(0.02), r).mul(this.config.appearance.opacity)
  }

  setSize(width: number, height: number, pixelRatio: number) {
    this.renderer.setPixelRatio(Math.min(pixelRatio, this.config.rendering.maxPixelRatio))
    this.renderer.setSize(width, height, false)
    this.aspect.value = width / Math.max(height, 1)
  }

  start(onFrame: (timeMs: number) => void) {
    this.renderer.setAnimationLoop((t) => {
      onFrame(t)
      this.renderer.render(this.scene, this.camera)
    })
  }

  dispose() {
    this.renderer.setAnimationLoop(null)
    this.geometry.dispose()
    this.material.dispose()
    this.renderer.dispose()
  }
}
