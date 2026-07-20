// Studio content — verbatim from design/shared.jsx + direction-a.jsx (SPEC §C9).

export type Scene = 'cathedral' | 'desert' | 'interior' | 'water'

export type Category = 'film' | 'motion' | 'identity' | 'interactive'

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
}

export interface Service {
  n: string
  label: string
  scene: Scene
  body: string
}

export interface Person {
  name: string
  role: string
}

export const STUDIO = {
  name: '204',
  suffix: 'NO-CONTENT',
  tag: 'Creative studio for image, motion & interaction',
} as const

export const WORKS: Work[] = [
  { id: 'w01', code: 'NC·001', title: 'Halide Parallax', client: 'Mekano Ltd.', cat: 'film', year: '2025', runtime: '02:14', note: 'Short film identity & end titles.', scene: 'cathedral' },
  { id: 'w02', code: 'NC·002', title: 'Obsidian Bureau', client: 'Obsidian Records', cat: 'identity', year: '2025', runtime: '—', note: 'Record label rebrand, 14 sleeves.', scene: 'interior' },
  { id: 'w03', code: 'NC·003', title: 'Slow Burn', client: 'Atlas Coffee Co.', cat: 'motion', year: '2024', runtime: '00:48', note: 'Six-spot broadcast package.', scene: 'interior' },
  { id: 'w04', code: 'NC·004', title: 'Nightshade OS', client: 'Nightshade Studio', cat: 'interactive', year: '2024', runtime: '—', note: 'Experimental reading interface.', scene: 'water' },
  { id: 'w05', code: 'NC·005', title: 'The Hollow Hour', client: 'Mubi / Aperture', cat: 'film', year: '2024', runtime: '04:02', note: 'Title sequence, 35mm grain.', scene: 'desert' },
  { id: 'w06', code: 'NC·006', title: 'Perforated Sun', client: 'Form & Forge', cat: 'identity', year: '2023', runtime: '—', note: 'Ceramic brand, print system.', scene: 'desert' },
  { id: 'w07', code: 'NC·007', title: 'Undercurrent', client: 'Pier 14 Gallery', cat: 'motion', year: '2023', runtime: '01:20', note: 'Looping gallery wall piece.', scene: 'water' },
  { id: 'w08', code: 'NC·008', title: 'Graphite Bay', client: 'Fieldbook Journal', cat: 'interactive', year: '2023', runtime: '—', note: 'Editorial reading app, issue 04.', scene: 'cathedral' },
]

export const CATEGORIES = ['all', 'film', 'motion', 'identity', 'interactive'] as const

export type CategoryFilter = (typeof CATEGORIES)[number]

export const SERVICES: Service[] = [
  { n: '01', label: 'Direction', scene: 'cathedral', body: 'Art direction and creative leadership on single projects or sustained campaigns. We own the look and defend it.' },
  { n: '02', label: 'Motion & Film', scene: 'desert', body: 'Title sequences, broadcast packages, and short-form film. Shot, composited, graded in-house.' },
  { n: '03', label: 'Identity', scene: 'interior', body: 'Marks, type systems, editorial standards. Built to survive a long shelf life and a loud feed.' },
  { n: '04', label: 'Interaction', scene: 'water', body: 'Interfaces for reading, watching, archiving. We prototype in code, not slides.' },
]

export const PEOPLE: Person[] = [
  { name: 'A. Valverde', role: 'Director' },
  { name: 'M. Koba', role: 'Motion lead' },
  { name: 'J. Lindgren', role: 'Type & print' },
  { name: 'R. Osei', role: 'Interaction' },
  { name: 'F. Marín', role: 'Studio ops' },
]

export const CONTACT = {
  email: 'room@204.nc',
  studio: 'Rua da Rosa 204, Lisboa 1200-385',
  instagram: '@204.nocontent',
  arena: 'are.na/204-nocontent',
} as const

// Home hero chapters — the 4 featured works in reel order (direction-a.jsx PageHome).
export const HERO_CHAPTERS = [
  { code: 'NC·001', title: 'Halide Parallax', client: 'Mekano Ltd.', scene: 'cathedral' },
  { code: 'NC·005', title: 'The Hollow Hour', client: 'Mubi / Aperture', scene: 'desert' },
  { code: 'NC·003', title: 'Slow Burn', client: 'Atlas Coffee Co.', scene: 'interior' },
  { code: 'NC·007', title: 'Undercurrent', client: 'Pier 14 Gallery', scene: 'water' },
] satisfies Array<{ code: string; title: string; client: string; scene: Scene }>

export const STATS: Array<[string, string]> = [
  ['People on payroll', '05'],
  ['Briefs per year', '≤ 12'],
  ['Years in practice', '09'],
]

export const BUDGET_RANGES = ['< 25k', '25–75k', '75–200k', '200k+', 'trade'] as const
