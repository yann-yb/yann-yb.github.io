# Email-code login setup

The frontend supports Supabase email OTP. Missing configuration leaves login unavailable; there is no simulated session.

1. Create a Supabase project and enable the Email provider.
2. Disable **Allow new users to sign up** in Authentication configuration. Disable anonymous and unused providers. Pre-create only approved users in Authentication > Users; do not send invitations unless intended. The browser passes `shouldCreateUser: false`, but the server setting is what prevents direct API sign-ups.
3. Change the Magic Link email template to include `{{ .Token }}` for a six-digit code instead of a link. Configure a short OTP expiry (for example, five minutes) and retain server-side rate limits. The UI has a 60-second resend cooldown; it is not a security boundary.
4. Configure custom SMTP for dependable delivery. Supabase's default sender is restricted and intended for testing. Keep SMTP credentials in Supabase, never in frontend variables or source files.
5. Copy `.env.example` to ignored `.env.local`, setting the project URL and **publishable** key. Never use a secret key, service-role key, database password, or management token in `VITE_*`. Vite embeds these values in public bundles. Restart the local server after changing them.
6. Before enabling any private content, enable Row Level Security and policies restricted to approved user IDs on every exposed table. Login alone does not protect public files or the current local Newsroom API. Private content must not be bundled into GitHub Pages.

The local development CSP must allow the exact configured HTTPS project origin for connections. Do not use wildcard network permissions, and do not allow that origin on the local MyShadow reader, which must retain its private-data egress restrictions.

Sessions persist using the Supabase SDK in browser local storage (`persistSession: true`, URL session detection disabled), as explicitly requested. Reloads and widget routes on the same origin keep the session. Different domains, subdomains, schemes, or ports do not share browser storage; local development and the public site require separate sign-ins. Do not put article content in local storage. Browser scripts can access these tokens, so a restrictive production CSP and avoiding untrusted HTML remain important. Sign out revokes this session's refresh token; existing access tokens can remain valid until their configured expiration, so use a suitably short JWT lifetime. The account button never displays the configured allowlist. Unknown-user OTP rejections show “User not allowed” without a resend cooldown. Successful sends and server rate-limit responses start the cooldown; other send failures and verification failures use generic UI messages.

Before real use, verify with the approved test account: code delivery, rejection of incorrect/expired/reused codes, blocked sign-up and unknown-email requests, sign-out, and database denial for anonymous/unapproved users. Real-email and live-project tests require explicit authorization; no such tests were run during local implementation.

Official references:
- https://supabase.com/docs/guides/auth/auth-email-passwordless
- https://supabase.com/docs/guides/auth/general-configuration
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/database/postgres/row-level-security

`useAuth()` separates signed-in identity from backend approval. Its `authorization` state is signed-out, checking, approved, denied, or error; `isApproved` becomes true only after the authenticated `GET /functions/v1/newsroom-api/session` returns `{ "authorized": true }`. Widgets must gate private loading on this state, clear data on logout/account change, and still rely on backend authorization on every request. Authorization requests are cancelled on session changes and old responses cannot approve a new session. `refreshAuthorization()` retries a failed check.

For GitHub Pages builds, set repository Actions variables named `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; the workflow passes these public values to Vite. No repository variables or cloud settings were changed by the local implementation.


Loopback development defaults to isolated preview login: enter `dev` then code `dev`. It sends no email or cloud request and does not create a Supabase identity or token. Real persistent Supabase sessions apply to production; a separate same-origin local preview marker restores preview access after reload.

The preview email field defaults to `dev`; the code field remains blank. Production email input starts empty and never shows preview credentials or guidance.
