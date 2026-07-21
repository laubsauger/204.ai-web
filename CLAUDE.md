# 204 · NO-CONTENT — site guide for agents

Production site for the 204 creative technology studio (Lisbon). React 19 +
Vite + TS SPA, deployed to GitHub Pages on every push to `main` (workflow in
`.github/workflows/deploy.yml`). Live: https://laubsauger.github.io/204.ai-web/

`SPEC.md` is the project spec — goals (§G), constraints (§C), invariants (§V),
task ledger (§T), bug log (§B). Read it before structural changes; log new
invariant-worthy bugs in §B.

## Content edits (the common job — no code changes needed)

ALL copy/data lives in `content/*.json`. `src/data/studio.ts` is only the
typed schema + derivation layer on top; components never read JSON directly.

- `content/works.json` — project catalog, NEWEST FIRST. Fields per entry:
  title, client, cat (`interactive|mapping|branded|artistic`), year, runtime,
  note (one-liner), scene (`cathedral|desert|interior|water` — placeholder art
  fallback), optional: media {still, video{webm,mp4}}, body (longform),
  youtube [ids], gallery [urls].
- `content/services.json` — pillars `content` + `interactive`; per service:
  n, label, scene, body, optional still/video/intro/modes/features/relatedCat.
- `content/people.json` — makers: name, role, optional photo/bio/socials
  {instagram, linkedin, web, email} — only set links render.
- `content/studio.json` — site settings: name/tag, contact, logoUrl,
  heroChapters (work SLUGS, reel order), workCategories (filter order),
  budgetRanges, practice rows, pillarsCount.

DERIVED — never write these by hand: ids, NC ref codes (position-based,
newest = highest), slugs (from title), ledger count, category filters, about
stats, per-route share meta, sitemap. Add/edit JSON → everything follows on
build.

Recipes:
- New project → prepend (or insert chronologically) in works.json. Codes
  renumber automatically; that is expected and fine.
- Feature it on the home reel → add its slug to studio.json heroChapters.
- New maker → append to people.json (photo optional — initials fallback).
- Facts only: content comes from the studio's real material. Never invent
  clients, dates or claims. Unknown = "—".

## Verify before pushing

```bash
npm run build   # tsc + vite + generate-meta (50+ static routes, must exit 0)
npm run lint
npm run preview -- --port 4573 &
node scripts/v6-check.mjs        # overflow + per-route titles at 4 widths
node scripts/player-probe.mjs    # hero player behavior (needs local Chrome)
```

For layout/CSS work, screenshot-verify with puppeteer-core + system Chrome
(pattern used throughout: launch headless, measure getBoundingClientRect,
screenshot). Keep the home fold: hero + strap + CTA above 1080p fold.

## Conventions & landmines

- Design system: Night Shift (cinematic noir). Tokens once in
  `src/styles/global.css` `:root` — never re-hardcode hex (SPEC V2).
  Type: Archivo Black display / Space Grotesk body / JetBrains Mono labels /
  Instrument Serif accents. Display tracking is `-0.02px`, NOT em (§B3).
- `design/` = imported claude.ai/design prototype + Webflow scrape snapshot
  (`design/scrape/extracted.json`). Read-only reference; never imported by
  app code (SPEC V9).
- Media is HOTLINKED from the Webflow CDN for now (SPEC V4 temp exception).
  Non-hero stills use `-p-800` renditions with onError fallback. Self-host
  once the redesign is approved.
- Animations: transform/opacity only, gated behind
  `prefers-reduced-motion: no-preference`. Entrance choreography: h1 is the
  only riser; media fades w/ scale-settle; secondary fades late; pagers wipe
  directionally. `<main>` has `overflow: clip` — transformed entrances must
  not grow the scrollable area (§B: scrollbar flash).
- Ref-callback gotcha: callbacks feeding player state must be identity-stable
  (memoized) — React 19 reruns ref cleanup on identity change (§B5).
  `<video>` needs `key={src}` to actually switch footage; mp4 before webm
  (Webflow webm reports Infinity duration).
- Titles: pages pass bare names; `useHead` + `scripts/generate-meta.mjs`
  apply the single brand rule (detail pages add `· Work/Service/Maker`).
  Keep BOTH in sync — same for the slugify/code mirror in generate-meta.
- Analytics: GA4 `G-E2HCBBXBVP` (same property as the old Webflow site).
  Track via `src/lib/analytics.ts` only; keep event names stable.
- GH Pages: deep links are real files (generate-meta) → 301 to trailing
  slash → 200. `VITE_BASE`/`SITE_URL` env drive base path + canonical/sitemap;
  when the real domain lands, update both in the deploy workflow.

## Don'ts

- Don't edit `SPEC.md` §T/§B casually — status flips and bug rows only, with
  the work they describe.
- Don't add runtime third-party requests beyond the documented exceptions
  (CDN media, GA4, click-to-load youtube/OSM).
- Don't break URLs: slugs derive from titles — renaming a title changes its
  URL. If a live title must change, discuss redirects first.
