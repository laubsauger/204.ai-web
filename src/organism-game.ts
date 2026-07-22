// Slime-mold evolution game v2 (lab exercise, 2026-07-22). NOT part of the
// site. A 500vh vertical world: hatch as a tiny cell in the nursery, eat to
// evolve through five stages, descend through zones whose geometry gates by
// size (nooks want you small, the rift wants you huge). Camera follows the
// creature — the sim's page anchoring handles the scroll shift natively.

import '@fontsource/archivo-black'
import '@fontsource/jetbrains-mono/400.css'
import { mountOrganism } from './organism/OrganismBackground'
import { defaultOrganismConfig } from './organism/OrganismParameters'
import type { OrganismController } from './organism/OrganismController'

const MIN_SCALE = 0.62 // tiny-scale (<0.6) locomotion needs its own tuning pass — floor here for now
const MAX_SCALE = 2.8

const STAGES: Array<{ at: number; name: string; note: string }> = [
  { at: 0, name: 'hatchling', note: 'small. hungry. find crumbs.' },
  { at: 0.9, name: 'sprout', note: 'limbs firming up.' },
  { at: 1.25, name: 'crawler', note: 'the warrens open.' },
  { at: 1.8, name: 'stalker', note: 'gaps start to look jumpable.' },
  { at: 2.4, name: 'colossus', note: 'the den is yours.' },
]

/* zones: vertical bands (vh) with food size/value tuned to the terrain */
const ZONES = [
  { from: 4, to: 96, count: 4, px: 9, grow: 1.05 },
  { from: 104, to: 196, count: 3, px: 12, grow: 1.07 },
  { from: 204, to: 296, count: 3, px: 15, grow: 1.09 },
  { from: 304, to: 396, count: 3, px: 19, grow: 1.12 },
  { from: 404, to: 492, count: 2, px: 26, grow: 1.16 },
]

type Pellet = { el: HTMLElement; x: number; y: number; zone: number }

function wallRects(): Array<{ l: number; t: number; r: number; b: number }> {
  return Array.from(document.querySelectorAll<HTMLElement>('.wall')).map((w) => ({
    l: w.offsetLeft,
    t: w.offsetTop,
    r: w.offsetLeft + w.offsetWidth,
    b: w.offsetTop + w.offsetHeight,
  }))
}

function spawnPellet(zone: number, walls: ReturnType<typeof wallRects>): Pellet {
  const z = ZONES[zone]
  const vh = window.innerHeight / 100
  const m = 40
  let x = 0
  let y = 0
  for (let tries = 0; tries < 120; tries++) {
    x = m + Math.random() * (window.innerWidth - m * 2)
    y = (z.from + Math.random() * (z.to - z.from)) * vh
    const clear = walls.every((r) => x < r.l - 26 || x > r.r + 26 || y < r.t - 26 || y > r.b + 26)
    if (!clear) continue
    // must be NEAR a surface (wall or side edge) — mid-air floaters are
    // unreachable for a wall-walker
    const nearWall = walls.some((r) => x > r.l - 130 && x < r.r + 130 && y > r.t - 130 && y < r.b + 130)
    const nearEdge = x < 150 || x > window.innerWidth - 150
    if (nearWall || nearEdge) break
  }
  const el = document.createElement('div')
  el.className = 'pellet'
  el.style.left = `${x}px`
  el.style.top = `${y}px`
  el.style.width = `${z.px}px`
  el.style.height = `${z.px}px`
  document.body.appendChild(el)
  return { el, x, y, zone }
}

function stageFor(scale: number) {
  let s = STAGES[0]
  for (const st of STAGES) if (scale >= st.at) s = st
  return s
}

function startGame(controller: OrganismController) {
  const scoreEl = document.getElementById('score')!
  const sizeEl = document.getElementById('size')!
  const stageEl = document.getElementById('stage')!
  const flashEl = document.getElementById('stage-flash')!
  const p = controller.particles
  const sim = controller.simulation

  let score = 0
  let scale = 0.7
  let stage = stageFor(scale)
  controller.setCreatureScale(scale)

  // hatch ON the first shelf (real geometry — the viewport top/bottom
  // edges are phantom surfaces that move with the camera)
  window.scrollTo(0, 0)
  const vh = Math.max(window.innerHeight, 1)
  const hx = (window.innerWidth * 0.12) / vh
  const hy = 1 - (window.innerHeight * 0.19) / vh
  for (let i = 0; i < p.count; i++) {
    p.posX[i] = hx
    p.posY[i] = hy
    p.prevX[i] = hx
    p.prevY[i] = hy
  }
  for (const pl of sim.plants) pl.active = false

  const walls = wallRects()
  let pellets: Pellet[] = []
  ZONES.forEach((z, i) => {
    for (let k = 0; k < z.count; k++) pellets.push(spawnPellet(i, walls))
  })

  const setStage = (next: (typeof STAGES)[number]) => {
    stage = next
    stageEl.textContent = next.name
    flashEl.innerHTML = `${next.name}<small>${next.note}</small>`
    flashEl.classList.add('show')
    setTimeout(() => flashEl.classList.remove('show'), 2200)
  }

  const eat = (pel: Pellet) => {
    pel.el.classList.add('eaten')
    setTimeout(() => pel.el.remove(), 300)
    pellets = pellets.filter((q) => q !== pel)
    score++
    scale = Math.min(MAX_SCALE, scale * ZONES[pel.zone].grow)
    controller.setCreatureScale(scale)
    scoreEl.textContent = String(score)
    sizeEl.textContent = scale.toFixed(2)
    const next = stageFor(scale)
    if (next !== stage) setStage(next)
    // respawn in the same zone after a beat
    window.setTimeout(() => pellets.push(spawnPellet(pel.zone, walls)), 1500)
  }

  /* eat check — mouth points are core + limb tips, in PAGE px */
  window.setInterval(() => {
    const vh2 = Math.max(window.innerHeight, 1)
    const sy = window.scrollY
    const pts: Array<[number, number]> = [[p.renderX[0] * vh2, (1 - p.renderY[0]) * vh2 + sy]]
    for (let a = 0; a < p.appendageCount; a++) {
      const t = p.indexOf(a, p.jointsPerAppendage - 1)
      pts.push([p.renderX[t] * vh2, (1 - p.renderY[t]) * vh2 + sy])
    }
    const coreReach = p.radius[0] * vh2 + 22
    for (const pel of [...pellets]) {
      for (const [px, py] of pts) {
        if (Math.hypot(px - pel.x, py - pel.y) < coreReach) {
          eat(pel)
          break
        }
      }
    }
  }, 120)

  /* starvation: drift back toward hatchling size — staying big needs food */
  window.setInterval(() => {
    if (scale > MIN_SCALE + 0.01) {
      scale = Math.max(MIN_SCALE, scale * 0.99)
      controller.setCreatureScale(scale)
      sizeEl.textContent = scale.toFixed(2)
      const next = stageFor(scale)
      if (next !== stage) setStage(next)
    }
  }, 7000)

  /* camera: DISCRETE recenter bursts, not continuous follow — every scroll
     tick invalidates the obstacle set and the creature's route, so a
     per-frame camera makes navigation impossible. Deadband: recenter only
     when the creature leaves the middle band, then glide once and stop. */
  let camAnimating = false
  const followCamera = () => {
    const vh2 = Math.max(window.innerHeight, 1)
    const corePageY = (1 - p.renderY[0]) * vh2 + window.scrollY
    const offset = corePageY - (window.scrollY + vh2 * 0.5)
    if (!camAnimating && Math.abs(offset) > vh2 * 0.27) {
      camAnimating = true
      const from = window.scrollY
      const to = Math.max(0, Math.min(document.body.scrollHeight - vh2, corePageY - vh2 * 0.5))
      const t0 = performance.now()
      const DUR = 700
      const glide = (now: number) => {
        const t = Math.min(1, (now - t0) / DUR)
        const e = t * t * (3 - 2 * t)
        window.scrollTo(0, from + (to - from) * e)
        if (t < 1) requestAnimationFrame(glide)
        else camAnimating = false
      }
      requestAnimationFrame(glide)
    }
    window.setTimeout(() => requestAnimationFrame(followCamera), 250)
  }
  requestAnimationFrame(followCamera)
}

const container = document.getElementById('mount')
if (container) {
  // game-tuned config: a 500vh world at site walk speed is glacial
  const cfg = structuredClone(defaultOrganismConfig)
  cfg.behavior.maximumCoreSpeed = 0.085
  cfg.behavior.maximumTipSpeed = 0.36
  mountOrganism(container, cfg).then((handle) => {
    if (!handle) {
      document.getElementById('msg')!.textContent = 'WebGPU unavailable — game disabled (C14)'
      return
    }
    const dbg = (window as unknown as { __organismDebug?: { controller: OrganismController } }).__organismDebug
    if (dbg) startGame(dbg.controller)
  })
}
