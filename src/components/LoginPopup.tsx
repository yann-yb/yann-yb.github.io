import { X } from 'lucide-react'
import { useRef } from 'react'

export function LoginPopup() {
  const dialog = useRef<HTMLDialogElement>(null)
  return <>
    <button className="login-button" onClick={() => dialog.current?.showModal()}>Login</button>
    <dialog className="login-dialog" ref={dialog} aria-labelledby="login-title" aria-describedby="login-description" onClick={event => { if (event.target === event.currentTarget) dialog.current?.close() }} onClose={() => dialog.current?.querySelector('form')?.reset()}>
      <div className="login-heading"><h2 id="login-title">Login</h2><button className="icon-button" type="button" aria-label="Close login" onClick={() => dialog.current?.close()}><X size={18} /></button></div>
      <p id="login-description">Sign in with an email code.</p>
      <form onSubmit={event => event.preventDefault()}>
        <label htmlFor="login-email">Email address</label>
        <input id="login-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" autoFocus required />
        <button className="login-send" type="submit" disabled>Send code</button>
      </form>
    </dialog>
  </>
}
