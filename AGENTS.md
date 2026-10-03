# Dashboard tile rules

Apply these rules when adding or changing dashboard tiles.

## Widget access categories

- Maintain a shared widget catalog with `public`, `private`, and `dev` access categories.
- Existing profile, clocks, Experience, Emoji, Stars, and Memo are public and remain visible regardless of login.
- Newsroom is private. On the deployed site, its tile and data require verified Supabase login. Hiding a tile alone is not security.
- MyShadow is dev: show it only with the loopback development runtime. It does not require login. Never expose or upload local notes through the public website.
- Loopback development initially shows public and dev widgets. Its local-only preview login accepts `dev` as the email-field value and `dev` as the code; Send code only advances the form and sends no email or cloud request. A successful preview login reveals private widget previews. Logout clears preview data.
- Development preview authentication must be explicitly distinct from real Supabase authorization. Never issue a fake cloud token, fetch private backend data using preview credentials, or include the preview bypass in production behavior. Require both a development build and loopback host. Direct private-preview routes must enforce the preview session too.

## Sizes

- Only two tile sizes are allowed: **S** and **M**.
- **S** uses `card tile-s`: one square, based on the Yihan Bao tile.
- **M** uses `card tile-m`: two S columns wide and one S square high. Its width includes the grid gap between the two columns.
- Use the existing `.dashboard-grid` and `--tile-size` styles. Do not introduce custom tile widths, heights, or extra size variants.
- On phones, show two S tiles per row. S remains square; M spans both columns and keeps the same height as S. Its width includes the gap between the two squares.
- Keep content inside the tile at every breakpoint. Adjust content spacing rather than stretching the tile.

## Navigation

- If a tile opens another page, the **entire tile must be clickable**, including its empty space.
- For internal routes, use a TanStack Router `Link` as the tile element, with `card`, the size class, and `clickable-card`.
- For an external destination, use an `<a>` with the same classes.
- Give the link a clear accessible name and preserve keyboard activation and visible focus.
- Do not add separate footer text links such as “Browse emoji” or “Full background”.
- Do not nest links or buttons inside a linked tile. Tiles with multiple independent destinations, such as Stars or social icons, should keep separate clickable links for those destinations.
- Tiles without a destination remain non-clickable; do not invent a route.

Example:

```tsx
<Link to="/memo" className="card tile-s clickable-card" aria-label="Memo">
  <div className="card-label">Memo</div>
</Link>
```

Verify S/M dimensions, content fit on desktop and mobile, and whole-tile mouse and keyboard navigation after UI changes. Run `npm run check` and `npm run build` for code changes.

## Panel layouts

Use these named navigation contracts when implementing or changing panel views. Keep Memo and News behavior distinct.

### Memo layout

- Selecting a note from the index replaces the current note chain and starts from that note; successive index selections must not accumulate panels.
- Only opening a note link inside an existing note expands the chain to the right.
- Reopening a note already in the chain focuses its existing panel instead of creating a duplicate.

### News layout

- Keep the original news list and its scroll position available while reading analyses.
- Selecting a new headline adds its analysis to the right of the existing stack, inside Newsroom. It does not replace earlier analyses or open a new browser tab.
- Allow any number of distinct analysis panels, with no fixed panel-count limit. Keep each open until the user closes it with X or marks that story read; opening another story must not close existing panels.
- Selecting the root-list navigation control focuses the main news list at its preserved scroll position. It must not reset the stack or close any analysis panels. Clicking a headline within the list follows the open-or-focus rule.
- Duplicate analysis panels are not allowed anywhere in the stack. Identify stories by their stable article ID. Selecting a story already open anywhere in the stack, including a collapsed panel, navigates to and focuses that existing panel, expanding it if needed. Preserve the stack order and all other open panels; do not append a duplicate.
- On larger screens, use the Memo visual style and subtle slide animation. Show at most three full analysis panels simultaneously (in addition to the news list), fewer when available width requires it. Keep additional open analyses as clickable collapsed rails; collapsing is not closing. The selected analysis must be expanded.
- Put the original article link at the top of each analysis. Keep the analysis concise: what happened, why it matters, opposing signals or missing evidence, and what to watch next. Explain mixed signals rather than showing only an unclear label.
- Use an unread-inbox model: clicking the read checkbox inside a story’s analysis panel marks it read and immediately removes it from the unread list. Preserve its read status so refreshing does not bring it back; do not delete the stored article. Opening an analysis does not mark it read. Marking a story read closes its matching analysis panel and leaves other panels open. X closes a panel without marking it read. Do not show read checkboxes in list rows.

- Remove checked stories from the browser’s unread-feed state, not only from rendered rows. Filter known read IDs out of refresh responses before storing them in client state, including responses arriving after a checkbox click. Persist only read IDs locally, not article content. Marking a story read must also release its matching open analysis from panel state.

### Phone behavior

- Preserve the existing phone navigation: one full-width panel at a time, with a way back to the list at its previous scroll position. Do not introduce side-by-side desktop panels on phones.
- For News, keep all unclosed analyses in the stack while showing one at a time. Switching between analysis panels or returning to the main list must not close any analyses.

## UI copy and login

- Keep backend settings and implementation details out of user-facing UI, including allowlist contents or status, provider configuration, and server setup. Keep these details in repository rules or developer documentation.
- Real Supabase email-code login is authorized. Disable automatic account creation, restrict hosted sign-ups, and verify Supabase users on the backend. Keep real email addresses and server credentials out of Git. Do not send real email or modify cloud settings without authorization.
- When real login is implemented, send codes only to explicitly allowed email addresses. Do not expose the allowlist in the browser.

## Public-site privacy

- Keep the site public, with `public/robots.txt` disallowing compliant crawlers and a global `noindex, nofollow` robots meta tag. These are crawler requests, not access control; public HTML, assets, and repository contents remain readable.
- Do not imply that the login popup protects published content or that crawler directives guarantee privacy or remove existing search results.

## Local MyShadow reader

- MyShadow is read in place only by the loopback Vite development middleware. Require a nonempty `MYSHADOW_ROOT` environment variable and resolve it only at request time; never traverse or bundle it during build or publish its contents.
- Serve only bounded Markdown reads (up to 1,000 notes, 256 KiB each), reject symlinks and excluded directories, and enforce loopback Host/socket and same-origin requests. Do not expose absolute paths, raw assets, or exception details.
- Keep note indexes and bodies in runtime memory only: no login, copies, browser persistence, external fetches, or changes to MyShadow files. Production builds must have no local note endpoint or private note data.

Start the local reader with `MYSHADOW_ROOT="/path/to/notes" npm run dev`. No working-directory fallback is permitted; an unset variable leaves the local reader unavailable.

- Render local PlantUML fences only through guarded document-ID/index GET requests, using the installed binary (`PLANTUML_BIN` or `plantuml` on PATH). Use the verified `SANDBOX` profile, block preprocessing/resource loading, and cap source, output, concurrency, and runtime. Return PNG without embedded source metadata; never send diagrams to remote renderers, inject SVG, write render files, or expose process errors.

- The local development server enforces a same-origin Content Security Policy for MyShadow documents, with loopback-only HMR connections and local/blob/data diagram images. Other pages may connect only to the exact configured Supabase HTTPS origin in addition to local resources. Enter and leave MyShadow using full document navigation so its stricter policy applies; do not initialize cloud authentication inside the local reader. Keep this backstop against private-data egress during rendering; public production headers remain separate.

## Private Newsroom

- Production Newsroom requires a persistent same-origin Supabase session with a verified user. Hiding a widget is not access control; every API request and database policy must enforce verified-user access.
- Store private news and read marks in the backend. Clear feed and analysis state on logout or account change, cancel pending requests, and ignore stale responses. Never fall back to local data when cloud authorization fails.
- Newsroom preview requires the local-only development login on loopback. Preview reads public headlines and must never read private local notes or real private cloud data. Production always uses verified real authentication.

## Local Newsroom

- Fetch public headlines only at runtime through the loopback development Newsroom API, using fixed verified Yahoo Finance and SemiAnalysis feed URLs. Attribute Reuters only when explicitly identified by the verified Yahoo feed publisher field; exclude other syndicated publishers. Never accept arbitrary feed URLs, follow unapproved redirects, fetch full articles, or bypass paywalls.
- Keep a bounded five-minute public-headline cache in server memory. No build-time fetches, remote classifiers, document/context uploads, or private-note inputs. Public production builds have no Newsroom backend.
- Stock-impact labels are conservative headline heuristics, not recommendations. Identify tickers only from explicit known company/ticker mentions and keep ambiguous or multi-company impact unclear.
