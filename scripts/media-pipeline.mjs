// media-pipeline (SPEC C12 / I.media / V15) — one-time, local-only, rerun-safe.
//
//   node scripts/media-pipeline.mjs            fetch originals + optimize into public/media/
//   node scripts/media-pipeline.mjs --rewrite  rewrite content/*.json refs via the manifest
//
// Scans content/*.json, index.html, src/, scripts/ for cdn.prod.website-files.com
// URLs. Originals cached in media-src/ (gitignored). Outputs per raster image:
//   <name>.webp (≤1920w) + <name>-p-500.webp + <name>-p-800.webp + <name>-p-800.jpg (og/share)
// Per video: single H.264 <name>.mp4 (1080p cap, CRF 23, faststart); webm inputs
// map to the mp4 twin (webm dropped site-wide, SPEC B5). Manifest written to
// scripts/media-manifest.json. Fails hard if V15 budget breached (60MB total / 15MB file).

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const SRC_DIR = join(ROOT, 'media-src')
const OUT_DIR = join(ROOT, 'public', 'media')
const MANIFEST = join(SRC_DIR, 'media-manifest.json')

const RASTER = /\.(png|jpe?g|webp|avif|gif)$/i
const VIDEO = /\.(mp4|webm|mov)$/i

/* ---------------- collect URLs ---------------- */

function* walkFiles(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) yield* walkFiles(p)
    else if (/\.(json|ts|tsx|html|mjs)$/.test(e.name)) yield p
  }
}

function collectUrls() {
  const files = [
    join(ROOT, 'index.html'),
    ...walkFiles(join(ROOT, 'content')),
    ...walkFiles(join(ROOT, 'src')),
    ...walkFiles(join(ROOT, 'scripts')),
  ]
  const urls = new Set()
  for (const f of files) {
    if (f === MANIFEST) continue
    const text = readFileSync(f, 'utf8')
    for (const m of text.matchAll(/https:\/\/cdn\.prod\.website-files\.com\/[^"'\s`]+/g)) {
      urls.add(m[0])
    }
  }
  return [...urls]
}

/* ---------------- naming ---------------- */

function slugFor(url) {
  let name = decodeURIComponent(url.split(/%2F|\//i).pop())
  const ext = extname(name).toLowerCase()
  name = name.slice(0, -ext.length)
  // strip chained webflow hex ids + poster frame suffix
  name = name.replace(/^([0-9a-f]{24}_)+/i, '').replace(/\.\d{7,}$/, '')
  name = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
  if (!name) name = 'asset'
  return { name, ext }
}

/* ---------------- fetch ---------------- */

async function fetchOriginal(url, file) {
  if (existsSync(file) && statSync(file).size > 0) return false
  const res = await fetch(url)
  if (!res.ok) throw new Error(`fetch ${res.status} ${url}`)
  writeFileSync(file, Buffer.from(await res.arrayBuffer()))
  return true
}

/* ---------------- optimize ---------------- */

async function processRaster(sharp, src, outBase) {
  const BG = '#0a0a0a' // §C4 bg token — alpha flattens onto it for jpg share cards
  const out = {}
  const jobs = [
    [`${outBase}.webp`, (s) => s.resize({ width: 1920, withoutEnlargement: true }).webp({ quality: 80 }), 'path'],
    [`${outBase}-p-500.webp`, (s) => s.resize({ width: 500, withoutEnlargement: true }).webp({ quality: 78 }), null],
    [`${outBase}-p-800.webp`, (s) => s.resize({ width: 800, withoutEnlargement: true }).webp({ quality: 78 }), null],
    [`${outBase}-p-800.jpg`, (s) => s.resize({ width: 800, withoutEnlargement: true }).flatten({ background: BG }).jpeg({ quality: 80, mozjpeg: true }), 'jpg800'],
  ]
  for (const [file, build, key] of jobs) {
    if (!existsSync(file)) await build(sharp(src).rotate()).toFile(file)
    if (key) out[key] = `/media/${basename(file)}`
  }
  return out
}

function hasAudio(src) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', src]).toString()
  return out.trim().length > 0
}

// encode ladder (§B6): quality first — 1080p/CRF23 unless that lands over
// the V15 40MB video cap, then step down.
const VIDEO_LADDER = [
  [1080, 23],
  [720, 26],
  [720, 28],
  [540, 30],
]
const VIDEO_CAP = 38 * 1048576

function processVideo(src, outFile) {
  if (existsSync(outFile) && statSync(outFile).size <= VIDEO_CAP) return
  const audio = hasAudio(src) ? ['-c:a', 'aac', '-b:a', '128k'] : ['-an']
  for (const [height, crf] of VIDEO_LADDER) {
    execFileSync('ffmpeg', [
      '-y', '-i', src,
      '-vf', `scale=-2:'min(${height},ih)'`,
      '-c:v', 'libx264', '-crf', String(crf), '-preset', 'slow',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      ...audio,
      outFile,
    ], { stdio: ['ignore', 'ignore', 'inherit'] })
    const size = statSync(outFile).size
    if (size <= VIDEO_CAP) return
    console.warn(`${basename(outFile)} ${(size / 1048576).toFixed(1)}MB @ ${height}p crf${crf} — stepping down`)
  }
  throw new Error(`encode ladder exhausted: ${basename(outFile)}`)
}

/* ---------------- main: fetch + optimize ---------------- */

async function build() {
  const { default: sharp } = await import('sharp')
  mkdirSync(SRC_DIR, { recursive: true })
  mkdirSync(OUT_DIR, { recursive: true })

  const urls = collectUrls()
  console.log(`found ${urls.length} CDN urls`)

  // assign collision-free output names
  const taken = new Map() // name.ext -> url
  const entries = []
  for (const url of urls) {
    const { name, ext } = slugFor(url)
    let final = name
    const keyOf = (n) => `${n}${ext}`
    if (taken.has(keyOf(final)) ) {
      final = `${name}-${createHash('sha1').update(url).digest('hex').slice(0, 6)}`
    }
    taken.set(keyOf(final), url)
    entries.push({ url, name: final, ext })
  }

  // webm twins → their mp4 sibling output (same webflow asset id prefix)
  const mp4ByBase = new Map()
  for (const e of entries) {
    if (e.ext === '.mp4') mp4ByBase.set(e.name.replace(/[-_]?mp4$/, ''), e)
  }

  const manifest = {}
  let fetched = 0
  for (const e of entries) {
    const srcFile = join(SRC_DIR, `${e.name}${e.ext}`)
    if (e.ext === '.webm') {
      const twin = mp4ByBase.get(e.name.replace(/[-_]?webm$/, ''))
      if (twin) {
        manifest[e.url] = { path: `/media/${twin.name.replace(/[-_]?mp4$/, '')}.mp4`, drop: 'webm→mp4 twin' }
        continue
      }
    }
    if (await fetchOriginal(e.url, srcFile)) fetched++

    if (RASTER.test(e.ext)) {
      const extra = await processRaster(sharp, srcFile, join(OUT_DIR, e.name))
      manifest[e.url] = { path: `/media/${e.name}.webp`, ...extra }
    } else if (VIDEO.test(e.ext)) {
      const clean = e.name.replace(/[-_]?mp4$/, '')
      processVideo(srcFile, join(OUT_DIR, `${clean}.mp4`))
      manifest[e.url] = { path: `/media/${clean}.mp4` }
    } else {
      console.warn(`skip (unknown type): ${e.url}`)
    }
  }

  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + '\n')
  console.log(`fetched ${fetched} new originals → ${SRC_DIR}`)

  /* size report + V15 gate */
  const files = readdirSync(OUT_DIR).map((f) => ({ f, size: statSync(join(OUT_DIR, f)).size }))
  const total = files.reduce((s, x) => s + x.size, 0)
  const srcTotal = readdirSync(SRC_DIR).reduce((s, f) => s + statSync(join(SRC_DIR, f)).size, 0)
  files.sort((a, b) => b.size - a.size)
  console.log('\nlargest outputs:')
  for (const { f, size } of files.slice(0, 10)) console.log(`  ${(size / 1048576).toFixed(2).padStart(7)} MB  ${f}`)
  console.log(`\noriginals ${(srcTotal / 1048576).toFixed(1)} MB → optimized ${(total / 1048576).toFixed(1)} MB (${files.length} files)`)

  const overVid = files.filter((x) => VIDEO.test(x.f) && x.size > 40 * 1048576)
  const overImg = files.filter((x) => !VIDEO.test(x.f) && x.size > 2 * 1048576)
  if (overVid.length) throw new Error(`V15 breach: videos >40MB: ${overVid.map((x) => x.f).join(', ')}`)
  if (overImg.length) throw new Error(`V15 breach: imgs >2MB: ${overImg.map((x) => x.f).join(', ')}`)
  if (total > 80 * 1048576) throw new Error(`V15 breach: public/media total ${(total / 1048576).toFixed(1)}MB > 80MB`)
  console.log('V15 budget OK')
}

/* ---------------- rewrite content JSONs ---------------- */

function rewrite() {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
  const dir = join(ROOT, 'content')
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const p = join(dir, f)
    const data = JSON.parse(readFileSync(p, 'utf8'))
    let hits = 0
    const walk = (node) => {
      if (Array.isArray(node)) return node.map(walk)
      if (node && typeof node === 'object') {
        for (const k of Object.keys(node)) node[k] = walk(node[k])
        // video pairs collapse to mp4-only (webm dropped, SPEC C12/B5)
        if (node.video && typeof node.video === 'object' && node.video.webm) {
          delete node.video.webm
          hits++
        }
        return node
      }
      if (typeof node === 'string' && manifest[node]) {
        hits++
        return manifest[node].path
      }
      return node
    }
    const out = walk(data)
    if (hits) {
      writeFileSync(p, JSON.stringify(out, null, 2) + '\n')
      console.log(`${f}: ${hits} refs rewritten`)
    }
  }
}

if (process.argv.includes('--rewrite')) rewrite()
else await build()
