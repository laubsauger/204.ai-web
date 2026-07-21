# 204 · NO-CONTENT — studio site

Production site for the 204 · NO-CONTENT creative studio, implementing
Direction A "Night Shift" (cinematic noir) from the design prototype in
[`design/`](design/DESIGN.md).

Stack: Vite + React 19 + TypeScript, react-router SPA, CSS Modules,
self-hosted fonts via @fontsource. No backend — fully static.

## Develop

```bash
npm install
npm run dev        # dev server
```

## Build & verify

```bash
npm run build      # typecheck + production build → dist/
npm run lint       # eslint
npm run preview    # serve dist/ locally

# responsive/overflow + per-route title probe (needs Chrome installed,
# and `npm run preview` running on :4573)
npm run preview -- --port 4573 &
node scripts/v6-check.mjs
```

## Deploy

`dist/` is the deployable artifact. SPA fallback is preconfigured:

- **Cloudflare Pages / Netlify** — `public/_redirects` (`/* /index.html 200`)
- **Vercel** — `vercel.json` rewrite

Build command `npm run build`, output directory `dist`.

## Editing content (no code required)

All copy and data live in **`content/*.json`** — edit, commit, push; the
deploy action rebuilds and everything downstream updates automatically:

- `content/works.json` — the project catalog, newest first. Ref codes
  (NC·0XX), URLs (slugs from titles), the ledger count, category filters,
  stats and the sitemap all derive from this list — add a project at the
  top and every one of those updates itself.
- `content/services.json` — the two pillars (`content` / `interactive`),
  including detail-page intros, modes, features and related-work category.
- `content/people.json` — the makers. Social links render only when set
  (instagram / linkedin / web / email). Photo optional (initials fallback).
- `content/studio.json` — site settings: studio name/tag, contact + socials,
  logo URL, hero reel (`heroChapters`: work slugs, in order), work category
  order, budget chips, worldbuilding rows.

`src/data/studio.ts` is the typed schema + derivation layer on top of the
JSON (ids, codes, slugs, stats, hero chapters); components never read the
JSON directly. To bolt on a CMS later, point any headless/git-based CMS
(Decap, Sveltia, Tina, …) at `content/` using these interfaces as the
content model — no app changes needed.

Per-route share meta (OG/Twitter cards) and `sitemap.xml` are generated
from the same JSON at build time by `scripts/generate-meta.mjs`.

## Layout

- `content/*.json` — ALL content (see above)
- `src/data/studio.ts` — typed loader/schema over content/
- `src/components/` — CinematicStill (SVG scene placeholders), Nav, Cursor, Layout
- `src/pages/` — Home, Work, Services, About, Contact, NotFound
- `src/styles/global.css` — design tokens (`:root` CSS vars) + reset
- `design/` — imported claude.ai/design prototype, reference only, never bundled
- `SPEC.md` — project spec (goals, invariants, task ledger)

The `CinematicStill` scenes are intentional placeholders — swap for real
`<video>`/`<img>` footage when available (see `design/DESIGN.md`).
