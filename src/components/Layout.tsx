import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { Nav } from './Nav'
import { CursorProvider } from './Cursor'
import { trackPageView } from '../lib/analytics'

export function Layout() {
  const { pathname, state } = useLocation()
  // pager links pass { pager: 'prev' | 'next' } — those get a fast
  // directional slide instead of the full entrance choreography
  const pager = (state as { pager?: 'prev' | 'next' } | null)?.pager
  const enterClass = pager === 'prev' ? 'page-pager-prev' : pager === 'next' ? 'page-pager-next' : 'page-enter'

  // Route change: reset scroll (SPA keeps scroll position by default).
  useEffect(() => {
    window.scrollTo(0, 0)
    // rAF: let useHead set the route title before it's reported
    const raf = requestAnimationFrame(() => trackPageView(window.location.pathname, document.title))
    return () => cancelAnimationFrame(raf)
  }, [pathname])

  return (
    <CursorProvider>
      <div className="grain">
        <Nav />
        <main style={{ paddingTop: 'var(--nav-h)', overflow: 'clip' }}>
          <div className={`shell ${enterClass}`} key={pathname}>
            <Outlet />
          </div>
        </main>
      </div>
    </CursorProvider>
  )
}
