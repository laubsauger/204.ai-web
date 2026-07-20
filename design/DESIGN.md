# 204 · NO-CONTENT — design reference (imported from claude.ai/design "204 test")

Two side-by-side design directions for a creative-studio portfolio site, built as
interactive HTML/React prototypes on a pannable design canvas.

**This folder is reference material only — not the production site.**
Source: https://claude.ai/design/p/de92b4be-ded4-4e8e-8519-4d42e0325ace

## Running the prototype locally
No build step. It's plain HTML + Babel-in-browser JSX. Serve the folder and open `index.html`:

```bash
npx serve .        # or: python3 -m http.server
```

Open the printed URL. (Opening `index.html` via `file://` will fail because the
browser blocks loading the `.jsx` files — always serve over http.)

## File map
- `index.html` — entry point. Loads React 18 + Babel standalone, then the scripts below.
- `design-canvas.jsx` — starter component: the pan/zoom canvas that hosts both directions
  as side-by-side "artboards". Do not edit unless changing canvas behavior.
- `shared.jsx` — shared data + tokens: `STUDIO`, `WORKS`, `CATEGORIES`, `SERVICES`,
  and the `PlaceholderCard` helper. Each work/service carries a `scene` key
  (`cathedral` | `desert` | `interior` | `water`).
- `direction-a.jsx` — **Direction A "Night Shift"** — cinematic noir. The primary /
  preferred direction. Full-bleed 16:9 hero player with a chapter rail, custom cursor,
  5 pages (home/work/services/about/contact), ledger table with per-row scene
  backgrounds + autoplaying hover preview cards, service cards with scene backgrounds.
- `direction-b.jsx` — **Direction B "Archive"** — editorial / Swiss grid, serif+mono.
- `app.jsx` — mounts both directions into the canvas and wires the Tweaks panel (accent color).

## Architecture notes
- Each `<script type="text/babel">` is its own scope. Shared components are published to
  `window` via `Object.assign(window, {...})` at the end of each file.
- Style objects are locally named (e.g. no bare `const styles`) to avoid collisions.
- `CinematicStill` (in `direction-a.jsx`) fakes film footage with graded gradients +
  SVG silhouettes + animated grain. Pass `playing` for Ken-Burns drift (used in hover
  cards), `mini` for the low-noise thumbnail variant. **Replace with real `<video>`/`<img>`
  when actual footage is available.**

## Fidelity
High-fidelity. Final colors, type, spacing, and interactions are intentional.
Direction A is the chosen direction; Direction B is kept for comparison.

## Design tokens (Direction A)
- Background `#0a0a0a`, foreground `#ececec`, dim `rgba(236,236,236,0.55)`,
  hairline `rgba(236,236,236,0.14)`, accent `#c9442b` (tweakable).
- Type: Archivo Black (display), Space Grotesk (body), JetBrains Mono (labels),
  Instrument Serif (accents/quotes).

## Real content scrape (2026-07-20)
`design/scrape/extracted.json` = text/meta/asset snapshot of the live Webflow site
(204-no-content.webflow.io, both pillars + subpages). Source of truth for real copy,
projects, team, contact + hotlinked media in `src/data/studio.ts` (SPEC §C10).
