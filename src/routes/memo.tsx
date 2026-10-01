import { Link2, X } from 'lucide-react'
import { createFileRoute, Link, useLocation } from '@tanstack/react-router'
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import Markdown from 'react-markdown'
import { memo, memoHashes } from 'virtual:personal-content'

const sections = memo.trim().split(/\n## /)
const notes = [
  { id: 'memo', title: sections[0].match(/^# (.+)$/m)?.[1] || 'Test page', content: sections[0] },
  ...sections.slice(1).map(section => {
    const title = section.split('\n')[0]
    return { id: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), title, content: `# ${section}` }
  }),
]
const noteById = new Map(notes.map(note => [note.id, note]))
const idByHash = new Map(Object.entries(memoHashes).map(([id, hash]) => [hash, id]))
const hashFor = (ids: string[]) => ids.map(id => memoHashes[id]).join('/')
const linksTo = (content: string, id: string) => [...content.matchAll(/\]\(#([a-z0-9-]+)\)/g)].some(match => match[1] === id)

export const Route = createFileRoute('/memo')({
  head: () => ({ meta: [{ title: 'Memo' }] }),
  validateSearch: (search: Record<string, unknown>): { notes?: string } => ({ notes: typeof search.notes === 'string' ? search.notes : undefined }),
  component: MemoTestPage,
})

function MemoTestPage() {
  const search = Route.useSearch()
  const hash = useLocation({ select: location => location.hash })
  const navigate = Route.useNavigate()
  const [ready, setReady] = useState(false)
  const [notice, setNotice] = useState('')
  const [paneSelection, setPaneSelection] = useState({ notes: '', index: 1 })
  const workspace = useRef<HTMLDivElement>(null)
  const [workspaceWidth, setWorkspaceWidth] = useState(0)
  useEffect(() => {
    setReady(true)
    const observer = new ResizeObserver(([entry]) => setWorkspaceWidth(entry.contentRect.width))
    if (workspace.current) observer.observe(workspace.current)
    return () => observer.disconnect()
  }, [])
  const chainKey = ready ? hash || search.notes || '' : ''
  const requested = !ready ? [] : hash ? hash.split('/').map(code => idByHash.get(code)).filter((id): id is string => !!id) : (search.notes || '').split(',')
  const selected = [...new Set(requested.filter(id => id !== 'memo' && noteById.has(id)))]
  const openIds = ['memo', ...selected]
  const activePane = paneSelection.notes === chainKey ? paneSelection.index : selected.length + 1
  const indexWidth = Math.min(workspaceWidth * .28333, 408)
  const paneWidth = activePane < 2 ? workspaceWidth - indexWidth : Math.max(320, (workspaceWidth - (activePane - 1) * 40) / 2)
  const paneWidthStyle = activePane < 2 ? 'calc(100cqw - min(28.333cqw,408px))' : `max(320px, calc((100cqw - ${(activePane - 1) * 40}px)/2))`
  function setActivePane(index: number) { setPaneSelection({ notes: chainKey, index }) }
  useEffect(() => {
    setNotice('')
    if (!ready) return
    setActivePane(selected.length + 1)
    const panes = workspace.current?.querySelectorAll<HTMLElement>('.note-pane:not(.note-pane-exit)')
    const pane = panes?.item(panes.length - 1)
    if (chainKey || paneSelection.notes !== chainKey) pane?.focus({ preventScroll: true })
  }, [ready, chainKey])
  useEffect(() => {
    if (!ready || !workspace.current) return
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
    const center = activePane < 2 ? indexWidth : Math.max(activePane * 40, workspaceWidth - paneWidth)
    const revealPane = () => {
      workspace.current?.scrollTo({ left: activePane === 0 ? 0 : Math.max(0, center + paneWidth - workspaceWidth), behavior })
      workspace.current?.parentElement?.querySelector('[aria-current="step"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior })
    }
    const frame = window.requestAnimationFrame(revealPane)
    const settled = window.setTimeout(revealPane, behavior === 'instant' ? 0 : 250)
    return () => { window.cancelAnimationFrame(frame); window.clearTimeout(settled) }
  }, [ready, activePane, chainKey, workspaceWidth, paneWidth])
  useEffect(() => {
    if (!ready) return
    const canonical = hashFor(selected)
    if (search.notes !== undefined || hash !== canonical) void navigate({ to: '/memo', search: {}, hash: canonical, replace: true })
  }, [ready, hash, search.notes])
  function openHash(id: string) {
    const next = openIds.includes(id) ? openIds : [...openIds, id]
    return hashFor(next.slice(1))
  }
  function openExisting(event: MouseEvent<HTMLAnchorElement>, id: string) {
    const index = openIds.indexOf(id)
    if (index < 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return
    event.preventDefault()
    setActivePane(index + 1)
    window.requestAnimationFrame(() => workspace.current?.querySelectorAll<HTMLElement>('.note-pane:not(.note-pane-exit)').item(index)?.focus({ preventScroll: true }))
  }
  function paneStyle(index: number): CSSProperties {
    const center = activePane < 2 ? 'min(28.333cqw,408px)' : `max(${activePane * 40}px, calc(100cqw - var(--pane-width)))`
    const left = index < activePane ? `max(${index * 40}px, calc(${center} - ${activePane - index} * var(--pane-width)))` : activePane === 0 ? `calc(min(28.333cqw, 408px) + ${index - 1} * var(--pane-width))` : `calc(${center} + ${index - activePane} * var(--pane-width))`
    return { '--pane-left': left } as CSSProperties
  }
  function isFolded(index: number) {
    const center = activePane < 2 ? indexWidth : Math.max(activePane * 40, workspaceWidth - paneWidth)
    const left = Math.max(index * 40, center - (activePane - index) * paneWidth)
    const next = Math.max((index + 1) * 40, center - (activePane - index - 1) * paneWidth)
    return index < activePane - 1 && next - left <= 40
  }
  function animateClose(index: number) {
    if (!workspace.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const panes = workspace.current.querySelectorAll<HTMLElement>('.note-pane:not(.note-pane-exit)')
    Array.from(panes).slice(index).forEach(pane => {
      const snapshot = pane.cloneNode(true) as HTMLElement
      snapshot.classList.add('note-pane-exit')
      snapshot.style.left = `${pane.offsetLeft}px`
      snapshot.style.width = `${pane.offsetWidth}px`
      snapshot.setAttribute('aria-hidden', 'true')
      snapshot.inert = true
      snapshot.removeAttribute('tabindex')
      workspace.current!.append(snapshot)
      snapshot.addEventListener('animationend', () => snapshot.remove(), { once: true })
      window.setTimeout(() => snapshot.remove(), 300)
    })
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(window.location.href); setNotice('Link copied') }
    catch { setNotice('Copy unavailable. Copy the URL from your browser.') }
  }
  return <main className="memo-notes">
    <div className="notes-workspace" ref={workspace} style={{ '--pane-width': paneWidthStyle } as CSSProperties}>
      <aside className={`memo-index${isFolded(0) ? ' is-folded' : ''}${activePane === 0 ? ' is-active' : ''}`} aria-label="Memo index">
        <button className="note-rail" onClick={() => setActivePane(0)} aria-label="Show memo index"><img src="/images/favicon.ico" alt="" width="16" height="16" /><span>Index</span></button>
        <div className="memo-index-content"><header>{notes.length} notes</header>{notes.map(note => <Link key={note.id} to="/memo" search={{}} hash={openHash(note.id)} onClick={event => openExisting(event, note.id)} className="memo-index-entry" aria-current={openIds[activePane - 1] === note.id ? 'page' : undefined}>{note.title}</Link>)}</div>
      </aside>
      {openIds.map((id, index) => {
        const note = noteById.get(id)!
        const backlinks = notes.filter(other => other.id !== id && linksTo(other.content, id))
        return <article className={`note-pane${isFolded(index + 1) ? ' is-folded' : ''}${index + 1 === activePane ? ' is-active' : ''}`} style={paneStyle(index + 1)} key={`${id}-${index}`} aria-label={note.title} tabIndex={-1}>
          <button className="note-rail" onClick={() => setActivePane(index + 1)} aria-label={`Show ${note.title}`}><img src="/images/favicon.ico" alt="" width="16" height="16" /><span>{note.title}</span></button>
          <header className="note-pane-header"><button className="note-pane-title" onClick={() => setActivePane(index + 1)}>{note.title}</button><div className="note-pane-actions"><button className="icon-button" onClick={copyLink} aria-label={`Copy ${note.title} link`} title="Copy link"><Link2 size={16} /></button>{index === 0 ? <Link to="/" className="icon-button" aria-label="Close memo" title="Close"><X size={16} /></Link> : <Link to="/memo" search={{}} hash={hashFor(openIds.slice(1, index))} onClick={event => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) animateClose(index) }} className="icon-button" aria-label={`Close ${note.title} pane`} title="Close"><X size={16} /></Link>}</div></header>
          <div className="note-pane-body">
            <div className="prose"><Markdown components={{ a: ({ href, children }) => href?.startsWith('#') && noteById.has(href.slice(1)) ? <Link to="/memo" search={{}} hash={openHash(href.slice(1))} onClick={event => openExisting(event, href.slice(1))}>{children}</Link> : <a href={href}>{children}</a> }}>{note.content}</Markdown></div>
            <section className="note-backlinks" aria-label={`Backlinks to ${note.title}`}><div className="note-backlinks-heading"><span><Link2 size={14} /> Backlinks</span><span>{backlinks.length}</span></div>{backlinks.length ? backlinks.map(backlink => <Link key={backlink.id} to="/memo" search={{}} hash={openHash(backlink.id)} onClick={event => openExisting(event, backlink.id)}>{backlink.title}</Link>) : <p className="muted">No backlinks found.</p>}</section>
          </div>
        </article>
      })}
    </div>
    <nav className="memo-navigation" aria-label="Memo panes">{['Index', ...openIds.map(id => noteById.get(id)!.title)].map((title, index) => <button key={index} aria-label={`Show ${title}${index === 0 ? '' : ' pane'}`} aria-current={activePane === index ? 'step' : undefined} title={title} onClick={() => setActivePane(index)} />)}</nav>
    <span className="sr-only" role="status">{notice}</span>
  </main>
}
