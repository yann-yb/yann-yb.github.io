import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import Markdown from 'react-markdown'
import { posts } from 'virtual:personal-content'

export const Route = createFileRoute('/posts/$slug')({
  loader: ({ params }) => {
    const post = posts.find(post => post.slug === params.slug)
    if (!post) throw notFound()
    return post
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.title || 'Writing'}` }] }),
  component: Post,
})
function Post() {
  const post = Route.useLoaderData()
  return <main className="article"><Link className="back-link" to="/writing">← Writing</Link><div className="eyebrow">{post.date}</div><h1>{post.title}</h1><div className="prose"><Markdown>{post.content}</Markdown></div></main>
}
