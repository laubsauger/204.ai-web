import { Link } from 'react-router-dom'
import { useHead } from '../hooks/useHead'

export function NotFound() {
  useHead('404 — 204 · NO-CONTENT', 'Page not found. Which is on-brand, but not on purpose this time.')

  return (
    <div style={{ padding: '96px 28px', maxWidth: 720 }}>
      <div className="t-label" style={{ marginBottom: 8 }}>§ ∅ / NOT FOUND</div>
      <h1 className="t-display" style={{ fontSize: 'clamp(56px, 10vw, 100px)', margin: 0 }}>
        404<span style={{ color: 'var(--dim)' }}>—</span>
        <span style={{ color: 'var(--accent)' }}>NO</span> PAGE
      </h1>
      <p className="t-serif" style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--fg)', maxWidth: 440 }}>
        We're named after a response that returns nothing, but this one is a genuine miss.
      </p>
      <Link
        to="/"
        className="t-mono"
        style={{
          display: 'inline-block',
          border: '1px solid var(--fg)',
          padding: '14px 22px',
          fontSize: 11,
          letterSpacing: 2,
          textTransform: 'uppercase',
        }}
      >
        → Back to Index
      </Link>
    </div>
  )
}
