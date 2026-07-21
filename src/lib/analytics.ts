// GA4 wrapper — same property as the current Webflow site (G-E2HCBBXBVP),
// so reporting stays continuous across the switch. gtag is loaded in
// index.html; everything here no-ops if it's absent (blocked, dev, etc).

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

export const GA_ID = 'G-E2HCBBXBVP'

function gtag(...args: unknown[]) {
  window.gtag?.(...args)
}

/* SPA page_view — fired on every route change by Layout */
export function trackPageView(path: string, title: string) {
  gtag('event', 'page_view', {
    page_path: path,
    page_title: title,
    page_location: window.location.href,
  })
}

/* Named interactions. Keep event/param names stable — GA4 reports key on them. */
export function trackCta(cta: string, extra?: Record<string, string>) {
  gtag('event', 'cta_click', { cta, ...extra })
}

export function trackChapterSelect(project: string) {
  gtag('event', 'select_chapter', { project })
}

export function trackPlayToggle(state: 'play' | 'pause', project: string) {
  gtag('event', 'reel_play_toggle', { state, project })
}

export function trackVideoOpen(project: string, videoId: string) {
  gtag('event', 'video_open', { project, video_id: videoId })
}

export function trackMapLoad() {
  gtag('event', 'map_load')
}

export function trackSocialClick(network: string, person?: string) {
  gtag('event', 'social_click', { network, ...(person ? { person } : {}) })
}

/* GA4 recommended event for form submissions */
export function trackLead(budget: string) {
  gtag('event', 'generate_lead', { budget: budget || 'unspecified', form: 'brief_intake' })
}

export function trackWorkFilter(category: string) {
  gtag('event', 'filter_work', { category })
}
