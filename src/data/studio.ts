// Typed loader over content/*.json — ALL copy, projects, services, people and
// site settings live there (SPEC §C11). This file only defines the schema
// (the interfaces below double as the future CMS content model) and derives
// computed fields: ids, ref codes, slugs, hero chapters, stats, categories.
// Components import from here and never touch the JSON directly, so a
// headless CMS can replace the JSON source without touching the app.
//
// NOTE: slugify/code derivation is mirrored in scripts/generate-meta.mjs —
// keep both in sync.

import worksJson from '../../content/works.json' with { type: 'json' }
import servicesJson from '../../content/services.json' with { type: 'json' }
import peopleJson from '../../content/people.json' with { type: 'json' }
import studioJson from '../../content/studio.json' with { type: 'json' }

export type Scene = 'cathedral' | 'desert' | 'interior' | 'water'

export type Category = 'branded' | 'artistic' | 'mapping' | 'interactive'

export interface WorkMedia {
  still?: string
  video?: { webm: string; mp4: string }
}

interface RawWork {
  title: string
  client: string
  cat: Category
  year: string
  runtime: string
  note: string
  scene: Scene
  media?: WorkMedia
  body?: string
  youtube?: string[]
  gallery?: string[]
}

export interface Work extends RawWork {
  id: string
  code: string
  slug: string
}

interface RawService {
  n: string
  label: string
  scene: Scene
  body: string
  still?: string
  video?: { webm: string; mp4: string }
  intro?: string
  modes?: Array<{ n: string; label: string; body: string }>
  features?: Array<{ label: string; body: string }>
  relatedCat?: Category
}

export interface Service extends RawService {
  slug: string
}

export interface PersonSocials {
  instagram?: string
  linkedin?: string
  web?: string
  email?: string
}

interface RawPerson {
  name: string
  role: string
  photo?: string
  bio?: string
  socials?: PersonSocials
}

export interface Person extends RawPerson {
  slug: string
}

export interface HeroChapter {
  code: string
  slug: string
  title: string
  client: string
  cat: Category
  scene: Scene
  media?: WorkMedia
}

/* ─── derivation (mirrored in scripts/generate-meta.mjs) ─── */

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const rawWorks = worksJson as RawWork[]

/* newest first in the JSON; ref codes descend so the newest carries the highest */
export const WORKS: Work[] = rawWorks.map((w, i) => ({
  ...w,
  id: `w${String(i + 1).padStart(2, '0')}`,
  code: `NC·${String(rawWorks.length - i).padStart(3, '0')}`,
  slug: slugify(w.title),
}))

export const SERVICES_CONTENT: Service[] = (servicesJson.content as RawService[]).map((s) => ({
  ...s,
  slug: slugify(s.label),
}))

export const SERVICES_INTERACTIVE: Service[] = (servicesJson.interactive as RawService[]).map((s) => ({
  ...s,
  slug: slugify(s.label),
}))

export const SERVICES_ALL: Service[] = [...SERVICES_CONTENT, ...SERVICES_INTERACTIVE]

export const PEOPLE: Person[] = (peopleJson as RawPerson[]).map((p) => ({
  ...p,
  slug: slugify(p.name),
}))

export const STUDIO = {
  name: studioJson.name,
  suffix: studioJson.suffix,
  tag: studioJson.tag,
} as const

export const CONTACT = studioJson.contact

export const LOGO_URL = studioJson.logoUrl

export const CATEGORIES = ['all', ...studioJson.workCategories] as string[]

export type CategoryFilter = string

/* hero reel = works referenced by slug in content/studio.json */
export const HERO_CHAPTERS: HeroChapter[] = studioJson.heroChapters
  .map((slug) => WORKS.find((w) => w.slug === slug))
  .filter((w): w is Work => Boolean(w))
  .map((w) => ({ code: w.code, slug: w.slug, title: w.title, client: w.client, cat: w.cat, scene: w.scene, media: w.media }))

export const PRACTICE: Array<{ n: string; label: string; body: string }> = studioJson.practice

export const BUDGET_RANGES: string[] = studioJson.budgetRanges

export interface PartnerLogo {
  name: string
  logo: string
}

export const TRUSTED_BY: PartnerLogo[] = studioJson.trustedBy
export const PARTNERS: PartnerLogo[] = studioJson.partners
export const RNA_STUDIO_URL: string = studioJson.rnaStudioUrl

/* stats derive from the content — adding a project or maker updates them */
export const STATS: Array<[string, string]> = [
  ['Makers in the room', String(PEOPLE.length).padStart(2, '0')],
  ['Main pillars', studioJson.pillarsCount],
  ['Projects shipped', String(WORKS.length)],
]
