import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MediaStill } from '../components/MediaStill'
import { useCursor } from '../components/Cursor'
import { useHead } from '../hooks/useHead'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { CATEGORIES, WORKS, type CategoryFilter, type Work as WorkItem } from '../data/studio'
import styles from './Work.module.css'

export function Work() {
  useHead(
    'Work — 204 · NO-CONTENT',
    'Selected work: interactive installations, immersive mapping, branded and artistic AI film by 204.',
  )
  const [cat, setCat] = useState<CategoryFilter>('all')
  const [hovered, setHovered] = useState<string | null>(null)
  const cursor = useCursor()

  const works = cat === 'all' ? WORKS : WORKS.filter((w) => w.cat === cat)

  const enter = (id: string) => {
    setHovered(id)
    cursor.setLabel('VIEW')
  }
  const leave = () => {
    setHovered(null)
    cursor.setLabel(null)
  }

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <div>
          <div className="t-label" style={{ marginBottom: 8 }}>§ 02 / SELECTED WORK</div>
          <h1 className={`t-display ${styles.title}`}>
            Ledger <span style={{ color: 'var(--dim)' }}>·</span> {String(works.length).padStart(2, '0')}
          </h1>
        </div>
        <div className={styles.filters} role="group" aria-label="Filter by category">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`t-mono ${styles.filter} ${cat === c ? styles.filterActive : ''}`}
              aria-pressed={cat === c}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* table-style list */}
      <div className={styles.table}>
        <div className={`t-mono ${styles.cols}`} aria-hidden="true">
          <div>ref</div>
          <div>project</div>
          <div className={styles.colClient}>client</div>
          <div className={styles.colCat}>category</div>
          <div className={styles.colYear}>year</div>
          <div className={styles.colRt}>rt</div>
        </div>
        {works.map((w) => {
          const isHover = hovered === w.id
          return (
            <div key={w.id} className={styles.row} onMouseEnter={() => enter(w.id)} onMouseLeave={leave}>
              {/* row background still — fades L→R, sits behind columns */}
              <div className={styles.rowBg} style={{ opacity: isHover ? 0.82 : 0.32 }}>
                <div className={styles.rowBgInner} style={{ transform: isHover ? 'scale(1.04)' : 'scale(1)' }}>
                  <MediaStill scene={w.scene} media={w.media} mini scrim />
                </div>
              </div>

              <div className={`t-mono ${styles.cellRef}`}>{w.code}</div>
              <div className={`t-display ${styles.cellTitle}`} style={{ color: isHover ? 'var(--accent)' : 'var(--fg)' }}>
                {w.title}
              </div>
              <div className={`${styles.cellClient} ${styles.colClient}`}>{w.client}</div>
              <div className={`t-mono ${styles.cellDim} ${styles.colCat}`}>{w.cat}</div>
              <div className={`t-mono ${styles.cellDim} ${styles.colYear}`}>{w.year}</div>
              <div className={`t-mono ${styles.cellDim} ${styles.cellRt} ${styles.colRt}`}>{w.runtime}</div>

              {/* mobile-only meta line (table cols hidden ≤768px) */}
              <div className={`t-mono ${styles.mobileMeta}`}>
                {w.client} · {w.cat.toUpperCase()} · {w.year}
              </div>

              {isHover && <HoverPreview w={w} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Hover preview card — "playing" feel via CinematicStill Ken-Burns mode plus a
// ticking timecode/progress bar. Pointer-events none: pure visual, no hover trap (V8).
function HoverPreview({ w }: { w: WorkItem }) {
  const reducedMotion = usePrefersReducedMotion()
  const [t, setT] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  // Keep the card fully inside the viewport: shift up/down so it never
  // extends past the bottom (which also grows document scroll height) or
  // under the fixed nav.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.top = '-8px'
    const rect = el.getBoundingClientRect()
    const minTop = 58 + 12 // fixed nav + margin
    const maxBottom = window.innerHeight - 12
    let shift = 0
    if (rect.bottom > maxBottom) shift = maxBottom - rect.bottom
    if (rect.top + shift < minTop) shift = minTop - rect.top
    if (shift !== 0) el.style.top = `${-8 + shift}px`
  }, [w.id])

  useEffect(() => {
    if (reducedMotion) return
    const start = performance.now()
    let raf: number
    const tick = (now: number) => {
      setT((now - start) / 1000)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [w.id, reducedMotion])

  // Parse runtime mm:ss; fallback to a fake 30s for items without one
  const parts = w.runtime.split(':').map((n) => parseInt(n, 10))
  const total = parts.length === 2 && !isNaN(parts[0]) ? parts[0] * 60 + parts[1] : 30
  const elapsed = Math.min(t, total)
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(Math.floor(elapsed % 60)).padStart(2, '0')
  const pct = (elapsed / total) * 100
  const hasRuntime = w.runtime !== '—'

  return (
    <div ref={ref} className={styles.preview}>
      <div className={styles.previewStill}>
        <MediaStill scene={w.scene} media={w.media} playing />
        <div className={`t-mono ${styles.previewBadge}`}>
          <span className={styles.previewPulse} />
          AUTOPLAY
        </div>
        {hasRuntime && (
          <div className={`t-mono ${styles.previewTimecode}`}>
            {mm}:{ss} / {w.runtime}
          </div>
        )}
        {hasRuntime && (
          <div className={styles.previewTrack}>
            <div className={styles.previewProgress} style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
      <div className={styles.previewBody}>
        <div className={`t-mono ${styles.previewMeta}`}>
          <span>
            {w.code} · {w.cat.toUpperCase()}
          </span>
          <span style={{ color: 'var(--accent)' }}>VIEW →</span>
        </div>
        <div className={`t-display ${styles.previewTitle}`}>{w.title}</div>
        <div className={styles.previewNote}>{w.note}</div>
      </div>
    </div>
  )
}
