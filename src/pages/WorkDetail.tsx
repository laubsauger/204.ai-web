import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MediaStill } from '../components/MediaStill'
import { useHead } from '../hooks/useHead'
import { trackVideoOpen } from '../lib/analytics'
import { WORKS } from '../data/studio'
import { NotFound } from './NotFound'
import styles from './WorkDetail.module.css'

export function WorkDetail() {
  const { slug } = useParams()
  const idx = WORKS.findIndex((w) => w.slug === slug)
  const w = WORKS[idx]

  useHead(
    w ? `${w.title} · Work` : '404',
    w ? w.note : 'Project not found.',
    w?.media?.still,
  )

  if (!w) return <NotFound />

  const prev = WORKS[(idx - 1 + WORKS.length) % WORKS.length]
  const next = WORKS[(idx + 1) % WORKS.length]

  return (
    <div className={styles.root}>
      <Link to="/work" className={`t-mono ${styles.back}`}>
        ← LEDGER
      </Link>

      <div className="t-label" style={{ margin: '18px 0 8px' }}>
        {w.code} / {w.cat.toUpperCase()} {w.year !== '—' && `/ ${w.year}`}
      </div>
      <h1 className={`t-display ${styles.title}`}>{w.title}</h1>
      {w.client !== '—' && <div className={`t-serif ${styles.client}`}>for {w.client}</div>}

      {/* media front and center, spec sheet beside it on large screens */}
      <div className={styles.mediaRow}>
        <div className={`${styles.hero} anim-media`}>
          <MediaStill scene={w.scene} media={w.media} playing letterbox />
        </div>
        <aside className={`${styles.meta} anim-fade`}>
          <div className="t-label" style={{ marginBottom: 12 }}>/ SPEC SHEET</div>
          {(
            [
              ['REF', w.code],
              ['CLIENT', w.client],
              ['CATEGORY', w.cat.toUpperCase()],
              ['YEAR', w.year],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className={`t-mono ${styles.metaRow}`}>
              <span className={styles.metaKey}>{k}</span>
              <span className={styles.metaValue}>{v}</span>
            </div>
          ))}
          <p className={styles.metaNote}>{w.note}</p>
          <Link to="/contact" className={`t-mono ${styles.cta}`}>
            → SOMETHING LIKE THIS?
          </Link>
        </aside>
      </div>

      <div className={`${styles.main} anim-fade`}>
        {w.body && <p className={`t-serif ${styles.body}`}>{w.body}</p>}

        {w.youtube?.map((id) => <YoutubeEmbed key={id} id={id} title={w.title} />)}

        {w.gallery && (
          <div className={styles.gallery}>
            {w.gallery.map((src) => (
              <div key={src} className={styles.galleryItem}>
                <img src={src} alt={`${w.title} — installation photo`} loading="lazy" decoding="async" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* prev / next */}
      <nav className={styles.pager} aria-label="More work">
        <Link to={`/work/${prev.slug}`} state={{ pager: 'prev' }} className={`${styles.pagerLink} anim-wipe-l`}>
          <span className={`t-mono ${styles.pagerLabel}`}>← PREV</span>
          <span className={`t-display ${styles.pagerTitle}`}>{prev.title}</span>
        </Link>
        <Link to={`/work/${next.slug}`} state={{ pager: 'next' }} className={`${styles.pagerLink} ${styles.pagerRight} anim-wipe-r`}>
          <span className={`t-mono ${styles.pagerLabel}`}>NEXT →</span>
          <span className={`t-display ${styles.pagerTitle}`}>{next.title}</span>
        </Link>
      </nav>
    </div>
  )
}

// Click-to-load — no third-party requests until the visitor asks for the film
// (SPEC V4: youtube on demand only).
function YoutubeEmbed({ id, title }: { id: string; title: string }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div className={styles.film}>
      {loaded ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`}
          title={`${title} — film`}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button
          onClick={() => {
            trackVideoOpen(title, id)
            setLoaded(true)
          }}
          className={styles.filmButton}
        >
          <span className={styles.filmRing}>
            <span className={styles.filmTriangle} />
          </span>
          <span className={`t-mono ${styles.filmLabel}`}>▶ WATCH FILM · YOUTUBE</span>
        </button>
      )}
    </div>
  )
}
