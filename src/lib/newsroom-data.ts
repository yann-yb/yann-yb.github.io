import { getSupabase } from './supabase'

export type NewsArticle = {
  id: string
  title: string
  url: string
  source: 'Yahoo Finance' | 'Reuters' | 'SemiAnalysis'
  publishedAt: string | null
  impact: 'positive' | 'negative' | 'unclear'
  tickers: string[]
  sector: string
  reason?: string
  analysis?: {
    summary: string
    whyItMatters: string
    risks: string
    watchNext: string
    evidence: 'headline' | 'excerpt' | 'full-text'
  }
}
export type NewsFeed = { articles: NewsArticle[]; updatedAt: string; unavailableSources: string[] }

export type NewsroomAccess = { mode: 'local' } | { mode: 'cloud'; userId: string }
export class NewsroomAccessError extends Error {}

async function cloudRequest(path: string, access: Extract<NewsroomAccess, { mode: 'cloud' }>, method: 'GET' | 'PUT', signal?: AbortSignal) {
  const client = getSupabase()
  if (!client) throw new NewsroomAccessError('Sign in required')
  const { data, error } = await client.auth.getSession()
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  if (error || !data.session || data.session.user.id !== access.userId) throw new NewsroomAccessError('Sign in required')
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '')}/functions/v1/newsroom-api/${path}`, {
    method, signal, cache: 'no-store', credentials: 'omit',
    headers: { Authorization: `Bearer ${data.session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
  })
  if (response.status === 401 || response.status === 403) throw new NewsroomAccessError('Access unavailable')
  if (!response.ok) throw new Error('Newsroom unavailable')
  return response.json()
}

export async function loadNewsroom(access: NewsroomAccess, signal?: AbortSignal): Promise<NewsFeed> {
  if (access.mode === 'cloud') return cloudRequest('articles', access, 'GET', signal)
  if (!import.meta.env.DEV || !['localhost', '127.0.0.1', '::1', '[::1]'].includes(window.location.hostname)) throw new Error('Newsroom unavailable')
  const response = await fetch('/__local/newsroom', { cache: 'no-store', signal })
  if (!response.ok) throw new Error('Newsroom unavailable')
  return response.json() as Promise<NewsFeed>
}

export async function markNewsRead(id: string, access: NewsroomAccess, signal?: AbortSignal): Promise<void> {
  if (access.mode !== 'cloud') throw new Error('Cloud session required')
  const result = await cloudRequest(`articles/${encodeURIComponent(id)}/read`, access, 'PUT', signal)
  if (result?.ok !== true) throw new Error('Read mark unavailable')
}
