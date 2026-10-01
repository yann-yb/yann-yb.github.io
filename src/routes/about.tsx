import { createFileRoute } from '@tanstack/react-router'
import Markdown from 'react-markdown'
import { about } from 'virtual:personal-content'

const title = about.match(/^# (.+)$/m)?.[1] || 'About Me'

export const Route = createFileRoute('/about')({
  head: () => ({ meta: [{ title: 'About' }] }),
  component: () => <main className="about-reader">
    <aside className="about-reader-title"><h1>{title}</h1></aside>
    <article className="about-reader-body"><Markdown components={{ h1: () => null }}>{about}</Markdown></article>
  </main>,
})
