import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MediaStill } from '../components/MediaStill'
import { useHead } from '../hooks/useHead'
import { HERO_CHAPTERS, STUDIO } from '../data/studio'
import styles from './Home.module.css'

export function Home() {
  useHead(
    '204 · NO-CONTENT — Creative technology studio',
    '204 is a creative technology studio at the intersection of AI, motion, identity and live environments. Based at RnA Studio, Lisbon.',
  )
  const [activeFrame, setActiveFrame] = useState(0)
  const current = HERO_CHAPTERS[activeFrame]

  return (
    <div className={styles.root}>
      {/* hero media — featured work player + chapter rail */}
      <section className={styles.hero} aria-label={`${STUDIO.name} showreel`}>
        <div className={styles.still}>
          <MediaStill scene={current.scene} media={current.media} playing letterbox />
          {/* caption overlays */}
          <div className={`t-mono ${styles.captionLeft}`}>
            <div style={{ color: 'var(--accent)' }}>● NOW PLAYING</div>
            <div style={{ marginTop: 2 }}>
              CH.0{activeFrame + 1} / {current.title.toUpperCase()}
            </div>
            <div style={{ opacity: 0.6 }}>{current.client.toUpperCase()}</div>
          </div>
          <div className={`t-mono ${styles.captionRight}`}>
            <div>{current.code}</div>
            <div style={{ opacity: 0.6 }}>204.AI · REAL-TIME</div>
          </div>
          {/* big play button centered */}
          <div className={styles.playWrap}>
            <div className={styles.playRing}>
              <div className={styles.playTriangle} />
            </div>
          </div>
          {/* footer bar */}
          <div className={`t-mono ${styles.stillFooter}`}>
            <span>
              CH.0{activeFrame + 1} · {current.code}
            </span>
            <span style={{ opacity: 0.6 }}>
              REEL · PART {activeFrame + 1} OF {HERO_CHAPTERS.length}
            </span>
          </div>
        </div>

        {/* right rail: thumbnail stack */}
        <div className={styles.rail}>
          <div className={`t-mono ${styles.railHead}`}>/ CHAPTERS</div>
          <div className={styles.railList}>
            {HERO_CHAPTERS.map((f, i) => {
              const active = i === activeFrame
              return (
                <button
                  key={f.code}
                  onClick={() => setActiveFrame(i)}
                  className={`${styles.chapter} ${active ? styles.chapterActive : ''}`}
                >
                  <span className={styles.thumb}>
                    <MediaStill scene={f.scene} media={f.media} mini />
                    {active && <span className={styles.thumbRing} />}
                  </span>
                  <span>
                    <span className={`t-mono ${styles.chapterCode}`} style={{ color: active ? 'var(--accent)' : undefined }}>
                      CH.0{i + 1} · {f.code}
                    </span>
                    <span className={`t-display ${styles.chapterTitle}`} style={{ color: active ? 'var(--fg)' : 'var(--dim)' }}>
                      {f.title}
                    </span>
                    <span className={`t-mono ${styles.chapterClient}`}>{f.client.toUpperCase()}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* big type strap */}
      <section className={styles.strap}>
        <h1 className={`t-display ${styles.strapType}`}>
          HUMAN<span style={{ color: 'var(--dim)' }}>—</span>FIRST.
          <br />
          AI AS <span style={{ color: 'var(--accent)' }}>TOOL</span>
        </h1>
        <div className={styles.strapRow}>
          <p className={`t-mono ${styles.intro}`}>
            204 is a creative technology studio working at the intersection of AI, motion, identity and live
            environments. Based at RnA Studio, Lisbon — operating everywhere there's a signal.
          </p>
          <Link to="/work" className={`t-mono ${styles.cta}`}>
            → Selected Work
          </Link>
        </div>
      </section>
    </div>
  )
}
