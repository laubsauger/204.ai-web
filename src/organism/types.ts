// Shared organism types (SPEC C14 / I.organism)

export type OrganismQuality = 'high' | 'balanced' | 'low'

export type OrganismCapabilities = {
  /* 'none' = navigator.gpu absent or adapter/init failed — feature stays off,
     there is deliberately NO WebGL fallback (C14) */
  backend: 'webgpu' | 'none'
  computeSupported: boolean
  quality: OrganismQuality
}

export type OrganismHandle = {
  capabilities: OrganismCapabilities
  dispose: () => void
}
