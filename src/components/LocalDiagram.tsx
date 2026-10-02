import { useEffect, useState } from 'react'

export function PlantUmlDiagram({ noteId, index, source }: { noteId: string; index: number; source: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!import.meta.env.DEV || !['localhost', '127.0.0.1', '::1', '[::1]'].includes(window.location.hostname)) return
    const controller = new AbortController()
    let objectUrl: string | undefined
    setUrl(null)
    setFailed(false)
    void fetch(`/__local/myshadow/${encodeURIComponent(noteId)}/diagram/${index}`, { cache: 'no-store', signal: controller.signal }).then(async response => {
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/png')) throw new Error()
      const image = await response.blob()
      if (controller.signal.aborted) return
      objectUrl = URL.createObjectURL(image)
      setUrl(objectUrl)
    }).catch(() => { if (!controller.signal.aborted) setFailed(true) })
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [noteId, index])
  return <figure className="local-diagram">
    {url ? <img src={url} alt="PlantUML diagram" /> : <p role="status">{failed ? 'Diagram unavailable.' : 'Rendering diagram…'}</p>}
    <details><summary>Diagram source</summary><pre><code>{source}</code></pre></details>
  </figure>
}


let mermaidQueue: Promise<unknown> = Promise.resolve()
let diagramId = 0

// Reject resource/configuration features before Mermaid creates its temporary DOM.
function safeMermaidSource(source: string) {
  const withoutBreaks = source.replace(/<br\s*\/?\s*>/gi, '')
  return source.length <= 20000 && !/^\s*---/.test(source)
    && !/%%\s*\{|(?:^|\n|;)\s*(?:click|properties|links|link|details)\b/i.test(source)
    && !/\b(?:img|image|icon|src|href)[\"\']?\s*[:=]|\b(?:url\s*\(|@import|@font-face)|(?:https?:|ftp:|data:|file:|javascript:|\/\/)/i.test(source)
    && !/<[a-z!\/][^>]*>/i.test(withoutBreaks)
}

function diagramSvg(svg: string) {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml')
  if (document.querySelector('parsererror')) throw new Error()
  document.querySelectorAll('script,image,foreignObject,iframe,object,embed').forEach(element => element.remove())
  document.querySelectorAll('*').forEach(element => {
    for (const attribute of [...element.attributes]) {
      if (/^on/i.test(attribute.name) || (/href$/i.test(attribute.name) && !attribute.value.startsWith('#')) || /(?:https?:|data:|javascript:|@import|@font-face)/i.test(attribute.value)) element.removeAttribute(attribute.name)
    }
  })
  return new XMLSerializer().serializeToString(document.documentElement)
}

export function MermaidDiagram({ source }: { source: string }) {
  const [theme, setTheme] = useState('light')
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const update = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
    update()
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!import.meta.env.DEV || !['localhost', '127.0.0.1', '::1', '[::1]'].includes(window.location.hostname)) return
    let cancelled = false
    let objectUrl: string | undefined
    setUrl(null)
    setFailed(false)
    const render = async () => {
      if (cancelled) return
      if (!safeMermaidSource(source)) throw new Error()
      const { default: mermaid } = await import('mermaid')
      if (cancelled) return
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', htmlLabels: false, theme: theme === 'dark' ? 'dark' : 'default', fontFamily: 'sans-serif', themeCSS: '', maxTextSize: 20000, suppressErrorRendering: true, flowchart: { htmlLabels: false }, secure: ['securityLevel', 'startOnLoad', 'maxTextSize', 'htmlLabels', 'flowchart', 'themeCSS', 'fontFamily', 'theme', 'secure', 'altFontFamily', 'themeVariables', 'maxEdges', 'suppressErrorRendering'] })
      const result = await mermaid.render(`local-mermaid-${++diagramId}`, source)
      if (cancelled) return
      objectUrl = URL.createObjectURL(new Blob([diagramSvg(result.svg)], { type: 'image/svg+xml' }))
      setUrl(objectUrl)
    }
    const pending = mermaidQueue.then(render)
    mermaidQueue = pending.catch(() => {})
    void pending.catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [source, theme])
  return <figure className="local-diagram local-mermaid">
    {url ? <img src={url} alt="Mermaid diagram" /> : <p role="status">{failed ? 'Diagram unavailable.' : 'Rendering diagram…'}</p>}
    <details><summary>Diagram source</summary><pre><code>{source}</code></pre></details>
  </figure>
}
