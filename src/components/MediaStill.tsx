// MediaStill — renders real project media when available, falling back to the
// CinematicStill placeholder scenes. Video only plays when `playing` and
// motion is allowed (SPEC V7); otherwise the poster still is shown.

import { useEffect, useRef } from 'react'
import { CinematicStill } from './CinematicStill'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import type { Scene, WorkMedia } from '../data/studio'

interface MediaStillProps {
  scene: Scene
  media?: WorkMedia
  mini?: boolean
  playing?: boolean
  letterbox?: boolean
  scrim?: boolean
}

const GRAIN_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.95' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.85'/%3E%3C/svg%3E\")"

export function MediaStill({ scene, media, mini = false, playing = false, letterbox = false, scrim = false }: MediaStillProps) {
  const reducedMotion = usePrefersReducedMotion()
  const videoRef = useRef<HTMLVideoElement>(null)
  const useVideo = Boolean(media?.video) && playing && !reducedMotion

  useEffect(() => {
    if (useVideo) videoRef.current?.play().catch(() => {})
  }, [useVideo])

  if (!media?.still && !media?.video) {
    return <CinematicStill scene={scene} mini={mini} playing={playing} />
  }

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#0f0f0f' }} aria-hidden="true">
      {useVideo && media.video ? (
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          autoPlay
          poster={media.still}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        >
          <source src={media.video.webm} type="video/webm" />
          <source src={media.video.mp4} type="video/mp4" />
        </video>
      ) : (
        <img
          src={media.still ?? media.video?.mp4}
          alt=""
          loading="lazy"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
      {/* letterbox bars for the cinematic hero */}
      {letterbox && (
        <>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 28, background: '#000' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 28, background: '#000' }} />
        </>
      )}
      {/* dark scrim keeps busy photos as subtle as the placeholder scenes in bg use */}
      {scrim && <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,10,10,0.38)' }} />}
      {/* grain + vignette so real footage sits in the same grade as the scenes */}
      <div style={{ position: 'absolute', inset: 0, mixBlendMode: 'overlay', opacity: mini ? 0.12 : 0.18, backgroundImage: GRAIN_URL }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)' }} />
    </div>
  )
}
