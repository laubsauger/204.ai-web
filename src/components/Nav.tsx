import { NavLink, Link } from 'react-router-dom'
import { LOGO_URL } from '../data/studio'
import { trackCta } from '../lib/analytics'
import { rendition } from '../lib/media'
import styles from './Nav.module.css'

const ITEMS = [
  { to: '/', label: 'Index' },
  { to: '/work', label: 'Work' },
  { to: '/services', label: 'Services' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
]

export function Nav() {
  return (
    <header className={styles.root} data-organism-obstacle data-organism-padding="12" data-organism-weight="2">
      <div className={styles.inner}>
      <Link to="/" className={styles.logo} aria-label="204 · NO-CONTENT — home">
        <img
          src={rendition(LOGO_URL, 320)}
          srcSet={`${rendition(LOGO_URL, 160)} 160w, ${rendition(LOGO_URL, 320)} 320w`}
          sizes="110px"
          onError={(e) => {
            e.currentTarget.srcset = ''
            if (e.currentTarget.src !== LOGO_URL) e.currentTarget.src = LOGO_URL
          }}
          alt="204 · NO-CONTENT"
          className={styles.logoImg}
        />
      </Link>

      <nav className={styles.nav} aria-label="Main">
        {ITEMS.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.to === '/'}
            className={({ isActive }) => `${styles.link} ${isActive ? styles.linkIsActive : ''}`}
          >
            {({ isActive }) => (
              <>
                <span className={isActive ? styles.linkActive : styles.linkLabel}>{it.label}</span>
                {isActive && <span className={styles.underline} />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <Link to="/contact" className={styles.status} onClick={() => trackCta('work_with_us')}>
        <span className={styles.statusBooking}>● RNA STUDIO · LISBOA</span>
        <span className={styles.statusCta}>WORK WITH US →</span>
      </Link>
      </div>
    </header>
  )
}
