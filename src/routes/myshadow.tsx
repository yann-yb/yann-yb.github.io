import { createFileRoute } from '@tanstack/react-router'
import { MyShadowReader } from '../components/MyShadowReader'

export const Route = createFileRoute('/myshadow')({
  head: () => ({ meta: [{ title: 'MyShadow' }] }),
  component: MyShadowReader,
})
