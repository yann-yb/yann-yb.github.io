import { createFileRoute, Link } from '@tanstack/react-router'
import { posts } from 'virtual:personal-content'

export const Route = createFileRoute('/writing')({
  head: () => ({ meta: [{ title: 'Writing' }] }),
  component: Writing,
})
function Writing() {
  return <main className="article"><Link className="back-link" to="/">← Dashboard</Link><div className="eyebrow">THE NOTEBOOK</div><h1>Writing<span className="brand-dot">.</span></h1><p className="article-lead">Architecture, systems, and things learned along the way.</p>{posts.length ? <div className="writing-list">{posts.map(post => <Link key={post.slug} to="/posts/$slug" params={{ slug: post.slug }}><h2>{post.title}</h2><time>{post.date}</time><span>Read →</span></Link>)}</div> : <div className="empty-page"><span>✳</span><h2>Good things take a little time.</h2><p>This notebook is waiting for its first published entry.</p></div>}</main>
}
