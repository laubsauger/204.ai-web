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
- C9: content (works, services, people, copy) verbatim from design/shared.jsx + direction-a.jsx. One data module.

## §I interfaces
- I.routes: `/` home, `/work`, `/services`, `/about`, `/contact`, `*` → 404.
- I.build: `npm run dev`, `npm run build` (tsc + vite build → dist/), `npm run preview`, `npm run lint`.
- I.deploy: `dist/` output. SPA rewrite: `public/_redirects` (`/* /index.html 200`) + `vercel.json` rewrite.
- I.seo: per-route `<title>` + meta description via route head hook. `index.html` base meta + og tags. `robots.txt`.

## §V invariants
- V1: prod bundle contains zero references to unpkg/babel-standalone/react.development. `grep -r "unpkg\|babel" dist/assets` → empty.
- V2: token values in code match §C4 exactly; defined once in `:root` CSS vars; components reference vars, never re-hardcode hex (exception: SVG scene art inside CinematicStill).
- V3: all 5 routes deep-linkable: direct URL load renders correct page (SPA fallback).
- V4: no external network requests at runtime except none — fonts/assets all same-origin.
- V5: `npm run build` exits 0 with zero TS errors. `npm run lint` exits 0.
- V6: no horizontal overflow at 360px, 768px, 1280px, 1920px viewport widths.
- V7: rAF/interval animations (CinematicStill, hover preview timecode) gated by `prefers-reduced-motion: reduce` → static frame.
- V8: custom cursor active only on `(pointer: fine)`; touch devices keep native cursor + hover-preview features degrade gracefully (no hover trap).
- V9: app code never imports from `design/`; `design/` not in tsconfig include, not in vite root scan.
- V10: every route sets unique title + meta description on navigation.

## §T tasks
id|status|desc|cites
T1|x|scaffold: vite react-ts, eslint, @fontsource pkgs, folder layout (src/components src/pages src/data src/styles), _redirects+vercel.json, robots.txt|C1,C2,C3,C6,I.build,I.deploy
T2|x|global styles: CSS reset, :root tokens, font-face imports, type scale helpers (display/mono/serif classes), grain overlay util|C3,C4,V2
T3|x|data module src/data/studio.ts: STUDIO, WORKS, CATEGORIES, SERVICES, PEOPLE, CONTACT_INFO typed from design/shared.jsx + copy from direction-a.jsx|C9
T4|.|CinematicStill component: 4 SVG scenes (cathedral/desert/interior/water), mini + playing (Ken Burns) modes, grain, letterbox, reduced-motion gate|C9,V7
T5|.|app shell: router setup, Layout w/ NavA (logo, nav links, booking status), custom cursor (pointer:fine), route head hook for title/meta, 404 page|I.routes,I.seo,V3,V8,V10
T6|.|Home page: hero player 16:9 + chapter rail, big type strap, intro copy, CTA → /work|C9,C7
T7|.|Work page: category filter, ledger table w/ per-row scene bg, hover preview card (autoplay still + timecode), mobile = card list|C7,C9
T8|.|Services page: 4 service cards w/ scene bg + hover, footer strip (rates/NDA/briefs)|C9
T9|.|About page: colophon display type, stats, team list, hiring box|C9
T10|.|Contact page: info grid + brief intake form (name/org/budget chips/three-lines textarea) → client-side sent state|C8,C9
T11|.|responsive pass: nav collapse, hero stack, type clamp(), work table→cards, grids→1col; verify V6 widths|C7,V6
T12|.|verify: build+lint clean, V1 grep, route deep-links via preview server, no external requests, README (run/build/deploy)|V1,V3,V4,V5

## §B bugs
id|date|cause|fix
