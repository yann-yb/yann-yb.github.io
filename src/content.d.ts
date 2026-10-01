declare module 'virtual:personal-content' {
  export const about: string
  export const memo: string
  export const posts: { slug: string; title: string; date: string; content: string }[]
}
