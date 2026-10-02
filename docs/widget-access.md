# Widget access

`src/lib/widgets.ts` defines the three categories used by the homepage:

| Category | Visibility | Existing widgets |
| --- | --- | --- |
| Public | Everyone | Profile, clocks, experience, emoji, Stars, Memo |
| Private | In production, signed-in users whose backend approval check succeeds | Newsroom |
| Dev | Development runtime only; never production | MyShadow |

In production, a signed-in identity alone does not reveal private tiles: the reusable authorization check must approve the current session. Homepage visibility is presentation, not data security; the private API must authenticate and authorize every request.

Dev means the loopback development runtime, not merely a signed-in account or a public site visited from home. MyShadow still requires its existing loopback API protections to read local files. Static GitHub Pages cannot serve local folders. MyShadow uses a normal anchor and a full document navigation to preserve its strict Content Security Policy.

## Local preview login

On loopback development, signed-out visitors see public and dev tiles. Enter literal `dev` in the email field, click Send code, then enter literal `dev` as the code. No email or authentication network request is sent. Private preview widgets become visible until logout. Wrong values are rejected.

This local preview state is separate from Supabase identity and backend approval: it creates no real user, token or cloud authorization. Production uses real email OTP and never accepts this bypass. MyShadow remains in the dev category and requires no login. The local Newsroom feed is loaded only after preview login; sign-out clears its panels and feed state.
