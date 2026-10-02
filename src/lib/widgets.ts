export type WidgetAccess = 'public' | 'private' | 'dev'

export const widgets = {
  profile: 'public',
  clocks: 'public',
  experience: 'public',
  emoji: 'public',
  stars: 'public',
  memo: 'public',
  newsroom: 'private',
  myshadow: 'dev',
} as const satisfies Record<string, WidgetAccess>

export function isWidgetVisible(id: keyof typeof widgets, context: { approved: boolean; development: boolean }) {
  const access: WidgetAccess = widgets[id]
  return access === 'public' || (access === 'private' ? context.approved : context.development)
}
