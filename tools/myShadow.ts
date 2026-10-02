import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { constants } from 'node:fs'
import { lstat, open, readdir, realpath } from 'node:fs/promises'
import { basename, join, relative, resolve, sep } from 'node:path'
import { createHash } from 'node:crypto'
import { plantUmlBlocks, renderPlantUml } from './local-diagrams.ts'

type Note = { id: string; title: string; path: string; file: string }
const endpoint = '/__local/myshadow'
const contentSecurityPolicy = "default-src 'self'; img-src 'self' blob: data:; connect-src 'self' ws://localhost:* ws://127.0.0.1:*; style-src 'self' 'unsafe-inline'; font-src 'self' data:; script-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'"
const excluded = new Set(['node_modules', 'dist', 'build', 'out', 'coverage', 'vendor', 'target', '__pycache__', 'cache', 'site'])
const maxBytes = 256 * 1024
const loopback = (address = '') => address === '::1' || /^(::ffff:)?127\.\d+\.\d+\.\d+$/.test(address)
const inside = (root: string, file: string) => { const path = relative(root, file); return path !== '..' && !path.startsWith(`..${sep}`) && !path.startsWith(sep) }

async function readMarkdown(root: string, file: string, titleOnly = false) {
  if (!inside(root, await realpath(file)) || (await lstat(file)).isSymbolicLink()) throw new Error('Unavailable')
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const stat = await handle.stat()
    if (!stat.isFile() || stat.size > maxBytes) throw new Error('Unavailable')
    if (!titleOnly) return await handle.readFile('utf8')
    const bytes = Buffer.alloc(Math.min(stat.size, 8192))
    const result = await handle.read(bytes, 0, bytes.length, 0)
    return bytes.subarray(0, result.bytesRead).toString('utf8')
  } finally { await handle.close() }
}

async function indexNotes(root: string) {
  if ((await lstat(root)).isSymbolicLink()) throw new Error('Unavailable')
  const canonicalRoot = await realpath(root)
  const notes: Note[] = []
  let visited = 0
  async function walk(directory: string) {
    const entries = await readdir(directory, { withFileTypes: true })
    entries.sort((a, b) => a.name.localeCompare(b.name))
    for (const entry of entries) {
      if (++visited > 10000 || notes.length >= 1000) return
      if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue
      const file = join(directory, entry.name)
      if (entry.isDirectory()) {
        if (!excluded.has(entry.name) && inside(canonicalRoot, await realpath(file))) {
          try { await walk(file) } catch { /* Skip unavailable directories. */ }
        }
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        try {
          const content = await readMarkdown(canonicalRoot, file, true)
          const path = relative(canonicalRoot, file).split(sep).join('/')
          const id = createHash('sha256').update(path).digest('hex').slice(0, 16)
          const title = content.match(/^#\s+(.+)$/m)?.[1].trim() || basename(path, '.md')
          notes.push({ id, title, path, file })
        } catch { /* Skip unavailable files. */ }
      }
    }
  }
  await walk(canonicalRoot)
  if (new Set(notes.map(note => note.id)).size !== notes.length) throw new Error('Unavailable')
  return { root: canonicalRoot, notes }
}

export async function serveMyShadow(req: IncomingMessage, res: ServerResponse, next: () => void) {
  if (!req.url?.startsWith(endpoint)) { next(); return }
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  function reply(status: number, body: unknown) { res.statusCode = status; res.end(JSON.stringify(body)) }
  try {
    const host = req.headers.host
    if (!host || !loopback(req.socket.remoteAddress)) { reply(403, { error: 'Access denied' }); return }
    const origin = new URL(`http://${host}`)
    const localPort = String(req.socket.localPort || 80)
    const site = req.headers['sec-fetch-site']
    if (!['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname) || (origin.port || '80') !== localPort || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash || (site && site !== 'same-origin' && site !== 'none') || (req.headers.origin && req.headers.origin !== origin.origin)) {
      reply(403, { error: 'Access denied' }); return
    }
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); reply(405, { error: 'Method not allowed' }); return }
    const path = new URL(req.url, origin).pathname
    const route = path.match(/^\/__local\/myshadow\/([a-f0-9]{16})(?:\/diagram\/(0|[1-9]\d{0,2}))?$/)
    const id = route?.[1] || ''
    if (path !== endpoint && !route) { reply(404, { error: 'Not found' }); return }
    const configuredRoot = process.env.MYSHADOW_ROOT?.trim()
    if (!configuredRoot) { reply(503, { error: 'Local notes unavailable' }); return }
    const root = resolve(configuredRoot)
    const index = await indexNotes(root)
    if (!id) { reply(200, { notes: index.notes.map(({ id, title, path }) => ({ id, title, path })) }); return }
    const note = index.notes.find(note => note.id === id)
    if (!note) { reply(404, { error: 'Not found' }); return }
    const content = await readMarkdown(index.root, note.file)
    const diagrams = plantUmlBlocks(content)
    if (route?.[2] !== undefined) {
      const diagram = diagrams[Number(route[2])]
      if (!diagram) { reply(404, { error: 'Not found' }); return }
      try {
        const png = await renderPlantUml(diagram.source)
        res.setHeader('Content-Type', 'image/png')
        res.statusCode = 200; res.end(png)
      } catch { reply(422, { error: 'Diagram unavailable' }) }
      return
    }
    reply(200, { id: note.id, title: note.title, path: note.path, content, diagrams: diagrams.map(({ index, line, language }) => ({ index, line, language })) })
  } catch { reply(503, { error: 'Local notes unavailable' }) }
}

export function myShadow(): Plugin {
  let publicPolicy = contentSecurityPolicy
  return {
    name: 'myShadow',
    enforce: 'pre',
    apply: 'serve',
    config: () => ({ server: {
      host: '127.0.0.1', allowedHosts: ['localhost', '127.0.0.1', '[::1]'], cors: false,
    } }),
    configResolved(config) {
      try {
        const origin = new URL(config.env.VITE_SUPABASE_URL || '')
        if (origin.protocol === 'https:' && !origin.username && !origin.password && origin.pathname === '/' && !origin.search && !origin.hash) {
          publicPolicy = contentSecurityPolicy.replace("connect-src 'self'", `connect-src 'self' ${origin.origin}`)
        }
      } catch { /* Missing or invalid configuration keeps the strict policy. */ }
    },
    configureServer(server) { server.middlewares.use((req, res, next) => {
      const path = new URL(req.url || '/', 'http://localhost').pathname
      const privateReader = path === '/myshadow' || path.startsWith('/myshadow/') || path.startsWith(endpoint)
      res.setHeader('Content-Security-Policy', privateReader ? contentSecurityPolicy : publicPolicy)
      void serveMyShadow(req, res, next)
    }) },
  }
}
