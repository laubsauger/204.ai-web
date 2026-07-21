// Post-build: bake per-route <title>/description/OG/Twitter meta into static
// HTML copies (dist/<route>/index.html) so social scrapers — which don't run
// JS — get the right card for every share. Bonus: real files mean GH Pages
// serves deep links with HTTP 200 instead of the 404 fallback.
// Also emits sitemap.xml + a robots.txt Sitemap line when SITE_URL is set.
//
// Reads content/*.json directly (same source the app loads through
// src/data/studio.ts) — content edits automatically flow into the sitemap
// and per-route share meta on the next build.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const content = (f) => JSON.parse(readFileSync(join(root, 'content', f), 'utf8'))

/* derivation mirror of src/data/studio.ts — keep in sync */
const slugify = (t) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const rawWorks = content('works.json')
const WORKS = rawWorks.map((w) => ({ ...w, slug: slugify(w.title) }))
const servicesJson = content('services.json')
const SERVICES_ALL = [...servicesJson.content, ...servicesJson.interactive].map((s) => ({ ...s, slug: slugify(s.label) }))
const PEOPLE = content('people.json').map((p) => ({ ...p, slug: slugify(p.name) }))
const dist = join(root, 'dist')
// e.g. https://laubsauger.github.io/204.ai-web — no trailing slash
const SITE_URL = (process.env.SITE_URL ?? '').replace(/\/$/, '')

/* title rule mirrors src/hooks/useHead.ts — bare page names in, brand out */
const BRAND = '204 · NO-CONTENT'
const HOME_TITLE = `${BRAND} — Creative technology studio`
const t = (page) => (page ? `${page} — ${BRAND}` : HOME_TITLE)

const DEFAULT_IMAGE =
  'https://cdn.prod.website-files.com/64ba5b3b418a540ade9f6e31/65b7a18446d60bb65c1641e7_204white.png'

/** @type {Array<{path: string, title: string, desc: string, image?: string}>} */
const routes = [
  {
    path: '/',
    title: t(''),
    desc: '204 is a creative technology studio at the intersection of AI, motion, identity and live environments. Based at RnA Studio, Lisbon.',
  },
  {
    path: '/work',
    title: t('Work'),
    desc: 'Selected work: interactive installations, immersive mapping, branded and artistic AI film by 204.',
  },
  {
    path: '/services',
    title: t('Services'),
    desc: 'Two pillars: AI-powered content creation (branded work, mapping, film, archival) and interactive formats (Magic Mirror, AI Photo Booth, Live Visuals, Augmented Art).',
  },
  {
    path: '/about',
    title: t('About'),
    desc: '204 is a creative technology studio led by six makers in Lisbon, working at the intersection of AI, motion, identity and live environments.',
  },
  {
    path: '/contact',
    title: t('Contact'),
    desc: 'Send a brief, not a form. Three lines: who you are, what you’re making, when you need it by.',
  },
  ...WORKS.map((w) => ({
    path: `/work/${w.slug}`,
    title: t(w.title),
    desc: w.note,
    image: w.media?.still,
  })),
  ...SERVICES_ALL.map((s) => ({
    path: `/services/${s.slug}`,
    title: t(s.label),
    desc: s.body,
    image: s.still,
  })),
  ...PEOPLE.map((p) => ({
    path: `/makers/${p.slug}`,
    title: t(p.name),
    desc: `${p.name}, ${p.role} at 204 — creative technology studio, Lisbon.`,
    image: p.photo,
  })),
]

const esc = (s) => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')

const base = readFileSync(join(dist, 'index.html'), 'utf8')

function metaFor(r) {
  const image = r.image ?? DEFAULT_IMAGE
  const url = SITE_URL ? `${SITE_URL}${r.path}` : ''
  return (
    `<title>${esc(r.title)}</title>\n` +
    `    <meta name="description" content="${esc(r.desc)}" />\n` +
    `    <meta property="og:title" content="${esc(r.title)}" />\n` +
    `    <meta property="og:description" content="${esc(r.desc)}" />\n` +
    `    <meta property="og:type" content="website" />\n` +
    `    <meta property="og:image" content="${esc(image)}" />\n` +
    (url ? `    <meta property="og:url" content="${esc(url)}" />\n    <link rel="canonical" href="${esc(url)}" />\n` : '') +
    `    <meta name="twitter:card" content="summary_large_image" />\n` +
    `    <meta name="twitter:title" content="${esc(r.title)}" />\n` +
    `    <meta name="twitter:description" content="${esc(r.desc)}" />\n` +
    `    <meta name="twitter:image" content="${esc(image)}" />`
  )
}

// strip the meta block the template carries, then inject the per-route one
function render(r) {
  let html = base
  html = html.replace(/<title>[\s\S]*?<\/title>/, '@@META@@')
  html = html.replace(/\n\s*<meta name="description"[^>]*\/>/, '')
  html = html.replace(/\n\s*<meta property="og:[^>]*\/>/g, '')
  html = html.replace(/\n\s*<meta name="twitter:[^>]*\/>/g, '')
  html = html.replace('@@META@@', metaFor(r))
  return html
}

let count = 0
for (const r of routes) {
  const target = r.path === '/' ? join(dist, 'index.html') : join(dist, r.path.slice(1), 'index.html')
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, render(r))
  count++
}

// 404 fallback keeps the home meta
writeFileSync(join(dist, '404.html'), render(routes[0]))

if (SITE_URL) {
  const sitemap =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    routes.map((r) => `  <url><loc>${esc(`${SITE_URL}${r.path}`)}</loc></url>`).join('\n') +
    '\n</urlset>\n'
  writeFileSync(join(dist, 'sitemap.xml'), sitemap)
  const robotsPath = join(dist, 'robots.txt')
  const robots = readFileSync(robotsPath, 'utf8')
  if (!robots.includes('Sitemap:')) writeFileSync(robotsPath, robots.trimEnd() + `\nSitemap: ${SITE_URL}/sitemap.xml\n`)
}

console.log(`generate-meta: ${count} routes${SITE_URL ? ' + sitemap.xml' : ' (no SITE_URL — sitemap skipped)'}`)
