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
  slug: string
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

export interface Service {
  n: string
  label: string
  slug: string
  scene: Scene
  body: string
  still?: string
  video?: { webm: string; mp4: string }
  /* detail page */
  intro?: string
  modes?: Array<{ n: string; label: string; body: string }>
  features?: Array<{ label: string; body: string }>
  relatedCat?: Category
}

export interface Person {
  name: string
  role: string
  photo?: string
}

export const STUDIO = {
  name: '204',
  suffix: 'NO-CONTENT',
  tag: 'Creative technology studio for image, motion & interaction',
} as const

// Full catalog from the live site (portfolios + content portfolio pages).
// Newest first; ref codes descend so the newest project carries the highest
// number. Facts (titles, clients, dates, notes) from the scrape only.
interface RawWork {
  title: string
  client: string
  cat: Category
  year: string
  runtime: string
  note: string
  scene: Scene
  media?: WorkMedia
  /* detail-page extras (present where the live site has real content) */
  body?: string
  youtube?: string[]
  gallery?: string[]
}

const RAW_WORKS: RawWork[] = [
  { title: 'Delulu', client: 'Sofie Heyman', cat: 'interactive', year: '2026', runtime: '—', note: 'Magic Mirror collaboration with artist Sofie Heyman.', scene: 'interior', media: { still: `${CDN}/69a0829ddd5d60e2bcdef691_%C2%A9AnaViotti_DELULU-167.jpg` } },
  { title: 'Stand Virtual', client: 'Stand Virtual', cat: 'interactive', year: '2026', runtime: '—', note: 'Interactive AI installation.', scene: 'cathedral', media: { still: `${CDN}/69a075e076a988d6b84312a8_Stand.png` } },
  { title: 'Portugal Tech Week', client: 'Portugal Tech Week', cat: 'interactive', year: '2025', runtime: '—', note: 'Interactive AI installation for Lisbon’s tech flagship event.', scene: 'cathedral', media: { still: `${CDN}/692db82f1671a179f06be1c8_portugaltechweek-img.png` } },
  { title: 'Sensoria', client: '—', cat: 'interactive', year: '2025', runtime: '—', note: 'Interactive AI installation.', scene: 'water', media: { still: `${CDN}/692ec004ca954cf090b1a964_sensoria-img.png` } },
  { title: 'Tkeshii', client: '—', cat: 'interactive', year: '2025', runtime: '—', note: 'Interactive AI installation.', scene: 'desert', media: { still: `${CDN}/692ebab120c3c4da481896d5_tkeshi-img.png` } },
  { title: '1N: EEG Mirror', client: 'MuLabs × 204', cat: 'interactive', year: '2025', runtime: '—', note: 'Real-time brain activity becomes a living artwork. Neurofeedback-driven Magic Mirror, London.', scene: 'water', media: { still: `${CDN}/69a086f5c7d37a8dd190b970_1nport.png` },
    body: 'Your mind becomes the exhibit. The Brain Mirror translates real-time brain activity into evolving visual forms — 204 generative technology driven by MuLabs neurofeedback. The installation responds to shifts in attention, focus and mental engagement: as you concentrate, the imagery transforms, turning your internal cognitive state into a living artwork. Shown in London.',
    gallery: [`${CDN}/69a0891bc407f0e265b0cc4d_DEV02179.jpg`, `${CDN}/69a08950e74b2dd303902e2c_Screenshot%202026-02-26%20at%2018.56.16.png`, `${CDN}/69a08969335ead4bd83753a8_Screenshot%202026-02-26%20at%2018.56.07.png`] },
  { title: 'Viva el Gonzo', client: 'Viva el Gonzo', cat: 'interactive', year: '2025', runtime: '—', note: 'Magic Mirror experience on location.', scene: 'desert', media: { still: `${CDN}/684047350c7f0d019855e2e9_vivaelgonzo.png` } },
  { title: 'Burst', client: 'Francisco Carolinum, Linz', cat: 'interactive', year: '2025', runtime: '—', note: 'Magic Mirror experience trained on the Burst style, shown in Linz.', scene: 'cathedral', media: { still: `${CDN}/69203f052ef9933a7d26918a_burst-img.png` } },
  { title: 'Rare Effect', client: 'Rare Effect, Arroz Estúdios', cat: 'interactive', year: '2024', runtime: '—', note: 'Interactive AI installation at Arroz Estúdios, Lisbon.', scene: 'interior', media: { still: `${CDN}/69b295ccf321e17fbd830d05_%C2%A9FILIPA_AURE%CC%81LIO_RARE%20EFFECT%202025%20-%20ARROZ%20ESTU%CC%81DIOS_-069.jpg` } },
  { title: 'Hulaween', client: 'Suwannee Hulaween, Florida', cat: 'interactive', year: '2024', runtime: '—', note: 'The Spirit Mirror — festival-goers transformed into the spirits of Spirit Lake.', scene: 'desert', media: { still: `${CDN}/6926dbb374354eab559adf35_hulaupscale.png` },
    body: 'Florida’s Hulaween is home to Spirit Lake — a lake with a reputation for being haunted, though nobody quite agrees on what lives inside. That legend became the brief: the Spirit Mirror, a Magic Mirror installation that transforms festival-goers into the spirits we imagine beneath the surface. October 24–27, 2024.',
    gallery: [`${CDN}/6749a0687b3df6da91e82b2f_2024-11-22%2016.18.15.jpg`, `${CDN}/6749a0702ffc63114d0d2862_2024-11-22%2016.18.25.jpg`, `${CDN}/6749a07936708671a96b92a3_2024-11-22%2016.18.32.jpg`] },
  { title: 'Vagabond', client: 'Vagabond', cat: 'interactive', year: '2024', runtime: '—', note: 'Magic Mirror event installation.', scene: 'interior', media: { still: `${CDN}/67488e3d2ecffdff49269d83_Vagabond_cover.png` } },
  { title: 'Studio 54b', client: 'Studio 54b', cat: 'interactive', year: '2024', runtime: '—', note: 'Interactive AI installation.', scene: 'cathedral' },
  { title: 'Oddsgate', client: 'Oddsgate', cat: 'interactive', year: '2024', runtime: '—', note: 'Interactive AI installation.', scene: 'water', media: { still: `${CDN}/6744776d2208432823790a7b_Oddsgate_cover.png` } },
  { title: 'NFC', client: '—', cat: 'interactive', year: '2024', runtime: '—', note: 'Interactive AI installation.', scene: 'desert', media: { still: `${CDN}/6745e2385b5bde16613229a4_NFC_Cover.jpg` } },
  { title: 'Synesthesia', client: 'Magic Mirror', cat: 'interactive', year: '2024', runtime: '—', note: 'Audio-reactive Magic Mirror set — sound becomes image in real time.', scene: 'water', media: { still: `${CDN}%2F69b3e598a8798a0f049be97f_Synesthesia%20-%20magicmirror_poster.0000000.jpg`, video: { webm: `${CDN}%2F69b3e598a8798a0f049be97f_Synesthesia%20-%20magicmirror_webm.webm`, mp4: `${CDN}%2F69b3e598a8798a0f049be97f_Synesthesia%20-%20magicmirror_mp4.mp4` } } },
  { title: 'Yard Episode', client: 'Yards', cat: 'mapping', year: '2024', runtime: '—', note: 'Live visuals and mapping for the Yards episodes.', scene: 'interior', media: { still: `${CDN}%2F6669a4c20c952c60a0c128eb_Yards_episodes-2024_finalvid_poster.0000000.jpg`, video: { webm: `${CDN}%2F6669a4c20c952c60a0c128eb_Yards_episodes-2024_finalvid_webm.webm`, mp4: `${CDN}%2F6669a4c20c952c60a0c128eb_Yards_episodes-2024_finalvid_mp4.mp4` } } },
  { title: 'Zuzalu × Grimes', client: 'Zuzalu', cat: 'interactive', year: '2024', runtime: '—', note: 'AI installation collaboration staged with Grimes.', scene: 'desert' },
  { title: 'Texas Eclipse', client: 'Texas Eclipse Festival', cat: 'mapping', year: '2024', runtime: '—', note: 'Immersive projection mapping under a total eclipse.', scene: 'desert', media: { still: `${CDN}/69242bb9b06e917f8bfc4598_Texas-img.png` } },
  { title: 'Lisbon Insiders', client: 'Lisbon Insiders', cat: 'interactive', year: '2024', runtime: '—', note: 'Interactive AI installation.', scene: 'cathedral' },
  { title: 'Wines Around The World', client: '—', cat: 'interactive', year: '2023', runtime: '—', note: 'Interactive AI installation.', scene: 'interior', media: { still: `${CDN}/67489265485a73607410fa99_winesfromanother.png` } },
  { title: 'Mazarine', client: 'Auriece Vettier', cat: 'interactive', year: '2023', runtime: '—', note: 'Augmented art collaboration with Auriece Vettier.', scene: 'water', media: { still: `${CDN}/69203f08380e1ffe677a9418_mazarine-img.png` } },
  { title: 'RUBr', client: 'Concept condom brand', cat: 'branded', year: '—', runtime: '—', note: 'Full brand book, packaging and AI-assisted campaign for a hypothetical condom brand.', scene: 'cathedral', media: { still: `${CDN}/69206288837a6cbd56eb8420_Rubr-img.png` },
    body: 'A self-initiated showcase of creative thinking and advertising craft: we designed a hypothetical condom brand end to end — brand book, wrappers and boxes, plus a campaign of posters and films to market it. Our designers built the entire brand; AI helped produce the campaign videos and product imagery. Landmark buildings become subtle, unmistakable reminders of why protection matters.',
    youtube: ['HerOGLgpefU', 'kLC9BqOVwOU'] },
  { title: 'Venom', client: 'Concept perfume brand', cat: 'branded', year: '—', runtime: '—', note: 'Identity film for a hypothetical perfume — transformation, seduction, embodied desire.', scene: 'water', media: { still: `${CDN}/692062972d8b6237a3349b6e_Venom-Img.png` },
    body: 'A full concept for a hypothetical perfume brand: an identity film crafted entirely from scratch — narrative, visual language and sound design. The piece explores transformation, seduction and embodied desire, using evocative imagery and atmosphere to give the brand its essence.',
    youtube: ['l8mZr3Th5dI'] },
  { title: 'Remember', client: 'Music video', cat: 'artistic', year: '—', runtime: '—', note: 'Artistic AI music video.', scene: 'interior', media: { still: `${CDN}/692429b5e7e95fffebb32c7c_Remember-img.png` } },
  { title: 'Shower Thoughts', client: '—', cat: 'artistic', year: '—', runtime: '—', note: 'Artistic AI film.', scene: 'desert', media: { still: `${CDN}/69242ae193a8f3d6760eb460_Shower%20Thoughts-img.png` } },
  { title: 'Thorneshade', client: '—', cat: 'branded', year: '—', runtime: '—', note: 'Branded content film.', scene: 'cathedral', media: { still: `${CDN}/69242a234690e5231f599efa_Thorneshade-img.png` } },
  { title: 'Surrender to Nature', client: '—', cat: 'artistic', year: '—', runtime: '—', note: 'Artistic film.', scene: 'water' },
  { title: 'Talent in Limbo', client: '—', cat: 'artistic', year: '—', runtime: '—', note: 'Satirical film.', scene: 'interior', media: { still: `${CDN}/69242b6b8e8ab4ed33ceb51a_TalentinLimbo-img.png` } },
  { title: 'Popular Faces', client: '—', cat: 'artistic', year: '—', runtime: '—', note: 'Artistic music video.', scene: 'desert', media: { still: `${CDN}/69242b75dbfc0660e399ae81_Popularfaces-img.png` } },
  { title: 'Breast Cancer Awareness', client: '—', cat: 'branded', year: '—', runtime: '—', note: 'Branded awareness campaign.', scene: 'interior', media: { still: `${CDN}/692429aaa21ad08bf2557e62_breastcancer-img.png` } },
  { title: 'BIOxyz Coin Launch', client: 'BIOxyz', cat: 'branded', year: '—', runtime: '—', note: 'Branded launch content.', scene: 'cathedral', media: { still: `${CDN}/692428c1a4b41790fc8a213a_bioxyz-img.png` } },
]

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const WORKS: Work[] = RAW_WORKS.map((w, i) => ({
  ...w,
  id: `w${String(i + 1).padStart(2, '0')}`,
  code: `NC·${String(RAW_WORKS.length - i).padStart(3, '0')}`,
  slug: slugify(w.title),
}))

export const CATEGORIES = ['all', 'interactive', 'mapping', 'branded', 'artistic'] as const

export type CategoryFilter = (typeof CATEGORIES)[number]

// Two pillars: .Content (SERVICES_CONTENT) and .Interactive (SERVICES_INTERACTIVE).
export const SERVICES_CONTENT: Service[] = [
  {
    n: '01', label: 'Branded Work & Campaigns', slug: 'branded-work-campaigns', scene: 'cathedral',
    body: 'Visual assets and narratives that express brand identity with clarity and impact.',
    intro: 'Visual assets and narratives that express brand identity with clarity and impact — from single spots to sustained campaigns, produced with AI speed and human direction.',
    relatedCat: 'branded',
  },
  {
    n: '02', label: 'Immersive Mapping', slug: 'immersive-mapping', scene: 'desert',
    body: 'High-end visuals and immersive mapping for any environment, theme, or surface.',
    intro: 'High-end visuals and immersive mapping for any environment, theme or surface — stages, buildings, domes, landscapes.',
    relatedCat: 'mapping',
  },
  {
    n: '03', label: 'Artistic Style & Film', slug: 'artistic-style-film', scene: 'interior',
    body: 'Character, motion, or abstract animation and stylistic film built to convey story, emotion, or concept.',
    intro: 'Character, motion or abstract animation and stylistic film — built to convey story, emotion or concept.',
    relatedCat: 'artistic',
  },
  {
    n: '04', label: 'Digital & Archival Preservation', slug: 'digital-archival-preservation', scene: 'water',
    body: 'Restoration and enhancement of archival photos or footage through advanced AI methods.',
    intro: 'Restoration and enhancement of archival photos and footage through advanced AI methods — history, kept legible.',
  },
]

const MIRROR_FEATURES = [
  { label: 'TOUCH PROMPTING', body: 'Activate prompts by touching an object of your choice.' },
  { label: 'LORA TRAINING', body: 'Artist? Brand? Unique style? We train a LoRA so the mirror keeps your style consistent.' },
  { label: 'CUSTOM FRAMES', body: 'A custom frame around the mirror for a more immersive, brand-consistent experience.' },
  { label: 'MIRROR APP', body: 'Control prompts and record your experience from the Mirror app.' },
]

export const SERVICES_INTERACTIVE: Service[] = [
  {
    n: '05', label: 'Magic Mirror', slug: 'magic-mirror', scene: 'cathedral',
    body: 'Real-time AI mirror installation. Touch prompting, custom-trained styles, custom frames — controlled from the Mirror app.',
    still: `${CDN}%2F69b3e6a6a71e70fdb9bb5fa9_magic-livingpainting_poster.0000000.jpg`,
    video: { webm: `${CDN}%2F69b3e6a6a71e70fdb9bb5fa9_magic-livingpainting_webm.webm`, mp4: `${CDN}%2F69b3e6a6a71e70fdb9bb5fa9_magic-livingpainting_mp4.mp4` },
    intro: 'One system, multiple experiences: a real-time interactive mirror that transforms your audience and places them at the center of the experience.',
    modes: [
      { n: '01', label: 'Identity Transformation', body: 'Guests become alternate versions of themselves in real time.' },
      { n: '02', label: 'Living Art', body: 'Participants step inside and animate iconic or branded artworks.' },
      { n: '03', label: 'Environment Control', body: 'Movement influences the surrounding visual environment.' },
      { n: '04', label: 'Game Mode', body: 'Interactive challenges layered into immersive worlds.' },
      { n: '05', label: 'Neurofeedback', body: 'Brain activity drives responsive live visuals.' },
    ],
    features: MIRROR_FEATURES,
    relatedCat: 'interactive',
  },
  {
    n: '06', label: 'AI Photo Booth', slug: 'ai-photo-booth', scene: 'interior',
    body: 'Generative photo booth for events — branded, styled, instantly shareable.',
    still: `${CDN}%2F69b3e614ee5d9448d002cbb6_photobooth_poster.0000000.jpg`,
    video: { webm: `${CDN}%2F69b3e614ee5d9448d002cbb6_photobooth_webm.webm`, mp4: `${CDN}%2F69b3e614ee5d9448d002cbb6_photobooth_mp4.mp4` },
    intro: 'Instant transformations, branded take-home moments: a real-time AI portrait experience that turns guests into custom identities — built for festivals, brand activations, conferences and cultural events.',
    modes: [
      { n: '01', label: 'Custom Worlds & Characters', body: 'Visual worlds and AI characters aligned with your identity or campaign narrative.' },
      { n: '02', label: 'Branded Booth & Interface', body: 'The booth and its interface carry your brand end to end.' },
      { n: '03', label: 'Print & Digital Formats', body: 'Print framing plus digital formats, ready to share.' },
      { n: '04', label: 'Take-Home Souvenir', body: 'Every portrait leaves as a branded memory in hand.' },
    ],
    features: MIRROR_FEATURES,
    relatedCat: 'interactive',
  },
  {
    n: '07', label: 'Live Visuals', slug: 'live-visuals', scene: 'water',
    body: 'AI-driven VJing and live visuals for stages, performances and immersive spaces.',
    still: `${CDN}%2F69b3e5faece24832f8313ed4_livevisualsss_poster.0000000.jpg`,
    video: { webm: `${CDN}%2F69b3e5faece24832f8313ed4_livevisualsss_webm.webm`, mp4: `${CDN}%2F69b3e5faece24832f8313ed4_livevisualsss_mp4.mp4` },
    intro: 'Real-time worlds at architectural scale: stages, buildings, landscapes and performers become responsive visual environments — from intimate venues to cliffs and full facades.',
    modes: [
      { n: '01', label: 'Stage Visuals', body: 'Real-time visuals that amplify musical energy and live performance.' },
      { n: '02', label: 'Architectural Mapping', body: 'Large-scale projection transforming buildings and structures.' },
      { n: '03', label: 'Responsive Atmospheres', body: 'Environments reacting to music, movement, weather data, audience interaction and performance energy.' },
    ],
    relatedCat: 'interactive',
  },
  {
    n: '08', label: 'Augmented Art', slug: 'augmented-art', scene: 'desert',
    body: 'Living paintings and augmented artworks for museums, galleries and artist collaborations.',
    still: `${CDN}%2F69b3e7021f89aaf243863571_Augmented%202_poster.0000000.jpg`,
    video: { webm: `${CDN}%2F69b3e7021f89aaf243863571_Augmented%202_webm.webm`, mp4: `${CDN}%2F69b3e7021f89aaf243863571_Augmented%202_mp4.mp4` },
    intro: 'Added motion, added story, added depth: physical artworks brought to life through real-time generative layers — extending narrative and atmosphere without altering the original piece.',
    modes: [
      { n: '01', label: 'Paintings', body: 'Subtle generative layers set static artworks in motion.' },
      { n: '02', label: 'Large-Scale Murals', body: 'Architectural augmentations expanding narrative across entire walls.' },
      { n: '03', label: 'Natural Landscapes', body: 'Site-specific layers adapted to organic textures and formations.' },
      { n: '04', label: 'Sculptural Forms', body: 'Projection-mapped systems wrapping three-dimensional objects.' },
    ],
    relatedCat: 'interactive',
  },
]

export const SERVICES_ALL: Service[] = [...SERVICES_CONTENT, ...SERVICES_INTERACTIVE]

export const PEOPLE: Person[] = [
  { name: 'Dimitri De Jonghe', role: 'Creative Technologist & Founder', photo: `${CDN}/6744aa085bf15599e815f40d_Dimi_Makers.png` },
  { name: 'Cintia Aguiar Pinto', role: 'Creative Director & Founder', photo: `${CDN}/6744aaf77e86a28002b33175_Cintia_Makers.png` },
  { name: 'Cecilia Hübinette', role: 'Art Director & Co-Founder', photo: `${CDN}/6744aaff7714a7f2459a01a9_Cece_Makers.png` },
  { name: 'Dan Brown', role: 'AI Arts Director & Artist', photo: `${CDN}/6744ab08106d7329c3649e60_dan_makers.png` },
  { name: 'Laura Coimbra', role: 'Marketing', photo: `${CDN}/67991aab309a340fa28cef39_Laure_themakers.png` },
  { name: 'Florian Hinze', role: 'Creative Engineer' },
]

// Worldbuilding in practice — from the live About page.
export const PRACTICE: Array<{ n: string; label: string; body: string }> = [
  { n: '01', label: 'Experience Design', body: 'We understand your audience, objectives, and environment.' },
  { n: '02', label: 'System Development', body: 'We define the experience mode, visual identity, and technical setup.' },
  { n: '03', label: 'Technical Production', body: 'We develop the AI models, interaction logic, and visual worlds.' },
  { n: '04', label: 'Strategic Consulting', body: 'We deploy, calibrate, and ensure seamless on-site performance.' },
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
  slug: string
  title: string
  client: string
  cat: Category
  scene: Scene
  media?: WorkMedia
}

function chapter(title: string): HeroChapter {
  const w = WORKS.find((x) => x.title === title)!
  return { code: w.code, slug: w.slug, title: w.title, client: w.client, cat: w.cat, scene: w.scene, media: w.media }
}

export const HERO_CHAPTERS: HeroChapter[] = [
  chapter('Synesthesia'),
  chapter('Hulaween'),
  chapter('1N: EEG Mirror'),
  chapter('Yard Episode'),
]

export const STATS: Array<[string, string]> = [
  ['Makers in the room', '06'],
  ['Main pillars', '02'],
  ['Projects shipped', '31'],
]

export const BUDGET_RANGES = ['< 25k', '25–75k', '75–200k', '200k+', 'trade'] as const
