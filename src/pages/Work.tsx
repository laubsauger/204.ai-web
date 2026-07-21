import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MediaStill } from '../components/MediaStill'
import { useCursor } from '../components/Cursor'
import { useHead } from '../hooks/useHead'
import { trackWorkFilter } from '../lib/analytics'
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
  const navigate = useNavigate()

  const works = cat === 'all' ? WORKS : WORKS.filter((w) => w.cat === cat)

  const [anchor, setAnchor] = useState({ x: 0, y: 0 })
  const enter = (id: string, e: React.MouseEvent) => {
    setAnchor({ x: e.clientX, y: e.clientY })
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
        <h1 className={`t-label ${styles.titleRow}`}>
          § 02 / SELECTED WORK <span className={styles.count}>— LEDGER · {String(works.length).padStart(2, '0')}</span>
        </h1>
        <div className={`${styles.filters} anim-fade`} role="group" aria-label="Filter by category">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => {
                setCat(c)
                trackWorkFilter(c)
              }}
              className={`t-mono ${styles.filter} ${cat === c ? styles.filterActive : ''}`}
              aria-pressed={cat === c}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* table-style list */}
      <div className={`${styles.table} anim-fade`}>
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
            <div
              key={w.id}
              className={styles.row}
              onMouseEnter={(e) => enter(w.id, e)}
              onMouseLeave={leave}
              onClick={() => {
                leave()
                navigate(`/work/${w.slug}`)
              }}
            >
              {/* row background still — fades L→R, sits behind columns */}
              <div className={styles.rowBg} style={{ opacity: isHover ? 0.82 : 0.32 }}>
                <div className={styles.rowBgInner} style={{ transform: isHover ? 'scale(1.04)' : 'scale(1)' }}>
                  <MediaStill scene={w.scene} media={w.media} mini scrim />
                </div>
              </div>

              <div className={`t-mono ${styles.cellRef}`}>{w.code}</div>
              <div className={`t-display ${styles.cellTitle}`} style={{ color: isHover ? 'var(--accent)' : 'var(--fg)' }}>
                <Link to={`/work/${w.slug}`} onClick={(e) => { e.stopPropagation(); leave() }}>{w.title}</Link>
              </div>
              <div className={`${styles.cellClient} ${styles.colClient}`}>{w.client}</div>
              <div className={`t-mono ${styles.cellDim} ${styles.colCat}`}>{w.cat}</div>
              <div className={`t-mono ${styles.cellDim} ${styles.colYear}`}>{w.year}</div>
              <div className={`t-mono ${styles.cellDim} ${styles.cellRt} ${styles.colRt}`}>{w.runtime}</div>

              {/* mobile-only meta line (table cols hidden ≤768px) */}
              <div className={`t-mono ${styles.mobileMeta}`}>
                {w.client} · {w.cat.toUpperCase()} · {w.year}
              </div>

              {isHover && <HoverPreview w={w} anchor={anchor} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Hover preview card — follows the cursor (anchored beside it) and stays fully
// inside the viewport (SPEC V11). Pointer-events none: pure visual, no hover trap (V8).
function HoverPreview({ w, anchor }: { w: WorkItem; anchor: { x: number; y: number } }) {
  const reducedMotion = usePrefersReducedMotion()
  const [t, setT] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const navH = document.querySelector('header')?.getBoundingClientRect().height ?? 58
    const place = (x: number, y: number) => {
      const cardW = el.offsetWidth
      const cardH = el.offsetHeight
      let left = x + 28
      if (left + cardW > window.innerWidth - 12) left = x - cardW - 28
      left = Math.max(12, left)
      const top = Math.min(Math.max(y - cardH * 0.35, navH + 12), window.innerHeight - cardH - 12)
      el.style.left = `${left}px`
      el.style.top = `${top}px`
    }
    place(anchor.x, anchor.y)
    const move = (e: MouseEvent) => place(e.clientX, e.clientY)
    document.addEventListener('mousemove', move)
    return () => document.removeEventListener('mousemove', move)
    // anchor is the enter-position only; live tracking comes from mousemove
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          {w.media?.video && <span className={styles.previewPulse} />}
          {w.media?.video ? 'AUTOPLAY' : 'PREVIEW'}
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
