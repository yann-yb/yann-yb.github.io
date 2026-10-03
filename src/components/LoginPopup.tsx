import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthProvider'

export function LoginPopup() {
  const { user, devPreview, isDevPreviewMode, loading, isConfigured, signInWithEmail, verifyCode, signOut } = useAuth()
  const signedIn = !!user || devPreview
  const dialog = useRef<HTMLDialogElement>(null)
  const generation = useRef(0)
  const [email, setEmail] = useState('')
  useEffect(() => { if (isDevPreviewMode) setEmail('dev') }, [isDevPreviewMode])
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [resendAt, setResendAt] = useState(0)
  const [now, setNow] = useState(Date.now())
  const remaining = Math.max(0, Math.ceil((resendAt - now) / 1000))
  useEffect(() => {
    if (!resendAt) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [resendAt])
  useEffect(() => () => { generation.current++ }, [])
  function reset() {
    generation.current++
    setEmail(isDevPreviewMode ? 'dev' : ''); setCode(''); setStep('email'); setMessage(''); setBusy(false)
  }
  async function sendCode() {
    if (busy || Date.now() < resendAt) return
    const request = generation.current
    setBusy(true); setMessage('')
    const result = await signInWithEmail(email.trim())
    if (request !== generation.current) return
    setBusy(false)
    setResendAt(!isDevPreviewMode && (result === 'sent' || result === 'rate-limited') ? Date.now() + 60_000 : 0); setNow(Date.now())
    if (result === 'sent') { setStep('code'); setCode(''); setMessage(isDevPreviewMode ? 'Enter dev to open the local preview.' : 'Check your inbox for a sign-in code.') }
    else if (result === 'not-allowed') setMessage('User not allowed.')
    else if (result === 'rate-limited') setMessage('Too many requests. Please try again later.')
    else setMessage('Unable to send a code. Please try again later.')
  }
  async function verify() {
    if (busy) return
    const request = generation.current
    setBusy(true); setMessage('')
    const ok = await verifyCode(email.trim(), code)
    if (request !== generation.current) return
    setBusy(false)
    if (ok) dialog.current?.close()
    else setMessage('Unable to sign in. Check the code or request a new one.')
  }
  async function logout() {
    if (busy) return
    const request = generation.current
    setBusy(true); setMessage('')
    const ok = await signOut()
    if (request !== generation.current) return
    setBusy(false)
    if (ok) dialog.current?.close()
    else setMessage('Unable to sign out. Please try again.')
  }
  return <>
    <button className="login-button" onClick={() => dialog.current?.showModal()}>{signedIn ? 'Account' : 'Login'}</button>
    <dialog className="login-dialog" ref={dialog} aria-labelledby="login-title" aria-describedby="login-description" onClick={event => {
      if (event.target !== event.currentTarget) return
      const bounds = event.currentTarget.getBoundingClientRect()
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) event.currentTarget.close()
    }} onClose={reset}>
      <div className="login-heading"><h2 id="login-title">{signedIn ? 'Account' : 'Login'}</h2><button className="icon-button" type="button" aria-label="Close login" onClick={() => dialog.current?.close()}><X size={18} /></button></div>
      <p id="login-description">{devPreview ? 'Local preview is open.' : signedIn ? 'You are signed in.' : isDevPreviewMode ? 'Use dev for the email and code to preview locally.' : 'Sign in with an email code.'}</p>
      {signedIn ? <button className="login-send" disabled={busy} onClick={logout}>{busy ? 'Signing out…' : 'Sign out'}</button> : loading ? <p role="status">Loading…</p> : !isConfigured ? <p role="status">Login is temporarily unavailable.</p> : <form onSubmit={event => { event.preventDefault(); void (step === 'email' ? sendCode() : verify()) }}>
        {step === 'email' ? <><label htmlFor="login-email">Email address</label><input id="login-email" name="email" type={isDevPreviewMode ? "text" : "email"} autoComplete={isDevPreviewMode ? "off" : "email"} placeholder={isDevPreviewMode ? "dev" : "you@example.com"} autoFocus required value={email} onChange={event => setEmail(event.target.value)} disabled={busy} /></> : <><label htmlFor="login-code">Sign-in code</label><input key="code" id="login-code" name="code" inputMode={isDevPreviewMode ? "text" : "numeric"} autoComplete="one-time-code" pattern={isDevPreviewMode ? undefined : "[0-9]{6}"} maxLength={6} autoFocus required value={code} onChange={event => setCode(isDevPreviewMode ? event.target.value.slice(0, 6) : event.target.value.replace(/\D/g, '').slice(0, 6))} disabled={busy} /></>}
        <button className="login-send" type="submit" disabled={busy || (step === 'email' && remaining > 0)}>{busy ? 'Please wait…' : step === 'code' ? 'Sign in' : remaining > 0 ? `Try again in ${remaining}s` : 'Send code'}</button>
        {step === 'code' && <div className="login-options"><button type="button" disabled={busy || remaining > 0} onClick={sendCode}>{remaining > 0 ? `Resend in ${remaining}s` : 'Resend code'}</button><button type="button" disabled={busy} onClick={() => { setStep('email'); setCode(''); setMessage('') }}>Change email</button></div>}
      </form>}
      {message && <p className="login-status" role="status">{message}</p>}
    </dialog>
  </>
}
