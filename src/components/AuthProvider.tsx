import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { getSupabase } from '../lib/supabase'

type Authorization = 'signed-out' | 'checking' | 'approved' | 'denied' | 'error'
type SendCodeResult = 'sent' | 'not-allowed' | 'rate-limited' | 'error'

interface AuthState {
  user: User | null
  loading: boolean
  isConfigured: boolean
  devPreview: boolean
  isDevPreviewMode: boolean
  authorization: Authorization
  isApproved: boolean
  refreshAuthorization: () => void
  signInWithEmail: (email: string) => Promise<SendCodeResult>
  verifyCode: (email: string, code: string) => Promise<boolean>
  signOut: () => Promise<boolean>
}
const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [devPreview, setDevPreview] = useState(false)
  const [isDevPreviewMode, setDevPreviewMode] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const user = session?.user ?? null
  const token = session?.access_token
  const [approval, setApproval] = useState<{ token: string; state: Authorization } | null>(null)
  const [approvalRevision, setApprovalRevision] = useState(0)
  const authorization: Authorization = !user ? 'signed-out' : approval && approval.token === token ? approval.state : 'checking'
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
    if (!token) { setApproval(null); return }
    const client = getSupabase()
    if (!client) { setApproval(null); return }
    const controller = new AbortController()
    setApproval(null)
    void client.functions.invoke('newsroom-api/session', {
      method: 'GET', headers: { Authorization: `Bearer ${token}` }, signal: controller.signal, timeout: 15_000,
    }).then(({ data, error }) => {
      if (controller.signal.aborted) return
      const status = error?.context instanceof Response ? error.context.status : undefined
      setApproval({ token, state: !error && data?.authorized === true ? 'approved' : status === 401 || status === 403 ? 'denied' : 'error' })
    }).catch(() => {
      if (!controller.signal.aborted) setApproval({ token, state: 'error' })
    })
    return () => controller.abort()
  }, [token, approvalRevision])
  function refreshAuthorization() {
    setApproval(null)
    setApprovalRevision(value => value + 1)
  }
  async function signInWithEmail(email: string): Promise<SendCodeResult> {
    if (isDevPreviewMode) return email === 'dev' ? 'sent' : 'not-allowed'
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
  return <AuthContext.Provider value={{ user, loading, isConfigured, devPreview, isDevPreviewMode, authorization, isApproved: authorization === 'approved', refreshAuthorization, signInWithEmail, verifyCode, signOut }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('AuthProvider is required')
  return auth
}
