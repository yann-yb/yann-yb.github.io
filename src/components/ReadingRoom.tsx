import { Newspaper, RefreshCw, X } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthProvider'
import { loadNewsroom, markNewsRead, NewsroomAccessError, type NewsroomAccess, type NewsArticle, type NewsFeed } from '../lib/newsroom-data'
import './reading-room.css'

const storageKey = 'dashboard-newsroom-read'
const sources = ['Yahoo Finance', 'Reuters', 'SemiAnalysis']
function safeUrl(value: string) {
  try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '' }
  catch { return '' }
}

export function ReadingTile() {
  return <Link to="/reading" className="card tile-s clickable-card reading-tile" aria-label="Newsroom">
    <div className="card-label">Newsroom <Newspaper size={16} aria-hidden="true" /></div>
    <div className="reading-tile-art" aria-hidden="true"><Newspaper size={48} strokeWidth={1.2} /><span /></div>
    <p>Headlines worth a look.</p>
  </Link>
}

export function ReadingRoom() {
  const { user, loading, isApproved, authorization, refreshAuthorization, devPreview, isDevPreviewMode } = useAuth()
  if (loading) return <main className="newsroom"><h1>Newsroom</h1><p className="newsroom-status">Loading…</p></main>
  if (isDevPreviewMode && devPreview) return <NewsroomSession key="local-preview" access={{ mode: 'local' }} />
  if (!isDevPreviewMode && user && isApproved) return <NewsroomSession key={user.id} access={{ mode: 'cloud', userId: user.id }} onAccessLost={refreshAuthorization} />
  return <main className="newsroom"><h1>Newsroom</h1><p className="newsroom-status">{authorization === 'checking' ? 'Checking access…' : authorization === 'error' ? 'Couldn’t check access.' : user ? 'Newsroom unavailable.' : 'Sign in to read your news.'}</p>{authorization === 'error' && <button className="newsroom-refresh" onClick={refreshAuthorization}>Try again</button>}</main>
}

function NewsroomSession({ access, onAccessLost }: { access: NewsroomAccess; onAccessLost?: () => void }) {
  const cloud = access.mode === 'cloud'
  const [ready, setReady] = useState(false)
  const [read, setRead] = useState<Set<string>>(new Set())
  const readIds = useRef<Set<string>>(new Set())
  const [feed, setFeed] = useState<NewsFeed | null>(null)
  const [panels, setPanels] = useState<NewsArticle[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const [sessionOnly, setSessionOnly] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [failedReads, setFailedReads] = useState<string[]>([])
  const [savingReads, setSavingReads] = useState<string[]>([])
  const sessionController = useRef<AbortController | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    sessionController.current = controller
    return () => controller.abort()
  }, [])
  const list = useRef<HTMLUListElement>(null)
  const listPane = useRef<HTMLElement>(null)
  const panelNodes = useRef(new Map<string, HTMLElement>())
  const refreshButton = useRef<HTMLButtonElement>(null)
  const stack = useRef<HTMLDivElement>(null)
  const [stackWidth, setStackWidth] = useState(0)
  useEffect(() => {
    if (!stack.current) return
    const observer = new ResizeObserver(entries => setStackWidth(entries[0].contentRect.width))
    observer.observe(stack.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!cloud) try {
      const saved: unknown = JSON.parse(localStorage.getItem(storageKey) || '[]')
      if (Array.isArray(saved)) readIds.current = new Set(saved.filter((id): id is string => typeof id === 'string'))
    } catch { setSessionOnly(true) }
    setRead(readIds.current)
    setReady(true)
  }, [])
  useEffect(() => {
    if (!ready || cloud) return
    try { localStorage.setItem(storageKey, JSON.stringify([...read])) }
    catch { setSessionOnly(true) }
  }, [ready, read, cloud])
  useEffect(() => {
    if (!ready) return
    const controller = new AbortController()
    setPending(true)
    setFailed(false)
    void loadNewsroom(access, controller.signal).then(result => {
      if (!Array.isArray(result.articles) || !Array.isArray(result.unavailableSources)) throw new Error()
      const unique = new Set<string>()
      const articles = result.articles.filter(article => {
        if (!article || typeof article.id !== 'string' || typeof article.title !== 'string' || typeof article.url !== 'string' || !sources.includes(article.source) || !safeUrl(article.url) || unique.has(article.id) || readIds.current.has(article.id)) return false
        unique.add(article.id)
        return true
      }).map(article => ({ ...article, url: safeUrl(article.url), tickers: Array.isArray(article.tickers) ? article.tickers.filter(ticker => typeof ticker === 'string') : [], sector: typeof article.sector === 'string' ? article.sector : '', impact: ['positive', 'negative'].includes(article.impact) ? article.impact : 'unclear' } as NewsArticle))
      if (!controller.signal.aborted) setFeed({ ...result, articles, unavailableSources: result.unavailableSources.filter(source => sources.includes(source)) })
    }).catch(error => { if (!controller.signal.aborted) { if (error instanceof NewsroomAccessError) { setFeed(null); setPanels([]); onAccessLost?.() } setFailed(true) } })
      .finally(() => { if (!controller.signal.aborted) setPending(false) })
    return () => controller.abort()
  }, [ready, refresh])
  useEffect(() => {
    const node = active ? panelNodes.current.get(active) : listPane.current
    node?.focus({ preventScroll: true })
    node?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [active])
  function open(article: NewsArticle) {
    setPanels(previous => previous.some(item => item.id === article.id) ? previous : [...previous, article])
    setActive(article.id)
  }
  function close(id: string) {
    setPanels(previous => previous.filter(item => item.id !== id))
    setActive(current => current === id ? null : current)
  }
  async function saveRead(id: string) {
    const signal = sessionController.current?.signal
    if (!signal || signal.aborted) return
    setSavingReads(previous => [...previous, id])
    setFailedReads(previous => previous.filter(value => value !== id))
    try {
      await markNewsRead(id, access, signal)
      if (!signal.aborted) { removeRead(id); setRefresh(value => value + 1) }
    } catch (error) {
      if (signal.aborted) return
      if (error instanceof NewsroomAccessError) { setFeed(null); setPanels([]); onAccessLost?.(); return }
      setFailedReads(previous => previous.includes(id) ? previous : [...previous, id])
    } finally { if (!signal.aborted) setSavingReads(previous => previous.filter(value => value !== id)) }
  }
  function removeRead(id: string) {
    close(id)
    readIds.current = new Set([...readIds.current, id])
    setRead(readIds.current)
    setFeed(previous => previous ? { ...previous, articles: previous.articles.filter(article => article.id !== id) } : previous)
  }
  function markRead(id: string) {
    if (cloud) void saveRead(id)
    else removeRead(id)
  }
  const articles = feed?.articles.slice(0, 20) || []
  let fullCount = Math.max(1, Math.floor((stackWidth - 300 - panels.length * 40) / 320))
  fullCount = Math.min(3, fullCount, panels.length)
  const focusIndex = active ? panels.findIndex(article => article.id === active) : panels.length - 1
  const fullStart = Math.max(0, Math.min(focusIndex - fullCount + 1, panels.length - fullCount))
  const expanded = new Set(panels.slice(fullStart, fullStart + fullCount).map(article => article.id))
  const updatedAt = feed ? new Date(feed.updatedAt) : null
  return <main className="newsroom">
    <header className="newsroom-heading"><div><h1>Newsroom</h1><p>Yahoo Finance · Reuters · SemiAnalysis</p></div><button ref={refreshButton} className="newsroom-refresh" disabled={pending} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={14} aria-hidden="true" /> Refresh</button></header>
    {!!panels.length && <nav className="newsroom-tabs" aria-label="Open analyses"><button aria-current={active === null ? 'page' : undefined} onClick={() => setActive(null)}>News list</button>{panels.map(article => <button key={article.id} aria-current={active === article.id ? 'page' : undefined} onClick={() => setActive(article.id)}>{article.title}</button>)}</nav>}
    <div ref={stack} className="newsroom-stack" data-has-panels={panels.length > 0}>
      <section ref={listPane} className="newsroom-inbox" data-active={active === null} tabIndex={-1} aria-label="News list">
        <div className="newsroom-status" role="status" aria-live="polite">
          {pending && <p>Updating headlines…</p>}
          {failed && <p>{feed ? 'Couldn’t refresh. Showing the last available headlines.' : 'Headlines are unavailable. Try refreshing.'}</p>}
          {feed?.unavailableSources.length ? <p>Unavailable: {feed.unavailableSources.join(', ')}.</p> : null}
          {sessionOnly && <p>Read marks are kept for this session.</p>}
        </div>
        {!!articles.length && <ul ref={list} className="newsroom-list" aria-label="Unread headlines">{articles.map(article => <li className="newsroom-row" key={article.id}>
          <button className="newsroom-headline" onClick={() => open(article)}>{article.title}</button>
          <div className="newsroom-meta"><span className="newsroom-source">{article.source}</span>{article.tickers.length > 0 && <span>{article.tickers.join(', ')}</span>}{article.sector && <span>{article.sector}</span>}<span className="newsroom-impact" data-impact={article.impact}>{article.impact === 'unclear' ? 'Mixed / unclear' : `Likely ${article.impact}`}</span></div>
          {article.reason && <p className="newsroom-reason">{article.reason}</p>}
        </li>)}</ul>}
        {!pending && !failed && feed && !articles.length && <p className="newsroom-status">No unread headlines.</p>}
        {updatedAt && !Number.isNaN(updatedAt.getTime()) && <p className="newsroom-updated">Updated <time dateTime={updatedAt.toISOString()}>{updatedAt.toLocaleString()}</time></p>}
      </section>
      {panels.map(article => <section key={article.id} ref={node => { if (node) panelNodes.current.set(article.id, node); else panelNodes.current.delete(article.id) }} className="newsroom-analysis" data-active={active === article.id} data-expanded={expanded.has(article.id)} tabIndex={-1} aria-label={`Analysis: ${article.title}`}>
        <button className="newsroom-panel-close" aria-label={`Close analysis: ${article.title}`} onClick={() => close(article.id)}><X size={16} aria-hidden="true" /></button>
        <button className="newsroom-rail" onClick={() => setActive(article.id)} aria-label={`Open analysis: ${article.title}`}>{article.title}</button>
        <div className="newsroom-analysis-body">
          <label className="newsroom-read"><input type="checkbox" checked={false} disabled={savingReads.includes(article.id)} onChange={() => markRead(article.id)} aria-label={`Mark as read: ${article.title}`} /><span>{savingReads.includes(article.id) ? 'Saving…' : 'Mark as read'}</span></label>
          {failedReads.includes(article.id) && <p className="newsroom-status" role="alert">Couldn’t mark this story as read. Try again.</p>}
          <a className="newsroom-original" href={article.url} target="_blank" rel="noopener noreferrer">{article.source} · Original article ↗</a>
          <h2>{article.title}</h2>
          <p className="newsroom-analysis-meta">{[...article.tickers, article.sector, article.impact === 'unclear' ? 'Mixed / unclear' : `Likely ${article.impact}`].filter(Boolean).join(' · ')}</p>
          {article.analysis ? <>
            <AnalysisSection title="What happened" text={article.analysis.summary} />
            <AnalysisSection title="Why it matters" text={article.analysis.whyItMatters} />
            <AnalysisSection title="Opposing signals & gaps" text={article.analysis.risks} />
            <AnalysisSection title="What to watch" text={article.analysis.watchNext} />
            <p className="newsroom-evidence">Based on {article.analysis.evidence === 'full-text' ? 'article text' : article.analysis.evidence === 'excerpt' ? 'the available excerpt' : 'the headline only'}.</p>
          </> : <p className="newsroom-status">Analysis isn’t available for this story yet. The original article is linked above.</p>}
        </div>
      </section>)}
    </div>
  </main>
}

function AnalysisSection({ title, text }: { title: string; text: string }) {
  return text ? <section className="newsroom-analysis-section"><h3>{title}</h3><p>{text}</p></section> : null
}
