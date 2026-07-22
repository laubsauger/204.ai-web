// Brief intake endpoint for the contact form (VITE_FORM_ENDPOINT points here).
// Writes each lead to Firestore `briefs`; mirrors it into `mail` for the
// Trigger Email extension (optional — without the extension the docs are inert
// and leads are still readable in the console).
//
// Abuse posture: origin allowlist, honeypot, per-IP + per-day rate limits,
// payload caps, and maxInstances: 1 as the hard ceiling on scale-out cost.

const { onRequest } = require('firebase-functions/v2/https')
const { initializeApp } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')

initializeApp()

const BRIEF_TO = process.env.BRIEF_TO || 'hello@204.ai'
// reCAPTCHA Enterprise. No secret involved: assessments are authorized via
// the function's own service account (metadata-server ADC), which needs
// roles/recaptchaenterprise.agent. Site key unset = skip verification, so
// the endpoint works before captcha is provisioned.
const RECAPTCHA_SITE_KEY = process.env.RECAPTCHA_SITE_KEY || ''
const RECAPTCHA_MIN_SCORE = 0.5
const PROJECT_ID = process.env.GCLOUD_PROJECT || 'studio204-web'

const ALLOWED_ORIGINS = new Set([
  'https://laubsauger.github.io',
  'https://studio204-web.web.app',
  'https://studio204-web.firebaseapp.com',
  'http://localhost:5173',
  'http://localhost:4573',
])

// In-memory limits — effective because maxInstances is 1, so every request
// hits the same instance while it's warm. A cold start resets the counters,
// which is acceptable slack for a contact form.
const WINDOW_MS = 60 * 60 * 1000
const MAX_PER_IP_PER_WINDOW = 5
const MAX_PER_DAY = 200
const hits = new Map()
let dayCount = 0
let dayStart = 0

exports.brief = onRequest(
  { region: 'europe-west1', maxInstances: 1, memory: '256MiB', invoker: 'public' },
  async (req, res) => {
    const origin = req.headers.origin || ''
    if (ALLOWED_ORIGINS.has(origin)) {
      res.set('Access-Control-Allow-Origin', origin)
      res.set('Vary', 'Origin')
    }
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST')
      res.set('Access-Control-Allow-Headers', 'Content-Type')
      res.set('Access-Control-Max-Age', '3600')
      res.status(204).send('')
      return
    }
    if (req.method !== 'POST') {
      res.status(405).send('POST only')
      return
    }
    if (!ALLOWED_ORIGINS.has(origin)) {
      res.status(403).send('origin not allowed')
      return
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {}
    const { name = '', org = '', email = '', budget = '', scope = '', website = '' } = body
    const fields = { name, org, email, budget, scope }
    if (Object.values(fields).some((v) => typeof v !== 'string')) {
      res.status(400).send('bad payload')
      return
    }
    // honeypot — bots fill the hidden field; pretend success so they move on
    if (website) {
      res.status(200).json({ ok: true })
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).send('bad email')
      return
    }
    if (Object.values(fields).join('').length > 8000) {
      res.status(400).send('too long')
      return
    }

    const now = Date.now()
    if (now - dayStart > 24 * 60 * 60 * 1000) {
      dayCount = 0
      dayStart = now
    }
    if (dayCount >= MAX_PER_DAY) {
      res.status(429).send('try again tomorrow')
      return
    }
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || 'unknown'
    const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS)
    if (recent.length >= MAX_PER_IP_PER_WINDOW) {
      res.status(429).send('slow down')
      return
    }
    recent.push(now)
    hits.set(ip, recent)
    dayCount += 1

    if (RECAPTCHA_SITE_KEY && !(await captchaOk(body.token))) {
      res.status(403).send('captcha failed')
      return
    }

    const db = getFirestore()
    const lead = { ...fields, ip, ua: req.headers['user-agent'] || '', at: FieldValue.serverTimestamp() }
    const ref = await db.collection('briefs').add(lead)
    const text = [
      `Name: ${name}`,
      org && `Organisation: ${org}`,
      `Reply to: ${email}`,
      budget && `Budget: ${budget}`,
      '',
      scope,
    ]
      .filter(Boolean)
      .join('\n')
    await db.collection('mail').doc(ref.id).set({
      to: BRIEF_TO,
      replyTo: email,
      message: { subject: `Brief — ${name || 'new project'}`, text },
    })
    res.status(200).json({ ok: true })
  },
)

async function captchaOk(token) {
  if (typeof token !== 'string' || !token) return false
  try {
    const meta = await fetch(
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
      { headers: { 'Metadata-Flavor': 'Google' } },
    )
    const { access_token: accessToken } = await meta.json()
    const resp = await fetch(
      `https://recaptchaenterprise.googleapis.com/v1/projects/${PROJECT_ID}/assessments`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: { token, siteKey: RECAPTCHA_SITE_KEY, expectedAction: 'brief' },
        }),
      },
    )
    const a = await resp.json()
    return (
      a.tokenProperties?.valid === true &&
      a.tokenProperties?.action === 'brief' &&
      (a.riskAnalysis?.score ?? 0) >= RECAPTCHA_MIN_SCORE
    )
  } catch {
    // assessment unreachable — fail closed; the visitor still has the mailto fallback
    return false
  }
}
