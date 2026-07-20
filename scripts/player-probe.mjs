import puppeteer from 'puppeteer-core'

const b = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
})
const pg = await b.newPage()
await pg.setViewport({ width: 1914, height: 915, deviceScaleFactor: 1 })
await pg.goto('http://localhost:4573/', { waitUntil: 'domcontentloaded' })
await new Promise((r) => setTimeout(r, 2500))

const state = () =>
  pg.evaluate(() => {
    const v = document.querySelector('video')
    const ring = Boolean(document.querySelector('[class*=playRing]'))
    const bar = document.querySelector('[class*=progressFill]')
    const tcRe = new RegExp('\\d\\d:\\d\\d / \\d\\d:\\d\\d')
    const tc = [...document.querySelectorAll('span')].find((s) => tcRe.test(s.textContent || ''))?.textContent
    return {
      src: v ? decodeURIComponent(v.currentSrc).slice(-30) : null,
      playing: Boolean(v && !v.paused),
      t: v ? Number(v.currentTime.toFixed(1)) : null,
      ring,
      barW: bar ? bar.style.width : null,
      tc: tc ?? null,
    }
  })

console.log('initial:', JSON.stringify(await state()))

const still = await pg.$('[class*=_still_]')
await still.click()
await new Promise((r) => setTimeout(r, 500))
console.log('click→pause:', JSON.stringify(await state()))

await still.click()
await new Promise((r) => setTimeout(r, 1000))
console.log('click→resume:', JSON.stringify(await state()))

// switch Synesthesia (video) → Yard Episode (video) directly
const yard = await pg.evaluateHandle(() =>
  [...document.querySelectorAll('button[class*=chapter]')].find((c) => /yard/i.test(c.textContent)),
)
await yard.asElement().click()
await new Promise((r) => setTimeout(r, 3000))
console.log('switch→yard:', JSON.stringify(await state()))

const syn = await pg.evaluateHandle(() =>
  [...document.querySelectorAll('button[class*=chapter]')].find((c) => /synesthesia/i.test(c.textContent)),
)
await syn.asElement().click()
await new Promise((r) => setTimeout(r, 3000))
console.log('switch→back:', JSON.stringify(await state()))

await pg.screenshot({
  path: '/private/tmp/claude-501/-Users-flo-work-code-204-ai-web/03509156-c10e-48fc-8d78-3096631df6f6/scratchpad/shots/player.png',
})
await b.close()
