// Slime-mold snake game (lab exercise, 2026-07-22). NOT part of the site:
// separate page reusing the organism stack. Steer the creature with the
// cursor, eat pellets to grow — reach/jump range scale with size, and the
// squeeze corridor closes once the body no longer fits (nav clearance
// derives from the scaled core radius).

import '@fontsource/archivo-black'
import '@fontsource/jetbrains-mono/400.css'
import { mountOrganism } from './organism/OrganismBackground'
import type { OrganismController } from './organism/OrganismController'

const MAX_SCALE = 2.4
const GROW_PER_PELLET = 1.13
const EAT_RADIUS_PX = 26

type Pellet = { el: HTMLElement; x: number; y: number }

function wallRects(): DOMRect[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.wall')).map((w) => w.getBoundingClientRect())
}

function spawnPellet(): Pellet {
  const walls = wallRects()
  const m = 50
  let x = 0
  let y = 0
  // ~30% of food spawns in the LEFT room behind the squeeze — a fat slime
  // can't reach it, so growth trades reach for access (user 2026-07-22)
  const leftRoom = Math.random() < 0.3
  const maxX = leftRoom ? window.innerWidth * 0.2 : window.innerWidth - m
  const minX = leftRoom ? m : window.innerWidth * 0.28
  for (let tries = 0; tries < 60; tries++) {
    x = minX + Math.random() * (maxX - minX)
    y = m + Math.random() * (window.innerHeight - m * 2)
    const clear = walls.every((r) => x < r.left - 30 || x > r.right + 30 || y < r.top - 30 || y > r.bottom + 30)
    if (clear) break
  }
  const el = document.createElement('div')
  el.className = 'pellet'
  el.style.left = `${x}px`
  el.style.top = `${y}px`
  document.body.appendChild(el)
  return { el, x, y }
}

function startGame(controller: OrganismController) {
  const scoreEl = document.getElementById('score')!
  const sizeEl = document.getElementById('size')!
  let score = 0
  let scale = 1
  let pellets: Pellet[] = [spawnPellet(), spawnPellet(), spawnPellet()]

  const eat = (pel: Pellet) => {
    pel.el.classList.add('eaten')
    setTimeout(() => pel.el.remove(), 300)
    pellets = pellets.filter((q) => q !== pel)
    score++
    scale = Math.min(MAX_SCALE, scale * GROW_PER_PELLET)
    controller.setCreatureScale(scale)
    scoreEl.textContent = String(score)
    sizeEl.textContent = scale.toFixed(2)
    pellets.push(spawnPellet())
  }

  const p = controller.particles
  const check = () => {
    const vh = Math.max(window.innerHeight, 1)
    // mouth points: core + every limb tip (render-space so it matches eyes)
    const pts: Array<[number, number]> = [[p.renderX[0] * vh, (1 - p.renderY[0]) * vh]]
    for (let a = 0; a < p.appendageCount; a++) {
      const t = p.indexOf(a, p.jointsPerAppendage - 1)
      pts.push([p.renderX[t] * vh, (1 - p.renderY[t]) * vh])
    }
    const coreReach = p.radius[0] * vh + EAT_RADIUS_PX
    for (const pel of [...pellets]) {
      for (const [px, py] of pts) {
        if (Math.hypot(px - pel.x, py - pel.y) < coreReach) {
          eat(pel)
          break
        }
      }
    }
  }
  window.setInterval(check, 120)

  // slow starvation: size decays toward 1 in 2% steps — stay fed to stay
  // big; slimming down re-opens the squeeze
  window.setInterval(() => {
    if (scale > 1.001) {
      scale = Math.max(1, scale * 0.98)
      controller.setCreatureScale(scale)
      sizeEl.textContent = scale.toFixed(2)
    }
  }, 4000)
}

const container = document.getElementById('mount')
if (container) {
  mountOrganism(container).then((handle) => {
    if (!handle) {
      document.getElementById('msg')!.textContent = 'WebGPU unavailable — game disabled (C14)'
      return
    }
    const dbg = (window as unknown as { __organismDebug?: { controller: OrganismController } }).__organismDebug
    if (dbg) startGame(dbg.controller)
  })
}
