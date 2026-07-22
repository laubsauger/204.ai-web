import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MediaStill } from '../components/MediaStill'
import { useHead } from '../hooks/useHead'
import { SERVICES_CONTENT, SERVICES_INTERACTIVE, type Service } from '../data/studio'
import styles from './Services.module.css'

export function Services() {
  useHead(
    'Services',
    'Two pillars: AI-powered content creation (branded work, mapping, film, archival) and interactive formats (Magic Mirror, AI Photo Booth, Live Visuals, Augmented Art).',
  )

  return (
    <div className={styles.root}>
      <div className="t-label" style={{ marginBottom: 8 }}>§ 03 / WHAT WE DO</div>
      <h1 className={`t-display ${styles.title}`}>
        Two pillars.
        <br />
        <span style={{ color: 'var(--dim)' }}>One room.</span>
      </h1>

      <div className={`${styles.pillarHead} anim-fade`}>
        <span className="t-label">/ .CONTENT — AI-POWERED VISUALS & GENERATIVE STORYTELLING</span>
        <span className={styles.pillarRule} />
      </div>
      <div className={`${styles.grid} anim-fade`}>
        {SERVICES_CONTENT.map((s, i) => (
          <ServiceCard key={s.n} s={s} last={i === SERVICES_CONTENT.length - 1} />
        ))}
      </div>

      <div className={styles.pillarHead}>
        <span className="t-label">/ .INTERACTIVE — INSTALLATIONS, MOTION TRACKING & RESPONSIVE ENVIRONMENTS</span>
        <span className={styles.pillarRule} />
      </div>
      <div className={`${styles.grid} anim-fade`}>
        {SERVICES_INTERACTIVE.map((s, i) => (
          <ServiceCard key={s.n} s={s} last={i === SERVICES_INTERACTIVE.length - 1} />
        ))}
      </div>

      <div className={`t-mono ${styles.footer} anim-fade`}>
        <span>RATES ON REQUEST</span>
        <span>EVERY FORMAT STANDS ALONE OR SCALES TO YOUR VENUE</span>
        <Link to="/contact" className={styles.footerLink}>
          TAKING BRIEFS →
        </Link>
      </div>
    </div>
  )
}

function ServiceCard({ s, last }: { s: Service; last: boolean }) {
  const [hover, setHover] = useState(false)
  return (
    <Link
      to={`/services/${s.slug}`}
      className={styles.card}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className={styles.cardBg} style={{ opacity: hover ? 0.7 : 0.42 }}>
        <div className={styles.cardBgInner} style={{ transform: hover ? 'scale(1.03)' : 'scale(1)' }}>
          <MediaStill scene={s.scene} media={s.still ? { still: s.still } : undefined} mini scrim />
        </div>
      </div>
      <div className={styles.cardContent}>
        <div className={styles.cardHead}>
          <span className={`t-mono ${styles.cardNum}`}>{s.n}</span>
          <span className={`t-mono ${styles.cardNext}`}>/ {last ? '— END' : 'NEXT →'}</span>
        </div>
        <h2 className={`t-display ${styles.cardLabel}`} style={{ textShadow: hover ? '0 1px 14px rgba(0,0,0,0.7)' : 'none' }}>
          {s.label}
        </h2>
        <p className={styles.cardBody}>{s.body}</p>
        <span className={`t-mono ${styles.cardMore}`} style={{ opacity: hover ? 1 : 0.55 }}>
          READ MORE →
        </span>
      </div>
    </Link>
  )
}
