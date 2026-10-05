import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Insights, TableInsight } from '@/lib/types'
import { DetailCard } from './detail-card'

const TableIndexContext = createContext<Map<string, TableInsight>>(new Map())

/** Lets every table chip in the report show a rich hover card without prop drilling. */
export function TableIndexProvider({ insights, children }: { insights: Insights; children: ReactNode }) {
  const index = useMemo(() => {
    const m = new Map<string, TableInsight>()
    ;[...insights.tables, ...insights.queriedOnly].forEach((t) => m.set(t.name.toLowerCase(), t))
    return m
  }, [insights])
  return <TableIndexContext.Provider value={index}>{children}</TableIndexContext.Provider>
}

export function TableChip({ name, className }: { name: string; className?: string }) {
  const table = useContext(TableIndexContext).get(name.toLowerCase())
  const custom = /_(CL|CE|CF)$/i.test(name)
  const chip = (
    <Badge variant="outline" className={cn('cursor-default font-mono text-[11px] font-normal', custom && 'border-teal-500/50', className)}>
      {name}
      {custom && <span className="ml-1 text-[9px] font-bold tracking-wide text-teal-600 uppercase dark:text-teal-400">custom</span>}
    </Badge>
  )
  if (!table) return chip
  const usage = [
    table.analytics.length && `${table.analytics.length} analytics`,
    table.hunting.length && `${table.hunting.length} hunting`,
    table.workbooks.length && `${table.workbooks.length} workbooks`,
    table.parsers.length && `${table.parsers.length} parsers`,
  ].filter(Boolean)
  return (
    <DetailCard
      trigger={chip}
      title={table.name}
      subtitle={table.custom ? 'Custom Log Analytics table' : table.producers.length ? 'Built-in table' : 'Queried only — ingested elsewhere'}
      accent={custom ? '#0d9488' : '#64748b'}
      sections={[
        { label: 'Ingested by', value: table.producers.join(', ') },
        { label: 'Schema', value: table.schema ? `${table.schema.columns} columns${table.schema.plan ? ` · ${table.schema.plan}` : ''}` : undefined },
        { label: 'Used by', value: usage.join(' · ') },
      ]}
    />
  )
}

export function TableChips({ names, max = 6 }: { names: string[]; max?: number }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {names.slice(0, max).map((n) => (
        <TableChip key={n} name={n} />
      ))}
      {names.length > max && <span className="text-muted-foreground self-center text-xs">+{names.length - max} more</span>}
    </div>
  )
}
