import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useHead } from '../hooks/useHead'
import { trackMapLoad } from '../lib/analytics'
import { CONTACT, PEOPLE, PRACTICE, STATS } from '../data/studio'
import styles from './About.module.css'

export function About() {
  useHead(
    'About — 204 · NO-CONTENT',
    '204 is a creative technology studio led by five makers in Lisbon, working at the intersection of AI, motion, identity and live environments.',
  )

  return (
    <div className={styles.root}>
      <div>
        <div className="t-label" style={{ marginBottom: 8 }}>§ 04 / COLOPHON</div>
        <h1 className={`t-display ${styles.title}`}>
          We build <span style={{ color: 'var(--accent)' }}>worlds</span>,
          <br />
          <span style={{ color: 'var(--dim)' }}>on purpose.</span>
        </h1>
        <p className={`t-serif ${styles.body}`}>
          Named after HTTP 204 — a response that returns nothing. A joke about studios that deliver exactly that, and a
          promise that we won't. 204 is a creative technology studio working at the intersection of AI, motion,
          identity and live environments — translating ideas into responsive worlds.
        </p>
        <div className={`${styles.stats} anim-fade`}>
          {STATS.map(([k, v]) => (
            <div key={k}>
              <div className={`t-display ${styles.statValue}`}>{v}</div>
              <div className={`t-mono ${styles.statKey}`}>{k.toUpperCase()}</div>
            </div>
          ))}
        </div>

        <div className={`${styles.practice} anim-fade`}>
          <div className="t-label" style={{ marginBottom: 4 }}>/ WORLDBUILDING IN PRACTICE</div>
          {PRACTICE.map((p) => (
            <div key={p.n} className={styles.practiceRow}>
              <span className={`t-mono ${styles.practiceNum}`}>{p.n}.</span>
              <span className={`t-display ${styles.practiceLabel}`}>{p.label}</span>
              <span className={styles.practiceBody}>{p.body}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={`${styles.side} anim-fade`}>
        <div className="t-label" style={{ marginBottom: 16 }}>/ THE MAKERS</div>
        {PEOPLE.map((p, i) => (
          <Link key={p.name} to={`/makers/${p.slug}`} className={styles.person}>
            <div className={styles.personName}>
              <span className={`t-mono ${styles.personNum}`}>{String(i + 1).padStart(2, '0')}</span>
              {p.photo && <img src={p.photo} alt={p.name} className={styles.personPhoto} loading="lazy" decoding="async" />}
              <span className={`t-serif ${styles.personLabel}`}>{p.name}</span>
            </div>
            <span className={`t-mono ${styles.personRole}`}>{p.role}</span>
          </Link>
        ))}
        <div className={styles.hiring}>
          <div className={`t-mono ${styles.hiringLabel}`}>/ RNA STUDIO — OUR LAB IN LISBON</div>
          <p className={styles.hiringBody}>
            A hybrid studio and cultural platform where ideas are developed, tested and exhibited — workshops,
            installations and collaborative projects. Write to{' '}
            <a href={`mailto:${CONTACT.email}`} style={{ color: 'var(--accent)' }}>{CONTACT.email}</a>
          </p>
        </div>

        <div className={styles.findUs}>
          <div className="t-label" style={{ marginBottom: 12 }}>/ FIND US</div>
          <div className={`t-mono ${styles.addressRow}`}>
            <span className={styles.addressKey}>STUDIO</span>
            <span>R. Ferreira Lapa 12A</span>
          </div>
          <div className={`t-mono ${styles.addressRow}`}>
            <span className={styles.addressKey}>CITY</span>
            <span>1150-157 Lisboa, Portugal</span>
          </div>
          <div className={`t-mono ${styles.addressRow}`}>
            <span className={styles.addressKey}>GEO</span>
            <span>38.7266 N · 9.1434 W</span>
          </div>
          <MapEmbed />
          <a
            href="https://www.google.com/maps/search/?api=1&query=R.+Ferreira+Lapa+12A,+1150-157+Lisboa"
            target="_blank"
            rel="noreferrer"
            className={`t-mono ${styles.mapsLink}`}
          >
            → OPEN IN GOOGLE MAPS
          </a>
        </div>
      </div>
    </div>
  )
}

// Click-to-load — no third-party tiles until asked (SPEC V4), dark-filtered
// so the map sits in the palette.
function MapEmbed() {
  const [loaded, setLoaded] = useState(false)
  return (
    <div className={styles.map}>
      {loaded ? (
        <iframe
          src="https://www.openstreetmap.org/export/embed.html?bbox=-9.1494%2C38.7236%2C-9.1374%2C38.7296&layer=mapnik&marker=38.7266%2C-9.1434"
          title="RnA Studio on the map"
        />
      ) : (
        <button
          onClick={() => {
            trackMapLoad()
            setLoaded(true)
          }}
          className={styles.mapButton}
        >
          <span className={styles.mapCross} aria-hidden="true">
            ⌖
          </span>
          <span className={`t-mono ${styles.mapLabel}`}>LOAD MAP · OPENSTREETMAP</span>
        </button>
      )}
    </div>
  )
}
