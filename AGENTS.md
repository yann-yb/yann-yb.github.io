# Dashboard tile rules

Apply these rules when adding or changing dashboard tiles.

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

## UI copy and login

- Keep backend settings and implementation details out of user-facing UI, including allowlist contents or status, provider configuration, and server setup. Keep these details in repository rules or developer documentation.
- The email allowlist is currently empty. Login is UI-only and Send code stays disabled; do not add a server, send email, or simulate successful authentication unless requested.
- When real login is implemented, send codes only to explicitly allowed email addresses. Do not expose the allowlist in the browser.

## Public-site privacy

- Keep the site public, with `public/robots.txt` disallowing compliant crawlers and a global `noindex, nofollow` robots meta tag. These are crawler requests, not access control; public HTML, assets, and repository contents remain readable.
- Do not imply that the login popup protects published content or that crawler directives guarantee privacy or remove existing search results.
