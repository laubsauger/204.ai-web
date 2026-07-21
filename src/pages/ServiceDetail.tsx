import { Link, useParams } from 'react-router-dom'
import { MediaStill } from '../components/MediaStill'
import { useHead } from '../hooks/useHead'
import { trackCta } from '../lib/analytics'
import { SERVICES_ALL, SERVICES_INTERACTIVE, WORKS } from '../data/studio'
import { NotFound } from './NotFound'
import styles from './ServiceDetail.module.css'

export function ServiceDetail() {
  const { slug } = useParams()
  const idx = SERVICES_ALL.findIndex((s) => s.slug === slug)
  const s = SERVICES_ALL[idx]

  useHead(
    s ? `${s.label}` : '404',
    s ? s.body : 'Service not found.',
    s?.still,
  )

  if (!s) return <NotFound />

  const pillar = SERVICES_INTERACTIVE.includes(s) ? '.INTERACTIVE' : '.CONTENT'
  const related = s.relatedCat ? WORKS.filter((w) => w.cat === s.relatedCat).slice(0, 4) : []
  const prev = SERVICES_ALL[(idx - 1 + SERVICES_ALL.length) % SERVICES_ALL.length]
  const next = SERVICES_ALL[(idx + 1) % SERVICES_ALL.length]

  return (
    <div className={styles.root}>
      <Link to="/services" className={`t-mono ${styles.back}`}>
        ← SERVICES
      </Link>

      <div className="t-label" style={{ margin: '18px 0 8px' }}>
        / {pillar} — {s.n}
      </div>
      <h1 className={`t-display ${styles.title}`}>{s.label}</h1>

      {/* media left; selected work in this practice rides beside it,
          intro + CTA follow underneath */}
      <div className={styles.top}>
        <div className={`${styles.hero} anim-media`}>
          <MediaStill
            scene={s.scene}
            media={s.still || s.video ? { still: s.still, video: s.video } : undefined}
            playing
          />
        </div>
        <aside className="anim-fade">
          {related.length > 0 ? (
            <>
              <div className="t-label" style={{ marginBottom: 4 }}>/ SELECTED WORK IN THIS PRACTICE</div>
              {related.map((w) => (
                <Link key={w.id} to={`/work/${w.slug}`} className={styles.relatedRow}>
                  <span className={`t-mono ${styles.relatedCode}`}>{w.code}</span>
                  <span className={`t-display ${styles.relatedTitle}`}>{w.title}</span>
                  <span className={`t-mono ${styles.relatedMeta}`}>{w.year}</span>
                </Link>
              ))}
            </>
          ) : (
            <>
              <p className={`t-serif ${styles.intro}`}>{s.intro ?? s.body}</p>
              <Link to="/contact" className={`t-mono ${styles.cta}`} onClick={() => trackCta('bring_to_event', { service: s.label })}>
                → BRING THIS TO YOUR EVENT
              </Link>
            </>
          )}
        </aside>
      </div>

      {related.length > 0 && (
        <div className={`${styles.introBlock} anim-fade`}>
          <p className={`t-serif ${styles.intro}`}>{s.intro ?? s.body}</p>
          <Link to="/contact" className={`t-mono ${styles.cta}`}>
            → BRING THIS TO YOUR EVENT
          </Link>
        </div>
      )}

      {s.modes && (
        <section className={`${styles.section} anim-fade`}>
          <div className="t-label" style={{ marginBottom: 4 }}>/ ONE SYSTEM — MULTIPLE MODES</div>
          {s.modes.map((m) => (
            <div key={m.n} className={styles.modeRow}>
              <span className={`t-mono ${styles.modeNum}`}>{m.n}.</span>
              <span className={`t-display ${styles.modeLabel}`}>{m.label}</span>
              <span className={styles.modeBody}>{m.body}</span>
            </div>
          ))}
        </section>
      )}

      {s.features && (
        <section className={`${styles.section} anim-fade`}>
          <div className="t-label" style={{ marginBottom: 14 }}>/ FEATURES</div>
          <div className={styles.features}>
            {s.features.map((f) => (
              <div key={f.label} className={styles.feature}>
                <div className={`t-mono ${styles.featureLabel}`}>{f.label}</div>
                <div className={styles.featureBody}>{f.body}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <nav className={styles.pager} aria-label="More services">
        <Link to={`/services/${prev.slug}`} className={`${styles.pagerLink} anim-wipe-l`}>
          <span className={`t-mono ${styles.pagerLabel}`}>← PREV</span>
          <span className={`t-display ${styles.pagerTitle}`}>{prev.label}</span>
        </Link>
        <Link to={`/services/${next.slug}`} className={`${styles.pagerLink} ${styles.pagerRight} anim-wipe-r`}>
          <span className={`t-mono ${styles.pagerLabel}`}>NEXT →</span>
          <span className={`t-display ${styles.pagerTitle}`}>{next.label}</span>
        </Link>
      </nav>
    </div>
  )
}
