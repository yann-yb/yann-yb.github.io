import { useEffect, useRef, useState, Children, isValidElement, type CSSProperties, type ReactNode } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { X } from 'lucide-react'
import { PlantUmlDiagram, MermaidDiagram } from './LocalDiagram'
import './myshadow-reader.css'

type Note = { id: string; title: string; path: string }
type Document = Note & { content: string; diagrams?: { index: number; line: number; language: 'plantuml' }[] }
function headingText(children: ReactNode): string {
  return Children.toArray(children).map(child => typeof child === 'string' || typeof child === 'number' ? String(child) : isValidElement<{ children?: ReactNode }>(child) ? headingText(child.props.children) : '').join('')
}
const headingId = (children: ReactNode) => headingText(children).toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-')

export function MyShadowReader() {
  const [available, setAvailable] = useState(false)
  const [index, setIndex] = useState<Note[]>([])
  const [indexStatus, setIndexStatus] = useState('Loading notes…')
  const [documents, setDocuments] = useState<Record<string, Document>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [stack, setStack] = useState<{ ids: string[]; active: string | null }>({ ids: [], active: null })
  const [width, setWidth] = useState(0)
  const workspace = useRef<HTMLDivElement>(null)
  const requests = useRef(new Map<string, AbortController>())
  useEffect(() => {
    if (!import.meta.env.DEV || !['localhost', '127.0.0.1', '::1', '[::1]'].includes(window.location.hostname)) return
    setAvailable(true)
    const controller = new AbortController()
    void fetch('/__local/myshadow', { cache: 'no-store', signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error()
      const result = await response.json() as { notes: Note[] }
      setIndex(result.notes)
      setIndexStatus(result.notes.length ? '' : 'No notes found.')
    }).catch(() => { if (!controller.signal.aborted) setIndexStatus('Notes are unavailable right now.') })
    return () => { controller.abort(); requests.current.forEach(request => request.abort()); requests.current.clear() }
  }, [])
  useEffect(() => {
    if (!available || !workspace.current) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(workspace.current)
    return () => observer.disconnect()
  }, [available])
  const activePane = stack.active ? stack.ids.indexOf(stack.active) + 1 : 0
  const indexWidth = Math.min(width * .28333, 408)
  const paneWidth = activePane < 2 ? width - indexWidth : Math.max(320, (width - (activePane - 1) * 40) / 2)
  const center = activePane < 2 ? indexWidth : Math.max(activePane * 40, width - paneWidth)
  const paneWidthStyle = activePane < 2 ? 'calc(100cqw - min(28.333cqw,408px))' : `max(320px,calc((100cqw - ${(activePane - 1) * 40}px)/2))`
  useEffect(() => {
    if (!available || !workspace.current) return
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
    const reveal = () => {
      workspace.current?.scrollTo({ left: activePane === 0 ? 0 : Math.max(0, center + paneWidth - width), behavior })
      workspace.current?.parentElement?.querySelector('[aria-current="step"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior })
    }
    const frame = requestAnimationFrame(() => {
      reveal()
      if (activePane) workspace.current?.querySelectorAll<HTMLElement>('.note-pane').item(activePane - 1)?.focus({ preventScroll: true })
    })
    const settled = window.setTimeout(reveal, behavior === 'instant' ? 0 : 250)
    return () => { cancelAnimationFrame(frame); clearTimeout(settled) }
  }, [available, activePane, stack.active, center, paneWidth, width])
  async function openNote(id: string, reset = false) {
    if (reset) {
      requests.current.forEach((request, pendingId) => {
        if (pendingId !== id) { request.abort(); requests.current.delete(pendingId) }
      })
      setDocuments(previous => previous[id] ? { [id]: previous[id] } : {})
      setErrors(previous => previous[id] ? { [id]: previous[id] } : {})
    }
    setStack(previous => ({ ids: reset ? [id] : previous.ids.includes(id) ? previous.ids : [...previous.ids, id], active: id }))
    if (documents[id] || requests.current.has(id)) return
    const controller = new AbortController()
    requests.current.set(id, controller)
    setErrors(previous => { const next = { ...previous }; delete next[id]; return next })
    try {
      const response = await fetch(`/__local/myshadow/${encodeURIComponent(id)}`, { cache: 'no-store', signal: controller.signal })
      if (!response.ok) throw new Error()
      const note = await response.json() as Document
      if (!controller.signal.aborted) setDocuments(previous => ({ ...previous, [id]: note }))
    } catch { if (!controller.signal.aborted) setErrors(previous => ({ ...previous, [id]: 'Couldn’t open this note.' })) }
    finally { if (requests.current.get(id) === controller) requests.current.delete(id) }
  }
  function closePane(position: number) {
    const remaining = stack.ids.slice(0, position)
    stack.ids.slice(position).forEach(id => { requests.current.get(id)?.abort(); requests.current.delete(id) })
    setDocuments(previous => Object.fromEntries(Object.entries(previous).filter(([id]) => remaining.includes(id))))
    setErrors(previous => Object.fromEntries(Object.entries(previous).filter(([id]) => remaining.includes(id))))
    setStack({ ids: remaining, active: remaining.at(-1) || null })
  }
  function paneStyle(position: number): CSSProperties {
    const base = activePane < 2 ? 'min(28.333cqw,408px)' : `max(${activePane * 40}px,calc(100cqw - var(--pane-width)))`
    const left = position < activePane ? `max(${position * 40}px,calc(${base} - ${activePane - position} * var(--pane-width)))` : activePane === 0 ? `calc(min(28.333cqw,408px) + ${position - 1} * var(--pane-width))` : `calc(${base} + ${position - activePane} * var(--pane-width))`
    return { '--pane-left': left } as CSSProperties
  }
  function folded(position: number) {
    const left = Math.max(position * 40, center - (activePane - position) * paneWidth)
    const next = Math.max((position + 1) * 40, center - (activePane - position - 1) * paneWidth)
    return position < activePane - 1 && next - left <= 40
  }
  function linkedNote(href: string, path: string) {
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(href)) return
    let target: string
    try { target = decodeURIComponent(href.split(/[?#]/)[0]) } catch { return }
    if (!/\.md$/i.test(target)) return
    const parts = target.startsWith('/') ? [] : path.split('/').slice(0, -1)
    for (const part of target.split('/')) {
      if (part === '..') { if (!parts.length) return; parts.pop() }
      else if (part && part !== '.') parts.push(part)
    }
    return index.find(note => note.path === parts.join('/'))
  }
  if (!available) return <main className="myshadow-unavailable"><h1>MyShadow</h1><p>This page is unavailable here.</p></main>
  return <main className="memo-notes myshadow-reader">
    <div className="notes-workspace" ref={workspace} style={{ '--pane-width': paneWidthStyle } as CSSProperties}>
      <aside className={`memo-index${folded(0) ? ' is-folded' : ''}${activePane === 0 ? ' is-active' : ''}`} aria-label="MyShadow index">
        <button className="note-rail" onClick={() => setStack(previous => ({ ...previous, active: null }))} aria-label="Show MyShadow index"><img src="/images/favicon.ico" alt="" width="16" height="16" /><span>Index</span></button>
        <div className="memo-index-content"><header>MyShadow</header>{indexStatus && <p className="myshadow-status" role="status">{indexStatus}</p>}{index.map(note => <button key={note.id} className="memo-index-entry" aria-current={stack.active === note.id ? 'page' : undefined} onClick={() => void openNote(note.id, true)}>{note.title}</button>)}</div>
      </aside>
      {!stack.ids.length && <p className="myshadow-placeholder">Choose a note.</p>}
      {stack.ids.map((id, position) => {
        const note = documents[id]
        const title = index.find(item => item.id === id)?.title || 'Note'
        return <article key={id} data-note-id={id} className={`note-pane${folded(position + 1) ? ' is-folded' : ''}${stack.active === id ? ' is-active' : ''}`} style={paneStyle(position + 1)} aria-label={title} tabIndex={-1}>
          <button className="note-rail" onClick={() => void openNote(id)} aria-label={`Show ${title}`}><img src="/images/favicon.ico" alt="" width="16" height="16" /><span>{title}</span></button>
          <header className="note-pane-header"><button className="note-pane-title" onClick={() => void openNote(id)}>{title}</button><button className="icon-button" aria-label={`Close ${title} pane`} onClick={() => closePane(position)}><X size={16} aria-hidden="true" /></button></header>
          <div className="note-pane-body">{note ? <div className="prose"><Markdown skipHtml remarkPlugins={[remarkGfm]} components={{
            pre: ({ children }) => {
              const child = Children.toArray(children)[0]
              if (isValidElement<{ className?: string; node?: { position?: { start: { line: number } } } }>(child) && (child.props.className === 'language-mermaid' || (/^language-(plantuml|puml)$/.test(child.props.className || '') && note.diagrams?.some(diagram => diagram.line === child.props.node?.position?.start.line)))) return <>{children}</>
              return <pre>{children}</pre>
            },
            code: ({ className, children, node }) => {
              if (className === 'language-mermaid') return <MermaidDiagram source={String(children).replace(/\n$/, '')} />
              const diagram = /^language-(plantuml|puml)$/.test(className || '') ? note.diagrams?.find(item => item.line === node?.position?.start.line) : undefined
              return diagram ? <PlantUmlDiagram noteId={id} index={diagram.index} source={String(children).replace(/\n$/, '')} /> : <code className={className}>{children}</code>
            },
            img: ({ alt }) => <span className="myshadow-image-placeholder">{alt ? `[Image: ${alt}]` : '[Image]'}</span>,
            h1: ({ children }) => <h1 id={`${id}-${headingId(children)}`}>{children}</h1>,
            h2: ({ children }) => <h2 id={`${id}-${headingId(children)}`}>{children}</h2>,
            h3: ({ children }) => <h3 id={`${id}-${headingId(children)}`}>{children}</h3>,
            a: ({ href, children }) => {
              const target = href ? linkedNote(href, note.path) : undefined
              if (target) return <button className="myshadow-note-link" onClick={() => void openNote(target.id)}>{children}</button>
              if (href?.startsWith('#')) return <a href={`#${id}-${href.slice(1)}`}>{children}</a>
              if (href && /^(https?:|mailto:)/i.test(href)) return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
              return <span>{children}</span>
            },
          }}>{note.content.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '')}</Markdown></div> : <p role="status">{errors[id] || 'Loading note…'}</p>}</div>
        </article>
      })}
    </div>
    {stack.ids.length > 0 && <nav className="memo-navigation" aria-label="MyShadow panes">{[null, ...stack.ids].map((id, position) => <button key={id || 'index'} aria-label={id ? `Show ${index.find(note => note.id === id)?.title || 'note'} pane` : 'Show MyShadow index'} aria-current={stack.active === id ? 'step' : undefined} onClick={() => setStack(previous => ({ ...previous, active: id }))} />)}</nav>}
  </main>
}
