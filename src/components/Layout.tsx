import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { Nav } from './Nav'
import { CursorProvider } from './Cursor'

export function Layout() {
  const { pathname } = useLocation()

  // Route change: reset scroll (SPA keeps scroll position by default).
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <CursorProvider>
      <div className="grain">
        <Nav />
        <main style={{ paddingTop: 'var(--nav-h)' }}>
          <div className="shell page-enter" key={pathname}>
            <Outlet />
          </div>
        </main>
      </div>
    </CursorProvider>
  )
}
