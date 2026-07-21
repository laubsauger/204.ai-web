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
    constraintIterations: 8,
    damping: 0.985,
  },
  /* scale target (user call 2026-07-21): whole creature ≈ ≤2× the home
     strap type height → torso ~0.07 sim units, limb reach ~0.12-0.2 */
  anatomy: {
    appendageCount: 5,
    jointsPerAppendage: 6,
    torsoRadius: 0.04,
    minimumTipRadius: 0.004,
    maximumTipRadius: 0.014,
  },
  behavior: {
    pointerInterest: 0.8,
    maximumCoreSpeed: 0.055,
    maximumTipSpeed: 0.2,
    gestureIntervalMin: 4,
    gestureIntervalMax: 14,
  },
  obstacles: {
    fieldWidth: 256,
    hardClearance: 0.02,
    /* dense layout — a fat comfort band leaves the creature nowhere to be */
    comfortClearance: 0.015,
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
