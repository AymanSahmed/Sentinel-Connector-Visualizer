import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { INS_METHODS } from '@/engine/pipeline.js'
import { SEVERITY_STYLE, TONE_CLASS, confidenceTone, type Tone } from '@/lib/format'

export function ToneBadge({ tone = 'neutral', className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <Badge variant="outline" className={cn('rounded-full border-0 px-2.5 font-medium ring-1 ring-inset', TONE_CLASS[tone], className)}>
      {children}
    </Badge>
  )
}

/** Solid pill in the collection method's own colour (CCF Pull, Azure Function, ...). */
export function MethodBadge({ method, className }: { method: string; className?: string }) {
  const info = INS_METHODS[method] ?? INS_METHODS.unknown
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full py-0.5 pr-3 pl-1 text-xs font-bold whitespace-nowrap text-white', className)}
      style={{ backgroundColor: info.color }}
    >
      <span className="grid size-5 place-items-center rounded-full bg-white/25 text-[11px]">{info.icon}</span>
      {info.label}
    </span>
  )
}

export function SeverityPill({ severity }: { severity: string }) {
  return (
    <Badge variant="outline" className={cn('rounded-full border-0 px-2.5 font-semibold ring-1 ring-inset', SEVERITY_STYLE[severity] ?? SEVERITY_STYLE.Unknown)}>
      {severity}
    </Badge>
  )
}

export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100)
  const tone = confidenceTone(confidence)
  return (
    <ToneBadge tone={tone}>
      {tone === 'danger' ? '⚠ Low confidence' : 'Confidence'} {pct}%
    </ToneBadge>
  )
}

export function Dot({ color }: { color: string }) {
  return <span className="inline-block size-2 rounded-full" style={{ backgroundColor: color }} />
}
