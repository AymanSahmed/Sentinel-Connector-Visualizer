import type { ComponentType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center', className)}>
      <div className="bg-primary/10 text-primary grid size-12 place-items-center rounded-full">
        <Icon className="size-6" />
      </div>
      <div className="space-y-1">
        <p className="font-semibold">{title}</p>
        {description && <p className="text-muted-foreground mx-auto max-w-md text-sm">{description}</p>}
      </div>
      {action}
    </div>
  )
}
