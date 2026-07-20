import { useHead } from '../hooks/useHead'
import { CONTACT, PEOPLE, STATS } from '../data/studio'
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
        <div className={styles.stats}>
          {STATS.map(([k, v]) => (
            <div key={k}>
              <div className={`t-display ${styles.statValue}`}>{v}</div>
              <div className={`t-mono ${styles.statKey}`}>{k.toUpperCase()}</div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.side}>
        <div className="t-label" style={{ marginBottom: 16 }}>/ THE MAKERS</div>
        {PEOPLE.map((p, i) => (
          <div key={p.name} className={styles.person}>
            <div className={styles.personName}>
              <span className={`t-mono ${styles.personNum}`}>{String(i + 1).padStart(2, '0')}</span>
              <span className={`t-serif ${styles.personLabel}`}>{p.name}</span>
            </div>
            <span className={`t-mono ${styles.personRole}`}>{p.role}</span>
          </div>
        ))}
        <div className={styles.hiring}>
          <div className={`t-mono ${styles.hiringLabel}`}>/ RNA STUDIO — OUR LAB IN LISBON</div>
          <p className={styles.hiringBody}>
            A hybrid studio and cultural platform where ideas are developed, tested and exhibited — workshops,
            installations and collaborative projects. Visit us at {CONTACT.studio.replace('RnA Studio — ', '')}, or
            write to <a href={`mailto:${CONTACT.email}`} style={{ color: 'var(--accent)' }}>{CONTACT.email}</a>
          </p>
        </div>
      </div>
    </div>
  )
}
