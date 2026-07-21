import { describe, expect, it } from 'vitest'
import {
  simulationToObstacleUv,
  simulationToViewportPx,
  viewportAspect,
  viewportPxToObstacleUv,
  viewportPxToSimulation,
} from './ObstacleCoordinates'

const vp = { width: 1600, height: 1000 } // aspect 1.6

describe('coordinate conversions (handoff §7)', () => {
  it('maps viewport corners into simulation space', () => {
    // DOM top-left → sim (0, 1): y flips, x scales by height
    expect(viewportPxToSimulation(0, 0, vp)).toEqual({ x: 0, y: 1 })
    // DOM bottom-right → sim (aspect, 0)
    expect(viewportPxToSimulation(1600, 1000, vp)).toEqual({ x: 1.6, y: 0 })
    expect(viewportPxToSimulation(800, 500, vp)).toEqual({ x: 0.8, y: 0.5 })
  })

  it('simulation ↔ viewport round-trips', () => {
    const cases = [
      [0, 0],
      [123, 456],
      [1600, 1000],
      [799.5, 0.25],
    ]
    for (const [x, y] of cases) {
      const s = viewportPxToSimulation(x, y, vp)
      const back = simulationToViewportPx(s.x, s.y, vp)
      expect(back.x).toBeCloseTo(x, 9)
      expect(back.y).toBeCloseTo(y, 9)
    }
  })

  it('maps viewport px to bottom-left obstacle uv', () => {
    expect(viewportPxToObstacleUv(0, 0, vp)).toEqual({ x: 0, y: 1 })
    expect(viewportPxToObstacleUv(1600, 1000, vp)).toEqual({ x: 1, y: 0 })
    expect(viewportPxToObstacleUv(400, 750, vp)).toEqual({ x: 0.25, y: 0.25 })
  })

  it('simulation and obstacle uv agree about the same physical point', () => {
    // pick a DOM point, convert via both routes, uv must match
    const px = 1234
    const py = 321
    const viaUv = viewportPxToObstacleUv(px, py, vp)
    const sim = viewportPxToSimulation(px, py, vp)
    const viaSim = simulationToObstacleUv(sim.x, sim.y, vp)
    expect(viaSim.x).toBeCloseTo(viaUv.x, 9)
    expect(viaSim.y).toBeCloseTo(viaUv.y, 9)
  })

  it('aspect matches x-range of simulation space', () => {
    expect(viewportAspect(vp)).toBeCloseTo(1.6)
    expect(viewportPxToSimulation(vp.width, 0, vp).x).toBeCloseTo(viewportAspect(vp))
  })
})
