import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createHash } from 'node:crypto'
import { DOMParser } from '@oozcitak/dom'

type Source = 'Yahoo Finance' | 'Reuters' | 'SemiAnalysis'
type Article = { id: string; title: string; url: string; source: Source; publishedAt: string | null; impact: 'positive' | 'negative' | 'unclear'; reason?: string; tickers: string[]; sector: string }
type Feed = { source: Source; url: string; articleHosts: string[] }
const feeds: Feed[] = [
  { source: 'Yahoo Finance', url: 'https://finance.yahoo.com/rss/', articleHosts: ['finance.yahoo.com'] },
  { source: 'SemiAnalysis', url: 'https://semianalysis.com/feed/', articleHosts: ['semianalysis.com', 'www.semianalysis.com', 'newsletter.semianalysis.com'] },
]
const endpoint = '/__local/newsroom'
const maxFeedBytes = 2 * 1024 * 1024
const cacheMs = 5 * 60 * 1000
const companies = [
  ['NVDA', 'Nvidia', 'Semiconductors'], ['AMD', 'Advanced Micro Devices|AMD', 'Semiconductors'],
  ['INTC', 'Intel', 'Semiconductors'], ['TSM', 'TSMC|Taiwan Semiconductor', 'Semiconductors'],
  ['AVGO', 'Broadcom', 'Semiconductors'], ['MU', 'Micron', 'Semiconductors'],
  ['ASML', 'ASML', 'Semiconductors'], ['ARM', 'Arm Holdings', 'Semiconductors'],
  ['ORCL', 'Oracle', 'Technology'], ['ANET', 'Arista', 'Technology'], ['SMCI', 'Supermicro|Super Micro', 'Technology'],
  ['AAPL', 'Apple', 'Technology'], ['MSFT', 'Microsoft', 'Technology'],
  ['GOOGL', 'Alphabet|Google', 'Technology'], ['AMZN', 'Amazon', 'Technology'],
  ['META', 'Meta', 'Technology'], ['TSLA', 'Tesla', 'Automotive'],
  ['JPM', 'JPMorgan|JP Morgan', 'Banking'], ['BAC', 'Bank of America', 'Banking'],
  ['GS', 'Goldman Sachs', 'Banking'], ['XOM', 'Exxon|ExxonMobil', 'Energy'], ['CVX', 'Chevron', 'Energy'],
] as const

export function headlineImpact(title: string) {
  const matches = companies.filter(([ticker, names]) => new RegExp(`\\b(?:${names})\\b|\\$${ticker}\\b|\\(${ticker}\\)|\\b(?:NASDAQ|NYSE):\\s*${ticker}\\b`, 'i').test(title))
  const tickers = matches.map(([ticker]) => ticker)
  const sectors = new Set(matches.map(([, , sector]) => sector))
  const sector = sectors.size === 1 ? [...sectors][0] : sectors.size > 1 ? 'Market-wide' : /\b(?:semiconductor|chips?|chipmakers?)\b/i.test(title) ? 'Semiconductors' : /\b(?:oil|gas|energy|crude)\b/i.test(title) ? 'Energy' : /\b(?:banks?|banking|lenders?)\b/i.test(title) ? 'Banking' : /\b(?:technology|tech|AI|software)\b/i.test(title) ? 'Technology' : /\b(?:markets?|stocks|nasdaq|dow|S&P|inflation|interest rates|Federal Reserve)\b/i.test(title) ? 'Market-wide' : 'Unspecified'
  const uncertain = tickers.length > 1 || /\b(?:not|no|fails?|without|despite|but|mixed|may|could|might|expects?|expected|will|would|if)\b|\?/i.test(title)
  const beat = /\b(?:earnings|profit|revenue|sales)\s+(?:beats?|tops?|topped)\s+(?:estimates|expectations|forecasts)\b|\bbeats?\s+(?:earnings|profit|revenue|sales)\s+(?:estimates|expectations|forecasts)\b/i.test(title)
  const miss = /\b(?:earnings|profit|revenue|sales)\s+miss(?:es)?\s+(?:estimates|expectations|forecasts)\b|\bmiss(?:es)?\s+(?:earnings|profit|revenue|sales)\s+(?:estimates|expectations|forecasts)\b/i.test(title)
  const raised = /\b(?:raises?|raised|lifts?|lifted)\s+(?:its\s+)?(?:(?:full[- ]year|annual|quarterly|profit|earnings|revenue|sales)\s+)*(?:guidance|outlook|forecast)\b/i.test(title)
  const cut = /\b(?:cuts?|lower(?:s|ed)?|slashed|slashes)\s+(?:its\s+)?(?:(?:full[- ]year|annual|quarterly|profit|earnings|revenue|sales)\s+)*(?:guidance|outlook|forecast)\b/i.test(title)
  const rose = /\b(?:stocks?|shares?|markets?|nasdaq|dow|S&P 500)\s+(?:rise|rises|rally|rallies|jump|jumps|gain|gains|surge|surges)\b/i.test(title)
  const fell = /\b(?:stocks?|shares?|markets?|nasdaq|dow|S&P 500)\s+(?:fall|falls|drop|drops|decline|declines|plunge|plunges|slide|slides)\b/i.test(title)
  const marketMovement = /\b(?:stocks|markets?|nasdaq|dow|S&P 500)\s+(?:rise|rises|rally|rallies|jump|jumps|gain|gains|surge|surges|fall|falls|drop|drops|decline|declines|plunge|plunges|slide|slides)\b/i.test(title)
  const identifiedCompany = tickers.length === 1
  const positive = (identifiedCompany && (beat || raised)) || (rose && (identifiedCompany || marketMovement))
  const negative = (identifiedCompany && (miss || cut)) || (fell && (identifiedCompany || marketMovement))
  const impact = !uncertain && positive !== negative ? positive ? 'positive' : 'negative' : 'unclear'
  const reason = impact === 'unclear' ? undefined : beat ? 'Potentially positive: earnings beat' : raised ? 'Potentially positive: raised outlook' : rose ? 'Headline reports a market rise' : miss ? 'Potentially negative: earnings miss' : cut ? 'Potentially negative: reduced outlook' : 'Headline reports a market decline'
  return { tickers, sector, impact, ...(reason ? { reason } : {}) } as Pick<Article, 'tickers' | 'sector' | 'impact' | 'reason'>
}

export function parseFeed(xml: string, feed: Feed): Article[] {
  if (Buffer.byteLength(xml) > maxFeedBytes || /<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) throw new Error('Unavailable')
  const root = new DOMParser().parseFromString(xml, 'application/xml')
  if (!root.documentElement || !['rss', 'feed'].includes(root.documentElement.localName)) throw new Error('Unavailable')
  type XmlNode = { nodeType: number; childNodes: Iterable<XmlNode>; textContent: string | null }
  const entries: XmlNode[] = []
  function walk(node: XmlNode, depth = 0) {
    if (depth > 32) throw new Error('Unavailable')
    if (node.nodeType === 1 && ['item', 'entry'].includes((node as XmlNode & { localName: string }).localName)) { if (entries.length < 100) entries.push(node); return }
    for (const child of node.childNodes) walk(child, depth + 1)
  }
  walk(root)
  return entries.flatMap(entry => {
    const children = [...entry.childNodes].filter(node => node.nodeType === 1) as (XmlNode & { localName: string; getAttribute(name: string): string | null })[]
    const text = (name: string) => children.find(node => node.localName === name)?.textContent?.trim() || ''
    const publisher = text('source')
    const source: Source = feed.source === 'Yahoo Finance' && publisher === 'Reuters' ? 'Reuters' : feed.source
    if (feed.source === 'Yahoo Finance' && publisher !== 'Reuters' && !/^Yahoo(?: Finance| Personal Finance)?(?: (?:UK|Australia|Canada))?$/i.test(publisher)) return []
    const title = text('title').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 280)
    const link = children.find(node => node.localName === 'link' && (!node.getAttribute('rel') || node.getAttribute('rel') === 'alternate'))
    const href = link?.getAttribute('href') || link?.textContent?.trim()
    if (!title || !href) return []
    try {
      const url = new URL(href)
      if (url.protocol !== 'https:' || !feed.articleHosts.includes(url.hostname) || url.username || url.password || (url.port && url.port !== '443')) return []
      url.hash = ''
      for (const key of [...url.searchParams.keys()]) if (/^utm_/i.test(key)) url.searchParams.delete(key)
      const rawDate = text('pubDate') || text('published') || text('updated')
      const date = rawDate ? new Date(rawDate) : null
      return [{ id: createHash('sha256').update(url.href).digest('hex').slice(0, 20), title, url: url.href, source, publishedAt: date && Number.isFinite(date.getTime()) ? date.toISOString() : null, ...headlineImpact(title) }]
    } catch { return [] }
  })
}

async function fetchFeed(feed: Feed, fetcher: typeof fetch) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    let url = feed.url
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetcher(url, { signal: controller.signal, redirect: 'manual', headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml', 'User-Agent': 'LocalNewsroom/1.0' } })
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location')
        await response.body?.cancel()
        if (!location) throw new Error('Unavailable')
        const target = new URL(location, url)
        // Only fixed, verified feed endpoints may be followed, never feed-supplied arbitrary destinations.
        if (!feeds.some(candidate => candidate.source === feed.source && candidate.url === target.href)) throw new Error('Unavailable')
        url = target.href
        continue
      }
      if (!response.ok || !response.body || Number(response.headers.get('content-length') || 0) > maxFeedBytes) { await response.body?.cancel(); throw new Error('Unavailable') }
      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let bytes = 0
      try {
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          bytes += value.byteLength
          if (bytes > maxFeedBytes) throw new Error('Unavailable')
          chunks.push(value)
        }
      } finally { await reader.cancel() }
      const articles = parseFeed(Buffer.concat(chunks).toString('utf8'), feed)
      if (!articles.length) throw new Error('Unavailable')
      return articles
    }
    throw new Error('Unavailable')
  } finally { clearTimeout(timer) }
}

export function createNewsroom(fetcher: typeof fetch = fetch) {
  let cache: { articles: Article[]; updatedAt: string; unavailableSources: Source[] } | undefined
  let pending: Promise<NonNullable<typeof cache>> | undefined
  return async () => {
    if (cache && Date.now() - Date.parse(cache.updatedAt) < cacheMs) return cache
    if (!pending) pending = (async () => {
      const results = await Promise.allSettled(feeds.map(feed => fetchFeed(feed, fetcher)))
      const articles: Article[] = []
      const unavailableSources: Source[] = []
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') articles.push(...result.value)
        else unavailableSources.push(feeds[index].source)
      })
      if (!articles.some(article => article.source === 'Reuters')) unavailableSources.push('Reuters')
      const unique = [...new Map(articles.map(article => [article.url, article])).values()]
      unique.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''))
      cache = { articles: unique.slice(0, 60), updatedAt: new Date().toISOString(), unavailableSources }
      return cache
    })().finally(() => { pending = undefined })
    return pending
  }
}

export function newsroom(): Plugin {
  const getNews = createNewsroom()
  return {
    name: 'newsroom', apply: 'serve', enforce: 'pre',
    configureServer(server) { server.middlewares.use((req: IncomingMessage, res: ServerResponse, next) => {
      if (!req.url?.startsWith(endpoint)) { next(); return }
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      const reply = (status: number, body: unknown) => { res.statusCode = status; res.end(JSON.stringify(body)) }
      try {
        const host = req.headers.host
        const origin = new URL(`http://${host || ''}`)
        const site = req.headers['sec-fetch-site']
        if (!/^(?:::1|(?:::ffff:)?127\.\d+\.\d+\.\d+)$/.test(req.socket.remoteAddress || '') || !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname) || (origin.port || '80') !== String(req.socket.localPort || 80) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash || (site && site !== 'none' && site !== 'same-origin') || (req.headers.origin && req.headers.origin !== origin.origin)) { reply(403, { error: 'Access denied' }); return }
        if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); reply(405, { error: 'Method not allowed' }); return }
        if (req.url !== endpoint) { reply(404, { error: 'Not found' }); return }
        void getNews().then(news => reply(200, news)).catch(() => reply(503, { error: 'News unavailable' }))
      } catch { reply(403, { error: 'Access denied' }) }
    }) },
  }
}
