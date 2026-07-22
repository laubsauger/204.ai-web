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
- C8: contact form client-side only (no backend). Submit → success state, same as prototype. mailto fallback link. SUPERSEDED by C15.
- C9: content (works, services, people, copy) verbatim from design/shared.jsx + direction-a.jsx. One data module. SUPERSEDED by C10 for real content.
- C11: content lives in content/*.json (works/services/people/studio) — code carries no copy. src/data/studio.ts = typed schema + derivations (ids, NC codes, slugs, stats, hero chapters, categories); scripts/generate-meta.mjs reads the same JSON for share meta + sitemap. CMS later = point it at content/.
- C10: real content source = 204-no-content.webflow.io scrape (snapshot design/scrape/extracted.json). Copy ADAPTED into Night Shift voice — inform, don't transplant; no invented facts. Design/layout unchanged.
- C12: media self-hosted in repo `public/media/`, committed plain git (no LFS). One-time pipeline `scripts/media-pipeline.mjs` (sharp + ffmpeg, local-only, ⊥ in CI deploy path): imgs → webp site renditions (full ≤1920w + `-p-800`) & jpg `-p-800` for og/share; video → single H.264 mp4 (1080p cap, CRF web-tuned), webm dropped (B5: Infinity duration). Originals cached `media-src/` (gitignored).
- C14: organism bg (liquid WebGPU creature): PROD-GATED — `VITE_ORGANISM=off` in all CI builds until explicit user go (2026-07-21); dev + lab only. three/webgpu + TSL, three version PINNED exact. WebGPU-ONLY — no WebGL fallback (user call 2026-07-21); `navigator.gpu` absent → feature fully disabled, site renders as today. Lazy chunk, loaded post-idle, ⊥ in entry bundle. Fixed bg layer in Layout: z 0, pointer-events none; content z 1. Obstacles = opt-in `data-organism-obstacle` elements only. First pass = pure-white silhouette (fill #fff, opacity 0.96, edge AA via fwidth), no bloom/glow/shading. Sim = fixed timestep PBD skeleton (core+attention+5 appendages×6 joints ≈32 particles); obstacle SDF via jump-flood compute; A* nav grid 64×36 on demand.
- C13: Firebase project `studio204-web` (display "204 · NO-CONTENT"), Blaze billing. Hosting = primary deploy → https://studio204-web.web.app, base `/`, canonical. GH Pages stays live secondary until custom domain cutover. Both deploy jobs in same workflow, both ! green.
- C15: contact form → real backend (supersedes C8). Brief intake = Cloud Function `brief` (functions/index.js, europe-west1, Gen2). Delivery = email to hello@204.ai via Trigger Email ext (`mail` collection = ext queue, ⊥ human-read); Firestore `briefs` = bounce backstop only, no UI ever. Client: VITE_FORM_ENDPOINT set → fetch POST JSON w/ states sending/sent/error + retry + mailto fallback on error; unset → mailto path (pre-C15 behavior). reCAPTCHA ENTERPRISE invisible score-based (google rec, no checkbox; key provisioned 2026-07-22), script `enterprise.js` inject ONLY on first form focus (click-to-load pattern), badge hidden + inline attribution. PENDING user setup: fn SA iam role, fn deploy, ext install, workflow env.

## §I interfaces
- I.routes: `/` home, `/work`, `/work/:slug` detail, `/services`, `/services/:slug` detail, `/about`, `/contact`, `*` → 404.
- I.build: `npm run dev`, `npm run build` (tsc + vite build → dist/), `npm run preview`, `npm run lint`.
- I.deploy: `dist/` output. SPA rewrite: `public/_redirects` (`/* /index.html 200`) + `vercel.json` rewrite.
- I.seo: per-route `<title>` + meta description via route head hook. `index.html` base meta + og tags. `robots.txt`.
- I.firebase: `firebase.json` (hosting: public=dist, SPA rewrite → /index.html, per-path Cache-Control headers), `.firebaserc` (default=studio204-web). CI deploy: FirebaseExtended/action-hosting-deploy w/ repo secret `FIREBASE_SERVICE_ACCOUNT_STUDIO204_WEB` (service acct JSON). Local: `firebase deploy --only hosting`.
- I.organism: `src/organism/` module (OrganismBackground/Controller/Simulation/Renderer/Parameters/DebugPanel + obstacle/ navigation/ simulation/ shaders/ math/ per handoff §5). Typed `OrganismConfig` central — no scattered magic numbers. DOM contract: `data-organism-obstacle` + `data-organism-padding|weight|allow-tendrils|hidden`. Capabilities: `{backend: 'webgpu'|'none', computeSupported, quality}`. Debug views (mask/sdf/skeleton/field/contacts) dev-only, stripped from prod. Coordinate converters viewportPx↔simulation↔obstacleUv unit-tested.
- I.brief: POST JSON `{name,org,email,budget,scope,website,token}` → fn `brief`; 2xx `{ok:true}` = delivered; 4xx/5xx → client error state. `website` = honeypot (filled → fake 200, drop). Env: client `VITE_FORM_ENDPOINT` + `VITE_RECAPTCHA_SITE_KEY` (public, .env.local + deploy.yml); server `RECAPTCHA_SITE_KEY` + `BRIEF_TO` (functions/.env, uploaded by fn deploy) — NO secret anywhere: enterprise assessment auth = fn service acct ADC (needs roles/recaptchaenterprise.agent). Files: functions/{index.js,package.json,README.md}, firestore.rules, firebase.json functions+firestore blocks. Deploy: `firebase deploy --only functions,firestore`.
- I.media: `scripts/media-pipeline.mjs` — scan content/*.json + src/index.html/scripts for cdn.prod.website-files.com urls → fetch originals → media-src/ → optimize → public/media/ + write url→path manifest → rewrite refs. Idempotent, rerun-safe.

## §V invariants
- V1: prod bundle contains zero references to unpkg/babel-standalone/react.development. `grep -r "unpkg\|babel" dist/assets` → empty.
- V2: token values in code match §C4 exactly; defined once in `:root` CSS vars; components reference vars, never re-hardcode hex (exception: SVG scene art inside CinematicStill).
- V3: all 5 routes deep-linkable: direct URL load renders correct page (SPA fallback).
- V4: fonts + app code + media ALL self-hosted, no third-party runtime requests except: GA4 gtag.js (G-E2HCBBXBVP, explicit request), click-to-load youtube + OSM tiles, brief POST → fn (C15) & recaptcha script — interaction-gated, injected on first form focus only, never page load. `grep -rl "website-files" src content index.html scripts dist` → only scripts/media-pipeline.mjs (migration tool scan regex; design/ scrape snapshot also exempt, read-only ref).
- V5: `npm run build` exits 0 with zero TS errors. `npm run lint` exits 0.
- V6: no horizontal overflow at 360px, 768px, 1280px, 1920px viewport widths.
- V7: rAF/interval animations (CinematicStill, hover preview timecode) gated by `prefers-reduced-motion: reduce` → static frame.
- V8: custom cursor active only on `(pointer: fine)`; touch devices keep native cursor + hover-preview features degrade gracefully (no hover trap).
- V9: app code never imports from `design/`; `design/` not in tsconfig include, not in vite root scan.
- V10: every route sets unique title + meta description on navigation.
- V11: floating overlays (work hover preview) stay fully inside viewport; never extend document scroll height or sit under fixed nav.
- V12: display type + hero scale fluidly past 1280 (vw-based clamps, caps ≈1.5× design size); display tracking = prototype value `-0.02px` (NOT em).
- V13: content constrained to max 1720px centered shell on wide screens; nav bar full-bleed w/ inner capped; nav/labels/chapter type fluid (no fixed tiny px on hidpi).
- V14: ∀ /media/** response → `Cache-Control: public, max-age=31536000, immutable`; hashed /assets/** same; index.html + generated route HTML → no-cache/short. Content change → new filename (⊥ edit in place under same name).
- V15: media weight budget: public/media total ≤ 80MB; ∀ video ≤ 40MB (quality > squeeze, user call 2026-07-21); ∀ img file ≤ 2MB; ∀ site-rendered img ≤ 500KB @ used rendition.
- V17: organism canvas ⊥ intercepts pointer events; core ⊥ enters hard obstacle regions; UI text readability preserved (content above, opt-in obstacles protect marked elements).
- V18: organism = separate lazy chunk, entry bundle unchanged; no WebGPU → zero runtime cost beyond capability check; V5/V6 hold w/ feature on & off.
- V19: organism sim fixed-timestep + interpolation (frame-rate independent, no explosion after tab restore); reduced-motion → feature fully disabled, no special mode (user call 2026-07-21, extends V7); no per-frame DOM layout reads on static pages; no GPU→CPU readback in loop.
- V16: dual deploy: GH Pages build (VITE_BASE=/204.ai-web/) & Firebase build (base /) both exit 0; canonical + sitemap urls → Firebase (SITE_URL=https://studio204-web.web.app) until domain cutover.
- V20: brief fn abuse posture holds: origin allowlist (403), honeypot drop, rate limits 5/hr/IP + 200/day (429), payload ≤8KB, maxInstances=1 (bill ceiling), captcha = enterprise assessment server-side when RECAPTCHA_SITE_KEY set (valid + action `brief` + score ≥0.5, fail closed; assessments ≤~6k/mo via rate caps → inside 10k free tier). Firestore rules = deny ALL client access (admin SDK only). Secrets: NONE in pipeline (enterprise = ADC auth, no secret key exists); `git check-ignore` ! pass for .env* + functions/.env + .firebase/ regardless; site key + fn url = public, allowed anywhere.

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
T23|x|content architecture: extract all data to content/*.json, studio.ts becomes typed loader w/ derived fields, stats/sitemap/meta/counts auto-update from content edits, README editing guide|C11
T22|x|share meta + analytics: og/twitter tags per route (client via useHead + static per-route HTML at build for non-JS scrapers → also fixes GH Pages deep-link 404), sitemap.xml (SITE_URL env), GA4 wired to existing property w/ SPA page_views + named events (cta_click, generate_lead, select_chapter, reel_play_toggle, video_open, map_load, social_click, filter_work)|I.seo,V10
T21|x|service detail pages /services/:slug: cards click through (READ MORE affordance), product loop hero video, modes list, feature grid, related-work links by category, prev/next pager, 404 on unknown slug; copy from scraped product pages|I.routes,C10,V10
T20|x|work detail pages /work/:slug: ledger rows click through; hero media, meta grid, longform copy (scraped where available), click-to-load youtube (RUBr/Venom), photo gallery (Hulaween/1N), prev/next nav, unknown slug → 404|I.routes,C10,V4,V10
T24|x|Firebase bootstrap (interactive w/ user): firebase login, projects:create studio204-web + display name, verify Blaze billing link, firebase.json + .firebaserc, local `firebase deploy --only hosting` smoke → studio204-web.web.app live|C13,I.firebase
T25|x|media pipeline scripts/media-pipeline.mjs: url scan → fetch → media-src/ → sharp (webp full+800, jpg -p-800 og) + ffmpeg (mp4 1080p CRF, drop webm) → public/media/ + manifest; report per-file before/after sizes|C12,I.media,V15
T26|x|ref rewrite: content/*.json media urls → /media/..., logo (index.html + useHead + generate-meta), -p-800 helpers → local paths (src/lib/media.ts, useHead.ts, generate-meta.mjs), drop cdn preconnect/dns-prefetch, video entries mp4-only|C12,V4
T27|x|firebase.json headers: /media/** + /assets/** immutable 1y, html no-cache; SPA rewrite; verify w/ curl -I on deployed site|I.firebase,V14
T28|x|CI: add Firebase deploy job (action-hosting-deploy, service acct secret) alongside GH Pages job; Firebase build base=/ SITE_URL=studio204-web.web.app, canonical/sitemap → Firebase|C13,I.firebase,V16
T30|x|rendition right-sizing (Lighthouse ~307KB): pipeline +`-p-160`/`-p-320`; partner/nav logos 500→320, maker avatars full→160 eager, MediaStill responsive srcset/sizes (thumb 320, letterbox 800w/1920w pair mirrored in generate-meta preload imagesrcset)|C12,V15
T31|x|organism M1 canvas+capability: fullscreen canvas in Layout, WebGPURenderer init (webgpu-only, navigator.gpu gate), resize, fixed render loop, blank TSL pass, HMR-safe dispose, lazy mount post-idle|C14,I.organism,V17,V18
T32|x|organism M2 obstacle mask: data-attr collection (ResizeObserver+scroll+invalidate, dirty-flag), canvas rasterize hard/comfort/weight/tendril channels @256w, coord converters + unit tests, debug mask view|C14,I.organism,V19
T33|x|organism M3 obstacle SDF: jump-flood compute (seed→ping-pong→resolve→gradient), storage textures, verify alignment vs DOM, debug sdf/gradient views|C14,I.organism
T34|x|organism M4 static creature field: TSL implicit field — anisotropic torso + lobes, 5 curved tapered limbs (capsule chains, smooth union w/ varied softness), crease/concavity, fwidth AA white silhouette, skeleton debug|C14
T35|x|organism M5 simulation: fixed-timestep PBD (segment/bend/cohesion/volume constraints, 6 iter), interpolation, damping, pause/resume stable|C14,V19
T36|~|organism M6 obstacle contact: SDF sampling @ joints/tips/core+predicted, soft repulsion + hard projection, tangential slide, contact debug, no clipping|C14,V17
T37|~|organism M7 pointer attention: smoothed pointer state, attention vs body targets, dead zones, observe behavior, no direct following|C14
T38|x|organism M8 navigation: 64×36 cost grid, A* on-demand (⊥ per frame), route smoothing, unreachable → nearest point + 1-2 SNIFF tendrils (boundary-crawl: tangent step + SDF snap-back, per-tendril seed, subtle grasp — user 2026-07-21) + withdraw|C14
T39|x|organism M9 locomotion+idle: anchor cycle crawl, state machine (Rest/Observe/Reach/Crawl/Brace/Settle/Withdraw w/ hysteresis), breathing 4-9s, gestures 4-14s seeded|C14,V19
T41|~|organism IK walker rewrite (Smitner-informed, user repo 2026-07-21): kinematic FABRIK limbs + explicit foot targets + swing arcs + traveling perpendicular waves; DONE core rewrite; OPEN: mid-stride equilibrium stall (feet planted slightly ahead — neither stretched nor behind → no release trigger; fix = stagnation-timer release within pursue), gait cadence tuning, wave amp/freq taste pass|C14,V19
T42|~|organism aesthetic punch list: interior depth + mottled structure DONE (§35 partial); tip glow + aura + hot core DONE; remaining §35 items: contact-pressure highlights, persistent advected folds, branching micro-tendrils; webbing balance + silhouette review w/ user|C14
T43|.|organism locomotion punch list: face→floor corner transitions (parks at face edges), walk-vs-fly balance (still glides too easily), leg bunching re-verify under IK, jump frequency taste|C14,V19
T44|x|slime run game sandbox (organism-game.html, lab exercise, NEVER ships to site): cursor-steered, pellets grow the body via setCreatureScale — reach/jump range scale up, nav clearance closes the squeeze corridor (verified: gap open @1×, blocked @2×)|C14,V19
T40|x|organism M10 polish (quality tiers via deviceMemory, dev CPU profiling log, debug DEV-gated; reduced-motion=disabled): quality modes high/balanced/low, profiling (≤3ms GPU target), param tuning, debug stripped from prod (reduced-motion = disabled, no extra mode)|C14,V18,V19
T29|x|verify sprint: build+lint, V4 grep empty, V6 rerun, player-probe, V15 size audit, curl header check both hosts, both deploys green|V4,V5,V6,V14,V15,V16
T45|~|brief intake backend: client wiring (states/honeypot/lazy recaptcha) + fn (guards/firestore/mail mirror) + deny-all rules DONE, emulator-verified (CORS 204, origin 403, email 400, honeypot fake-200, captcha 403, 6th req 429); enterprise migration DONE (key live, fail-closed verified); OPEN (user): fn SA iam role (README cmd), fn+rules deploy, Trigger Email ext, VITE_FORM_ENDPOINT+VITE_RECAPTCHA_SITE_KEY in deploy.yml, e2e test brief|C15,I.brief,V4,V20

## §B bugs
id|date|cause|fix
B1|2026-07-20|work hover preview absolute w/o viewport clamp → clipped bottom + grew doc scroll|V11 + useLayoutEffect clamp
B2|2026-07-20|nav status lines not optically flush right (block/text-align)|flex column + flex-end, cosmetic
B3|2026-07-20|t-display tracking -0.02em (prototype = -0.02px ≈ none) + fixed 1280-design px caps → tiny type + dead space on large/hidpi screens|V12 + fluid clamps
B4|2026-07-20|home not composed to viewport: fixed-height hero + oversized strap pushed CTA below fold on FHD; fixed-width chapter thumbs forced rail taller than hero (last item clipped); nav divider floating|hero flex-fills 100dvh-composed root, strap 6.2vw, thumbs derive width from row height, status divider stretched
B24|2026-07-22|ceiling shuffle: A* open list w/o dedupe exploded past 2000 safety cap in off-shell frontiers → abort → straight-line [goal] fallback; LOS smoothing then collapsed even valid wall routes into one far mid-air waypoint; decide() jumped to that waypoint (far carrot) → travelDir projected on ceiling tangent flip-flopped|open-list dedupe (inOpen flags, cap n); shellCut smoothing (shortcuts must stay near shell); decide() interpolates within segments to exact 0.28 arc
B23|2026-07-22|"glass fence" standoff at obstacle contact: 16px data-organism-padding baked into mask hard channel → GPU cut plane 16px off the visible edge; wide smax blend (R*0.22) + press highlight smeared a half-tone wall there|hard channel rasterized at true geometry (pad 0 — solver/nav keep padded analytic copies); cut k → R*0.09; press highlight retired
B22|2026-07-22|core walk displacement zeroed by oversized dither deadband (0.0035·dt·60 ≈ 3× max step) → creature drifted on hover forces only, frantic in-place stepping|deadband = maxStep·0.12; back-drift component stripped fully instead
B21|2026-07-21|single joints flew 0.83 from core: extension guard glued root AFTER capping links (chain stranded) and later systems re-violated it; legs aimed at angular slots into open space instead of the ground|enforceChainIntegrity(): root first, root→tip caps, runs as the LAST position op each step (whip worst 0.12 ≤ 0.15 bound); free legs arc toward their projected footfall
B20|2026-07-21|breakdance at rest: parked-in-pursue (goal unreachable-closer) kept gait-releasing feet every 0.45s vs swaying body; planted mids double-driven (bridge target vs constraint solver = limit cycle); reachableTowards 1/8-ray quantization hopped free-limb targets|Withdraw-lite: stalled pursue (no progress 2.5s) → settle, feet freeze (0 releases/8s verified); planted chains constraint-only + render-side cosmetic snake; per-joint target low-pass
B19|2026-07-21|corner yoink: jump arcs assigned AFTER constraint solve → sanctioned pass-through obstacles (press-cut hid the body inside); chain links straddled corners between projected joints|arc-clear precheck before any jump + in-flight hard projection + segment-midpoint solidity pass; verified 4-side hammer test, worst penetration 0.006
B18|2026-07-21|no-plant tether vs rotating far-field normal formed a stable ORBIT attractor (core cycling r≈9 around viewport) once flung out; jump landings could target off-page points|§24 hard guarantees: core clamped to page neighborhood + 2%-viewport per-step displacement cap + jump landing sanity check
B17|2026-07-21|plant LOS check sampled the ON-boundary endpoint w/ core clearance → every healthy plant failed → silent per-frame release/replant churn (foot jitter) + mid-churn corner bridges press-cut into floating pads|bridgeClear(): interior samples, obstacle-only distance, tip-scale clearance; plants accepted only w/ clear bridge; footfalls offset out by tip radius
B16|2026-07-21|browser scroll-restore fired a phantom page-shift on frame 1 → creature streaked across the whole screen on load|lazy lastScrollY init; shiftPageY also shifts render-lerp state
B15|2026-07-21|load smear: spawn pose radial → on-screen morph into role pose read as stretched caramel ~1.5s|spawn directly in walker/upper role pose + 150-step prewarm before first rendered frame
B14|2026-07-21|planted tip pinned across obstacle while body ejected opposite side → limb bridged THROUGH box (stagger gate blocked emergency release); also intention target snapped on LOS loss|forced release >1.3× stretch; smoothed intention target (0.55s half-life); no-flight shell locomotion
B13|2026-07-21|lockfile drift recurrence (proxy-agent@8.0.2 missing): local npm 11 writes lockfiles CI npm 10 (node 22) rejects → both organism pushes failed deploy|CI node 22→24 (npm 11 parity, node 24 = LTS); organism additionally gated VITE_ORGANISM=off in prod until user go
B12|2026-07-21|route-split chunks fetch on first nav click → body blank ~0.5s, nav feels sluggish|App idle-warms all route chunks post-mount (requestIdleCallback, timeout 3s)
B11|2026-07-21|pipeline rerun after --rewrite found 0 CDN urls (refs now local) → wrote empty manifest, clobbered url→path map|manifest merged not overwritten + url list sourced from prior manifest; restored from git
B10|2026-07-21|home .root min-height 100dvh but hero max-height caps at 33vw → medium-width tall windows left dead gap before logos section|@media (max-aspect-ratio: 8/5) releases composition
B9|2026-07-21|About maker avatars: lazy 44px imgs under grayscale filter skip first paint in Chromium until repaint (hover)|eager + -p-160 rendition + translateZ(0) layer
B8|2026-07-21|mobile reel stuck: MediaStill gates video ≤900px (LCP) but Home hasVideo didn't → waited for video events that never came; no progress/auto-advance (pre-existing since mobile LCP pass)|Home mirrors smallScreen gate → still-timer drives mobile
B7|2026-07-21|player-probe.mjs selector `button[class*=chapter]` vs actual `<div role="button">` markup → probe crashed on chapter-switch step, hero verification silently unusable (pre-existing, surfaced by T29 rerun)|selector → `[role="button"][class*=chapter]`
B6|2026-07-21|long-form video (Yards reel 2.4min) 36.5MB @ 1080p/CRF23 tripped orig 15MB cap; user: quality > squeeze|V15 relaxed → video ≤ 40MB; ladder (1080p23→720p26→720p28→540p30) only if > 38MB
B5|2026-07-20|hero player state frozen at 0: inline ref arrow on <video> changed identity every render → React 19 ran ref cleanup + re-invoked host bindVideo, resetting progress/timecode state on each timeupdate render; also <source> swaps don't reload video (chapter switch kept old footage) and webm transcodes report Infinity duration|memoized merged ref, key video by src, mp4-first sources
