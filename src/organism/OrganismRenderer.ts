// Renderer layer (SPEC C14): owns the WebGPURenderer, the fullscreen ortho
// quad and the TSL creature-field pass. Debug views (dev only) switch via
// the debugView uniform. No simulation or DOM logic lives here.

import * as THREE from 'three/webgpu'
import { uniform, uv, vec2 } from 'three/tsl'
import type { OrganismConfig } from './OrganismParameters'
import { buildOutputNodes, creatureDistance, makeCreatureFieldUniforms, type CreatureFieldUniforms } from './shaders/creatureField'
import type { ParticleBuffer } from './simulation/ParticleBuffer'
import { LOBE_COUNT, CREASE_COUNT } from './OrganismController'

export class OrganismRenderer {
  private renderer: THREE.WebGPURenderer
  private scene = new THREE.Scene()
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private material: THREE.MeshBasicNodeMaterial
  private geometry = new THREE.PlaneGeometry(2, 2)
  readonly aspect = uniform(1)
  readonly viewportHeightPx = uniform(1000)
  /* 0 final · 1 mask · 2 sdf · 3 field · 4 skeleton (dev only) */
  readonly debugView = uniform(0)
  /* (x, y, radius, intensity) — nearest-tip proximity glow */
  readonly glow = uniform(new THREE.Vector4(0, 0, 0.07, 0))
  readonly fieldUniforms: CreatureFieldUniforms

  constructor(
    renderer: THREE.WebGPURenderer,
    private config: OrganismConfig,
    particles: ParticleBuffer,
    lobeData: THREE.Vector4[],
    creaseData: THREE.Vector4[],
    maskTex: THREE.Texture,
    sdfTex: THREE.Texture,
  ) {
    this.renderer = renderer
    this.fieldUniforms = makeCreatureFieldUniforms(particles, lobeData, creaseData)

    // simulation space: x [0,aspect], y [0,1], bottom-left — uv() is already
    // bottom-left on the fullscreen quad
    const uvNode = uv()
    const simPos = vec2(uvNode.x.mul(this.aspect), uvNode.y)

    const layout = {
      appendageCount: particles.appendageCount,
      jointsPerAppendage: particles.jointsPerAppendage,
      lobeCount: LOBE_COUNT,
      creaseCount: CREASE_COUNT,
      torsoRadius: config.anatomy.torsoRadius,
      indexOf: (a: number, j: number) => particles.indexOf(a, j),
    }
    const distance = creatureDistance(simPos, this.fieldUniforms, layout)

    const { colorNode, opacityNode } = buildOutputNodes({
      distance,
      maskTex,
      sdfTex,
      uvNode,
      simPos,
      aspect: this.aspect,
      torsoRadius: config.anatomy.torsoRadius,
      viewportHeightPx: this.viewportHeightPx,
      debugView: this.debugView,
      particles: this.fieldUniforms.particles,
      particleCount: particles.count,
      appendageCount: particles.appendageCount,
      jointsPerAppendage: particles.jointsPerAppendage,
      indexOf: (a: number, j: number) => particles.indexOf(a, j),
      opacity: config.appearance.opacity,
      edgeSoftnessPx: config.appearance.edgeSoftnessPx,
      internalShadingStrength: config.appearance.internalShadingStrength,
      includeDebug: import.meta.env.DEV,
      glow: this.glow,
    })

    this.material = new THREE.MeshBasicNodeMaterial({ transparent: true, depthTest: false, depthWrite: false })
    this.material.colorNode = colorNode
    this.material.opacityNode = opacityNode

    const quad = new THREE.Mesh(this.geometry, this.material)
    quad.frustumCulled = false
    this.scene.add(quad)
  }

  /** Init the raw GPU renderer first — the controller needs it for compute
      passes before the render graph can be assembled. */
  static async initGpu(canvas: HTMLCanvasElement): Promise<THREE.WebGPURenderer> {
    const gpu = new THREE.WebGPURenderer({ canvas, alpha: true, antialias: false })
    await gpu.init()
    // isWebGPUBackend exists on WebGPUBackend (three@0.185.1 source) —
    // the published .d.ts types `backend` as the base class, hence the cast
    if (!(gpu.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend) {
      gpu.dispose()
      throw new Error('organism: WebGPU backend unavailable (WebGL fallback disabled by design)')
    }
    return gpu
  }

  setSize(width: number, height: number, pixelRatio: number) {
    this.renderer.setPixelRatio(Math.min(pixelRatio, this.config.rendering.maxPixelRatio))
    this.renderer.setSize(width, height, false)
    this.aspect.value = width / Math.max(height, 1)
    this.viewportHeightPx.value = Math.max(height, 1)
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
