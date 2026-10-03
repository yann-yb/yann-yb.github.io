import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { getSupabase } from '../lib/supabase'

type Authorization = 'signed-out' | 'checking' | 'authenticated' | 'denied' | 'error'
type SendCodeResult = 'sent' | 'not-allowed' | 'rate-limited' | 'error'

interface AuthState {
  user: User | null
  loading: boolean
  isConfigured: boolean
  devPreview: boolean
  isDevPreviewMode: boolean
  authorization: Authorization
  isAuthenticated: boolean
  refreshAuthorization: () => void
  signInWithEmail: (email: string) => Promise<SendCodeResult>
  verifyCode: (email: string, code: string) => Promise<boolean>
  signOut: () => Promise<boolean>
}
const AuthContext = createContext<AuthState | null>(null)

function isValidEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [devPreview, setDevPreview] = useState(false)
  const [isDevPreviewMode, setDevPreviewMode] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const user = session?.user ?? null
  const token = session?.access_token
  const [validation, setValidation] = useState<{ token: string; state: Authorization } | null>(null)
  const [validationRevision, setValidationRevision] = useState(0)
  const authorization: Authorization = !user ? 'signed-out' : validation && validation.token === token ? validation.state : 'checking'
  const [loading, setLoading] = useState(true)
  const [isConfigured, setConfigured] = useState(false)
  useEffect(() => {
    const localPreview = import.meta.env.DEV && ['localhost', '127.0.0.1', '::1', '[::1]'].includes(window.location.hostname)
    if (localPreview) {
      setDevPreviewMode(true); setConfigured(true)
      try { setDevPreview(localStorage.getItem('dashboard-dev-preview') === '1') } catch { /* Preview still works for this visit. */ }
      setLoading(false)
      return
    }
    const client = getSupabase()
    setConfigured(!!client)
    if (!client) { setLoading(false); return }
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!token) { setValidation(null); return }
    const client = getSupabase()
    if (!client) { setValidation(null); return }
    let cancelled = false
    setValidation(null)
    void client.auth.getUser(token).then(({ data, error }) => {
      if (cancelled) return
      setValidation({ token, state: !error && data.user?.email_confirmed_at ? 'authenticated' : error?.status === 401 || error?.status === 403 || (!error && !data.user?.email_confirmed_at) ? 'denied' : 'error' })
    }).catch(() => {
      if (!cancelled) setValidation({ token, state: 'error' })
    })
    return () => { cancelled = true }
  }, [token, validationRevision])
  function refreshAuthorization() {
    setValidation(null)
    setValidationRevision(value => value + 1)
  }
  async function signInWithEmail(email: string): Promise<SendCodeResult> {
    if (isDevPreviewMode) return email === 'dev' ? 'sent' : 'not-allowed'
    if (!isValidEmail(email)) return 'not-allowed'
    const client = getSupabase()
    if (!client) return 'error'
    try {
      const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
      if (!error) return 'sent'
      if (error.code === 'otp_disabled' && error.message === 'Signups not allowed for otp') return 'not-allowed'
      if (error.status === 429) return 'rate-limited'
      return 'error'
    } catch { return 'error' }
  }
  async function verifyCode(email: string, code: string) {
    if (isDevPreviewMode) {
      if (email !== 'dev' || code !== 'dev') return false
      setDevPreview(true)
      try { localStorage.setItem('dashboard-dev-preview', '1') } catch { /* Preview still works for this visit. */ }
      return true
    }
    if (!isValidEmail(email)) return false
    const client = getSupabase()
    if (!client) return false
    try {
      const { data, error } = await client.auth.verifyOtp({ email, token: code, type: 'email' })
      return !error && !!data.session
    } catch { return false }
  }
  async function signOut() {
    if (isDevPreviewMode) {
      setDevPreview(false)
      try { localStorage.removeItem('dashboard-dev-preview') } catch { /* Clear in-memory access even when storage is unavailable. */ }
      return true
    }
    const client = getSupabase()
    if (!client) return false
    try {
      const { error } = await client.auth.signOut({ scope: 'local' })
      return !error
    } catch { return false }
  }
  return <AuthContext.Provider value={{ user, loading, isConfigured, devPreview, isDevPreviewMode, authorization, isAuthenticated: authorization === 'authenticated', refreshAuthorization, signInWithEmail, verifyCode, signOut }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('AuthProvider is required')
  return auth
}
