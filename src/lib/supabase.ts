import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (typeof window === 'undefined') return null
  if (window.location.pathname === '/myshadow' || window.location.pathname.startsWith('/myshadow/')) return null
  if (import.meta.env.DEV && ['localhost', '127.0.0.1', '::1', '[::1]'].includes(window.location.hostname)) return null
  if (client) return client
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  // Only the browser-safe publishable key belongs in this build.
  if (!url || !key?.startsWith('sb_publishable_')) return null
  try {
    const endpoint = new URL(url)
    if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.pathname !== '/' || endpoint.search || endpoint.hash) return null
    client = createClient(endpoint.origin, key, {
      auth: { persistSession: true, detectSessionInUrl: false, autoRefreshToken: true },
    })
    return client
  } catch { return null }
}
