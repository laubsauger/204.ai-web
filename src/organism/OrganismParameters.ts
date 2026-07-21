// Central typed configuration — every tunable lives here, never as magic
// numbers inside shaders or controllers (handoff §29, SPEC I.organism).

import type { OrganismQuality } from './types'

export type OrganismConfig = {
  appearance: {
    color: number
    opacity: number
    edgeSoftnessPx: number
  }
  simulation: {
    fixedDelta: number
    maxSubsteps: number
    constraintIterations: number
    damping: number
  }
  anatomy: {
    appendageCount: number
    jointsPerAppendage: number
    torsoRadius: number
    minimumTipRadius: number
    maximumTipRadius: number
  }
  behavior: {
    pointerInterest: number
    maximumCoreSpeed: number // viewport widths / second
    maximumTipSpeed: number
    gestureIntervalMin: number
    gestureIntervalMax: number
  }
  obstacles: {
    fieldWidth: number
    hardClearance: number // simulation units
    comfortClearance: number
  }
  navigation: {
    gridWidth: number
    gridHeight: number
    rerouteThreshold: number
  }
  rendering: {
    maxPixelRatio: number
  }
  quality: OrganismQuality
}

export const defaultOrganismConfig: OrganismConfig = {
  appearance: {
    color: 0xffffff,
    opacity: 0.96,
    edgeSoftnessPx: 1.25,
  },
  simulation: {
    fixedDelta: 1 / 60,
    maxSubsteps: 4,
    constraintIterations: 6,
    damping: 0.985,
  },
  anatomy: {
    appendageCount: 5,
    jointsPerAppendage: 6,
    torsoRadius: 0.11,
    minimumTipRadius: 0.008,
    maximumTipRadius: 0.035,
  },
  behavior: {
    pointerInterest: 0.6,
    maximumCoreSpeed: 0.12,
    maximumTipSpeed: 0.32,
    gestureIntervalMin: 4,
    gestureIntervalMax: 14,
  },
  obstacles: {
    fieldWidth: 256,
    hardClearance: 0.02,
    comfortClearance: 0.09,
  },
  navigation: {
    gridWidth: 64,
    gridHeight: 36,
    rerouteThreshold: 0.08,
  },
  rendering: {
    maxPixelRatio: 1.5,
  },
  quality: 'high',
}
