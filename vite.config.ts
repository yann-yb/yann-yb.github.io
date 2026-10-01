import { defineConfig, type Plugin } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import matter from 'gray-matter'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'

// Read Markdown at build time: no filesystem or server calls in the browser.
function contentPlugin(): Plugin {
  return {
    name: 'personal-markdown',
    resolveId(id: string) {
      if (id === 'virtual:personal-content') return '\0' + id
    },
    load(id: string) {
      if (id !== '\0virtual:personal-content') return
      const about = matter(readFileSync(resolve('content/about/_index.md'), 'utf8')).content
      const memo = matter(readFileSync(resolve('content/memo/_index.md'), 'utf8')).content
      const memoIds = ['memo', ...[...memo.matchAll(/^## (.+)$/gm)].map(match => match[1].toLowerCase().replace(/[^a-z0-9]+/g, '-'))]
      const memoHashes = Object.fromEntries(memoIds.map(id => [id, createHash('sha256').update(id).digest('hex').slice(0, 6)]))
      if (new Set(Object.values(memoHashes)).size !== memoIds.length) throw new Error('Memo short IDs must be unique')
      const posts = readdirSync(resolve('content/posts'))
        .filter(name => name.endsWith('.md'))
        .map(name => {
          const { data, content } = matter(readFileSync(resolve('content/posts', name), 'utf8'))
          return {
            slug: name.replace(/\.md$/, ''),
            title: String(data.title || name),
            date: data.date instanceof Date ? data.date.toISOString().slice(0, 10) : String(data.date || ''),
            draft: data.draft === true,
            content,
          }
        })
        .filter(post => !post.draft)
        .sort((a, b) => b.date.localeCompare(a.date))
      return `export const about = ${JSON.stringify(about)}; export const memo = ${JSON.stringify(memo)}; export const memoHashes = ${JSON.stringify(memoHashes)}; export const posts = ${JSON.stringify(posts)};`
    },
    handleHotUpdate(ctx) {
      if (!ctx.file.includes('/content/') || !ctx.file.endsWith('.md')) return
      const module = ctx.server.moduleGraph.getModuleById('\0virtual:personal-content')
      if (module) ctx.server.moduleGraph.invalidateModule(module)
      ctx.server.ws.send({ type: 'full-reload' })
    },
  }
}

export default defineConfig({
  plugins: [
    contentPlugin(),
    tanstackStart({ prerender: { enabled: true, crawlLinks: true, failOnError: true } }),
    react(),
  ],
})
