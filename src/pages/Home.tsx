import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MediaStill } from '../components/MediaStill'
import { useHead } from '../hooks/useHead'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { HERO_CHAPTERS, PARTNERS, STUDIO, TRUSTED_BY, type PartnerLogo } from '../data/studio'
import { trackChapterSelect, trackCta, trackPlayToggle } from '../lib/analytics'
import { rendition } from '../lib/media'
import styles from './Home.module.css'

function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

export function Home() {
  useHead(
    '',
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
  // MediaStill skips autoplay video ≤900px (mobile LCP) — mirror that here,
  // else the reel waits for video events that never come and sticks (§B8)
  const smallScreen = useMediaQuery('(max-width: 900px)')
  const hasVideo = Boolean(current.media?.video) && !reducedMotion && !smallScreen
  const hasPlayer = !reducedMotion

  const advance = useCallback(() => {
    setActiveFrame((i) => (i + 1) % HERO_CHAPTERS.length)
  }, [])

  const selectFrame = (i: number) => {
    pausedRef.current = false
    setIsPaused(false)
    setActiveFrame(i)
    trackChapterSelect(HERO_CHAPTERS[i].title)
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
      trackPlayToggle(el.paused ? 'play' : 'pause', current.title)
      if (el.paused) el.play().catch(() => {})
      else el.pause()
      return
    }
    // still chapter: pause/resume the auto-advance timer
    pausedRef.current = !pausedRef.current
    setIsPaused(pausedRef.current)
    trackPlayToggle(pausedRef.current ? 'pause' : 'play', current.title)
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
    <>
    <div className={styles.root}>
      {/* hero media — featured work player + chapter rail */}
      <section className={styles.hero} aria-label={`${STUDIO.name} showreel`} data-organism-obstacle data-organism-padding="20">
        <div
          className={`${styles.still} anim-media`}
          data-cursor={hasPlayer ? (isPaused ? 'PLAY' : 'PAUSE') : undefined}
          onClick={hasPlayer ? togglePlay : undefined}
          onKeyDown={hasPlayer ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePlay() } } : undefined}
          role={hasPlayer ? 'button' : undefined}
          tabIndex={hasPlayer ? 0 : undefined}
          aria-label={hasPlayer ? (isPaused ? 'Play showreel' : 'Pause showreel') : undefined}
        >
          <MediaStill scene={current.scene} media={current.media} playing letterbox loop={false} priority videoRef={bindVideo} />
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
        <div className={`${styles.rail} anim-fade`}>
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
                  data-cursor="PLAY"
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
      {/* organism obstacles: mark the CONTENT blocks, not the full-width
          section — the creature needs the negative space between them */}
      <section className={styles.strap}>
        <h1 className={`t-display ${styles.strapType}`} data-organism-obstacle data-organism-padding="24">
          HUMAN FIRST<span style={{ color: 'var(--dim)' }}>.</span>
          <br />
          <span style={{ color: 'var(--dim)' }}>AI AS</span> <span style={{ color: 'var(--accent)' }}>TOOL</span>
          <span style={{ color: 'var(--dim)' }}>.</span>
        </h1>
        <div className={`${styles.strapRow} anim-fade`}>
          <p className={`t-mono ${styles.intro}`} data-organism-obstacle data-organism-padding="20">
            204 is a creative technology studio working at the intersection of AI, motion, identity and live
            environments. Based at RnA Studio, Lisbon — operating everywhere there's a signal.
          </p>
          <Link to="/work" className={`t-mono ${styles.cta}`} onClick={() => trackCta('explore_work')} data-organism-obstacle data-organism-padding="20">
            EXPLORE OUR WORK
            <span className={styles.ctaArrow}>→</span>
          </Link>
        </div>
      </section>
    </div>

      {/* below the fold: trusted-by marquee + global partners */}
      <section className={styles.logos} aria-label="Trusted by">
        <div className={styles.logosHead}>
          <span className="t-label">/ TRUSTED BY</span>
          <span className={styles.logosRule} />
        </div>
        <div data-organism-obstacle data-organism-padding="14" data-organism-weight="0.6" data-organism-allow-tendrils="true">
          <LogoMarquee items={TRUSTED_BY} />
        </div>

        <div className={styles.logosHead}>
          <span className="t-label">/ GLOBAL PARTNERS & DISTRIBUTION</span>
          <span className={styles.logosRule} />
        </div>
        <div className={styles.partnersRow} data-organism-obstacle data-organism-padding="14" data-organism-weight="0.6" data-organism-allow-tendrils="true">
          {PARTNERS.map((p) => (
            <PartnerMark key={p.name} item={p} />
          ))}
        </div>
      </section>
    </>
  )
}

// Logo (linked when a url is set — internal → router link, external → new tab)
function PartnerMark({ item, hidden = false }: { item: PartnerLogo; hidden?: boolean }) {
  const img = (
    <img
      src={rendition(item.logo, 320)}
      srcSet={[160, 320, 500].map((w) => `${rendition(item.logo, w as 160 | 320 | 500)} ${w}w`).join(', ')}
      /* lazy → `auto` resolves to the logo's real rendered width */
      sizes="auto, 200px"
      onError={(e) => {
        e.currentTarget.srcset = ''
        if (e.currentTarget.src !== item.logo) e.currentTarget.src = item.logo
      }}
      alt={hidden ? '' : item.name}
      title={item.name}
      className={styles.logo}
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  )
  if (!item.url) return img
  return item.url.startsWith('/') ? (
    <Link to={item.url} className={styles.logoLink} aria-hidden={hidden} tabIndex={hidden ? -1 : undefined}>
      {img}
    </Link>
  ) : (
    <a href={item.url} target="_blank" rel="noreferrer" className={styles.logoLink} aria-hidden={hidden} tabIndex={hidden ? -1 : undefined}>
      {img}
    </a>
  )
}

// Auto-scrolling marquee, scrubbable by drag. rAF-driven so drag and
// auto-scroll share one offset; a real drag suppresses the logo links'
// click. Reduced motion renders a static wrapped grid instead.
function LogoMarquee({ items }: { items: PartnerLogo[] }) {
  const reducedMotion = usePrefersReducedMotion()
  const trackRef = useRef<HTMLDivElement | null>(null)
  const offset = useRef(0)
  const dragging = useRef(false)
  const hovering = useRef(false)
  const moved = useRef(0)
  const lastX = useRef(0)
  const [grabbing, setGrabbing] = useState(false)

  useEffect(() => {
    if (reducedMotion) return
    let raf: number
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      const el = trackRef.current
      if (el) {
        if (!dragging.current && !hovering.current) offset.current -= 30 * dt
        const half = el.scrollWidth / 2
        if (half > 0) {
          let o = offset.current % half
          if (o > 0) o -= half
          offset.current = o
          el.style.transform = `translateX(${o}px)`
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reducedMotion])

  if (reducedMotion) {
    return (
      <div className={styles.marqueeStatic}>
        {items.map((p) => (
          <PartnerMark key={p.name} item={p} />
        ))}
      </div>
    )
  }

  // NOTE: no setPointerCapture here — capturing retargets the derived click
  // to the container, which would swallow the logo links' clicks entirely.
  // Drag tracking runs on window listeners installed at pointerdown instead.
  const startDrag = (e: React.PointerEvent) => {
    dragging.current = true
    moved.current = 0
    lastX.current = e.clientX
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - lastX.current
      lastX.current = ev.clientX
      offset.current += dx
      moved.current += Math.abs(dx)
      if (moved.current > 4) setGrabbing(true)
    }
    const up = () => {
      dragging.current = false
      setGrabbing(false)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  return (
    <div
      className={`${styles.marquee} ${grabbing ? styles.marqueeGrabbing : ''}`}
      data-cursor="DRAG"
      onPointerEnter={() => (hovering.current = true)}
      onPointerLeave={() => (hovering.current = false)}
      onPointerDown={startDrag}
      onClickCapture={(e) => {
        if (moved.current > 6) {
          e.preventDefault()
          e.stopPropagation()
        }
      }}
    >
      <div ref={trackRef} className={styles.marqueeTrack}>
        {[...items, ...items].map((p, i) => (
          <PartnerMark key={`${p.name}-${i}`} item={p} hidden={i >= items.length} />
        ))}
      </div>
    </div>
  )
}
