# SPEC — 204 · NO-CONTENT studio site

## §G goal
Ship production static site for studio "204 · NO-CONTENT". Implement design/ Direction A "Night Shift" (cinematic noir) 1:1 in look/feel, but proper multi-file app: build tooling, components, routes, responsive, deployable anywhere static.

## §C constraints
- C1: stack = Vite + React 19 + TypeScript. SPA + react-router. No SSR framework.
- C2: no Babel-in-browser. No CDN react dev builds. All deps bundled.
- C3: fonts self-hosted via @fontsource: Archivo Black, Space Grotesk, JetBrains Mono, Instrument Serif. No runtime Google Fonts request.
- C4: design tokens fixed: bg `#0a0a0a`, fg `#ececec`, dim `rgba(236,236,236,0.55)`, hairline `rgba(236,236,236,0.14)`, accent `#c9442b`. Single source: CSS custom props.
- C5: `design/` = read-only reference (prototype). Never imported by app code. Excluded from build.
- C6: deploy target = any static host (CF Pages / Netlify / Vercel). SPA fallback config included.
- C7: prototype is fixed 1280×820 artboard → production must be responsive. Desktop = design fidelity; ≤768px = adapted layout, no horizontal scroll.
- C8: contact form client-side only (no backend). Submit → success state, same as prototype. mailto fallback link.
- C9: content (works, services, people, copy) verbatim from design/shared.jsx + direction-a.jsx. One data module. SUPERSEDED by C10 for real content.
- C10: real content source = 204-no-content.webflow.io scrape (snapshot design/scrape/extracted.json). Copy ADAPTED into Night Shift voice — inform, don't transplant; no invented facts. Design/layout unchanged.

## §I interfaces
- I.routes: `/` home, `/work`, `/services`, `/about`, `/contact`, `*` → 404.
- I.build: `npm run dev`, `npm run build` (tsc + vite build → dist/), `npm run preview`, `npm run lint`.
- I.deploy: `dist/` output. SPA rewrite: `public/_redirects` (`/* /index.html 200`) + `vercel.json` rewrite.
- I.seo: per-route `<title>` + meta description via route head hook. `index.html` base meta + og tags. `robots.txt`.

## §V invariants
- V1: prod bundle contains zero references to unpkg/babel-standalone/react.development. `grep -r "unpkg\|babel" dist/assets` → empty.
- V2: token values in code match §C4 exactly; defined once in `:root` CSS vars; components reference vars, never re-hardcode hex (exception: SVG scene art inside CinematicStill).
- V3: all 5 routes deep-linkable: direct URL load renders correct page (SPA fallback).
- V4: fonts + app code self-hosted, no third-party JS/CSS at runtime. TEMP exception (until redesign approved, then self-host): project media (img/video) may hotlink cdn.prod.website-files.com; youtube embeds allowed on demand-load.
- V5: `npm run build` exits 0 with zero TS errors. `npm run lint` exits 0.
- V6: no horizontal overflow at 360px, 768px, 1280px, 1920px viewport widths.
- V7: rAF/interval animations (CinematicStill, hover preview timecode) gated by `prefers-reduced-motion: reduce` → static frame.
- V8: custom cursor active only on `(pointer: fine)`; touch devices keep native cursor + hover-preview features degrade gracefully (no hover trap).
- V9: app code never imports from `design/`; `design/` not in tsconfig include, not in vite root scan.
- V10: every route sets unique title + meta description on navigation.
- V11: floating overlays (work hover preview) stay fully inside viewport; never extend document scroll height or sit under fixed nav.
- V12: display type + hero scale fluidly past 1280 (vw-based clamps, caps ≈1.5× design size); display tracking = prototype value `-0.02px` (NOT em).
- V13: content constrained to max 1720px centered shell on wide screens; nav bar full-bleed w/ inner capped; nav/labels/chapter type fluid (no fixed tiny px on hidpi).

## §T tasks
id|status|desc|cites
T1|x|scaffold: vite react-ts, eslint, @fontsource pkgs, folder layout (src/components src/pages src/data src/styles), _redirects+vercel.json, robots.txt|C1,C2,C3,C6,I.build,I.deploy
T2|x|global styles: CSS reset, :root tokens, font-face imports, type scale helpers (display/mono/serif classes), grain overlay util|C3,C4,V2
T3|x|data module src/data/studio.ts: STUDIO, WORKS, CATEGORIES, SERVICES, PEOPLE, CONTACT_INFO typed from design/shared.jsx + copy from direction-a.jsx|C9
T4|x|CinematicStill component: 4 SVG scenes (cathedral/desert/interior/water), mini + playing (Ken Burns) modes, grain, letterbox, reduced-motion gate|C9,V7
T5|x|app shell: router setup, Layout w/ NavA (logo, nav links, booking status), custom cursor (pointer:fine), route head hook for title/meta, 404 page|I.routes,I.seo,V3,V8,V10
T6|x|Home page: hero player 16:9 + chapter rail, big type strap, intro copy, CTA → /work|C9,C7
T7|x|Work page: category filter, ledger table w/ per-row scene bg, hover preview card (autoplay still + timecode), mobile = card list|C7,C9
T8|x|Services page: 4 service cards w/ scene bg + hover, footer strip (rates/NDA/briefs)|C9
T9|x|About page: colophon display type, stats, team list, hiring box|C9
T10|x|Contact page: info grid + brief intake form (name/org/budget chips/three-lines textarea) → client-side sent state|C8,C9
T11|x|responsive pass: nav collapse, hero stack, type clamp(), work table→cards, grids→1col; verify V6 widths|C7,V6
T12|x|verify: build+lint clean, V1 grep, route deep-links via preview server, no external requests, README (run/build/deploy)|V1,V3,V4,V5
T13|x|persist scrape snapshot design/scrape/extracted.json + note in DESIGN.md|C10
T14|x|real data swap src/data/studio.ts: curated 12 works (both pillars, cat= branded/artistic/mapping/interactive), 8 services (4 content + 4 interactive products), team 5 makers, contact (Hello@204.ai, RnA Studio Lisboa, IG/LinkedIn), stats, hero chapters|C10
T15|x|brand + media wiring: real 204 logo in nav (hotlink), adapted copy (strap HUMAN FIRST—AI AS TOOL, about= creative tech studio + RnA box replaces hiring box, services intro), real stills/videos in hero chapters + work hover cards, CinematicStill fallback|C10,V4,V12
T16|x|verify: build+lint, V6 rerun, screenshots desktop+mobile, V1 grep|V1,V5,V6
T17|x|full catalog: all 31 scraped projects in ledger, codes reversed (highest=newest), posters where available|C10
T18|x|wide-screen pass: 1720px shell, nav/chapter/label scale-up, strap redesign (no em dash), wider intro, cursor-anchored hover preview, /work header merged (label+count, no LEDGER slab), chapter category tags|V11,V13,C7
T19|x|SEO pass: og:image, JSON-LD Organization, noscript fallback, semantic h1 audit; sitemap deferred until final domain|I.seo

## §B bugs
id|date|cause|fix
B1|2026-07-20|work hover preview absolute w/o viewport clamp → clipped bottom + grew doc scroll|V11 + useLayoutEffect clamp
B2|2026-07-20|nav status lines not optically flush right (block/text-align)|flex column + flex-end, cosmetic
B3|2026-07-20|t-display tracking -0.02em (prototype = -0.02px ≈ none) + fixed 1280-design px caps → tiny type + dead space on large/hidpi screens|V12 + fluid clamps
B4|2026-07-20|home not composed to viewport: fixed-height hero + oversized strap pushed CTA below fold on FHD; fixed-width chapter thumbs forced rail taller than hero (last item clipped); nav divider floating|hero flex-fills 100dvh-composed root, strap 6.2vw, thumbs derive width from row height, status divider stretched
B5|2026-07-20|hero player state frozen at 0: inline ref arrow on <video> changed identity every render → React 19 ran ref cleanup + re-invoked host bindVideo, resetting progress/timecode state on each timeupdate render; also <source> swaps don't reload video (chapter switch kept old footage) and webm transcodes report Infinity duration|memoized merged ref, key video by src, mp4-first sources
