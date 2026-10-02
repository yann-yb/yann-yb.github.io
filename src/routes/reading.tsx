import { createFileRoute } from '@tanstack/react-router'
import { ReadingRoom } from '../components/ReadingRoom'

export const Route = createFileRoute('/reading')({
  head: () => ({ meta: [{ title: 'Newsroom' }] }),
  component: ReadingRoom,
})
