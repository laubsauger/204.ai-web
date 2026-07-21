import { useEffect } from 'react'

const OG_DEFAULT_IMAGE = `${import.meta.env.BASE_URL}media/204white-p-800.jpg`

/* WhatsApp-safe og:image — mirror of scripts/generate-meta.mjs ogImage():
   scrapers reject webp and drop images over ~600KB, so serve the pipeline's
   -p-800 jpg rendition, absolutized. Keep both in sync. */
function ogImage(img?: string): string | undefined {
  if (!img || img.startsWith('data:')) return undefined // inline placeholders can't be share cards
  const jpg = img.replace(/\.(?:png|jpe?g|webp|avif)$/i, '-p-800.jpg')
  return new URL(jpg, window.location.origin).href
}

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.content = content
}

const BRAND = '204 · NO-CONTENT'
const HOME_TITLE = `${BRAND} — Creative technology studio`

// SPEC V10 / I.seo: every route sets unique title + description; og/twitter
// tags follow so shares carry the right card. (Static per-route HTML for
// non-JS scrapers is generated at build time by scripts/generate-meta.mjs.)
// Pass the bare page name — the brand suffix is appended HERE, in one place
// (empty string = home, which leads with the brand instead).
export function useHead(pageTitle: string, description: string, rawImage?: string) {
  const title = pageTitle ? `${pageTitle} — ${BRAND}` : HOME_TITLE
  const image = ogImage(rawImage)
  useEffect(() => {
    document.title = title
    setMeta('name', 'description', description)
    setMeta('property', 'og:title', title)
    setMeta('property', 'og:description', description)
    const img = image ?? new URL(OG_DEFAULT_IMAGE, window.location.origin).href
    setMeta('property', 'og:image', img)
    setMeta('property', 'og:url', window.location.href)
    setMeta('property', 'og:type', 'website')
    setMeta('name', 'twitter:card', 'summary_large_image')
    setMeta('name', 'twitter:title', title)
    setMeta('name', 'twitter:description', description)
    setMeta('name', 'twitter:image', img)
  }, [title, description, image])
}
