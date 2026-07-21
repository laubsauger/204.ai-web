// Social link row — renders only the links that are set on the person.

import type { PersonSocials } from '../data/studio'
import styles from './SocialLinks.module.css'

const ICONS = {
  instagram: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="3" width="18" height="18" rx="4.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M4.98 3.5a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2zM3.5 9h3v11.5h-3V9zm5.5 0h2.9v1.6h.04c.4-.76 1.39-1.56 2.86-1.56 3.06 0 3.7 2.01 3.7 4.63v6.87h-3v-6.09c0-1.45-.03-3.32-2.02-3.32-2.02 0-2.33 1.58-2.33 3.21v6.2H9V9z" />
    </svg>
  ),
  web: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.7-3.8-9s1.3-6.4 3.8-9z" />
    </svg>
  ),
  email: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="M3.5 6.5 12 13l8.5-6.5" />
    </svg>
  ),
} as const

const LABELS: Record<keyof PersonSocials, string> = {
  instagram: 'INSTAGRAM',
  linkedin: 'LINKEDIN',
  web: 'WEB',
  email: 'EMAIL',
}

export function SocialLinks({ socials, compact = false }: { socials?: PersonSocials; compact?: boolean }) {
  if (!socials) return null
  const entries = (Object.keys(LABELS) as Array<keyof PersonSocials>)
    .filter((k) => socials[k])
    .map((k) => ({
      key: k,
      href: k === 'email' ? `mailto:${socials[k]}` : socials[k]!,
      label: LABELS[k],
    }))
  if (entries.length === 0) return null

  return (
    <div className={compact ? styles.compact : styles.list}>
      {entries.map((e) => (
        <a
          key={e.key}
          href={e.href}
          target={e.href.startsWith('http') ? '_blank' : undefined}
          rel="noreferrer"
          className={styles.item}
          aria-label={e.label}
          onClick={(ev) => ev.stopPropagation()}
        >
          <span className={styles.icon}>{ICONS[e.key]}</span>
          {!compact && <span className={`t-mono ${styles.label}`}>{e.label}</span>}
        </a>
      ))}
    </div>
  )
}
