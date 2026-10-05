import type { ReactNode } from 'react'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'

export interface DetailSection {
  label: string
  value?: ReactNode
}

/**
 * Rich popover used instead of native `title` tooltips: a heading, optional subtitle and labelled sections.
 * Sections without a value are skipped, so callers can pass raw optional data.
 */
export function DetailCard({
  trigger,
  title,
  subtitle,
  accent,
  sections,
  side = 'top',
  asChild = true,
}: {
  trigger: ReactNode
  title: string
  subtitle?: string
  accent?: string
  sections: DetailSection[]
  side?: 'top' | 'right' | 'bottom' | 'left'
  asChild?: boolean
}) {
  const visible = sections.filter((s) => s.value !== undefined && s.value !== null && s.value !== '' && !(Array.isArray(s.value) && !s.value.length))
  return (
    <HoverCard openDelay={150} closeDelay={80}>
      <HoverCardTrigger asChild={asChild}>{trigger as never}</HoverCardTrigger>
      <HoverCardContent side={side} className="w-80 space-y-3 text-sm">
        <div className="flex items-start gap-2">
          {accent && <span className="mt-1 h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: accent }} />}
          <div className="min-w-0">
            <p className="leading-tight font-semibold break-words">{title}</p>
            {subtitle && <p className="text-muted-foreground mt-0.5 text-xs">{subtitle}</p>}
          </div>
        </div>
        {visible.length > 0 && (
          <dl className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1.5 text-xs">
            {visible.map((s) => (
              <div key={s.label} className="contents">
                <dt className="text-muted-foreground font-medium tracking-wide uppercase">{s.label}</dt>
                <dd className="break-words">{s.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </HoverCardContent>
    </HoverCard>
  )
}
