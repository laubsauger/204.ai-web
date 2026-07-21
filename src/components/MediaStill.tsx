// MediaStill — renders real project media when available, falling back to the
// CinematicStill placeholder scenes. Video only plays when `playing` and
// motion is allowed (SPEC V7); otherwise the poster still is shown.

import { useCallback, useEffect, useRef } from 'react'
import { rendition } from '../lib/media'
import { CinematicStill } from './CinematicStill'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { useMediaQuery } from '../hooks/useMediaQuery'
import type { Scene, WorkMedia } from '../data/studio'

interface MediaStillProps {
  scene: Scene
  media?: WorkMedia
  mini?: boolean
  playing?: boolean
  letterbox?: boolean
  scrim?: boolean
  /* default true; the hero player disables looping to drive auto-advance */
  loop?: boolean
  /* LCP hint: eager-load + fetchpriority=high (hero media only) */
  priority?: boolean
  /* exposes the underlying <video> so a host can build player controls */
  videoRef?: (el: HTMLVideoElement | null) => void | (() => void)
}

const GRAIN_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.95' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.85'/%3E%3C/svg%3E\")"

export function MediaStill({ scene, media, mini = false, playing = false, letterbox = false, scrim = false, loop = true, priority = false, videoRef }: MediaStillProps) {
  const reducedMotion = usePrefersReducedMotion()
  // No autoplay background video on small screens: it dominates constrained
  // bandwidth and registers a late LCP entry. Mobile gets the (preloaded)
  // still with Ken-Burns; the reel's still-timer drives auto-advance.
  const smallScreen = useMediaQuery('(max-width: 900px)')
  const innerVideoRef = useRef<HTMLVideoElement>(null)

  const useVideo = Boolean(media?.video) && playing && !reducedMotion && !smallScreen

  // stable identity — an inline ref arrow changes every render, which makes
  // React 19 run the ref cleanup + re-invoke it (host resets its player state)
  const mergedVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      innerVideoRef.current = el
      return videoRef?.(el)
    },
    [videoRef],
  )

  useEffect(() => {
    if (useVideo) innerVideoRef.current?.play().catch(() => {})
  }, [useVideo, media?.video?.mp4])

  if (!media?.still && !media?.video) {
    return <CinematicStill scene={scene} mini={mini} playing={playing} />
  }

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#0f0f0f' }} aria-hidden="true">
      {/* poster stays mounted under the video: the early img paint anchors
          LCP — an equal-size video frame later can't replace it */}
      {media.still && (
        <img
          src={letterbox ? media.still : rendition(media.still, mini ? 320 : 800)}
          /* responsive pick: rail thumbs ~160px desktop, work/service cards
             near full-width on mobile, hero letterbox full-res only on
             desktop — don't ship 1920w into a phone viewport. The letterbox
             srcset/sizes pair is mirrored by the generate-meta preload —
             keep both in sync or the preload double-downloads. */
          srcSet={
            media.still.startsWith('data:')
              ? undefined
              : letterbox
                ? `${rendition(media.still, 800)} 800w, ${media.still} 1920w`
                : [160, 320, 500, 800].map((w) => `${rendition(media.still!, w as 160 | 320 | 500 | 800)} ${w}w`).join(', ')
          }
          sizes={letterbox ? '(max-width: 900px) 100vw, 62vw' : mini ? '(max-width: 900px) 88vw, 160px' : '(max-width: 900px) 100vw, 60vw'}
          alt=""
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : undefined}
          decoding="async"
          onError={(e) => {
            if (media.still && e.currentTarget.src !== media.still) {
              e.currentTarget.srcset = ''
              e.currentTarget.src = media.still
            }
          }}
          className={!useVideo && playing && !reducedMotion ? 'kenburns' : undefined}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
      {useVideo && media.video ? (
        <video
          /* key forces a fresh element per source — <source> swaps alone
             don't make the browser load the new file */
          key={media.video.mp4}
          ref={mergedVideoRef}
          muted
          loop={loop}
          playsInline
          autoPlay
          preload="auto"
          onLoadedData={(e) => {
            if (playing) e.currentTarget.play().catch(() => {})
          }}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        >
          <source src={media.video.mp4} type="video/mp4" />
        </video>
      ) : null}

      {/* dark scrim keeps busy photos as subtle as the placeholder scenes in bg use */}
      {scrim && <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,10,10,0.38)' }} />}
      {/* grain so real footage sits in the same grade as the scenes */}
      <div style={{ position: 'absolute', inset: 0, mixBlendMode: 'overlay', opacity: mini ? 0.12 : 0.18, backgroundImage: GRAIN_URL }} />
      {/* small tiles keep a soft vignette; large media only gets caption
          scrims top + bottom so the footage itself stays clean */}
      {mini ? (
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)' }} />
      ) : (
        <div className="media-scrims" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', transition: 'opacity 0.35s' }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '32%', background: 'linear-gradient(180deg, rgba(0,0,0,0.72) 0%, transparent 100%)' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '26%', background: 'linear-gradient(0deg, rgba(0,0,0,0.62) 0%, transparent 100%)' }} />
        </div>
      )}
    </div>
  )
}
