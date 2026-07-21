import { Link, useParams } from 'react-router-dom'
import { SocialLinks } from '../components/SocialLinks'
import { useHead } from '../hooks/useHead'
import { PEOPLE } from '../data/studio'
import { NotFound } from './NotFound'
import styles from './MakerDetail.module.css'

export function MakerDetail() {
  const { slug } = useParams()
  const idx = PEOPLE.findIndex((p) => p.slug === slug)
  const p = PEOPLE[idx]

  useHead(
    p ? `${p.name} · Maker` : '404',
    p ? `${p.name}, ${p.role} at 204 — creative technology studio, Lisbon.` : 'Maker not found.',
    p?.photo,
  )

  if (!p) return <NotFound />

  const prev = PEOPLE[(idx - 1 + PEOPLE.length) % PEOPLE.length]
  const next = PEOPLE[(idx + 1) % PEOPLE.length]

  return (
    <div className={styles.root}>
      <Link to="/about" className={`t-mono ${styles.back}`}>
        ← ABOUT
      </Link>

      <div className="t-label" style={{ margin: '18px 0 8px' }}>
        / THE MAKERS — {String(idx + 1).padStart(2, '0')}
      </div>
      <h1 className={`t-display ${styles.name}`}>{p.name}</h1>
      <div className={`t-serif ${styles.role}`}>{p.role}</div>

      <div className={styles.columns}>
        <div className={`${styles.photoWrap} anim-media`}>
          {p.photo ? (
            <img src={p.photo} alt={p.name} className={styles.photo} />
          ) : (
            <div className={styles.photoFallback}>
              <span className={`t-display ${styles.initials}`}>
                {p.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </span>
            </div>
          )}
        </div>

        <aside className={`${styles.side} anim-fade`}>
          {p.bio && <p className={`t-serif ${styles.bio}`}>{p.bio}</p>}
          <div className="t-label" style={{ marginBottom: 8 }}>/ REACH OUT</div>
          <SocialLinks socials={p.socials} person={p.name} />
          <Link to="/contact" className={`t-mono ${styles.cta}`}>
            → WORK WITH US
          </Link>
        </aside>
      </div>

      <nav className={styles.pager} aria-label="More makers">
        <Link to={`/makers/${prev.slug}`} state={{ pager: 'prev' }} className={`${styles.pagerLink} anim-wipe-l`}>
          <span className={`t-mono ${styles.pagerLabel}`}>← PREV</span>
          <span className={`t-display ${styles.pagerTitle}`}>{prev.name}</span>
        </Link>
        <Link to={`/makers/${next.slug}`} state={{ pager: 'next' }} className={`${styles.pagerLink} ${styles.pagerRight} anim-wipe-r`}>
          <span className={`t-mono ${styles.pagerLabel}`}>NEXT →</span>
          <span className={`t-display ${styles.pagerTitle}`}>{next.name}</span>
        </Link>
      </nav>
    </div>
  )
}
