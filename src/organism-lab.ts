// Dev-only sandbox entry (organism-lab.html) — controlled environment for
// creature iteration: one obstacle box, no router, no entrance animations.
// Served by `npm run dev` only; production build inputs don't include it.

import { mountOrganism } from './organism/OrganismBackground'

const container = document.getElementById('mount')
if (container) {
  mountOrganism(container).then((handle) => {
    if (!handle) {
      const hud = document.getElementById('hud')
      if (hud) hud.textContent = 'WebGPU unavailable — organism disabled (C14)'
    }
  })
}
