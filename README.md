# Yann’s personal dashboard

React + TypeScript + TanStack Start, with prerendered pages for GitHub Pages.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. For production: `npm run build`, then `npm run check`.
The static website is emitted to `dist/client`.

## Content

- Edit the single-page biography in `content/about/_index.md`.
- Edit the Memo test page in `content/memo/_index.md`. The viewer has a note index and linked reading panes. `##` headings define notes; links such as `[Linked note](#linked-note)` open a pane to the right. Backlinks are automatic, and the URL preserves open panes for sharing and reloads.
- Add Markdown posts in `content/posts/` with `title`, `date`, and `draft` frontmatter. Posts with `draft: true` stay unpublished. Published post links are crawled during prerendering, including their individual pages.
- Dashboard copy and cards live in `src/routes/index.tsx`.
- The four analog clocks show fixed EST (UTC−5), fixed PDT (UTC−7), UTC, and CST / China Standard Time (UTC+8), with dates for each zone.
- Theme preference is stored only in that browser. Disabled storage falls back to the current visit.

## Deployment

`.github/workflows/pages.yaml` builds and deploys on pushes to `master`. The repository’s Pages source must be GitHub Actions. No backend is required for this version. Server functions or private API integrations need a runtime host instead of GitHub Pages.

Existing Hugo configuration and theme are retained for reference; the dashboard build does not use them.

## Emoji mini app

Open `/emoji` for the searchable Emojibase catalog, including skin-tone variants, GitHub shortcodes (Emojibase fallback), and classic emoticons where defined. Copy buttons use the clipboard. Text shortcuts only convert in apps that support them. The dataset is bundled locally; the app does not need a remote API.

Emoji artwork is vendored from [Blobmoji](https://github.com/C1710/blobmoji) under Apache 2.0. Source revision, license, and contributors are in `public/emoji/blobmoji/`. Unsupported artwork falls back to native emoji; copying always uses Unicode text.

## Login popup

The top-right Login button opens an email-code dialog. This is UI only: the allowlist is currently empty, Send code is disabled, and no email or authentication requests are made.
