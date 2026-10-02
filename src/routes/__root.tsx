import { Moon, Sun } from 'lucide-react'
import { AuthProvider } from '../components/AuthProvider'
import { LoginPopup } from '../components/LoginPopup'
import { createRootRoute, HeadContent, Link, Outlet, Scripts, useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import styles from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: '' },
      { name: 'description', content: 'Yihan Bao — software engineer. Systems, infrastructure, notes, and small tools.' },
      { name: 'robots', content: 'noindex, nofollow' },
      { name: 'color-scheme', content: 'light dark' },
    ],
    links: [{ rel: 'stylesheet', href: styles }, { rel: 'icon', href: '/images/favicon.ico', type: 'image/png' }],
  }),
  component: Root,
  notFoundComponent: () => <main className="article"><h1>Nothing here yet.</h1><Link to="/">Back to the dashboard →</Link></main>,
})

function Root() {
  const privateReader = useRouterState({ select: state => state.location.pathname.startsWith('/myshadow') })
  const [dark, setDark] = useState(false)
  useEffect(() => {
    let saved: string | null = null
    try { saved = localStorage.getItem('yann-theme') } catch { /* Storage may be disabled. */ }
    const preference = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
    setDark(preference)
    document.documentElement.dataset.theme = preference ? 'dark' : 'light'
  }, [])
  function toggleTheme() {
    const root = document.documentElement
    if (root.classList.contains('theme-changing')) return
    const next = !dark
    const applyTheme = () => {
      setDark(next)
      root.dataset.theme = next ? 'dark' : 'light'
      try { localStorage.setItem('yann-theme', next ? 'dark' : 'light') } catch { /* Theme still works for this visit. */ }
    }
    if (!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      applyTheme()
      return
    }
    root.style.setProperty('--theme-reveal-radius', `${Math.hypot(window.innerWidth, window.innerHeight) + 48}px`)
    root.classList.add('theme-changing')
    const transition = document.startViewTransition(() => flushSync(applyTheme))
    const finish = () => {
      root.classList.remove('theme-changing')
      root.style.removeProperty('--theme-reveal-radius')
    }
    transition.finished.then(finish, finish)
  }
  return <html lang="en"><head><HeadContent /></head><body>
    <a className="skip-link" href="#main">Skip to content</a>
    <AuthProvider><div className="site-shell">
      <header className="site-header">
        {privateReader ? <a href="/" className="wordmark" aria-label="Yann dashboard">.</a> : <Link to="/" className="wordmark" aria-label="Yann dashboard">.</Link>}
        <div className="header-actions">
          <button className="icon-button" onClick={toggleTheme} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}>{dark ? <Sun size={17} /> : <Moon size={17} />}</button>
          {!privateReader && <LoginPopup />}
        </div>
      </header>
      <div id="main"><Outlet /></div>
    </div>
    </AuthProvider><Scripts />
  </body></html>
}
