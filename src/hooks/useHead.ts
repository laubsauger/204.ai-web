import { useEffect } from 'react'

const OG_DEFAULT_IMAGE =
  'https://cdn.prod.website-files.com/64ba5b3b418a540ade9f6e31/65b7a18446d60bb65c1641e7_204white.png'

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.content = content
}

// SPEC V10 / I.seo: every route sets unique title + description; og/twitter
// tags follow so shares carry the right card. (Static per-route HTML for
// non-JS scrapers is generated at build time by scripts/generate-meta.mjs.)
export function useHead(title: string, description: string, image?: string) {
  useEffect(() => {
    document.title = title
    setMeta('name', 'description', description)
    setMeta('property', 'og:title', title)
    setMeta('property', 'og:description', description)
    setMeta('property', 'og:image', image ?? OG_DEFAULT_IMAGE)
    setMeta('property', 'og:url', window.location.href)
    setMeta('property', 'og:type', 'website')
    setMeta('name', 'twitter:card', 'summary_large_image')
    setMeta('name', 'twitter:title', title)
    setMeta('name', 'twitter:description', description)
    setMeta('name', 'twitter:image', image ?? OG_DEFAULT_IMAGE)
  }, [title, description, image])
}
