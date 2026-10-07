import { Smile } from 'lucide-react'
import { EmojiArtwork } from '../components/EmojiArtwork'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import data from 'emojibase-data/en/data.json'
import github from 'emojibase-data/en/shortcodes/github.json'
import emojibase from 'emojibase-data/en/shortcodes/emojibase.json'
import messages from 'emojibase-data/en/messages.json'

const emojis = data.flatMap(emoji => [emoji, ...(emoji.skins || [])])
  .sort((a, b) => a.label.localeCompare(b.label) || a.hexcode.localeCompare(b.hexcode))
  .map(emoji => {
    const githubCodes = github[emoji.hexcode]
    const codes = githubCodes || emojibase[emoji.hexcode] || []
    const shortcuts = (Array.isArray(codes) ? codes : [codes]).map(code => `:${code}:`)
    const emoticons = emoji.emoticon ? (Array.isArray(emoji.emoticon) ? emoji.emoticon : [emoji.emoticon]) : []
    const unicode = emoji.hexcode.split('-').map(code => `U+${code}`).join(' ')
    return {
      id: emoji.hexcode,
      glyph: emoji.emoji,
      label: emoji.label,
      group: emoji.group ?? -1,
      unicode,
      shortcuts,
      provider: githubCodes ? 'GitHub' : 'Emojibase',
      emoticons,
      search: [emoji.label, emoji.emoji, unicode, ...(emoji.tags || []), ...shortcuts, ...emoticons].join(' ').toLowerCase(),
    }
  })

const commonEmoji = ['😀', '😃', '😄', '😁', '😂', '🤣', '😊', '🙂', '😉', '😍', '🥰', '😘', '😎', '🤔', '😢', '😭', '😡', '😱', '🙏', '👍', '👎', '👏', '❤️', '💔', '💯', '🔥', '🎉', '✨', '⭐', '🚀', '✅', '❌', '🐶', '🐱', '🍕', '☕']
const commonRank = new Map(commonEmoji.map((glyph, index) => [glyph, index]))

export const Route = createFileRoute('/emoji')({
  head: () => ({ meta: [{ title: 'Emoji' }] }),
  component: EmojiBrowser,
})

function EmojiBrowser() {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('all')
  const [limit, setLimit] = useState(96)
  const [notice, setNotice] = useState('')
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    const results = emojis.filter(emoji => (group === 'all' || emoji.group === Number(group)) && (!term || emoji.search.includes(term)))
    if (group !== 'all') return results
    return results.sort((a, b) => (commonRank.get(a.glyph) ?? Infinity) - (commonRank.get(b.glyph) ?? Infinity) || a.label.localeCompare(b.label) || a.id.localeCompare(b.id))
  }, [query, group])
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setNotice(`Copied ${value}`)
    } catch {
      setNotice('Copy unavailable. Select the text to copy it manually.')
    }
  }
  return <main className="emoji-app">
    <div className="emoji-app-heading"><h1><Smile size={18} /> Emoji</h1><span>{emojis.length.toLocaleString('en-US')} emoji & variants</span></div>
    <p className="emoji-help">Click to copy. Shortcuts such as <code>:smile:</code> or <code>:)</code> depend on the app you paste into.</p>
    <div className="emoji-toolbar">
      <label className="sr-only" htmlFor="emoji-search">Search emoji</label>
      <input id="emoji-search" type="search" value={query} onChange={e => { setQuery(e.target.value); setLimit(96) }} placeholder="Search an emoji, name, or shortcut…" />
      <label className="sr-only" htmlFor="emoji-category">Category</label>
      <select id="emoji-category" value={group} onChange={e => { setGroup(e.target.value); setLimit(96) }}>
        <option value="all">All categories</option>
        {messages.groups.map(category => <option key={category.key} value={category.order}>{category.message}</option>)}
        <option value="-1">Other components</option>
      </select>
    </div>
    <div className="emoji-results"><span>{filtered.length.toLocaleString('en-US')} results</span><span role="status" aria-live="polite">{notice}</span></div>
    <div className="emoji-grid">
      {filtered.slice(0, limit).map(emoji => <section className="emoji-entry" key={emoji.id}>
        <div className="emoji-entry-heading"><button className="emoji-glyph emoji-icon" onClick={() => copy(emoji.glyph)} aria-label={`Copy ${emoji.label} emoji`}><EmojiArtwork glyph={emoji.glyph} /></button><h2>{emoji.label}</h2></div>
        <div className="emoji-shortcuts">
          <button className="shortcut-button" onClick={() => copy(emoji.unicode)} aria-label={`Copy ${emoji.unicode} Unicode code point`} title="Unicode code point"><code>{emoji.unicode}</code></button>
          {emoji.shortcuts.map(shortcut => <button key={shortcut} className="shortcut-button" onClick={() => copy(shortcut)} aria-label={`Copy ${shortcut} shortcut`} title={`${emoji.provider} shortcode`}><code>{shortcut}</code></button>)}
          {emoji.emoticons.map(emoticon => <button key={emoticon} className="shortcut-button emoticon-button" onClick={() => copy(emoticon)} aria-label={`Copy ${emoticon} emoticon`} title="Classic emoticon"><code>{emoticon}</code></button>)}
          {!emoji.shortcuts.length && !emoji.emoticons.length && <span className="muted">No text shortcut</span>}
        </div>
      </section>)}
    </div>
    {!filtered.length && <p className="emoji-empty">No matches. Try a different name or shortcut.</p>}
    {limit < filtered.length && <button className="emoji-more" onClick={() => setLimit(limit + 96)}>Show more · {Math.min(limit, filtered.length)} of {filtered.length}</button>}
    <p className="emoji-source">Data: <a href="https://emojibase.dev/">Emojibase</a> · Shortcodes use GitHub names where available. Artwork: <a href="https://github.com/C1710/blobmoji">Blobmoji</a>. Uncovered emoji use your device’s emoji font.</p>
  </main>
}
