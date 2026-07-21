import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MediaStill } from '../components/MediaStill'
import { useHead } from '../hooks/useHead'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { HERO_CHAPTERS, STUDIO } from '../data/studio'
import styles from './Home.module.css'

function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

export function Home() {
  useHead(
    '204 · NO-CONTENT — Creative technology studio',
    '204 is a creative technology studio at the intersection of AI, motion, identity and live environments. Based at RnA Studio, Lisbon.',
  )
  const [activeFrame, setActiveFrame] = useState(0)
  const current = HERO_CHAPTERS[activeFrame]

  // hero player state — wired to the <video> inside MediaStill; still-only
  // chapters run a fixed-duration timer so the reel auto-advances either way
  const STILL_DURATION = 8
  const reducedMotion = usePrefersReducedMotion()
  const videoEl = useRef<HTMLVideoElement | null>(null)
  const fillRef = useRef<HTMLDivElement | null>(null)
  const pausedRef = useRef(false)
  const [isPaused, setIsPaused] = useState(false)
  const [timecode, setTimecode] = useState('00:00 / 00:00')
  const hasVideo = Boolean(current.media?.video) && !reducedMotion
  const hasPlayer = !reducedMotion

  const advance = useCallback(() => {
    setActiveFrame((i) => (i + 1) % HERO_CHAPTERS.length)
  }, [])

  const selectFrame = (i: number) => {
    pausedRef.current = false
    setIsPaused(false)
    setActiveFrame(i)
  }

  const bindVideo = useCallback((el: HTMLVideoElement | null) => {
    videoEl.current = el
    if (!el) return
    pausedRef.current = el.paused
    setIsPaused(el.paused)
    setTimecode('00:00 / 00:00')
    const onTime = () => {
      if (isFinite(el.duration) && el.duration) setTimecode(`${fmt(el.currentTime)} / ${fmt(el.duration)}`)
    }
    const onPlay = () => {
      pausedRef.current = false
      setIsPaused(false)
    }
    const onPause = () => {
      pausedRef.current = true
      setIsPaused(true)
    }
    const onEnded = () => advance()
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    el.addEventListener('ended', onEnded)
    // progress bar advances per-frame — timeupdate only ticks ~4Hz, which
    // reads as stepped jumps
    let raf = requestAnimationFrame(function frame() {
      const fill = fillRef.current
      if (fill && isFinite(el.duration) && el.duration) {
        fill.style.width = `${(el.currentTime / el.duration) * 100}%`
      }
      raf = requestAnimationFrame(frame)
    })
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('ended', onEnded)
      videoEl.current = null
    }
    // advance is stable (setState updater)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const togglePlay = () => {
    const el = videoEl.current
    if (el) {
      if (el.paused) el.play().catch(() => {})
      else el.pause()
      return
    }
    // still chapter: pause/resume the auto-advance timer
    pausedRef.current = !pausedRef.current
    setIsPaused(pausedRef.current)
  }

  // still-only chapters: timed progress + auto-advance
  useEffect(() => {
    if (reducedMotion || hasVideo) return
    // a finished video fires 'pause' on ended — clear that so the timer runs
    pausedRef.current = false
    setIsPaused(false)
    let elapsed = 0
    let lastSec = -1
    let last = performance.now()
    if (fillRef.current) fillRef.current.style.width = '0%'
    setTimecode(`00:00 / ${fmt(STILL_DURATION)}`)
    let raf = requestAnimationFrame(function tick(now) {
      if (!pausedRef.current) {
        elapsed += (now - last) / 1000
        if (fillRef.current) fillRef.current.style.width = `${Math.min(elapsed / STILL_DURATION, 1) * 100}%`
        const sec = Math.floor(elapsed)
        if (sec !== lastSec) {
          lastSec = sec
          setTimecode(`${fmt(Math.min(elapsed, STILL_DURATION))} / ${fmt(STILL_DURATION)}`)
        }
        if (elapsed >= STILL_DURATION) {
          advance()
          return
        }
      }
      last = now
      raf = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(raf)
  }, [activeFrame, hasVideo, reducedMotion, advance])

  return (
    <div className={styles.root}>
      {/* hero media — featured work player + chapter rail */}
      <section className={styles.hero} aria-label={`${STUDIO.name} showreel`}>
        <div
          className={styles.still}
          onClick={hasPlayer ? togglePlay : undefined}
          onKeyDown={hasPlayer ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePlay() } } : undefined}
          role={hasPlayer ? 'button' : undefined}
          tabIndex={hasPlayer ? 0 : undefined}
          aria-label={hasPlayer ? (isPaused ? 'Play showreel' : 'Pause showreel') : undefined}
        >
          <MediaStill scene={current.scene} media={current.media} playing letterbox loop={false} videoRef={bindVideo} />
          {/* caption overlays */}
          <div className={`t-mono ${styles.captionLeft}`}>
            <div style={{ color: 'var(--accent)' }}>● NOW PLAYING</div>
            <div style={{ marginTop: 2 }}>
              CH.0{activeFrame + 1} / {current.title.toUpperCase()}
            </div>
            <div style={{ opacity: 0.6 }}>{current.client.toUpperCase()}</div>
            <Link
              to={`/work/${current.slug}`}
              className={styles.captionLink}
              onClick={(e) => e.stopPropagation()}
            >
              VIEW PROJECT →
            </Link>
          </div>
          <div className={`t-mono ${styles.captionRight}`}>
            <div>{current.code}</div>
            <div style={{ opacity: 0.6 }}>204.AI · REAL-TIME</div>
          </div>
          {/* play ring — only while paused (or when there's no video to control) */}
          {(!hasPlayer || isPaused) && (
            <div className={styles.playWrap}>
              <div className={styles.playRing}>
                <div className={styles.playTriangle} />
              </div>
            </div>
          )}
          {/* footer bar */}
          <div className={`t-mono ${styles.stillFooter}`}>
            <span>{hasPlayer ? timecode : `CH.0${activeFrame + 1} · ${current.code}`}</span>
            <span style={{ opacity: 0.6 }}>
              REEL · PART {activeFrame + 1} OF {HERO_CHAPTERS.length}
            </span>
          </div>
          {/* progress bar — sits on the lower letterbox bar */}
          {hasPlayer && (
            <div className={styles.progressTrack}>
              <div ref={fillRef} className={styles.progressFill} />
            </div>
          )}
        </div>

        {/* right rail: thumbnail stack */}
        <div className={styles.rail}>
          <div className={`t-mono ${styles.railHead}`}>/ CHAPTERS</div>
          <div className={styles.railList}>
            {HERO_CHAPTERS.map((f, i) => {
              const active = i === activeFrame
              return (
                <div
                  key={f.code}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectFrame(i)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      selectFrame(i)
                    }
                  }}
                  className={`${styles.chapter} ${active ? styles.chapterActive : ''}`}
                >
                  <span className={styles.thumb}>
                    <MediaStill scene={f.scene} media={f.media} mini />
                    {active && <span className={styles.thumbRing} />}
                  </span>
                  <span className={`t-mono ${styles.chapterCat}`}>{f.cat.toUpperCase()}</span>
                  <span>
                    <span className={`t-mono ${styles.chapterCode}`}>
                      CH.0{i + 1} · {f.code}
                    </span>
                    <span className={`t-display ${styles.chapterTitle}`}>
                      {f.title}
                    </span>
                    <span className={`t-mono ${styles.chapterClient}`}>{f.client.toUpperCase()}</span>
                  </span>
                  <Link
                    to={`/work/${f.slug}`}
                    className={`t-mono ${styles.chapterLink}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    VIEW →
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* big type strap */}
      <section className={styles.strap}>
        <h1 className={`t-display ${styles.strapType}`}>
          HUMAN FIRST<span style={{ color: 'var(--dim)' }}>.</span>
          <br />
          <span style={{ color: 'var(--dim)' }}>AI AS</span> <span style={{ color: 'var(--accent)' }}>TOOL</span>
          <span style={{ color: 'var(--dim)' }}>.</span>
        </h1>
        <div className={styles.strapRow}>
          <p className={`t-mono ${styles.intro}`}>
            204 is a creative technology studio working at the intersection of AI, motion, identity and live
            environments. Based at RnA Studio, Lisbon — operating everywhere there's a signal.
          </p>
          <Link to="/work" className={`t-mono ${styles.cta}`}>
            EXPLORE OUR WORK
            <span className={styles.ctaArrow}>→</span>
          </Link>
        </div>
      </section>
    </div>
  )
}
