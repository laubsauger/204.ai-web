// Studio content — real data from 204-no-content.webflow.io
// (snapshot: design/scrape/extracted.json, SPEC §C10). Copy adapted to the
// Night Shift voice; facts, names, projects and media are verbatim from the
// live site. Media is hotlinked from the Webflow CDN for now (SPEC §V4 temp
// exception) — self-host once the redesign is approved.

export type Scene = 'cathedral' | 'desert' | 'interior' | 'water'

export type Category = 'branded' | 'artistic' | 'mapping' | 'interactive'

const CDN = 'https://cdn.prod.website-files.com/64ba5b3b418a540ade9f6e31'

export interface WorkMedia {
  still?: string
  video?: { webm: string; mp4: string }
}

export interface Work {
  id: string
  code: string
  title: string
  client: string
  cat: Category
  year: string
  runtime: string
  note: string
  scene: Scene
  media?: WorkMedia
}

export interface Service {
  n: string
  label: string
  scene: Scene
  body: string
  still?: string
}

export interface Person {
  name: string
  role: string
}

export const STUDIO = {
  name: '204',
  suffix: 'NO-CONTENT',
  tag: 'Creative technology studio for image, motion & interaction',
} as const

// Curated flagship selection from the full portfolio (~19 projects), newest first.
export const WORKS: Work[] = [
  { id: 'w01', code: 'NC·001', title: 'Delulu', client: 'Sofie Heyman', cat: 'interactive', year: '2026', runtime: '—', note: 'Magic Mirror collaboration with artist Sofie Heyman.', scene: 'interior' },
  { id: 'w02', code: 'NC·002', title: 'Portugal Tech Week', client: 'Portugal Tech Week', cat: 'interactive', year: '2025', runtime: '—', note: 'Interactive AI installation for Lisbon’s tech flagship event.', scene: 'cathedral', media: { still: `${CDN}/692db82f1671a179f06be1c8_portugaltechweek-img.png` } },
  { id: 'w03', code: 'NC·003', title: '1N: EEG Mirror', client: 'MuLabs × 204', cat: 'interactive', year: '2025', runtime: '—', note: 'Real-time brain activity becomes a living artwork. Neurofeedback-driven Magic Mirror, London.', scene: 'water', media: { still: `${CDN}/69a086f5c7d37a8dd190b970_1nport.png` } },
  { id: 'w04', code: 'NC·004', title: 'Burst', client: 'Francisco Carolinum, Linz', cat: 'interactive', year: '2025', runtime: '—', note: 'Magic Mirror experience trained on the Burst style, shown in Linz.', scene: 'cathedral', media: { still: `${CDN}/69203f052ef9933a7d26918a_burst-img.png` } },
  { id: 'w05', code: 'NC·005', title: 'Synesthesia', client: 'Magic Mirror', cat: 'interactive', year: '2024', runtime: '—', note: 'Audio-reactive Magic Mirror set — sound becomes image in real time.', scene: 'water', media: { still: `${CDN}%2F69b3e598a8798a0f049be97f_Synesthesia%20-%20magicmirror_poster.0000000.jpg`, video: { webm: `${CDN}%2F69b3e598a8798a0f049be97f_Synesthesia%20-%20magicmirror_webm.webm`, mp4: `${CDN}%2F69b3e598a8798a0f049be97f_Synesthesia%20-%20magicmirror_mp4.mp4` } } },
  { id: 'w06', code: 'NC·006', title: 'Hulaween', client: 'Suwannee Hulaween, Florida', cat: 'interactive', year: '2024', runtime: '—', note: 'The Spirit Mirror — festival-goers transformed into the spirits of Spirit Lake.', scene: 'desert', media: { still: `${CDN}/6926dbb374354eab559adf35_hulaupscale.png` } },
  { id: 'w07', code: 'NC·007', title: 'Zuzalu × Grimes', client: 'Zuzalu', cat: 'interactive', year: '2024', runtime: '—', note: 'AI installation collaboration staged with Grimes.', scene: 'desert' },
  { id: 'w08', code: 'NC·008', title: 'Texas Eclipse', client: 'Texas Eclipse Festival', cat: 'mapping', year: '2024', runtime: '—', note: 'Immersive projection mapping under a total eclipse.', scene: 'desert' },
  { id: 'w09', code: 'NC·009', title: 'Yard Episode', client: 'Yards', cat: 'mapping', year: '2024', runtime: '—', note: 'Live visuals and mapping for the Yards episodes.', scene: 'interior', media: { still: `${CDN}%2F6669a4c20c952c60a0c128eb_Yards_episodes-2024_finalvid_poster.0000000.jpg`, video: { webm: `${CDN}%2F6669a4c20c952c60a0c128eb_Yards_episodes-2024_finalvid_webm.webm`, mp4: `${CDN}%2F6669a4c20c952c60a0c128eb_Yards_episodes-2024_finalvid_mp4.mp4` } } },
  { id: 'w10', code: 'NC·010', title: 'Remember', client: 'Music video', cat: 'artistic', year: '—', runtime: '—', note: 'Artistic AI music video.', scene: 'interior', media: { still: `${CDN}/692429b5e7e95fffebb32c7c_Remember-img.png` } },
  { id: 'w11', code: 'NC·011', title: 'Venom', client: 'Concept perfume brand', cat: 'branded', year: '—', runtime: '—', note: 'Identity film for a hypothetical perfume — transformation, seduction, embodied desire.', scene: 'water', media: { still: `${CDN}/692062972d8b6237a3349b6e_Venom-Img.png` } },
  { id: 'w12', code: 'NC·012', title: 'RUBr', client: 'Concept condom brand', cat: 'branded', year: '—', runtime: '—', note: 'Full brand book, packaging and AI-assisted campaign for a hypothetical condom brand.', scene: 'cathedral', media: { still: `${CDN}/69206288837a6cbd56eb8420_Rubr-img.png` } },
]

export const CATEGORIES = ['all', 'interactive', 'mapping', 'branded', 'artistic'] as const

export type CategoryFilter = (typeof CATEGORIES)[number]

// Two pillars: .Content (SERVICES_CONTENT) and .Interactive (SERVICES_INTERACTIVE).
export const SERVICES_CONTENT: Service[] = [
  { n: '01', label: 'Branded Work & Campaigns', scene: 'cathedral', body: 'Visual assets and narratives that express brand identity with clarity and impact.' },
  { n: '02', label: 'Immersive Mapping', scene: 'desert', body: 'High-end visuals and immersive mapping for any environment, theme, or surface.' },
  { n: '03', label: 'Artistic Style & Film', scene: 'interior', body: 'Character, motion, or abstract animation and stylistic film built to convey story, emotion, or concept.' },
  { n: '04', label: 'Digital & Archival Preservation', scene: 'water', body: 'Restoration and enhancement of archival photos or footage through advanced AI methods.' },
]

export const SERVICES_INTERACTIVE: Service[] = [
  { n: '05', label: 'Magic Mirror', scene: 'cathedral', body: 'Real-time AI mirror installation. Touch prompting, custom-trained styles, custom frames — controlled from the Mirror app.', still: `${CDN}%2F69b3e6a6a71e70fdb9bb5fa9_magic-livingpainting_poster.0000000.jpg` },
  { n: '06', label: 'AI Photo Booth', scene: 'interior', body: 'Generative photo booth for events — branded, styled, instantly shareable.', still: `${CDN}%2F69b3e614ee5d9448d002cbb6_photobooth_poster.0000000.jpg` },
  { n: '07', label: 'Live Visuals', scene: 'water', body: 'AI-driven VJing and live visuals for stages, performances and immersive spaces.', still: `${CDN}%2F69b3e5faece24832f8313ed4_livevisualsss_poster.0000000.jpg` },
  { n: '08', label: 'Augmented Art', scene: 'desert', body: 'Living paintings and augmented artworks for museums, galleries and artist collaborations.', still: `${CDN}%2F69b3e7021f89aaf243863571_Augmented%202_poster.0000000.jpg` },
]

export const PEOPLE: Person[] = [
  { name: 'Dimitri De Jonghe', role: 'Creative Technologist & Founder' },
  { name: 'Cintia Aguiar Pinto', role: 'Creative Director & Founder' },
  { name: 'Cecilia Hübinette', role: 'Art Director & Co-Founder' },
  { name: 'Dan Brown', role: 'AI Arts Director & Artist' },
  { name: 'Laura Coimbra', role: 'Marketing' },
]

export const CONTACT = {
  email: 'Hello@204.ai',
  studio: 'RnA Studio — R. Ferreira Lapa 12A, 1150-157 Lisboa',
  instagram: '@204nocontent.ai',
  instagramUrl: 'https://www.instagram.com/204nocontent.ai/',
  linkedin: '204-no-content',
  linkedinUrl: 'https://www.linkedin.com/company/204-no-content/',
} as const

export const LOGO_URL = `${CDN}/65b7a18446d60bb65c1641e7_204white.png`

// Home hero chapters — featured work with real media, reel order.
export interface HeroChapter {
  code: string
  title: string
  client: string
  scene: Scene
  media?: WorkMedia
}

export const HERO_CHAPTERS: HeroChapter[] = [
  { code: 'NC·005', title: 'Synesthesia', client: 'Magic Mirror', scene: 'water', media: WORKS[4].media },
  { code: 'NC·006', title: 'Hulaween', client: 'Suwannee Hulaween', scene: 'desert', media: WORKS[5].media },
  { code: 'NC·003', title: '1N: EEG Mirror', client: 'MuLabs × 204', scene: 'water', media: WORKS[2].media },
  { code: 'NC·009', title: 'Yard Episode', client: 'Yards', scene: 'interior', media: WORKS[8].media },
]

export const STATS: Array<[string, string]> = [
  ['Makers in the room', '05'],
  ['Main pillars', '02'],
  ['Projects shipped', '19+'],
]

export const BUDGET_RANGES = ['< 25k', '25–75k', '75–200k', '200k+', 'trade'] as const
